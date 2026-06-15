#!/usr/bin/env python3
"""Build public/op-jp-index.json from the official Japanese One Piece card list.

The official site does not send CORS headers, so the app cannot fetch it
browser-direct from rarebox.io. This script runs as a bounded, opt-in asset
builder and ships normalized public card metadata as a static JSON asset.

    python3 scripts/build_op_jp_index.py
"""

from __future__ import annotations

import html
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

# One Piece Japanese set logos (populated manually for best quality)
# Add URLs here when available. Use official or high-quality hosted images.
OP_JP_SET_LOGOS = {
    # Example:
    # "OP-01": "https://example.com/logos/romance-dawn.png",
}

BASE = "https://www.onepiece-cardgame.com"
CARDLIST = f"{BASE}/cardlist/"
OUT = Path(__file__).resolve().parent.parent / "public" / "op-jp-index.json"
HEADERS = {
    "User-Agent": "Rarebox/1.4 (+https://rarebox.io)",
    "Accept": "text/html,application/xhtml+xml",
}


def fetch_cardlist(data: dict[str, str] | None = None) -> str:
    req = urllib.request.Request(CARDLIST, headers=HEADERS)
    if data is not None:
        req.data = urllib.parse.urlencode(data).encode()
        req.add_header("Content-Type", "application/x-www-form-urlencoded")
    with urllib.request.urlopen(req, timeout=40) as resp:
        return resp.read().decode("utf-8", "replace")


def clean(raw: str) -> str:
    # Aggressive HTML stripping first (handles <br class="..."> etc.)
    raw = re.sub(r"<[^>]+>", " ", raw)
    raw = html.unescape(raw)
    return re.sub(r"\s+", " ", raw).strip()


def set_name_from_label(label: str, code: str) -> str:
    text = clean(label)
    text = re.sub(r"【[^】]+】", "", text).strip()
    # Keep product family for starter decks, but remove generic booster prefixes.
    text = re.sub(r"^(ブースターパック|エクストラブースター|プレミアムブースター)\s*", "", text)
    # Final safety: remove any remaining HTML fragments
    text = re.sub(r"<[^>]*>", "", text).strip()
    text = re.sub(r"\s+", " ", text).strip()
    return text or code


def parse_sets(page: str) -> list[dict]:
    sets: list[dict] = []
    seen: set[str] = set()
    for val, label in re.findall(r'<option value="([^"]*)"[^>]*>(.*?)</option>', page, re.S | re.DOTALL):
        if not val or val == "ALL":
            continue
        m = re.search(r"【([^】]+)】", html.unescape(label))
        if not m:
            continue
        code = m.group(1).strip()
        if code in seen:
            continue
        seen.add(code)
        sets.append({
            "id": code,
            "code": code,
            "name": set_name_from_label(label, code),
            "seriesId": val,
            "releaseDate": None,
            "logo": OP_JP_SET_LOGOS.get(code, ""),
        })
    return sets



def get_limitless_jp_image(set_code: str, number: str) -> str:
    """
    Try to construct a Limitless One Piece image URL for Japanese cards.
    Pattern is guessed and may need adjustment.
    Example: https://limitlesstcg.com/images/cards/jp/op01/OP01-001.png
    """
    # Normalize set code (lowercase, remove dashes if needed)
    set_lower = set_code.lower().replace("-", "")
    num = number.split("_")[0]  # remove _p1, _p2 variants for base image
    return f"https://limitlesstcg.com/images/cards/jp/{set_lower}/{num}.png"

def absolute_image(src: str) -> str:
    src = html.unescape(src or "").split("?")[0]
    src = src.replace("../", "/")
    if src.startswith("//"):
        return "https:" + src
    if src.startswith("/"):
        return BASE + src
    if src.startswith("http"):
        return src
    return f"{BASE}/{src.lstrip('/')}"


def parse_cards(page: str, set_code: str, set_name: str) -> list[dict]:
    cards: list[dict] = []
    blocks = re.findall(r'<dl class="modalCol" id="([^"]+)">(.*?)</dl>', page, re.S)
    for fallback_id, block in blocks:
        info = re.search(r'<div class="infoCol">(.*?)</div>', block, re.S)
        spans = re.findall(r"<span>(.*?)</span>", info.group(1), re.S) if info else []
        number = clean(spans[0]) if spans else fallback_id
        rarity = clean(spans[1]) if len(spans) > 1 else ""
        card_type = clean(spans[2]) if len(spans) > 2 else ""
        name_match = re.search(r'<div class="cardName">(.*?)</div>', block, re.S)
        name = clean(name_match.group(1)) if name_match else fallback_id
        img_match = re.search(r'<img[^>]+data-src="([^"]+)"', block)
        # Prefer Limitless images (better hotlinking support)
        image = get_limitless_jp_image(set_code, number)
        # Fallback to official site image if Limitless doesn't have it
        if not image and img_match:
            image = absolute_image(img_match.group(1))
        cards.append({
            "id": f"jp:{fallback_id}",
            "name": name,
            "number": number,
            "image": image,
            "price": None,
            "rarity": rarity,
            "type": card_type,
            "setId": set_code,
            "setName": set_name,
            "lang": "ja",
        })
    cards.sort(key=lambda c: natural_key(c["number"]))
    return cards


def natural_key(value: str) -> tuple:
    parts = re.split(r"(\d+)", value)
    return tuple(int(p) if p.isdigit() else p.lower() for p in parts)


def main() -> int:
    index_page = fetch_cardlist()
    sets = parse_sets(index_page)
    if len(sets) < 20:
        print(f"only found {len(sets)} Japanese One Piece sets; refusing to write", file=sys.stderr)
        return 1

    all_cards: dict[str, list[dict]] = {}
    for idx, s in enumerate(sets, 1):
        page = fetch_cardlist({"search": "true", "series": s["seriesId"]})
        cards = parse_cards(page, s["id"], s["name"])
        if not cards:
            print(f"  {s['id']}: no cards found", file=sys.stderr)
        s["total"] = len(cards)
        all_cards[s["id"]] = cards
        print(f"{idx:02d}/{len(sets)} {s['id']}: {len(cards)} cards")
        time.sleep(0.2)

    total = sum(len(v) for v in all_cards.values())
    if total < 1000:
        print(f"only parsed {total} cards; refusing to write", file=sys.stderr)
        return 1

    payload = {
        "source": CARDLIST,
        "builtAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "sets": sets,
        "cards": all_cards,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")))
    print(f"wrote {OUT}: {len(sets)} sets, {total} cards, {OUT.stat().st_size // 1024}KB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
