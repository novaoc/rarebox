#!/usr/bin/env python3
"""Build public/jp-index.json — a searchable ENGLISH-name index of Japanese
Pokémon cards.

Why it exists: the app's JP card source (tcgdex) carries Japanese names, so
typing "mega charizard ex" can never match a JP card. TCGplayer's "Pokemon
Japan" category (85 on tcgcsv) lists the same cards with ENGLISH product
names — this joins them: tcgcsv group abbreviations ARE tcgdex set ids, and
product Numbers match tcgdex localIds.

Output: {
  "stamp": ...,
  "cards": [[tcgdexSetId, localId, name, price, productId], ...],
  "sets": { tcgdexSetIdLower: { en, logo, scans } }
}
  - tcgdexSetId keeps tcgdex casing (SV8a, M2) so image URLs work
  - name is the cleaned ENGLISH product name ("Mega Charizard X ex")
  - productId → tcgplayer-cdn product image, the fallback for sets tcgdex
    has no scans for (the whole Mega era ships imageless on tcgdex)
  - sets.en = English set name (TCGplayer group), sets.logo = pokellector
    logo URL (matched by name slug), sets.scans = tcgdex has card scans

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


def slugify(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", (s or "").lower())


def jp_en_names() -> dict:
    """The app's community-name table, parsed from the JS source so the
    builder can never drift from it (pokellector uses these exact names)."""
    src = (Path(__file__).resolve().parent.parent / "src" / "services" / "pokemonApi.js").read_text()
    m = re.search(r"export const JP_EN_NAMES = \{(.*?)\n\}", src, re.S)
    out = {}
    if m:
        for k, v in re.findall(r"([A-Za-z0-9]+):\s*'([^']+)'", m.group(1)):
            out[k] = v
    return out


JP_SERIES_PREFIX = [("SV", "SV"), ("SM", "SM"), ("XY", "XY"), ("BW", "BW"), ("DP", "DP"), ("M", "M"), ("S", "S")]


def jp_series(set_id: str) -> str:
    sid = set_id.upper()
    for pref, series in JP_SERIES_PREFIX:
        if sid.startswith(pref):
            return series
    return ""


def cdn_scan_exists(set_id: str) -> bool:
    """HEAD-probe one constructed scan URL — for sets whose tcgdex listing
    is empty but whose scans exist by ID pattern (sv1a and friends)."""
    series = jp_series(set_id)
    if not series:
        return False
    url = f"https://assets.tcgdex.net/ja/{series}/{set_id}/001/low.webp"
    try:
        req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": HEADERS["User-Agent"]})
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.status == 200
    except Exception:  # noqa: BLE001
        return False


def pokellector_logos() -> dict:
    """EN-set-name-slug → logo URL, scraped from the JP sets page."""
    try:
        req = urllib.request.Request("https://jp.pokellector.com/sets",
                                     headers={"User-Agent": "Mozilla/5.0 (Rarebox index builder)"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            html = resp.read().decode("utf-8", "ignore")
    except Exception as e:  # noqa: BLE001
        print(f"pokellector scrape failed ({e}) — logos skipped", file=sys.stderr)
        return {}
    out = {}
    for url in re.findall(r"https://den-media\.pokellector\.com/logos/[^\"]+\.logo\.\d+\.png", html):
        m = re.search(r"/logos/(.+)\.logo\.\d+\.png$", url)
        if m:
            out.setdefault(slugify(m.group(1)), url)
    print(f"pokellector: {len(out)} set logos")
    return out


def tcgdex_has_scans(set_id: str) -> bool:
    """True when tcgdex serves card scans for this set (Mega era doesn't)."""
    try:
        d = json.loads(fetch(f"https://api.tcgdex.net/v2/ja/sets/{set_id}"))
        cards = d.get("cards") or []
        if cards:
            return bool(cards[0].get("image"))
        # empty listing ≠ no scans: sv1a et al list empty but serve scans
        # by the ID pattern — probe one
        return cdn_scan_exists(set_id)
    except Exception:  # noqa: BLE001
        return True  # benign default: tcgdex URL with UI onerror fallback


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

    logos = pokellector_logos()
    en_names = jp_en_names()
    cards = []
    sets_meta = {}
    for g in groups:
        abbr = (g.get("abbreviation") or "").strip()
        set_id = tcgdex_ids.get(abbr.lower())
        if not set_id:
            continue  # group with no tcgdex counterpart
        en_name = re.sub(r"\s*\(.*\)$", "", g.get("name") or "").strip()
        # logo match: community name (the app's table) first, then the
        # tcgcsv group name, then containment fuzz
        community = en_names.get(set_id, "")
        logo = logos.get(slugify(community)) or logos.get(slugify(en_name)) or ""
        if not logo:
            for lslug, lurl in logos.items():
                if lslug and (lslug in slugify(en_name) or slugify(en_name) in lslug):
                    logo = lurl
                    break
        sets_meta[set_id.lower()] = {
            "en": community or en_name,
            "logo": logo,
            "scans": tcgdex_has_scans(set_id),
        }
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
            cards.append([set_id, lid, name, by_pid.get(p["productId"]) or 0, p["productId"]])
        time.sleep(0.1)

    OUT.write_text(json.dumps({"stamp": stamp, "cards": cards, "sets": sets_meta}, separators=(",", ":"), ensure_ascii=False))
    nologo = [k for k, v in sets_meta.items() if not v["logo"]]
    noscan = [k for k, v in sets_meta.items() if not v["scans"]]
    print(f"sets: {len(sets_meta)} | missing logos: {len(nologo)} {nologo[:8]} | tcgdex scanless: {noscan[:10]}")
    print(f"wrote {len(cards)} JP cards → {OUT} ({OUT.stat().st_size // 1024}KB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
