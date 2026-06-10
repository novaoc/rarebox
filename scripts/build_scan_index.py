#!/usr/bin/env python3
"""Build the card-scan hash index (public/scan-index/*.bin).

For each card image we store a 64-bit dHash and a 64-bit pHash. The client
computes the same two hashes from the camera crop and matches by Hamming
distance — the approach used by the Lexmark card-sorter patent (US 12,200,174)
and every verified open-source card scanner.

The algorithm here MUST stay in sync with src/utils/imageHash.js:
  grayscale = 0.299R + 0.587G + 0.114B
  dHash: resize 9x8 (bilinear) -> bit = px[x] > px[x+1], row-major
  pHash: resize 32x32 (bilinear) -> 2D DCT-II -> top-left 8x8 block
         (skip the DC term, keep 64 coefficients starting after it... we use
         the 8x8 block with DC replaced by the block median comparison)
         bit = coeff > median(non-DC coefficients)

Binary format (little-endian), per record:
  u8  id length
  ..  id (utf-8)
  8B  dHash
  8B  pHash
File header: 4-byte magic "RBX1", u32 record count.

Usage:
  python3 scripts/build_scan_index.py pokemon     # EN pokemon via bulk data
  python3 scripts/build_scan_index.py pokemon-jp  # JP pokemon via tcgdex
  python3 scripts/build_scan_index.py riftbound
  python3 scripts/build_scan_index.py lorcana
  python3 scripts/build_scan_index.py one-piece
"""

import io
import json
import math
import os
import struct
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

from PIL import Image

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "scan-index")
CONCURRENCY = 16
UA = {"User-Agent": "rarebox-scan-index/1.0 (github.com/novaoc/rarebox)"}


def fetch_json(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())


def fetch_image(url, retries=2):
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=25) as r:
                return Image.open(io.BytesIO(r.read())).convert("RGB")
        except Exception:
            if attempt == retries:
                return None
            time.sleep(1 + attempt)


# ── hashing (mirror of src/utils/imageHash.js) ──────────────────────────────

def to_gray(img, w, h):
    img = img.resize((w, h), Image.BILINEAR)
    px = img.load()
    out = []
    for y in range(h):
        row = []
        for x in range(w):
            r, g, b = px[x, y][:3]
            row.append(0.299 * r + 0.587 * g + 0.114 * b)
        out.append(row)
    return out


def dhash64(img):
    g = to_gray(img, 9, 8)
    bits = 0
    for y in range(8):
        for x in range(8):
            bits = (bits << 1) | (1 if g[y][x] > g[y][x + 1] else 0)
    return bits


_DCT_N = 32
_COS = [[math.cos((2 * x + 1) * u * math.pi / (2 * _DCT_N)) for x in range(_DCT_N)] for u in range(_DCT_N)]


def phash64(img):
    g = to_gray(img, _DCT_N, _DCT_N)
    # rows then cols 1D DCT-II (unnormalized — thresholding makes scale irrelevant)
    tmp = [[sum(g[y][x] * _COS[u][x] for x in range(_DCT_N)) for u in range(_DCT_N)] for y in range(_DCT_N)]
    dct = [[sum(tmp[y][u] * _COS[v][y] for y in range(_DCT_N)) for u in range(_DCT_N)] for v in range(_DCT_N)]
    block = [dct[v][u] for v in range(8) for u in range(8)]
    coeffs = block[1:]  # skip DC
    med = sorted(coeffs)[len(coeffs) // 2]
    bits = 0
    for c in block:
        bits = (bits << 1) | (1 if c > med else 0)
    return bits


# ── per-game card lists ──────────────────────────────────────────────────────

def cards_pokemon():
    sets = fetch_json("https://cdn.jsdelivr.net/gh/PokemonTCG/pokemon-tcg-data@master/sets/en.json")
    out = []
    for s in sets:
        try:
            cards = fetch_json(f"https://cdn.jsdelivr.net/gh/PokemonTCG/pokemon-tcg-data@master/cards/en/{s['id']}.json")
        except Exception:
            continue
        for c in cards:
            img = (c.get("images") or {}).get("small")
            if img:
                out.append((c["id"], img))
    return out


def cards_pokemon_jp():
    sets = fetch_json("https://api.tcgdex.net/v2/ja/sets")
    out = []
    seen = set()
    for s in sets:
        try:
            d = fetch_json(f"https://api.tcgdex.net/v2/ja/sets/{s['id']}")
        except Exception:
            continue
        for c in d.get("cards") or []:
            if c.get("image") and c["id"] not in seen:
                seen.add(c["id"])
                out.append((c["id"], c["image"] + "/low.webp"))
    return out


def cards_riftbound():
    sets = fetch_json("https://api.riftcodex.com/sets")["items"]
    out = []
    for s in sets:
        page, total, got = 1, 1, 0
        while got < total and page <= 20:
            d = fetch_json(f"https://api.riftcodex.com/cards?set_id={s['set_id']}&limit=100&page={page}")
            total = d.get("total", 0)
            for c in d.get("items", []):
                got += 1
                img = (c.get("media") or {}).get("image_url")
                if img:
                    out.append((c["id"], img))
            page += 1
    return out


def cards_lorcana():
    sets = fetch_json("https://api.lorcast.com/v0/sets")["results"]
    out = []
    for s in sets:
        d = fetch_json(f"https://api.lorcast.com/v0/sets/{s['code']}/cards")
        for c in (d if isinstance(d, list) else d.get("results", [])):
            img = ((c.get("image_uris") or {}).get("digital") or {}).get("small")
            if img:
                out.append((c["id"], img))
    return out


def cards_one_piece():
    d = fetch_json("https://optcgapi.com/api/allSetCards/")
    out = []
    seen = set()
    for c in d:
        img = c.get("card_image")
        cid = c.get("card_set_id")
        # variants share card_set_id — key on image filename to keep each art
        key = (cid, img)
        if img and cid and key not in seen:
            seen.add(key)
            out.append((cid, img))
    return out


GAMES = {
    "pokemon": cards_pokemon,
    "pokemon-jp": cards_pokemon_jp,
    "riftbound": cards_riftbound,
    "lorcana": cards_lorcana,
    "one-piece": cards_one_piece,
}


def build(game):
    cards = GAMES[game]()
    print(f"[{game}] {len(cards)} cards with images", flush=True)
    records = []
    done = 0

    def work(item):
        cid, url = item
        img = fetch_image(url)
        if img is None:
            return None
        return (cid, dhash64(img), phash64(img))

    t0 = time.time()
    with ThreadPoolExecutor(max_workers=CONCURRENCY) as ex:
        futs = [ex.submit(work, it) for it in cards]
        for f in as_completed(futs):
            r = f.result()
            done += 1
            if r:
                records.append(r)
            if done % 500 == 0:
                rate = done / (time.time() - t0)
                eta = (len(cards) - done) / rate / 60
                print(f"[{game}] {done}/{len(cards)} ({rate:.0f}/s, eta {eta:.0f}m)", flush=True)

    records.sort(key=lambda r: r[0])
    os.makedirs(OUT_DIR, exist_ok=True)
    path = os.path.join(OUT_DIR, f"{game}.bin")
    with open(path, "wb") as fh:
        fh.write(b"RBX1")
        fh.write(struct.pack("<I", len(records)))
        for cid, dh, ph in records:
            b = cid.encode("utf-8")
            fh.write(struct.pack("<B", len(b)))
            fh.write(b)
            fh.write(struct.pack("<QQ", dh, ph))
    print(f"[{game}] wrote {len(records)} records → {path} ({os.path.getsize(path)/1024:.0f} KB)", flush=True)


if __name__ == "__main__":
    for game in sys.argv[1:] or ["pokemon"]:
        build(game)
