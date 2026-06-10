#!/usr/bin/env python3
"""Build public/jp-prices.json — TCGplayer market prices for Japanese Pokémon
cards, keyed by `{tcgdex_set_id}-{number}` (lowercase, no leading zeros).

tcgdex (the app's JP card source) only carries Cardmarket pricing for the
newest Mega-era sets — every SV-era and older JP set returns no price at all.
TCGplayer's "Pokemon Japan" category (85 on tcgcsv.com) covers them nearly
completely, and its group abbreviations match tcgdex set ids (SV8a, m1L, …)
while product Numbers ("205/187") match tcgdex localIds — an exact join.

Same rules as build_riftbound_prices.py: tcgcsv is backend-only (no CORS,
custom UA, ≤10k req/day, re-sync only when last-updated.txt changes), so this
runs in CI and the app ships the result as a static asset.

    python3 scripts/build_jp_prices.py
"""

import json
import re
import sys
import time
import urllib.request
from pathlib import Path

TCGCSV = "https://tcgcsv.com/tcgplayer"
JP_CATEGORY = 85  # "Pokemon Japan"
OUT = Path(__file__).resolve().parent.parent / "public" / "jp-prices.json"

HEADERS = {
    "User-Agent": "Rarebox/1.4 (+https://rarebox.io)",
    "Accept": "application/json",
}


def fetch(url: str):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode()


def card_key(set_abbr: str, number: str) -> str:
    """'SV8a' + '001/187' → 'sv8a-1'."""
    num = number.split("/")[0].strip().lstrip("0") or "0"
    return f"{set_abbr.lower()}-{num.lower()}"


def main() -> int:
    stamp = fetch("https://tcgcsv.com/last-updated.txt").strip()
    if OUT.exists():
        try:
            if json.loads(OUT.read_text()).get("stamp") == stamp:
                print(f"up to date ({stamp}), nothing to do")
                return 0
        except (ValueError, OSError):
            pass

    groups = json.loads(fetch(f"{TCGCSV}/{JP_CATEGORY}/groups"))["results"]
    print(f"{len(groups)} Pokemon Japan groups")

    prices: dict[str, float] = {}
    for g in groups:
        abbr = (g.get("abbreviation") or "").strip()
        if not abbr:
            continue  # no tcgdex set id to join on
        try:
            prods = json.loads(fetch(f"{TCGCSV}/{JP_CATEGORY}/{g['groupId']}/products"))["results"]
            rows = json.loads(fetch(f"{TCGCSV}/{JP_CATEGORY}/{g['groupId']}/prices"))["results"]
        except Exception as e:
            print(f"  {abbr}: fetch failed ({e}) — skipping", file=sys.stderr)
            continue

        by_pid: dict[int, dict] = {}
        for r in rows:
            cur = by_pid.setdefault(r["productId"], {})
            cur[(r.get("subTypeName") or "Normal").lower()] = r.get("marketPrice") or r.get("midPrice")

        for p in prods:
            number = next((e["value"] for e in p.get("extendedData", []) if e.get("name") == "Number"), "")
            if not number:
                continue  # sealed product, not a card
            # Variant printings ("Budew (Mirror Foil)") share the base card's
            # Number — keep only the base product so the key stays unambiguous.
            if re.search(r"\((?!.*/)[^)]+\)\s*$", p.get("name", "")):
                continue
            sub = by_pid.get(p["productId"], {})
            price = sub.get("normal") or sub.get("holofoil") or next(iter(sub.values()), None)
            if price:
                prices.setdefault(card_key(abbr, number), price)
        time.sleep(0.1)  # tcgcsv asks for ~10 req/s max

    if len(prices) < 5000:  # the category is far bigger — bad pull
        print(f"only {len(prices)} priced cards — refusing to overwrite", file=sys.stderr)
        return 1

    OUT.write_text(json.dumps({"stamp": stamp, "prices": prices}, separators=(",", ":")))
    print(f"wrote {OUT.name}: {len(prices)} priced cards (stamp {stamp})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
