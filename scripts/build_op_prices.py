#!/usr/bin/env python3
"""Build public/op-prices.json — TCGplayer market prices for One Piece cards,
keyed by `{card_set_id}|{variant}` (e.g. "EB02-061|manga", "OP05-060|sp").

Two tiers: tcgcsv's daily TCGplayer dump first; for card products the dump
carries NO price rows for (it happens — Luffy SP EB-02 traded at $2,386 with
an empty dump entry), a PriceCharting gap-fill pass queries each affected
set once and matches by the card number embedded in PC product names
(SP reprints keep their original OP numbers, so numbers disambiguate).

Why: optcgapi (the One Piece card source) carries its own market prices and
they lag badly on fast movers — Monkey.D.Luffy (SP) EB-02 showed $232 there
while trading at $2,386 on TCGplayer. TCGplayer's per-printing prices via
tcgcsv are exact, including SP/Manga/Alt-Art variants.

Variant slug comes from the trailing "(...)" of the product name, letters
only (numeric parens are collector numbers), lowercased, space→dash, with
aliases unified (TCGplayer says "SP", optcgapi says "SPR" — both → "sp").

Same tcgcsv etiquette as the other build scripts: CI-only, custom UA,
100ms between requests, last-updated stamp check.

    python3 scripts/build_op_prices.py
"""

import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

TCGCSV = "https://tcgcsv.com/tcgplayer"
OP_CATEGORY = 68
OUT = Path(__file__).resolve().parent.parent / "public" / "op-prices.json"

HEADERS = {
    "User-Agent": "Rarebox/1.4 (+https://rarebox.io)",
    "Accept": "application/json",
}

VARIANT_ALIASES = {"spr": "sp"}


def fetch(url: str):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode()


def variant_slug(name: str) -> str:
    """'Monkey.D.Luffy (SP)' → 'sp'; '(061)' → '' (collector number).
    Trailing bracket qualifiers are stripped FIRST: promo names like
    'Kuroobi (Online Regional 2023) [Finalist]' must slug to the promo
    variant, never to the empty/base slug — empty-slug promo entries were
    stomping base-card keys with inflated prices (audit 2026-06-12)."""
    n = re.sub(r"(\s*\[[^\]]*\])+\s*$", "", name or "")
    m = re.search(r"\(((?!.*/)[^)]+)\)\s*$", n)
    if not m or not re.search(r"[a-zA-Z]", m.group(1)):
        return ""
    slug = re.sub(r"\s+", "-", m.group(1).strip().lower())
    return VARIANT_ALIASES.get(slug, slug)


def main() -> int:
    stamp = fetch("https://tcgcsv.com/last-updated.txt").strip()
    if OUT.exists():
        try:
            if json.loads(OUT.read_text()).get("stamp") == stamp:
                print(f"up to date ({stamp}), nothing to do")
                return 0
        except (ValueError, OSError):
            pass

    groups = json.loads(fetch(f"{TCGCSV}/{OP_CATEGORY}/groups"))["results"]
    print(f"{len(groups)} One Piece groups")

    prices: dict[str, float] = {}
    price_src: dict[str, tuple] = {}
    gaps: list = []
    for g in groups:
        try:
            prods = json.loads(fetch(f"{TCGCSV}/{OP_CATEGORY}/{g['groupId']}/products"))["results"]
            rows = json.loads(fetch(f"{TCGCSV}/{OP_CATEGORY}/{g['groupId']}/prices"))["results"]
        except Exception as e:  # noqa: BLE001
            print(f"  {g.get('abbreviation') or g['groupId']}: fetch failed ({e}) — skipping", file=sys.stderr)
            continue

        by_pid: dict[int, float] = {}
        for r in rows:
            # marketPrice ONLY — a lone $100k midPrice listing poisoned a key
            # in the first build; gap-fill covers products without market data
            p = r.get("marketPrice")
            if p and p > 0:
                if r["productId"] not in by_pid or p > by_pid[r["productId"]]:
                    by_pid[r["productId"]] = round(p, 2)

        gap_numbers = []
        for p in prods:
            number = next((e["value"] for e in p.get("extendedData", []) if e.get("name") == "Number"), "")
            if not number:
                continue  # sealed
            num_key = number.split("/")[0].strip().upper()
            price = by_pid.get(p["productId"])
            key = f"{num_key}|{variant_slug(p.get('name', ''))}"
            if not price:
                gap_numbers.append((key, num_key))
                continue
            # A card's HOME group (OP03-xxx priced inside the OP-03 group)
            # always wins; among foreign groups (reprints/promo boxes), the
            # higher price wins but can never override the home group.
            abbr_norm = re.sub(r"[^A-Z0-9]", "", (g.get("abbreviation") or "").upper())
            is_home = num_key.split("-")[0].replace("-", "") == abbr_norm
            prev = price_src.get(key)
            if prev is None or (is_home and not prev[1]) or (is_home == prev[1] and price > prev[0]):
                price_src[key] = (price, is_home)
                prices[key] = price
        if gap_numbers:
            gaps.append((g.get("name", ""), gap_numbers))
        time.sleep(0.1)

    # ── gap-fill: PriceCharting, one query per set that has unpriced cards ──
    filled = 0
    for set_name, missing in gaps:
        still = [(k, n) for k, n in missing if k not in prices]
        if not still:
            continue
        try:
            pc = json.loads(fetch("https://www.pricecharting.com/search-products?type=prices&q="
                                  + urllib.parse.quote(f"one piece {set_name}")))
        except Exception:
            continue
        by_num: dict[str, float] = {}
        for p in pc.get("products", []):
            cname = (p.get("consoleName") or "").lower()
            if "one piece" not in cname or "japanese" in cname:
                continue
            m = re.search(r"\b([A-Z]{1,3}\d{2}-\d{3})\b", p.get("productName") or "")
            raw = p.get("price1")
            try:
                val = float(str(raw).replace("$", "").replace(",", ""))
            except (TypeError, ValueError):
                continue
            if m and val > 0:
                n = m.group(1).upper()
                # several printings can share a number — keep the higher
                # (the chase printing is the one with the empty dump entry)
                if n not in by_num or val > by_num[n]:
                    by_num[n] = val
        for key, num_key in still:
            if num_key in by_num and key not in prices:
                prices[key] = by_num[num_key]
                filled += 1
        time.sleep(0.25)
    print(f"gap-filled {filled} prices via PriceCharting")

    OUT.write_text(json.dumps({"stamp": stamp, "prices": prices}, separators=(",", ":")))
    luffy = {k: v for k, v in prices.items() if k.startswith("OP05-060") or k.startswith("EB02-061")}
    print(f"wrote {len(prices)} prices → {OUT} ({OUT.stat().st_size // 1024}KB)")
    print(f"sanity (Luffy): {luffy}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
