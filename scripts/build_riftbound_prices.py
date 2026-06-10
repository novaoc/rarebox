#!/usr/bin/env python3
"""Build public/riftbound-prices.json — TCGplayer market prices for every
Riftbound card, keyed by TCGplayer product id.

Pulls tcgcsv.com's daily TCGplayer dump (Riftbound = category 89). tcgcsv is
backend-only by policy (no CORS, custom User-Agent required, re-sync only when
last-updated.txt changes) — so this runs as a build/CI script and the app
ships the result as a static asset, same as the scan indexes. riftcodex.com
card objects carry the same `tcgplayer_id`, so the client joins prices
exactly — no fuzzy name/number matching.

Run daily via .github/workflows/riftbound-prices.yml, or manually:

    python3 scripts/build_riftbound_prices.py
"""

import json
import sys
import time
import urllib.request
from pathlib import Path

TCGCSV = "https://tcgcsv.com/tcgplayer"
RIFTBOUND_CATEGORY = 89  # "Riftbound League of Legends Trading Card Game"
OUT = Path(__file__).resolve().parent.parent / "public" / "riftbound-prices.json"

HEADERS = {
    "User-Agent": "Rarebox/1.4 (+https://rarebox.io)",
    "Accept": "application/json",
}


def fetch(url: str):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode()


def main() -> int:
    stamp = fetch("https://tcgcsv.com/last-updated.txt").strip()

    # Skip the sync entirely if the dump hasn't changed since the last build.
    if OUT.exists():
        try:
            if json.loads(OUT.read_text()).get("stamp") == stamp:
                print(f"up to date ({stamp}), nothing to do")
                return 0
        except (ValueError, OSError):
            pass  # unreadable previous file — rebuild

    groups = json.loads(fetch(f"{TCGCSV}/{RIFTBOUND_CATEGORY}/groups"))["results"]
    print(f"{len(groups)} groups: {', '.join(g['name'] for g in groups)}")

    prices: dict[str, dict] = {}
    for g in groups:
        rows = json.loads(fetch(f"{TCGCSV}/{RIFTBOUND_CATEGORY}/{g['groupId']}/prices"))["results"]
        for row in rows:
            pid = str(row.get("productId", ""))
            price = row.get("marketPrice") or row.get("midPrice")
            if not pid or not price:
                continue
            sub = "foil" if (row.get("subTypeName") or "").lower() == "foil" else "normal"
            prices.setdefault(pid, {"normal": None, "foil": None})[sub] = price
        time.sleep(0.1)  # tcgcsv asks for ~10 req/s max

    if len(prices) < 500:  # all sets combined are well past this — bad pull
        print(f"only {len(prices)} priced products — refusing to overwrite", file=sys.stderr)
        return 1

    OUT.write_text(json.dumps({"stamp": stamp, "prices": prices}, separators=(",", ":")))
    print(f"wrote {OUT.name}: {len(prices)} priced products (stamp {stamp})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
