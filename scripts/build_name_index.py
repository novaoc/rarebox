#!/usr/bin/env python3
"""Build public/name-index.json — a names-only card index for typo rescue.

Why: live card APIs have no fuzzy matching (pokemontcg.io 400s on Lucene
fuzzy operators), so a typo'd query ("charzard", "blastoyse") returns
nothing unless the user downloaded the offline card DB. This small index
lets the app's own fuzzy matcher (collapsed-substring + DL-1) rescue those
queries for every game. Names + identity only — no prices, no images
(hydrated live after a hit).

Shape: { stamp, cards: [[game, setId, number, name], ...] }
Games: pokemon (EN), one-piece, lorcana, riftbound, yugioh.
(MTG is rescued live via Scryfall's named?fuzzy= endpoint; JP Pokémon
already has jp-index.json.)

    python3 scripts/build_name_index.py
"""

import json
import sys
import time
import urllib.request
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "public" / "name-index.json"
HEADERS = {"User-Agent": "Rarebox/1.4 (+https://rarebox.io)", "Accept": "application/json"}


def fetch(url: str, retries: int = 4):
    last = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=60) as resp:
                return json.loads(resp.read().decode())
        except Exception as e:  # noqa: BLE001 — pokemontcg 500s transiently on deep pages
            last = e
            time.sleep(2.5 * (attempt + 1))
    raise last


def main() -> int:
    cards = []

    # ── Pokémon EN: paginated full catalog, names only ──
    page = 1
    while True:
        d = fetch(f"https://api.pokemontcg.io/v2/cards?page={page}&pageSize=250&orderBy=id&select=id,name,number,set")
        rows = d.get("data") or []
        for c in rows:
            cards.append(["pokemon", c.get("set", {}).get("id", ""), c.get("number", ""), c.get("name", "")])
        print(f"pokemon page {page}: +{len(rows)}", flush=True)
        if len(rows) < 250:
            break
        page += 1
        time.sleep(0.25)

    # ── One Piece: one dump ──
    op = fetch("https://optcgapi.com/api/allSetCards/")
    for c in op:
        cards.append(["one-piece", c.get("set_id", ""), c.get("card_set_id", ""), c.get("card_name", "")])
    print(f"one-piece: +{len(op)}", flush=True)

    # ── Lorcana: per set ──
    sets = fetch("https://api.lorcast.com/v0/sets")
    for s in sets.get("results", sets) or []:
        try:
            d = fetch(f"https://api.lorcast.com/v0/sets/{s['code']}/cards")
        except Exception as e:  # noqa: BLE001
            print(f"lorcana {s.get('code')}: {e}", file=sys.stderr)
            continue
        rows = d if isinstance(d, list) else d.get("results", [])
        for c in rows:
            name = f"{c.get('name', '')} — {c['version']}" if c.get("version") else c.get("name", "")
            cards.append(["lorcana", s["code"], str(c.get("collector_number", "")), name])
        time.sleep(0.2)
    print("lorcana done", flush=True)

    # ── Riftbound: per set ──
    rsets = fetch("https://api.riftcodex.com/sets").get("items", [])
    for s in rsets:
        page = 1
        while page <= 10:
            d = fetch(f"https://api.riftcodex.com/cards?set_id={s['set_id']}&limit=100&page={page}")
            rows = d.get("items", [])
            for c in rows:
                cards.append(["riftbound", s["set_id"], str(c.get("collector_number", "")), c.get("name", "")])
            if len(rows) < 100:
                break
            page += 1
            time.sleep(0.15)
    print("riftbound done", flush=True)

    # ── Yu-Gi-Oh!: full dump, first printing per card ──
    d = fetch("https://db.ygoprodeck.com/api/v7/cardinfo.php")
    for c in d.get("data", []):
        si = (c.get("card_sets") or [{}])[0]
        cards.append(["yugioh", si.get("set_name", ""), si.get("set_code", ""), c.get("name", "")])
    print(f"yugioh: +{len(d.get('data', []))}", flush=True)

    cards = [c for c in cards if c[3]]
    OUT.write_text(json.dumps({"stamp": time.strftime("%Y-%m-%d"), "cards": cards}, separators=(",", ":"), ensure_ascii=False))
    print(f"wrote {len(cards)} names → {OUT} ({OUT.stat().st_size // 1024}KB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
