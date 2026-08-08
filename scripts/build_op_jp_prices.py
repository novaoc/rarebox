#!/usr/bin/env python3
"""Build public/op-jp-prices.json — market prices for Japanese One Piece
cards, keyed exactly as opNormalizeJapaneseCard expects:
`"<CARD-NUMBER>|"` (base printing) and `"<CARD-NUMBER>|parallel"` (any _pN).

TCGplayer has NO Japanese One Piece category (verified 2026-08-08 against
tcgcsv's category list — only EN category 68 and Pokemon Japan 85), so this
was a stub writing an empty prices map since it landed. PriceCharting DOES
cover JP One Piece with per-set consoles ("One Piece Japanese Romance Dawn")
and bracketed variants ("Roronoa Zoro [Alternate Art] OP01-001"), searchable
by card number through the same public JSON endpoint the app already uses.

Etiquette: the full number list is ~2,600 searches, too many for a daily
walk — so a FULL pass runs only when the output is empty/missing (seeding),
and daily runs refresh a rotating 1/7 shard (~370 queries, merged over the
existing map). Prices are at most a week stale, PC sees a few hundred
polite queries a day.

Variant mapping: a product with no bracket (or a bracket that's just a set
qualifier like "[PRB-02]") is the base printing; bracketed printings
([Alternate Art], [Manga], [25th Anniversary], …) are parallels — the app
folds every _pN onto one "parallel" key, so parallels take the LOWEST
bracketed price (a p2 owner must not be valued at the p1 Shonen Jump price).

    python3 scripts/build_op_jp_prices.py           # shard (or full if empty)
    python3 scripts/build_op_jp_prices.py --full    # force full pass
"""

import json
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "op-jp-prices.json"
INDEX = ROOT / "public" / "op-jp-index.json"

HEADERS = {
    "User-Agent": "Rarebox/1.4 (+https://rarebox.io)",
    "Accept": "application/json",
}
PC_SEARCH = "https://www.pricecharting.com/search-products"
THROTTLE = 0.25
SHARDS = 7

# Brackets that scope a product to a reprint set rather than a variant
SET_QUALIFIER = re.compile(r"^(OP|EB|ST|PRB)-?\d", re.I)


def fetch(url: str, retries: int = 2):
    req = urllib.request.Request(url, headers=HEADERS)
    for attempt in range(retries + 1):
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                return resp.read().decode()
        except Exception:  # noqa: BLE001
            if attempt >= retries:
                raise
            time.sleep(1.5 * (attempt + 1))


def parse_price(v):
    try:
        n = float(str(v).replace("$", "").replace(",", ""))
        return n if n >= 0 else None
    except (TypeError, ValueError):
        return None


def classify(product_name: str, number: str):
    """→ ('base'|'parallel'|None). None = not this card."""
    name = product_name or ""
    if number.lower() not in name.lower():
        return None
    brackets = re.findall(r"\[([^\]]+)\]", name)
    variantish = [b for b in brackets if not SET_QUALIFIER.match(b.strip())]
    return "parallel" if variantish else "base"


def lookup(number: str):
    q = urllib.parse.quote(f"one piece japanese {number}")
    try:
        data = json.loads(fetch(f"{PC_SEARCH}?type=prices&q={q}"))
    except Exception:  # noqa: BLE001
        return {}
    products = data if isinstance(data, list) else data.get("products", [])
    out = {}
    for p in products:
        if "one piece japanese" not in (p.get("consoleName") or "").lower():
            continue
        kind = classify(p.get("productName", ""), number)
        price = parse_price(p.get("price1"))
        if kind is None or price is None:
            continue
        if kind == "base":
            # first base hit wins (PC ranks the native printing first)
            out.setdefault(f"{number.upper()}|", price)
        else:
            key = f"{number.upper()}|parallel"
            out[key] = min(out.get(key, price), price)
    return out


def main() -> int:
    full = "--full" in sys.argv
    idx = json.loads(INDEX.read_text())
    numbers = sorted({c["number"] for cards in idx["cards"].values() for c in cards if c.get("number")})

    existing = {}
    if OUT.exists():
        try:
            existing = json.loads(OUT.read_text()).get("prices", {}) or {}
        except (ValueError, OSError):
            pass
    if not existing:
        full = True  # first real run seeds everything

    if full:
        todo = numbers
    else:
        shard = datetime.now(timezone.utc).toordinal() % SHARDS
        todo = [n for n in numbers if hash(n) % SHARDS == shard]
    print(f"{len(numbers)} numbers, querying {len(todo)} ({'full' if full else 'shard'})")

    prices = dict(existing)
    hit = 0
    for i, number in enumerate(todo):
        found = lookup(number)
        if found:
            hit += 1
            # a refreshed number replaces BOTH its keys (a vanished parallel
            # listing must not leave a stale price behind)
            prices.pop(f"{number.upper()}|", None)
            prices.pop(f"{number.upper()}|parallel", None)
            prices.update(found)
        if i and i % 200 == 0:
            print(f"  {i}/{len(todo)} ({hit} hits)")
        time.sleep(THROTTLE)

    if full and len(prices) < 500:  # PC covers far more than this — bad pass
        print(f"only {len(prices)} prices on a full pass — refusing to overwrite", file=sys.stderr)
        return 1

    OUT.write_text(json.dumps({
        "stamp": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "source": "pricecharting",
        "prices": prices,
    }, separators=(",", ":")))
    print(f"wrote {OUT.name}: {len(prices)} price keys ({hit}/{len(todo)} queried numbers hit)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
