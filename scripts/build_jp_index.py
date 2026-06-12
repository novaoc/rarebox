#!/usr/bin/env python3
"""Build public/jp-index.json — a searchable ENGLISH-name index of Japanese
Pokémon cards.

Why it exists: the app's JP card source (tcgdex) carries Japanese names, so
typing "mega charizard ex" can never match a JP card. TCGplayer's "Pokemon
Japan" category (85 on tcgcsv) lists the same cards with ENGLISH product
names — this joins them: tcgcsv group abbreviations ARE tcgdex set ids, and
product Numbers match tcgdex localIds.

Output: { "stamp": ..., "cards": [[tcgdexSetId, localId, name, price], ...] }
  - tcgdexSetId keeps tcgdex casing (SV8a, M2a) so image URLs work
  - name is the cleaned product name ("Mega Charizard ex")
  - price = TCGplayer market (same selection as build_jp_prices.py)

Same tcgcsv etiquette as the other build scripts: CI-only, custom UA,
100ms between requests, last-updated stamp check.

    python3 scripts/build_jp_index.py
"""

import json
import re
import sys
import time
import urllib.request
from pathlib import Path

TCGCSV = "https://tcgcsv.com/tcgplayer"
TCGDEX_SETS = "https://api.tcgdex.net/v2/ja/sets"
JP_CATEGORY = 85
OUT = Path(__file__).resolve().parent.parent / "public" / "jp-index.json"

HEADERS = {
    "User-Agent": "Rarebox/1.4 (+https://rarebox.io)",
    "Accept": "application/json",
}


def fetch(url: str):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode()


def clean_name(product_name: str) -> str:
    """'Mega Charizard ex - 215/186' → 'Mega Charizard ex'."""
    n = re.sub(r"\s*-\s*\d+/\d+\s*$", "", product_name or "").strip()
    return n


def local_id(number: str) -> str:
    """'001/187' → '001' (keep zero padding — tcgdex localIds are padded)."""
    return (number or "").split("/")[0].strip()


def main() -> int:
    stamp = fetch("https://tcgcsv.com/last-updated.txt").strip()
    if OUT.exists():
        try:
            if json.loads(OUT.read_text()).get("stamp") == stamp:
                print(f"up to date ({stamp}), nothing to do")
                return 0
        except (ValueError, OSError):
            pass

    # tcgdex set ids with their exact casing, keyed lowercase for the join
    tcgdex_ids = {s["id"].lower(): s["id"] for s in json.loads(fetch(TCGDEX_SETS))}

    groups = json.loads(fetch(f"{TCGCSV}/{JP_CATEGORY}/groups"))["results"]
    print(f"{len(groups)} Pokemon Japan groups")

    cards = []
    for g in groups:
        abbr = (g.get("abbreviation") or "").strip()
        set_id = tcgdex_ids.get(abbr.lower())
        if not set_id:
            continue  # group with no tcgdex counterpart
        try:
            prods = json.loads(fetch(f"{TCGCSV}/{JP_CATEGORY}/{g['groupId']}/products"))["results"]
            rows = json.loads(fetch(f"{TCGCSV}/{JP_CATEGORY}/{g['groupId']}/prices"))["results"]
        except Exception as e:  # noqa: BLE001
            print(f"  {abbr}: fetch failed ({e}) — skipping", file=sys.stderr)
            continue

        by_pid: dict[int, float] = {}
        for r in rows:
            p = r.get("marketPrice") or r.get("midPrice")
            if p and (r["productId"] not in by_pid or (r.get("subTypeName") or "").lower() == "normal"):
                by_pid[r["productId"]] = round(p, 2)

        for p in prods:
            number = next((e["value"] for e in p.get("extendedData", []) if e.get("name") == "Number"), "")
            if not number:
                continue  # sealed
            # variant printings ("(Mirror Foil)") share the base Number — skip
            m = re.search(r"\(((?!.*/)[^)]+)\)\s*$", p.get("name", ""))
            if m and re.search(r"[a-zA-Z]", m.group(1)):
                continue
            name = clean_name(p.get("name", ""))
            lid = local_id(number)
            if not name or not lid:
                continue
            cards.append([set_id, lid, name, by_pid.get(p["productId"]) or 0])
        time.sleep(0.1)

    OUT.write_text(json.dumps({"stamp": stamp, "cards": cards}, separators=(",", ":"), ensure_ascii=False))
    print(f"wrote {len(cards)} JP cards → {OUT} ({OUT.stat().st_size // 1024}KB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
