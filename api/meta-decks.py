"""GET /api/meta-decks — live meta decks from all 6 TCG sources."""

from http.server import BaseHTTPRequestHandler
import json
import re
import time
import threading
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed

import httpx
from bs4 import BeautifulSoup

# ── Cache (in-memory, per-instance, 24h TTL) ─────────────────────────────────
_cache: dict = {}
CACHE_TTL = 60 * 60 * 24

def cache_get(key: str):
    entry = _cache.get(key)
    if entry and time.time() < entry["expires"]:
        return entry["data"]
    return None

def cache_set(key: str, data):
    _cache[key] = {"data": data, "expires": time.time() + CACHE_TTL}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

# Shared HTTP client for connection pooling
_client = None

# ── Per-domain rate limiter ────────────────────────────────────────────────────
_request_times: dict = {}
_request_lock = threading.Lock()

def _rate_limit(domain: str, interval: float):
    """Enforce minimum interval between requests to the same domain."""
    with _request_lock:
        last = _request_times.get(domain, 0)
        now = time.time()
        if now - last < interval:
            time.sleep(interval - (now - last))
        _request_times[domain] = time.time()

def get_client():
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.Client(timeout=10, follow_redirects=True, headers=HEADERS)
    return _client

def fetch(url: str, delay: float = 0) -> str:
    """Fetch HTML with optional per-domain rate limiting."""
    if delay:
        _rate_limit(urllib.parse.urlparse(url).netloc, delay)
    resp = get_client().get(url)
    resp.raise_for_status()
    return resp.text

def fetch_json(url: str, delay: float = 0) -> dict:
    """Fetch JSON with optional per-domain rate limiting."""
    if delay:
        _rate_limit(urllib.parse.urlparse(url).netloc, delay)
    resp = get_client().get(url)
    resp.raise_for_status()
    return resp.json()


# ── Pokémon: Limitless TCG (unchanged logic, added rate-limit cushion) ────────

SET_CODE_MAP = {
    "SVI": "sv1", "PAL": "sv2", "OBF": "sv3", "PAF": "sv4pt5", "PAR": "sv4",
    "TEF": "sv5", "TWM": "sv6", "SFA": "sv6pt5", "SCR": "sv7", "SSP": "sv8",
    "PRE": "sv8pt5", "JTG": "sv9", "DRI": "sv10",
    "MEG": "me1", "ASC": "me2pt5",
    "BRS": "swsh9", "FST": "swsh8", "EVS": "swsh7", "CRE": "swsh6", "BST": "swsh5",
    "DAA": "swsh3", "RCL": "swsh2", "SSH": "swsh1", "CEL": "cel25", "CRZ": "swsh12pt5",
}

PRIORITY_ORDER = {
    "Common": 0, "Uncommon": 1, "Rare": 2, "Rare Holo": 3,
    "Double Rare": 4, "Ultra Rare": 5, "Illustration Rare": 6,
    "Special Illustration Rare": 7, "Hyper Rare": 8, "Secret Rare": 9,
}

def resolve_pokemon_card(args):
    """Look up a card on pokemontcg.io by set code + number."""
    set_code, number, quantity = args
    api_set = SET_CODE_MAP.get(set_code, set_code.lower())
    url = f"https://api.pokemontcg.io/v2/cards?q=set.id:{api_set}+number:{number}&pageSize=5"
    try:
        data = fetch_json(url)
        cards = data.get("data", [])
        if not cards:
            return None

        cards.sort(key=lambda c: PRIORITY_ORDER.get(c.get("rarity", ""), 5))
        card = cards[0]

        price = None
        prices = card.get("tcgplayer", {}).get("prices", {})
        for key in ["holofoil", "normal", "reverseHolofoil"]:
            if key in prices and prices[key].get("market"):
                price = prices[key]["market"]
                break
        if price is None:
            for v in prices.values():
                if v.get("market"):
                    price = v["market"]
                    break

        return {
            "cardId": card["id"],
            "name": card["name"],
            "setName": card.get("set", {}).get("name", ""),
            "setCode": card.get("set", {}).get("id", api_set),
            "number": card.get("number", number),
            "quantity": quantity,
            "price": price,
            "image": card.get("images", {}).get("small", ""),
        }
    except Exception:
        return None


def resolve_cards_parallel(card_list, resolver=resolve_pokemon_card):
    """Resolve multiple cards in parallel using threads."""
    tasks = [(c["setCode"], c["number"], c["quantity"]) for c in card_list]
    results = []
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = {executor.submit(resolver, t): i for i, t in enumerate(tasks)}
        ordered = [None] * len(tasks)
        for future in as_completed(futures):
            idx = futures[future]
            try:
                result = future.result()
                if result:
                    ordered[idx] = result
            except Exception:
                pass
        results = [r for r in ordered if r]
    return results


def parse_meta_table(html: str) -> list[dict]:
    """Parse the /decks page table into ranked deck list."""
    soup = BeautifulSoup(html, "html.parser")
    table = soup.select_one("table.data-table")
    if not table:
        return []

    decks = []
    rows = table.select("tr")
    for row in rows:
        cells = row.select("td")
        if len(cells) < 4:
            continue

        link = cells[2].select_one("a")
        if not link:
            continue

        href = link.get("href", "")
        deck_id = href.replace("/decks/", "").strip()

        # Extract name
        full_text = link.get_text(separator=" ", strip=True)
        ann_span = link.select_one("span.annotation")
        annotation = ann_span.get_text(strip=True) if ann_span else ""
        name_text = full_text.replace(annotation, "").strip() if annotation else full_text

        points = cells[3].get_text(strip=True).replace(",", "")
        share = cells[-1].get_text(strip=True) if len(cells) > 4 else ""
        rank = cells[0].get_text(strip=True)

        try:
            decks.append({
                "rank": int(rank),
                "id": deck_id,
                "name": full_text,
                "archetype": name_text.replace(" ", ""),
                "points": int(points),
                "share": share,
            })
        except (ValueError, IndexError):
            continue

    return decks


def parse_deck_cards(html: str) -> list[dict]:
    """Parse a deck page for its core cards using data attributes."""
    soup = BeautifulSoup(html, "html.parser")
    cards = []
    for card_el in soup.select(".core-card"):
        img = card_el.select_one("img[data-card]")
        if not img:
            continue
        set_code = img.get("data-set", "")
        number = img.get("data-number", "")
        alt = img.get("alt", "")
        share_span = card_el.select_one(".share")
        share_text = share_span.get_text(strip=True) if share_span else ""
        qty_match = re.match(r"(\d+)\s+in\s+", share_text)
        quantity = int(qty_match.group(1)) if qty_match else 1
        if set_code and number:
            cards.append({
                "setCode": set_code,
                "number": number,
                "name": alt,
                "quantity": quantity,
            })
    return cards


def scrape_pokemon() -> list[dict]:
    """Live meta decks from Limitless TCG."""
    html = fetch("https://limitlesstcg.com/decks?format=standard", delay=0.3)
    deck_list = parse_meta_table(html)

    if not deck_list:
        return []

    raw_decks = []
    for deck_meta in deck_list[:5]:
        try:
            deck_html = fetch(f"https://limitlesstcg.com/decks/{deck_meta['id']}", delay=0.3)
            cards = parse_deck_cards(deck_html)
            if cards:
                raw_decks.append({**deck_meta, "cards": cards})
        except Exception:
            continue

    all_cards = []
    card_deck_map = []
    for di, deck in enumerate(raw_decks):
        for card in deck["cards"]:
            all_cards.append(card)
            card_deck_map.append(di)

    resolved_all = resolve_cards_parallel(all_cards, resolve_pokemon_card)

    deck_cards = [[] for _ in raw_decks]
    for ci, resolved in enumerate(resolved_all):
        deck_idx = card_deck_map[ci]
        deck_cards[deck_idx].append(resolved)

    resolved_decks = []
    for di, deck in enumerate(raw_decks):
        if deck_cards[di]:
            resolved_decks.append({
                "name": deck["name"],
                "archetype": deck["archetype"],
                "description": f"{deck['share']} meta share \u00b7 {deck['points']:,} CP",
                "meta": {
                    "rank": deck["rank"],
                    "share": deck["share"],
                    "points": deck["points"],
                },
                "cards": deck_cards[di],
            })

    return resolved_decks


# ── MTG: mtgtop8.com ──────────────────────────────────────────────────────────
# Format page: http://mtgtop8.com/format?format=ST (Standard)
# Scrapes archetype table, follows through to individual deck pages,
# then resolves card names via Scryfall batch collection endpoint.

MTG_FORMATS = {"ST": "Standard", "MO": "Modern", "PI": "Pioneer", "LE": "Legacy"}

def _mtg_parse_card_line(line: str) -> tuple | None:
    """Parse a line like '4 Lightning Bolt' into (qty, name) or None."""
    m = re.match(r"^(\d+)\s+(.+)$", line.strip())
    if not m:
        return None
    qty = int(m.group(1))
    name = m.group(2).strip()
    # Skip basic lands
    if name in ("Plains", "Island", "Swamp", "Mountain", "Forest",
                 "Snow-Covered Plains", "Snow-Covered Island",
                 "Snow-Covered Swamp", "Snow-Covered Mountain", "Snow-Covered Forest",
                 "Wastes"):
        return None
    # Skip header lines masquerading as card names
    if name.lower() in ("deck", "sideboard", "creatures", "instants", "sorceries",
                         "enchantments", "artifacts", "planeswalkers", "lands",
                         "spells", "nonlands", "non-creatures"):
        return None
    return (qty, name)


def scrape_mtg() -> list[dict]:
    """Scrape Standard meta decks from mtgtop8.com."""
    html = fetch("http://mtgtop8.com/format?format=ST", delay=1.5)
    soup = BeautifulSoup(html, "html.parser")

    # Parse the archetype table
    archetypes = []
    for tr in soup.select("table.form tr"):
        g1 = tr.select_one("td.G1")
        g2 = tr.select_one("td.G2")
        if not g1 or not g2:
            continue
        link = g1.select_one("a")
        if not link:
            continue
        href = link.get("href", "")
        if "format?e=" not in href:
            continue
        name = link.get_text(strip=True).replace("\xa0", " ").replace("  ", " ").strip()
        share_text = g2.get_text(strip=True).replace("%", "")
        try:
            share = float(share_text)
        except ValueError:
            share = 0
        archetypes.append({
            "name": name,
            "archetype": name.split("(")[0].strip() or name,
            "share": share,
            "url": f"http://mtgtop8.com/{href}",
        })

    if not archetypes:
        return []

    archetypes.sort(key=lambda a: a["share"], reverse=True)

    decks = []
    for arch in archetypes[:3]:
        try:
            arch_html = fetch(arch["url"], delay=1.5)
            arch_soup = BeautifulSoup(arch_html, "html.parser")
            deck_link = arch_soup.select_one("table.form a[href*='event?e=']")
            if not deck_link:
                continue
            deck_url = f"http://mtgtop8.com/{deck_link.get('href')}"
            deck_row = deck_link.find_parent("tr")
            player_td = deck_row.select_one("td.G1") if deck_row else None
            player = player_td.get_text(strip=True) if player_td else ""

            deck_html = fetch(deck_url, delay=1.5)
            deck_soup = BeautifulSoup(deck_html, "html.parser")

            deck_list_div = deck_soup.select_one("div.deck_lists, div#deck_lists, .deck_list")
            if not deck_list_div:
                deck_list_div = deck_soup

            text = deck_list_div.get_text("\n")
            cards = []
            in_sideboard = False
            for line in text.split("\n"):
                line = line.strip()
                if not line:
                    continue
                if line.lower().startswith("sideboard"):
                    in_sideboard = True
                    continue
                parsed = _mtg_parse_card_line(line)
                if parsed:
                    qty, card_name = parsed
                    cards.append({
                        "name": card_name,
                        "quantity": qty,
                        "sideboard": in_sideboard,
                    })

            if cards:
                main_cards = [c for c in cards if not c.get("sideboard")] or cards[:60]
                decks.append({
                    "name": f"{arch['archetype']} by {player}".strip().rstrip("by "),
                    "archetype": arch["archetype"],
                    "description": f"{arch['share']}% meta share \u00b7 Standard",
                    "meta": {"share": arch["share"]},
                    "cards": main_cards,
                })
        except Exception:
            continue

    return decks


def resolve_mtg_cards(decks: list[dict]) -> list[dict]:
    """Resolve MTG card names via Scryfall batch collection endpoint."""
    all_names = set()
    for deck in decks:
        for card in deck["cards"]:
            all_names.add(card["name"])

    names = list(all_names)
    results = {}

    for i in range(0, len(names), 75):
        batch = names[i:i + 75]
        try:
            payload = {"identifiers": [{"name": n} for n in batch]}
            resp = get_client().post("https://api.scryfall.com/cards/collection", json=payload)
            resp.raise_for_status()
            data = resp.json()
            for card in data.get("data", []):
                card_name = (card.get("name") or "").lower()
                imgs = (card.get("image_uris")
                        or (card.get("card_faces", [{}])[0].get("image_uris"))
                        or {})
                usd = card.get("prices", {}).get("usd")
                usd_foil = card.get("prices", {}).get("usd_foil")
                results[card_name] = {
                    "cardId": card.get("id", ""),
                    "name": card.get("name", ""),
                    "setName": card.get("set_name", ""),
                    "setCode": card.get("set", ""),
                    "number": card.get("collector_number", ""),
                    "price": float(usd) if usd else (float(usd_foil) if usd_foil else None),
                    "image": imgs.get("small", "") or imgs.get("normal", "") or "",
                }
        except Exception:
            continue

    for deck in decks:
        resolved = []
        for card in deck["cards"]:
            info = results.get(card["name"].lower())
            if info:
                resolved.append({**info, "quantity": card["quantity"]})
            else:
                resolved.append({
                    "cardId": "", "name": card["name"],
                    "setName": "", "setCode": "", "number": "",
                    "price": None, "image": "", "quantity": card["quantity"],
                })
        deck["cards"] = resolved

    return decks


# ── Lorcana: inkdecks.com ─────────────────────────────────────────────────────

def scrape_lorcana() -> list[dict]:
    """Scrape Lorcana meta decks from inkdecks.com."""
    html = fetch("https://inkdecks.com/lorcana-decks", delay=1.5)
    soup = BeautifulSoup(html, "html.parser")

    decks = []
    seen = set()
    for link in soup.select("a[href*='/lorcana-decks/']"):
        href = link.get("href", "")
        name = link.get_text(strip=True)
        if not name or not href or href.startswith("http"):
            continue
        # Deduplicate by URL
        if href in seen:
            continue
        seen.add(href)

        try:
            deck_html = fetch(f"https://inkdecks.com{href}", delay=1.5)
            deck_soup = BeautifulSoup(deck_html, "html.parser")

            cards = []
            for card_row in deck_soup.select("[class*='card'], tr.deck-card, .deck-list tr"):
                cells = card_row.select("td, .qty, .quantity, .name, [class*='name']")
                if len(cells) < 2:
                    continue
                qty_text = cells[0].get_text(strip=True)
                try:
                    qty = int(qty_text)
                except ValueError:
                    continue
                card_name = cells[1].get_text(strip=True)
                if not card_name:
                    continue
                cards.append({"name": card_name, "quantity": qty})

            # Also try extracting from embedded JSON / JS data
            if not cards:
                for script in deck_soup.select("script"):
                    text = script.string or ""
                    m = re.search(r'"cards"\s*:\s*(\[.*?\])\s*[,}]', text, re.DOTALL)
                    if m:
                        try:
                            raw = json.loads(m.group(1))
                            for entry in raw:
                                cname = entry.get("name") or entry.get("cardName") or ""
                                qty = entry.get("quantity") or entry.get("qty") or 1
                                if cname:
                                    cards.append({"name": cname, "quantity": int(qty)})
                        except Exception:
                            pass

            if cards:
                leader = link.find_previous("h3") or link.find_previous("[class*='leader']")
                archetype = leader.get_text(strip=True) if leader else name
                decks.append({
                    "name": name,
                    "archetype": archetype,
                    "description": "Inkdecks tournament deck",
                    "meta": {},
                    "cards": cards,
                })

            if len(decks) >= 3:
                break
        except Exception:
            continue

    return decks


def resolve_lorcana_cards(decks: list[dict]) -> list[dict]:
    """Resolve Lorcana card names via Lorcast API, one card at a time."""
    for deck in decks:
        resolved = []
        for card in deck["cards"]:
            try:
                url = f"https://api.lorcast.com/v0/cards/search?q={urllib.parse.quote(card['name'])}"
                data = fetch_json(url, delay=0.3)
                results = data.get("results", [])
                if results:
                    c = results[0]
                    img = (c.get("image_uris") or {}).get("digital") or {}
                    resolved.append({
                        "cardId": c.get("id", ""),
                        "name": c.get("name", card["name"]),
                        "setName": c.get("set_name", ""),
                        "setCode": c.get("set_code", ""),
                        "number": c.get("collector_number", ""),
                        "price": c.get("prices", {}).get("usd") or c.get("prices", {}).get("usd_foil"),
                        "image": img.get("small") or "",
                        "quantity": card["quantity"],
                    })
                else:
                    resolved.append({
                        "cardId": "", "name": card["name"],
                        "setName": "", "setCode": "", "number": "",
                        "price": None, "image": "", "quantity": card["quantity"],
                    })
            except Exception:
                resolved.append({
                    "cardId": "", "name": card["name"],
                    "setName": "", "setCode": "", "number": "",
                    "price": None, "image": "", "quantity": card["quantity"],
                })
        deck["cards"] = resolved
    return decks


# ── One Piece: optcg.one ──────────────────────────────────────────────────────

def scrape_one_piece() -> list[dict]:
    """Scrape One Piece meta decks from optcg.one."""
    html = fetch("https://optcg.one/decklists", delay=1.5)
    soup = BeautifulSoup(html, "html.parser")

    decks = []
    seen = set()
    for link in soup.select("a[href*='/decklists/']"):
        href = link.get("href", "")
        name = link.get_text(strip=True)
        if not name or not href:
            continue
        if href in seen:
            continue
        seen.add(href)

        try:
            deck_url = href if href.startswith("http") else f"https://optcg.one{href}"
            deck_html = fetch(deck_url, delay=1.5)
            deck_soup = BeautifulSoup(deck_html, "html.parser")

            cards = []
            for card_row in deck_soup.select("[class*='card'], tr.deck-card, .deck-list tr"):
                cells = card_row.select("td, .qty, .quantity, .name, [class*='name']")
                if len(cells) < 2:
                    continue
                qty_text = cells[0].get_text(strip=True)
                try:
                    qty = int(qty_text)
                except ValueError:
                    continue
                card_name = cells[1].get_text(strip=True)
                if not card_name:
                    continue
                cards.append({"name": card_name, "quantity": qty})

            if not cards:
                for script in deck_soup.select("script"):
                    text = script.string or ""
                    m = re.search(r'"cards"\s*:\s*(\[.*?\])\s*[,}]', text, re.DOTALL)
                    if m:
                        try:
                            raw = json.loads(m.group(1))
                            for entry in raw:
                                cname = entry.get("name") or entry.get("cardName") or ""
                                qty = entry.get("quantity") or entry.get("qty") or 1
                                if cname:
                                    cards.append({"name": cname, "quantity": int(qty)})
                        except Exception:
                            pass

            if cards:
                leader_el = link.find_previous("[class*='leader']") or link.find_previous("h3")
                archetype = leader_el.get_text(strip=True) if leader_el else ""
                decks.append({
                    "name": name,
                    "archetype": archetype or name,
                    "description": "optcg.one tournament deck",
                    "meta": {},
                    "cards": cards,
                })

            if len(decks) >= 3:
                break
        except Exception:
            continue

    return decks


def resolve_one_piece_cards(decks: list[dict]) -> list[dict]:
    """Resolve One Piece card names from optcgapi full set list."""
    try:
        all_cards = fetch_json("https://optcgapi.com/api/allSetCards/", delay=0.5)
        if not isinstance(all_cards, list):
            all_cards = []
    except Exception:
        all_cards = []

    card_lookup = {}
    for c in all_cards:
        name = (c.get("card_name") or "").lower()
        if name:
            card_lookup[name] = c

    for deck in decks:
        resolved = []
        for card in deck["cards"]:
            info = card_lookup.get(card["name"].lower())
            if info:
                resolved.append({
                    "cardId": info.get("card_set_id", ""),
                    "name": info.get("card_name", card["name"]),
                    "setName": info.get("set_name", ""),
                    "setCode": (info.get("card_set_id") or "").split("-")[0] if info.get("card_set_id") else "",
                    "number": info.get("card_set_id", ""),
                    "price": info.get("market_price") or info.get("inventory_price"),
                    "image": info.get("card_image", ""),
                    "quantity": card["quantity"],
                })
            else:
                resolved.append({
                    "cardId": "", "name": card["name"],
                    "setName": "", "setCode": "", "number": "",
                    "price": None, "image": "", "quantity": card["quantity"],
                })
        deck["cards"] = resolved
    return decks


# ── Riftbound: RiftDecks.com ─────────────────────────────────────────────────

def scrape_riftbound() -> list[dict]:
    """Scrape Riftbound meta decks from RiftDecks.com."""
    html = fetch("https://riftdecks.com/riftbound-decks", delay=1.5)
    soup = BeautifulSoup(html, "html.parser")

    decks = []
    seen = set()
    for link in soup.select("a[href*='/riftbound-decks/']"):
        href = link.get("href", "")
        name = link.get_text(strip=True)
        if not name or not href:
            continue
        if href in seen:
            continue
        seen.add(href)

        try:
            deck_url = href if href.startswith("http") else f"https://riftdecks.com{href}"
            deck_html = fetch(deck_url, delay=1.5)
            deck_soup = BeautifulSoup(deck_html, "html.parser")

            cards = []
            for card_row in deck_soup.select("[class*='card'], tr.deck-card, .deck-list tr"):
                cells = card_row.select("td, .qty, .quantity, .name, [class*='name']")
                if len(cells) < 2:
                    continue
                qty_text = cells[0].get_text(strip=True)
                try:
                    qty = int(qty_text)
                except ValueError:
                    continue
                card_name = cells[1].get_text(strip=True)
                if not card_name:
                    continue
                cards.append({"name": card_name, "quantity": qty})

            if not cards:
                for script in deck_soup.select("script"):
                    text = script.string or ""
                    m = re.search(r'"cards"\s*:\s*(\[.*?\])\s*[,}]', text, re.DOTALL)
                    if m:
                        try:
                            raw = json.loads(m.group(1))
                            for entry in raw:
                                cname = entry.get("name") or entry.get("cardName") or ""
                                qty = entry.get("quantity") or entry.get("qty") or 1
                                if cname:
                                    cards.append({"name": cname, "quantity": int(qty)})
                        except Exception:
                            pass

            if cards:
                archetype_el = link.find_previous("[class*='archetype']") or link.find_previous("h3")
                archetype = archetype_el.get_text(strip=True) if archetype_el else ""
                decks.append({
                    "name": name,
                    "archetype": archetype or name,
                    "description": "RiftDecks tournament deck",
                    "meta": {},
                    "cards": cards,
                })

            if len(decks) >= 3:
                break
        except Exception:
            continue

    return decks


def resolve_riftbound_cards(decks: list[dict]) -> list[dict]:
    """Resolve Riftbound card names via riftcodex API."""
    try:
        sets = fetch_json("https://api.riftcodex.com/sets", delay=0.3)
    except Exception:
        sets = {"items": []}

    all_cards = {}
    for s in (sets.get("items") or []):
        try:
            d = fetch_json(
                f"https://api.riftcodex.com/cards?set_id={urllib.parse.quote(s['set_id'])}&limit=200",
                delay=0.3,
            )
            for c in (d.get("items") or []):
                name = (c.get("name") or "").lower()
                if name:
                    all_cards[name] = c
        except Exception:
            continue

    for deck in decks:
        resolved = []
        for card in deck["cards"]:
            info = all_cards.get(card["name"].lower())
            if info:
                resolved.append({
                    "cardId": info.get("id", ""),
                    "name": info.get("name", card["name"]),
                    "setName": (info.get("set") or {}).get("label", ""),
                    "setCode": (info.get("set") or {}).get("set_id", ""),
                    "number": str(info.get("collector_number", "")),
                    "price": None,
                    "image": (info.get("media") or {}).get("image_url", ""),
                    "quantity": card["quantity"],
                })
            else:
                resolved.append({
                    "cardId": "", "name": card["name"],
                    "setName": "", "setCode": "", "number": "",
                    "price": None, "image": "", "quantity": card["quantity"],
                })
        deck["cards"] = resolved
    return decks


# ── Yu-Gi-Oh: ygoprodeck.com ──────────────────────────────────────────────────

def scrape_yugioh() -> list[dict]:
    """Scrape Yu-Gi-Oh meta decks from ygoprodeck.com."""
    html = fetch("https://ygoprodeck.com/decks/?format=current", delay=1.5)
    soup = BeautifulSoup(html, "html.parser")

    decks = []
    seen = set()
    for link in soup.select("a[href*='/deck/']"):
        href = link.get("href", "")
        name = link.get_text(strip=True)
        if not name or not href:
            continue
        if href in seen:
            continue
        seen.add(href)

        try:
            deck_url = href if href.startswith("http") else f"https://ygoprodeck.com{href}"
            deck_html = fetch(deck_url, delay=1.5)
            deck_soup = BeautifulSoup(deck_html, "html.parser")

            cards = []
            # YGOPRODeck shows cards with class names like deck-card, card-item
            for card_el in deck_soup.select("[class*='deck-card'], [class*='card-item'], [class*='card-row']"):
                qty_el = card_el.select_one(".quantity, .qty, .count, .card-quantity")
                name_el = card_el.select_one(".card-name, .name, .card-title")
                if not qty_el or not name_el:
                    continue
                qty_text = qty_el.get_text(strip=True)
                try:
                    qty = int(qty_text)
                except ValueError:
                    continue
                card_name = name_el.get_text(strip=True)
                if not card_name:
                    continue
                cards.append({"name": card_name, "quantity": qty})

            # Fallback: try extracting from a decklist text block
            if not cards:
                for pre in deck_soup.select("pre, textarea, .deck-list-text"):
                    text = pre.get_text(strip=True)
                    for line in text.split("\n"):
                        m = re.match(r"^(\d+)\s+(.+)$", line.strip())
                        if m:
                            qty = int(m.group(1))
                            cname = m.group(2).strip()
                            if cname:
                                cards.append({"name": cname, "quantity": qty})

            if cards:
                arch_el = link.find_previous("[class*='archetype']") or link.find_previous("h2") or link.find_previous("h3")
                archetype = arch_el.get_text(strip=True) if arch_el else ""
                decks.append({
                    "name": name,
                    "archetype": archetype or name,
                    "description": "YGOPRODeck tournament deck",
                    "meta": {},
                    "cards": cards,
                })

            if len(decks) >= 3:
                break
        except Exception:
            continue

    return decks


def resolve_yugioh_cards(decks: list[dict]) -> list[dict]:
    """Resolve Yu-Gi-Oh card names via YGOPRODeck API."""
    for deck in decks:
        resolved = []
        for card in deck["cards"]:
            try:
                url = f"https://db.ygoprodeck.com/api/v7/cardinfo.php?fname={urllib.parse.quote(card['name'])}"
                data = fetch_json(url, delay=0.3)
                results = data.get("data", [])
                if results:
                    c = results[0]
                    set_info = c.get("card_sets", [{}])[0] if c.get("card_sets") else {}
                    cps = c.get("card_prices", [{}])
                    resolved.append({
                        "cardId": f"ygo-{c.get('id', '')}",
                        "name": c.get("name", card["name"]),
                        "setName": set_info.get("set_name", ""),
                        "setCode": set_info.get("set_code", ""),
                        "number": set_info.get("set_code", str(c.get("id", ""))),
                        "price": (
                            float(cps[0]["tcgplayer_price"])
                            if cps and cps[0].get("tcgplayer_price")
                            else (float(cps[0]["cardmarket_price"])
                                  if cps and cps[0].get("cardmarket_price")
                                  else None)
                        ),
                        "image": (c.get("card_images") or [{}])[0].get("image_url_small", ""),
                        "quantity": card["quantity"],
                    })
                else:
                    resolved.append({
                        "cardId": "", "name": card["name"],
                        "setName": "", "setCode": "", "number": "",
                        "price": None, "image": "", "quantity": card["quantity"],
                    })
            except Exception:
                resolved.append({
                    "cardId": "", "name": card["name"],
                    "setName": "", "setCode": "", "number": "",
                    "price": None, "image": "", "quantity": card["quantity"],
                })
        deck["cards"] = resolved
    return decks


# ── Dispatcher ─────────────────────────────────────────────────────────────────

SCRAPERS = {
    "pokemon": (scrape_pokemon, None),
    "mtg": (scrape_mtg, resolve_mtg_cards),
    "lorcana": (scrape_lorcana, resolve_lorcana_cards),
    "one-piece": (scrape_one_piece, resolve_one_piece_cards),
    "riftbound": (scrape_riftbound, resolve_riftbound_cards),
    "yugioh": (scrape_yugioh, resolve_yugioh_cards),
}


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        from urllib.parse import urlparse, parse_qs
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)
        game = (params.get("game") or ["pokemon"])[0]

        cached_key = f"meta-decks-{game}"
        cached = cache_get(cached_key)
        if cached:
            self._json({"decks": cached, "cached": True})
            return

        scraper_info = SCRAPERS.get(game)
        if not scraper_info:
            self._json({"decks": [], "game": game, "note": f"Unknown game: {game}"})
            return

        scraper, resolver = scraper_info

        try:
            decks = scraper()

            if not decks:
                self._json({"decks": [], "game": game, "note": f"No decks found for {game}"})
                return

            if resolver:
                decks = resolver(decks)

            if decks:
                cache_set(cached_key, decks)

            self._json({"decks": decks, "cached": False})

        except Exception as e:
            self._json({"error": str(e), "decks": []}, 502)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.end_headers()

    def _json(self, data: dict, status: int = 200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())
