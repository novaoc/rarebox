#!/usr/bin/env python3
"""Build public/en-extras.json — English Pokémon cards that exist on
TCGplayer but NOT in pokemontcg.io at all.

Why: pokemontcg.io has no set for several real card groups — verified
2026-08-08: tcgcsv group 24451 "ME: Mega Evolution Promo" (MEP, 107
products incl. the Phantasmal Flames tin Mega Charizard X/Y ex promos)
has no pokemontcg counterpart (api /sets/mep 404s and the canonical
pokemon-tcg-data repo carries no such set). Rarebox single-sources its
EN catalog from pokemontcg.io, so these cards were unsearchable and
untrackable. This asset supplements the catalog from TCGplayer's own
data: names, numbers, market prices, and product ids (product photos).

Being unmapped is NOT enough to qualify — several unmapped groups exist
upstream under a different abbreviation (SM Promos: tcgcsv "SMP" vs
ptcgoCode "PR-SM"), and emitting those would duplicate real cards. So
extras come from EXTRA_GROUPS, a hand-verified allowlist of groups
confirmed ABSENT from pokemon-tcg-data (checked by set-name search,
2026-08-08). Every run logs the remaining unmapped groups as review
candidates; an allowlisted group that becomes mapped upstream fails the
build loudly so the entry gets removed and the real catalog takes over.

Synthetic set ids are prefixed `x-` (x-mep, x-mee, x-g24529) so they
can never collide with a real pokemontcg id.

Output shape (flat rows, like jp-index.json):
  { stamp, sets: { "x-mep": {name, abbrev, released, count} },
    cards: [["x-mep", "029", "Mega Charizard X ex", 4.43, 680639], ...] }

Same tcgcsv etiquette as the sibling builders: CI-only, custom UA,
100ms between requests, last-updated stamp check. Refuses to build when
either mapping source fails — an empty history map would misclassify
two hundred mapped groups as extras.

    python3 scripts/build_en_extras.py
"""

import json
import re
import sys
import time
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_en_prices import (  # noqa: E402
    EN_CATEGORY, EXPLICIT_GROUPS, HEADERS, HIST_GROUPS, PKM_SETS, TCGCSV,
    fetch, norm_code, pick_variant_price, ptcgo_join,
)

# Canonical data behind the API — the API 500s routinely; the repo doesn't.
PKM_SETS_FALLBACK = "https://raw.githubusercontent.com/PokemonTCG/pokemon-tcg-data/master/sets/en.json"

OUT = Path(__file__).resolve().parent.parent / "public" / "en-extras.json"

# Hand-verified: these tcgcsv groups have NO pokemontcg.io set (name-searched
# pokemon-tcg-data sets/en.json, 2026-08-08). Do NOT add a group merely for
# being unmapped — SM Promos (1861) is unmapped yet exists upstream as smp.
EXTRA_GROUPS = {
    "24451": "ME: Mega Evolution Promo — Phantasmal Flames tin promos etc.",
    "24461": "MEE: Mega Evolution Energies",
    "24722": "ME: 30th Celebration (cel25 is 2021's Celebrations, unrelated)",
    "24529": "Player Placement Trainer Promos",
    "24584": "First Partner Collection 2026",
    "24163": "McDonald's Promos 2024 (upstream mcd* stops at 2022)",
    "23306": "McDonald's Promos 2023",
    "23520": "Battle Academy 2024",
    "23330": "My First Battle",
    "23561": "Trick or Trade BOOster Bundle 2024",
    "23266": "Trick or Trade BOOster Bundle 2023",
    "3179": "Trick or Trade BOOster Bundle (2022)",
    "22880": "Prize Pack Series Cards",
    "23323": "Trading Card Game Classic (abbrev CL false-joins to col1's ptcgoCode)",
}


def load_pokemontcg_sets() -> list:
    try:
        return json.loads(fetch(PKM_SETS, timeout=90, retries=2))["data"]
    except Exception as e:  # noqa: BLE001
        print(f"pokemontcg API sets failed ({e}) — using pokemon-tcg-data repo", file=sys.stderr)
        return json.loads(fetch(PKM_SETS_FALLBACK, timeout=60, retries=2))


def synth_set_id(g: dict) -> str:
    ab = (g.get("abbreviation") or "").strip().lower()
    if re.fullmatch(r"[a-z0-9]{2,10}", ab):
        return f"x-{ab}"
    return f"x-g{g['groupId']}"


def main() -> int:
    stamp = fetch("https://tcgcsv.com/last-updated.txt").strip()
    if OUT.exists():
        try:
            if json.loads(OUT.read_text()).get("stamp") == stamp:
                print(f"up to date ({stamp}), nothing to do")
                return 0
        except (ValueError, OSError):
            pass

    # Both mapping sources are REQUIRED here (unlike en-prices, where a
    # missing source just shrinks coverage): losing one would flood the
    # extras with sets pokemontcg actually has.
    sets = load_pokemontcg_sets()
    by_ptcgo = ptcgo_join(sets)
    hist = json.loads(fetch(HIST_GROUPS)).get(str(EN_CATEGORY), {}) or {}
    if len(by_ptcgo) < 50 or sum(1 for v in hist.values() if v) < 50:
        print("mapping sources look broken — refusing to build", file=sys.stderr)
        return 1

    groups = json.loads(fetch(f"{TCGCSV}/{EN_CATEGORY}/groups"))["results"]

    def mapped(g):
        return (EXPLICIT_GROUPS.get(str(g["groupId"]))
                or hist.get(str(g["groupId"]))
                or by_ptcgo.get(norm_code(g.get("abbreviation"))))

    unmapped = [g for g in groups if not mapped(g)]
    extras_groups = [g for g in unmapped if str(g["groupId"]) in EXTRA_GROUPS]
    candidates = [g for g in unmapped
                  if str(g["groupId"]) not in EXTRA_GROUPS and g["groupId"] >= 3000]
    if candidates:
        print("unmapped groups NOT in the allowlist (verify against pokemon-tcg-data "
              "and add to EXTRA_GROUPS if truly absent upstream): "
              + ", ".join(f"{g['groupId']}={g.get('name')}" for g in candidates[:15]))
    # 23323 excepted: TCG Classic false-joins via ptcgoCode CL → col1, so it
    # always looks "mapped" — every OTHER allowlisted group must be unmapped.
    stale = [gid for gid in EXTRA_GROUPS
             if gid != "23323" and gid not in {str(g["groupId"]) for g in unmapped}]
    if stale:
        print(f"allowlisted groups now mapped upstream — remove from EXTRA_GROUPS: {stale}",
              file=sys.stderr)
        return 1
    extras_groups += [g for g in groups if str(g["groupId"]) == "23323"]
    print(f"{len(groups)} groups, {len(unmapped)} unmapped, {len(extras_groups)} allowlisted extras")

    out_sets: dict[str, dict] = {}
    out_cards: list = []
    for g in sorted(extras_groups, key=lambda g: g["groupId"]):
        gid = g["groupId"]
        sid = synth_set_id(g)
        try:
            prods = json.loads(fetch(f"{TCGCSV}/{EN_CATEGORY}/{gid}/products"))["results"]
            rows = json.loads(fetch(f"{TCGCSV}/{EN_CATEGORY}/{gid}/prices"))["results"]
        except Exception as e:  # noqa: BLE001
            print(f"  {sid}: fetch failed ({e}) — skipping", file=sys.stderr)
            continue

        by_pid: dict[int, dict] = {}
        for r in rows:
            p = r.get("marketPrice")
            if p is None:
                p = r.get("midPrice")
            by_pid.setdefault(r["productId"], {})[(r.get("subTypeName") or "Normal").lower()] = p

        # base products claim Numbers first; parenthesized products only fill
        # Numbers with no base (unique-numbered "(Full Art)"-style cards)
        base, variant = [], []
        for p in prods:
            number = next((e["value"] for e in p.get("extendedData", []) if e.get("name") == "Number"), "")
            if not number:
                continue  # sealed product, not a card
            # TCGplayer names promos "Mega Charizard X ex - 029" — strip the
            # trailing number for display
            name = re.sub(r"\s*-\s*[0-9/]+\s*$", "", p.get("name", "")).strip()
            if re.search(r"\((?!.*/)[^)]+\)\s*$", name):
                variant.append((number, name, p))
            else:
                base.append((number, name, p))
        seen_nums: set[str] = set()
        count = 0
        for number, name, p in base + variant:
            key = number.lower()
            if key in seen_nums:
                continue
            seen_nums.add(key)
            price = pick_variant_price(by_pid.get(p["productId"], {}))
            out_cards.append([
                sid, str(number),
                name,
                round(float(price), 2) if price is not None and price >= 0 else None,
                p["productId"],
            ])
            count += 1
        if count:
            out_sets[sid] = {
                "name": g.get("name") or sid,
                "abbrev": g.get("abbreviation") or "",
                "released": (g.get("publishedOn") or "")[:10],
                "count": count,
            }
        time.sleep(0.1)  # tcgcsv asks for ~10 req/s max

    if not any(s.startswith("x-mep") for s in out_sets):
        print("sanity: x-mep (ME promos) missing from extras — mapping drifted?", file=sys.stderr)
        return 1

    OUT.write_text(json.dumps({"stamp": stamp, "sets": out_sets, "cards": out_cards},
                              separators=(",", ":")))
    print(f"wrote {OUT.name}: {len(out_sets)} sets, {len(out_cards)} cards "
          f"({OUT.stat().st_size // 1024}KB, stamp {stamp})")
    print("sanity: " + "  ".join(f"{sid}={out_sets[sid]['count']}" for sid in list(out_sets)[:8]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
