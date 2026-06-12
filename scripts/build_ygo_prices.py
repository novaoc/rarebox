#!/usr/bin/env python3
"""Build public/ygo-prices.json — TCGplayer market prices for Yu-Gi-Oh!,
keyed `{setSlug}|{SET_CODE}|{raritySlug}` (+ a `{setSlug}|{SET_CODE}` key
when the code has exactly one rarity in that set — the common case).

Why: the 2026-06-12 audit found YGOPRODeck's price fields structurally
unusable — median 68.8% drift vs TCGplayer market, 72.8% of cards >25% off.
`set_price` is a stale low-listing snapshot (Retro Pack BEWD $2,999.98 vs
$114.99 market) and `tcgplayer_price` is the card's CHEAPEST printing
(LOB-001 Blue-Eyes $0.15). TCGplayer market via tcgcsv is the cure.

Request economy (tcgcsv asks ≤10k/day):
- prices: ONE archive download (prices-{today}.ppmd.7z covers everything)
- product metadata (Number/Rarity per productId — changes only when new
  sets release): cached in scripts/data/ygo_products.json, fetched only
  for groups missing from the cache (first run ~1,100 requests, then ~0-2/day)

    python3 scripts/build_ygo_prices.py
"""

import datetime as dt
import json
import re
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

TCGCSV = "https://tcgcsv.com/tcgplayer"
ARCHIVE = "https://tcgcsv.com/archive/tcgplayer"
YGO_CATEGORY = 2
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "ygo-prices.json"
PRODUCTS_CACHE = ROOT / "scripts" / "data" / "ygo_products.json"

HEADERS = {
    "User-Agent": "Rarebox/1.4 (+https://rarebox.io)",
    "Accept": "application/json",
}


def fetch(url: str):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.read()


def slug(s: str) -> str:
    """Must match the app's yugioh set slug (utils + providers)."""
    import unicodedata
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-") or "unknown"


def rarity_slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", (s or "").lower()).strip("-")


def sevenzip() -> str:
    for c in ("7zz", "7z"):
        if shutil.which(c):
            return c
    raise SystemExit("7z not found")


def main() -> int:
    stamp = fetch("https://tcgcsv.com/last-updated.txt").decode().strip()
    if OUT.exists():
        try:
            if json.loads(OUT.read_text()).get("stamp") == stamp:
                print(f"up to date ({stamp}), nothing to do")
                return 0
        except (ValueError, OSError):
            pass

    groups = json.loads(fetch(f"{TCGCSV}/{YGO_CATEGORY}/groups"))["results"]
    print(f"{len(groups)} YGO groups")

    # ── product metadata: cached, incremental ──
    cache = {}
    if PRODUCTS_CACHE.exists():
        try:
            cache = json.loads(PRODUCTS_CACHE.read_text())
        except (ValueError, OSError):
            cache = {}
    todo = [g for g in groups if str(g["groupId"]) not in cache]
    print(f"product metadata: {len(cache)} cached groups, fetching {len(todo)}")
    for g in todo:
        gid = str(g["groupId"])
        try:
            prods = json.loads(fetch(f"{TCGCSV}/{YGO_CATEGORY}/{gid}/products"))["results"]
        except Exception as e:  # noqa: BLE001
            print(f"  group {gid}: {e} — skipping", file=sys.stderr)
            continue
        m = {}
        for p in prods:
            num = rar = ""
            for e in p.get("extendedData", []):
                if e.get("name") == "Number":
                    num = (e.get("value") or "").strip().upper()
                elif e.get("name") == "Rarity":
                    rar = e.get("value") or ""
            if num:
                m[str(p["productId"])] = [num, rar]
        cache[gid] = m
        time.sleep(0.1)
    if todo:
        PRODUCTS_CACHE.parent.mkdir(parents=True, exist_ok=True)
        PRODUCTS_CACHE.write_text(json.dumps(cache, separators=(",", ":")))

    # ── prices: one archive download covers every group ──
    zbin = sevenzip()
    today = dt.date.today()
    by_pid = {}
    with tempfile.TemporaryDirectory() as tmp_s:
        tmp = Path(tmp_s)
        arc = tmp / "a.7z"
        got = None
        for d in (today, today - dt.timedelta(days=1)):
            try:
                arc.write_bytes(fetch(f"{ARCHIVE}/prices-{d.isoformat()}.ppmd.7z"))
                got = d.isoformat()
                break
            except Exception:  # noqa: BLE001
                continue
        if not got:
            raise SystemExit("no price archive available")
        subprocess.run([zbin, "x", "-y", f"-o{tmp}", str(arc)], capture_output=True, check=True)
        cat_dir = tmp / got / str(YGO_CATEGORY)
        for gdir in cat_dir.iterdir():
            try:
                rows = json.loads((gdir / "prices").read_text())["results"]
            except (OSError, ValueError, KeyError):
                continue
            for r in rows:
                p = r.get("marketPrice")
                if p and p > 0:
                    pid = str(r["productId"])
                    if pid not in by_pid or p > by_pid[pid]:
                        by_pid[pid] = round(p, 2)
    print(f"archive {got}: {len(by_pid)} priced products")

    # ── keys ──
    # The APP looks up by YGOPRODeck set names; tcgcsv groups use TCGplayer
    # names ("The Legend of..." vs "Legend of..."). Alias each group slug to
    # the matching YGOPRODeck set slug so both naming worlds resolve.
    try:
        ygo_sets = json.loads(fetch("https://db.ygoprodeck.com/api/v7/cardsets.php"))
        ygo_slugs = {slug(s2.get("set_name") or ""): True for s2 in ygo_sets}
    except Exception:  # noqa: BLE001
        ygo_slugs = {}

    def norm_for_match(sl: str) -> str:
        sl = re.sub(r"^the-", "", sl)
        sl = re.sub(r"-(worldwide-english|1st-edition|unlimited)$", "", sl)
        return sl

    ygo_by_norm = {}
    for ys in ygo_slugs:
        ygo_by_norm.setdefault(norm_for_match(ys), ys)

    def alias_of(gslug: str):
        if gslug in ygo_slugs:
            return None  # identical — no alias needed
        hit = ygo_by_norm.get(norm_for_match(gslug))
        return hit if hit and hit != gslug else None

    gname = {str(g["groupId"]): slug(g["name"]) for g in groups}
    prices = {}
    code_rarities = {}
    for gid, prods in cache.items():
        gslug = gname.get(gid)
        if not gslug:
            continue
        for pid, (num, rar) in prods.items():
            price = by_pid.get(pid)
            if not price:
                continue
            rs = rarity_slug(rar)
            prices[f"{gslug}|{num}|{rs}"] = price
            code_rarities.setdefault(f"{gslug}|{num}", set()).add(rs)
            al = alias_of(gslug)
            if al:
                prices.setdefault(f"{al}|{num}|{rs}", price)
                code_rarities.setdefault(f"{al}|{num}", set()).add(rs)
    # unambiguous code-level keys (single rarity for that code in that set)
    for ck, rs in code_rarities.items():
        if len(rs) == 1:
            prices[ck] = prices[f"{ck}|{next(iter(rs))}"]

    OUT.write_text(json.dumps({"stamp": stamp, "prices": prices}, separators=(",", ":")))
    s1 = prices.get("legend-of-blue-eyes-white-dragon|LOB-001|ultra-rare")
    s2 = prices.get("metal-raiders|MRD-060|ultra-rare") or prices.get("metal-raiders|MRD-060")
    print(f"wrote {len(prices)} keys → {OUT} ({OUT.stat().st_size // 1024}KB)")
    print(f"sanity: LOB-001 Ultra={s1}  MRD-060={s2}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
