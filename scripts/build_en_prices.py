#!/usr/bin/env python3
"""Build public/en-prices.json — TCGplayer market prices for English Pokémon
cards, keyed by `{pokemontcg_set_id}-{normalized_number}` (lowercase, no
leading zeros: "001/217" → "1", "TG07" → "tg7", "SWSH001" → "swsh1" — the
same normalization as priceHistory.js's normNumber).

Why: since Ascended Heroes (me2pt5, 2026-01-30) api.pokemontcg.io lists new
sets' cards but omits `tcgplayer.prices` entirely (URL only) — verified
2026-07-18 against me2pt5-1 (URL only) vs me1-1 (full prices). Rarebox
single-sourced EN spot prices from that field, so every me2pt5+ card showed
no market price in browse/search/shelf refresh. This asset is a FALLBACK:
the app only uses it where the live payload carries no usable prices.

Group → pokemontcg-set mapping is exact and data-driven (no fuzzy/name
matching, no release-date cutoff), from three maintained sources:
  0. explicit: a small hand-verified tcgcsv groupId → pokemontcg set id map
     (EXPLICIT_GROUPS below) for sets whose tcgcsv abbreviation disagrees
     with pokemontcg's ptcgoCode AND that the history repo has not mapped yet
     — e.g. Mega Brilliant Stars (me5): tcgcsv group 24688 abbreviates ME05
     while pokemontcg's ptcgoCode is PBL, so neither data-driven join fires.
  1. history: rarebox-price-history `maps/groups.json` — the daily-maintained
     tcgcsv groupId → pokemontcg set id map that repo's ingest already uses
     (covers groups whose abbreviation disagrees with ptcgoCode).
  2. live: pokemontcg.io's own set list — its `ptcgoCode` equals tcgcsv's
     group abbreviation for modern sets (ASC → me2pt5, POR → me3,
     CRI → me4, BLK → zsv10pt5, …), normalized uppercase-alphanumeric.
Precedence explicit > history (groupId-exact) > ptcgo; conflicts are logged.
Unmapped groups are skipped and logged — a brand-new set self-heals as soon
as any source maps it, and the explicit map is a stopgap until it does.

One safe market variant per card, picked with the app's getMarketPrice
priority (holofoil → 1st-edition-holo → unlimited-holo → reverse-holo →
normal → 1st-edition-normal, then first available), marketPrice else
midPrice. Variant printings ("Erika's Oddish (Poke Ball)") share the base
card's Number — skipped so keys stay unambiguous (same rule as
build_jp_prices.py). $0 stays 0; unknown stays absent (null).

Same tcgcsv etiquette as the other build scripts: CI-only, custom UA,
100ms between requests, last-updated stamp check.

    python3 scripts/build_en_prices.py
"""

import json
import re
import sys
import time
import urllib.request
from pathlib import Path

TCGCSV = "https://tcgcsv.com/tcgplayer"
EN_CATEGORY = 3  # "Pokemon" (English) on tcgcsv
PKM_SETS = "https://api.pokemontcg.io/v2/sets?select=id,name,ptcgoCode,releaseDate&orderBy=-releaseDate&pageSize=250"
HIST_GROUPS = "https://raw.githubusercontent.com/novaoc/rarebox-price-history/main/maps/groups.json"
OUT = Path(__file__).resolve().parent.parent / "public" / "en-prices.json"

HEADERS = {
    "User-Agent": "Rarebox/1.4 (+https://rarebox.io)",
    "Accept": "application/json",
}

# tcgcsv subTypeName (lowercased) in the app's getMarketPrice priority order
VARIANT_PRIORITY = [
    "holofoil",
    "1st edition holofoil",
    "unlimited holofoil",
    "reverse holofoil",
    "normal",
    "1st edition normal",
]

# Explicit, hand-verified tcgcsv groupId → pokemontcg set id overrides for
# sets neither the history map nor the ptcgoCode join covers. Highest
# precedence. Keep this SMALL and delete entries once an upstream source
# maps the group (the join self-heals). Verified 2026-07-18:
#   24688 "Mega Brilliant Stars" (tcgcsv abbrev ME05) → me5; pokemontcg
#   ptcgoCode is PBL, so the ptcgo join can't match ME05.
EXPLICIT_GROUPS = {"24688": "me5"}

# Known-broken sets the join must cover (CI tripwire, not mapping logic —
# mapping above is fully data-driven / explicit). me5 is covered by the
# explicit override above and is now required coverage.
REQUIRED_SETS = {"me2pt5": 100, "me3": 100, "me4": 100, "me5": 50}
WARN_SETS = {}


def fetch(url: str, timeout: int = 30, retries: int = 2):
    """Small retry with backoff — pokemontcg.io set queries routinely take
    30s+ and transient 5xx/429s should not fail a daily CI run."""
    req = urllib.request.Request(url, headers=HEADERS)
    for attempt in range(retries + 1):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return resp.read().decode()
        except Exception:  # noqa: BLE001
            if attempt >= retries:
                raise
            time.sleep(1.5 * (attempt + 1))


def norm_code(s: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", (s or "").upper())


def norm_number(num: str) -> str:
    """MUST mirror normEnNumber in src/services/tcg/enPrices.js (and
    priceHistory.js's normNumber): '001/217'→'1', 'TG07'→'tg7'."""
    n = str(num or "").split("/")[0].strip().lower()
    n = re.sub(r"^0+(?=[a-z0-9])", "", n)
    m = re.match(r"^([a-z]+)0*(\d.*)$", n)
    if m:
        n = m.group(1) + m.group(2)
    return n


def card_key(set_id: str, number: str) -> str:
    return f"{set_id.lower()}-{norm_number(number)}"


def ptcgo_join(sets: list) -> dict:
    """normalized ptcgoCode → pokemontcg set id (live mapping)."""
    out = {}
    for s in sets:
        code = norm_code(s.get("ptcgoCode"))
        if not code:
            continue
        if code in out and out[code] != s["id"]:
            print(f"  ptcgo collision {code}: {out[code]} vs {s['id']} — keeping {out[code]}",
                  file=sys.stderr)
            continue
        out[code] = s["id"]
    return out


def pick_variant_price(subtypes: dict):
    """One market price per card in getMarketPrice's priority order.
    `is not None` keeps $0 valid; all-None subtypes fall through."""
    for name in VARIANT_PRIORITY:
        v = subtypes.get(name)
        if v is not None:
            return v
    for v in subtypes.values():
        if v is not None:
            return v
    return None


def main() -> int:
    stamp = fetch("https://tcgcsv.com/last-updated.txt").strip()
    if OUT.exists():
        try:
            if json.loads(OUT.read_text()).get("stamp") == stamp:
                print(f"up to date ({stamp}), nothing to do")
                return 0
        except (ValueError, OSError):
            pass

    # ── mapping sources ──
    sets = json.loads(fetch(PKM_SETS, timeout=90, retries=3))["data"]
    by_ptcgo = ptcgo_join(sets)
    try:
        hist = json.loads(fetch(HIST_GROUPS)).get(str(EN_CATEGORY), {}) or {}
    except Exception as e:  # noqa: BLE001
        print(f"history groups.json fetch failed ({e}) — ptcgo join only", file=sys.stderr)
        hist = {}
    print(f"mapping: {len(by_ptcgo)} ptcgo codes, {sum(1 for v in hist.values() if v)} history groups")

    groups = json.loads(fetch(f"{TCGCSV}/{EN_CATEGORY}/groups"))["results"]
    print(f"{len(groups)} English Pokemon groups")

    prices: dict[str, float] = {}
    covered: dict[str, int] = {}
    skipped = []
    for g in sorted(groups, key=lambda g: g["groupId"]):
        gid = str(g["groupId"])
        e_set = EXPLICIT_GROUPS.get(gid)
        h_set = hist.get(gid)
        p_set = by_ptcgo.get(norm_code(g.get("abbreviation")))
        if h_set and p_set and h_set != p_set:
            print(f"  mapping conflict {g.get('name')}: history={h_set} ptcgo={p_set} — using history",
                  file=sys.stderr)
        if e_set and (h_set or p_set) and e_set not in (h_set, p_set):
            print(f"  explicit override {g.get('name')} (group {gid}): {e_set} "
                  f"over history={h_set} ptcgo={p_set}", file=sys.stderr)
        set_id = e_set or h_set or p_set
        if not set_id:
            skipped.append(g.get("abbreviation") or g.get("name") or gid)
            continue
        try:
            prods = json.loads(fetch(f"{TCGCSV}/{EN_CATEGORY}/{gid}/products"))["results"]
            rows = json.loads(fetch(f"{TCGCSV}/{EN_CATEGORY}/{gid}/prices"))["results"]
        except Exception as e:  # noqa: BLE001
            print(f"  {set_id} ({g.get('abbreviation')}): fetch failed ({e}) — skipping", file=sys.stderr)
            continue

        by_pid: dict[int, dict] = {}
        for r in rows:
            p = r.get("marketPrice")
            if p is None:
                p = r.get("midPrice")
            cur = by_pid.setdefault(r["productId"], {})
            cur[(r.get("subTypeName") or "Normal").lower()] = p

        for p in prods:
            number = next((e["value"] for e in p.get("extendedData", []) if e.get("name") == "Number"), "")
            if not number:
                continue  # sealed product, not a card
            # Variant printings ("Erika's Oddish (Poke Ball)") share the base
            # card's Number — keep only the base product so the key stays
            # unambiguous (same rule as build_jp_prices.py).
            if re.search(r"\((?!.*/)[^)]+\)\s*$", p.get("name", "")):
                continue
            price = pick_variant_price(by_pid.get(p["productId"], {}))
            if price is not None and price >= 0:
                key = card_key(set_id, number)
                if key not in prices:
                    prices[key] = round(float(price), 2)
                    covered[set_id] = covered.get(set_id, 0) + 1
        time.sleep(0.1)  # tcgcsv asks for ~10 req/s max

    print(f"{len(covered)} sets joined, {len(prices)} priced cards; "
      f"{len(skipped)} groups unmapped: {', '.join(skipped[:12])}")

    # ── guards: refuse to publish a bad pull ──
    if len(prices) < 10000:  # English category is far bigger — bad pull
        print(f"only {len(prices)} priced cards — refusing to overwrite", file=sys.stderr)
        return 1
    bad = False
    for sid, minimum in REQUIRED_SETS.items():
        n = covered.get(sid, 0)
        if n < minimum:
            print(f"REQUIRED set {sid}: only {n} priced cards (need {minimum}) — mapping broke?",
                  file=sys.stderr)
            bad = True
    if bad:
        return 1
    for sid, minimum in WARN_SETS.items():
        n = covered.get(sid, 0)
        if n < minimum:
            print(f"warning: {sid} not covered yet (upstream group unmapped — self-heals "
                  "once pokemontcg ptcgoCode or rarebox-price-history maps it)", file=sys.stderr)

    OUT.write_text(json.dumps({"stamp": stamp, "prices": prices}, separators=(",", ":")))
    print(f"wrote {OUT.name}: {len(prices)} priced cards "
      f"({OUT.stat().st_size // 1024}KB, stamp {stamp})")
    print("sanity: " + "  ".join(
        f"{sid}={covered.get(sid, 0)}" for sid in ["me2pt5", "me3", "me4", "me5", "me1", "sv8"]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
