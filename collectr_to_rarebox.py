#!/usr/bin/env python3
"""Convert a Collectr portfolio CSV export into a Rarebox-compatible JSON backup.

Usage:
  python3 collectr_to_rarebox.py pokemonList.csv -o rarebox_import.json
  python3 collectr_to_rarebox.py pokemonList.csv -o rarebox_import.json --portfolio "Master sets JP"
"""

import csv
import json
import sys
import argparse
import re
from datetime import datetime, timezone
from uuid import uuid4

GAME_MAP = {
    'pokemon': 'pokemon',
    'yugioh': 'yu-gi-oh',
    'magic: the gathering': 'magic',
    'mtg': 'magic',
    'magic': 'magic',
    'one piece': 'one-piece',
    'lorcana': 'lorcana',
    'riftbound': 'riftbound',
}

VARIANCE_MAP = {
    'normal': 'normal',
    'holofoil': 'holofoil',
    'reverse holo': 'reverseHolofoil',
    'reverse holofoil': 'reverseHolofoil',
    'master ball reverse holo': 'reverseHolofoil',
    'poke ball reverse holo': 'reverseHolofoil',
}

GRADE_RE = re.compile(r'^(PSA|BGS|CGC|ACE)\s+(\d+(?:\.\d+)?)')


def normalize_game(raw):
    c = raw.strip().lower()
    for key, val in GAME_MAP.items():
        if key in c:
            return val
    return None


def is_japanese(product_name, set_name):
    text = (product_name + ' ' + set_name).lower()
    return '(jp)' in text


def parse_cost(val):
    if not val or not val.strip():
        return 0
    cleaned = val.strip().replace('$', '').replace(',', '').replace('"', '')
    try:
        return round(float(cleaned), 2)
    except ValueError:
        return 0


def parse_grade(raw):
    if not raw or raw.strip().lower() == 'ungraded':
        return None, None
    m = GRADE_RE.match(raw.strip())
    if m:
        return m.group(1), m.group(2)
    for company in ('PSA', 'BGS', 'CGC', 'ACE'):
        if raw.strip().upper().startswith(company):
            rest = raw.strip()[len(company):].strip()
            g = re.search(r'(\d+(?:\.\d+)?)', rest)
            return company, g.group(1) if g else '10'
    return None, None


def map_variance(v):
    if not v:
        return None
    return VARIANCE_MAP.get(v.strip().lower(), None)


def build_item(row):
    pname = row.get('Portfolio Name', '').strip()
    category = row.get('Category', '').strip()
    set_name = row.get('Set', '').strip()
    product_name = row.get('Product Name', '').strip()
    card_number = (row.get('Card Number') or '').strip()
    rarity = row.get('Rarity', '').strip()
    variance = row.get('Variance', '').strip()
    grade_raw = row.get('Grade', '').strip()
    cost_str = row.get('Average Cost Paid', '').strip()
    qty_str = row.get('Quantity', '').strip()
    date_added = row.get('Date Added', '').strip()
    notes = (row.get('Notes') or '').strip()

    game = normalize_game(category)
    is_pokemon = game == 'pokemon'
    jp = is_pokemon and is_japanese(product_name, set_name)
    cost = parse_cost(cost_str)
    quantity = max(1, int(float(qty_str))) if qty_str else 1
    has_card_number = bool(card_number)
    grading_company, grade = parse_grade(grade_raw)

    now = datetime.now(timezone.utc).isoformat()

    if not has_card_number:
        sealed = True
    elif grading_company:
        sealed = False
    else:
        sealed = False

    base = {
        'id': str(uuid4()),
        'quantity': quantity,
        'purchasePrice': cost,
        'purchaseDate': date_added if date_added else None,
        'notes': notes,
        'addedAt': now,
        'lastPriceUpdate': now,
    }

    if not is_pokemon:
        base['game'] = game

    if sealed:
        base['type'] = 'sealed'
        base['name'] = product_name
        base['setName'] = set_name
        base['sealedType'] = 'booster_box'
        base['currentValue'] = None
        base['pcUrl'] = ''
        base['imageUrl'] = ''

    elif grading_company:
        base['type'] = 'graded'
        base['gradingCompany'] = grading_company
        base['grade'] = grade or '10'
        base['currentValue'] = None
        base['cardData'] = {
            'name': product_name,
            'number': card_number,
            'set': {'name': set_name},
            'rarity': rarity,
            'images': {'small': '', 'large': ''},
        }
        if is_pokemon:
            base['_lang'] = 'ja' if jp else None

    else:
        base['type'] = 'card'
        base['priceVariant'] = map_variance(variance)
        base['currentMarketPrice'] = None
        base['cardData'] = {
            'name': product_name,
            'number': card_number,
            'set': {'name': set_name},
            'rarity': rarity,
            'images': {'small': '', 'large': ''},
        }
        if is_pokemon:
            base['_lang'] = 'ja' if jp else None

    return base


COLORS = ['#58a6ff', '#f5a623', '#3fb950', '#da3633', '#a371f7', '#f778ba', '#7ee787', '#d2a8ff']


def convert_csv(path, only_portfolio=None):
    with open(path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    groups = {}
    for row in rows:
        name = row.get('Portfolio Name', '').strip()
        if not name:
            cat = row.get('Category', '').strip()
            name = cat if cat else 'Uncategorized'
        if only_portfolio and name != only_portfolio:
            continue
        groups.setdefault(name, []).append(row)

    portfolios = []
    for idx, (pname, prows) in enumerate(groups.items()):
        items = [build_item(r) for r in prows]
        portfolios.append({
            'id': str(uuid4()),
            'name': pname,
            'color': COLORS[idx % len(COLORS)],
            'createdAt': datetime.now(timezone.utc).isoformat(),
            'items': items,
        })

    return portfolios


def main():
    ap = argparse.ArgumentParser(description='Convert Collectr CSV to Rarebox')
    ap.add_argument('csv', help='Path to Collectr CSV export')
    ap.add_argument('-o', '--output', default='rarebox_import.json', help='Output JSON path')
    ap.add_argument('--portfolio', default=None, help='Only convert one portfolio')
    ap.add_argument(
        '--format', choices=['backup', 'state'], default='backup',
        help='backup=Rarebox Settings backup format; state=direct IDB state (for DevTools import)'
    )
    args = ap.parse_args()

    portfolios = convert_csv(args.csv, args.portfolio)

    state = {
        'portfolios': portfolios,
        'activePortfolioId': portfolios[0]['id'] if portfolios else None,
        'settings': {'currency': 'USD', 'defaultPortfolioId': None},
        'snapshots': {},
    }

    if args.format == 'state':
        output = {'key': 'app_state', 'value': state}
    else:
        output = {
            'version': 1,
            'exportedAt': datetime.now(timezone.utc).isoformat(),
            'app': 'rarebox',
            'data': {
                'portfolios': state,
                'settings': state['settings'],
                'snapshots': {},
            },
        }

    with open(args.output, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    total_items = sum(len(p['items']) for p in portfolios)
    print(f'Converted {total_items} items across {len(portfolios)} portfolios')
    print(f'Output: {args.output}')
    for p in portfolios:
        print(f'  {p["name"]}: {len(p["items"])} items')


if __name__ == '__main__':
    main()
