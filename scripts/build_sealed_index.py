#!/usr/bin/env python3
"""Build public/sealed-index/{game}.json — every sealed product TCGplayer
knows for the games Rarebox supports, keyed by TCGplayer product id.

Sealed products (booster boxes, ETBs, decks, bundles, cases) have no industry
standard identifier, so listings for the same box go by many names. TCGplayer
product ids are the canonical id Rarebox already joins prices on (see
build_riftbound_prices.py), and tcgcsv carries every product per group —
cards have a Number/Rarity row in extendedData, sealed products never do.
That difference IS the classifier.

Each row: [productId, name, groupName, upc, marketPrice]
  - upc comes from extendedData when TCGplayer has it ("" otherwise) — kept
    so a barcode-scan-to-add feature can join on it later.
  - marketPrice is the Normal-subtype market (or mid) price, 0 when unpriced
    (out-of-print sealed often has no live market row; keep it — vintage
    sealed is exactly what people hunt for).

The app loads these lazily per game for the booth editor's sealed search and
ISO wantlist matching. tcgcsv is backend-only by policy (custom User-Agent,
re-sync only when last-updated.txt changes) — this runs in CI like the other
build_*_prices.py scripts, and the app ships the result as a static asset.

Run daily via .github/workflows/refresh-data.yml, or manually:

    python3 scripts/build_sealed_index.py
"""

import json
import re
import sys
import threading
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

TCGCSV = "https://tcgcsv.com/tcgplayer"
OUT_DIR = Path(__file__).resolve().parent.parent / "public" / "sealed-index"

# App game id → tcgcsv category. pokemon-jp (category 85) stays its own file
# so EN-only sessions never download it; the app merges it into the Pokémon
# lane at load time.
CATEGORIES = {
    "mtg": 1,
    "yugioh": 2,
    "pokemon": 3,
    "one-piece": 68,
    "lorcana": 71,
    "pokemon-jp": 85,
    "riftbound": 89,
}

# Refuse to overwrite a game's index when a pull comes back implausibly small
# (same guard as build_riftbound_prices.py — a bad partial sync must not
# replace a good index).
MIN_ROWS = {
    "mtg": 500, "yugioh": 400, "pokemon": 300, "one-piece": 50,
    "lorcana": 30, "pokemon-jp": 100, "riftbound": 5,
}

# Online-code cards ride in the card categories without a Number row but are
# not sealed product.
NOT_SEALED = re.compile(r"code card", re.I)

HEADERS = {
    "User-Agent": "Rarebox/1.4 (+https://rarebox.io)",
    "Accept": "application/json",
}

# tcgcsv asks for ~10 req/s max — a shared minimum gap between request
# starts holds the whole pool under that no matter the worker count.
_gate = threading.Lock()
_last_start = [0.0]


def fetch(url: str):
    with _gate:
        wait = _last_start[0] + 0.1 - time.monotonic()
        if wait > 0:
            time.sleep(wait)
        _last_start[0] = time.monotonic()
    req = urllib.request.Request(url, headers=HEADERS)
    for attempt in (1, 2, 3):
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.loads(resp.read().decode())
        except Exception:
            if attempt == 3:
                raise
            time.sleep(1.5 * attempt)


def is_card(product) -> bool:
    names = {e.get("name") for e in (product.get("extendedData") or [])}
    return "Number" in names or "Rarity" in names


def upc_of(product) -> str:
    for e in product.get("extendedData") or []:
        if e.get("name") == "UPC":
            return str(e.get("value") or "")
    return ""


def group_rows(category: int, group) -> list:
    gid = group["groupId"]
    products = fetch(f"{TCGCSV}/{category}/{gid}/products")["results"]
    sealed = [p for p in products if not is_card(p) and not NOT_SEALED.search(p.get("name") or "")]
    if not sealed:
        return []
    prices = {}
    for row in fetch(f"{TCGCSV}/{category}/{gid}/prices")["results"]:
        pid = row.get("productId")
        price = row.get("marketPrice") or row.get("midPrice")
        if not pid or not price:
            continue
        # Normal subtype wins; anything beats nothing
        if (row.get("subTypeName") or "").lower() != "foil" or pid not in prices:
            prices[pid] = round(float(price), 2)
    return [
        [p["productId"], p["name"], group["name"], upc_of(p), prices.get(p["productId"], 0)]
        for p in sealed
    ]


def build_game(game: str, category: int, stamp: str, pool: ThreadPoolExecutor) -> bool:
    out = OUT_DIR / f"{game}.json"
    groups = fetch(f"{TCGCSV}/{category}/groups")["results"]
    rows = []
    for chunk in pool.map(lambda g: group_rows(category, g), groups):
        rows.extend(chunk)
    rows.sort(key=lambda r: -r[0])  # newest products first
    if len(rows) < MIN_ROWS[game]:
        print(f"{game}: only {len(rows)} rows — refusing to overwrite", file=sys.stderr)
        return False
    out.write_text(json.dumps({"stamp": stamp, "rows": rows}, separators=(",", ":")))
    print(f"{game}: {len(rows)} sealed products from {len(groups)} groups → {out.name}")
    return True


def main() -> int:
    # last-updated.txt is plain text, not JSON — fetch it raw
    req = urllib.request.Request("https://tcgcsv.com/last-updated.txt", headers=HEADERS)
    with urllib.request.urlopen(req, timeout=30) as resp:
        stamp = resp.read().decode().strip()

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    # Skip everything if no game is stale (mirrors the other build scripts).
    stale = []
    for game in CATEGORIES:
        out = OUT_DIR / f"{game}.json"
        try:
            if json.loads(out.read_text()).get("stamp") == stamp:
                continue
        except (ValueError, OSError):
            pass
        stale.append(game)
    if not stale:
        print(f"up to date ({stamp}), nothing to do")
        return 0

    ok = True
    with ThreadPoolExecutor(max_workers=8) as pool:
        for game in stale:
            try:
                ok = build_game(game, CATEGORIES[game], stamp, pool) and ok
            except Exception as e:
                print(f"{game}: failed — {e}", file=sys.stderr)
                ok = False
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
