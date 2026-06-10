"""GET /api/og — dynamic Open Graph banner (1200x630 PNG).

Rendered in the Tactile design language: cream paper, ink lines, hard
shadows, the "Collect. Track. Trade. Win." headline with a yellow marker,
and three showcase cards with price tags. The card trio rotates daily and
prices are refreshed live (short timeouts, seeded fallbacks) so shared
links on Discord / Telegram / WhatsApp / X show current market values.

Heavily cached at the CDN (6h) — scrapers and humans hit the cache.
"""

from http.server import BaseHTTPRequestHandler
import io
import os
import datetime

import httpx
from PIL import Image, ImageDraw, ImageFont

# ── Tactile palette ──────────────────────────────────────────────────────────
CREAM = (250, 246, 239)
INK = (20, 20, 20)
YELLOW = (255, 210, 63)
PINK = (255, 107, 169)
BLUE = (79, 134, 247)
GREEN = (47, 191, 113)
SECONDARY = (95, 90, 81)
WHITE = (255, 255, 255)

FONT_PATH = os.path.join(os.path.dirname(__file__), "_fonts", "ArchivoBlack-Regular.ttf")

# Showcase pool — same cards the landing page rotates. `live` describes how to
# refresh the price (fast sources only; the seeded price is the fallback).
POOL = [
    {"name": "Charizard", "img": "https://images.pokemontcg.io/base1/4.png",
     "price": 614.49, "live": None},  # pokemontcg.io is too slow for scraper timeouts
    {"name": "Lugia 1st Ed", "img": "https://images.pokemontcg.io/neo1/9.png",
     "price": 1599.98, "live": None},
    {"name": "TR's Mewtwo ex", "img": "https://images.pokemontcg.io/sv10/231.png",
     "price": 569.18, "live": None},
    {"name": "Manga Luffy", "img": "https://optcgapi.com/media/static/Card_Images/OP05-119_r2.jpg",
     "price": 3975.00, "live": None},
    {"name": "Blue-Eyes", "img": "https://images.ygoprodeck.com/images/cards_small/89631139.jpg",
     "price": 681.49,
     "live": {"t": "ygo", "name": "Blue-Eyes White Dragon", "set": "LOB-E001"}},
    {"name": "Ahri Signature",
     "img": "https://cmsassets.rgpub.io/sanity/images/dsfx7636/game_data_live/e5fe571a8f09c0a9e76345ec32b446480f54617c-1488x2078.png",
     "price": 2250.67,
     "live": {"t": "pc", "q": "riftbound origins ahri", "match": "[Signature] #303"}},
    {"name": "Traveling Chocobo",
     "img": "https://cards.scryfall.io/normal/front/7/1/71b97e69-f198-41ec-9385-015ec2f0160f.jpg",
     "price": 5950.00,
     "live": {"t": "scry", "id": "71b97e69-f198-41ec-9385-015ec2f0160f"}},
    {"name": "The Soul Stone",
     "img": "https://cards.scryfall.io/normal/front/f/9/f9d80efc-e829-4257-83e8-f37b0b68de57.jpg",
     "price": 1224.49,
     "live": {"t": "scry", "id": "f9d80efc-e829-4257-83e8-f37b0b68de57"}},
]


def pick_cards():
    """Three cards, rotating daily — deterministic so the CDN cache is stable."""
    day = datetime.date.today().toordinal()
    n = len(POOL)
    return [POOL[day % n], POOL[(day + 3) % n], POOL[(day + 5) % n]]


def fetch_live_price(client, card):
    live = card.get("live")
    if not live:
        return card["price"]
    try:
        if live["t"] == "scry":
            d = client.get(f"https://api.scryfall.com/cards/{live['id']}").json()
            p = d.get("prices", {})
            v = p.get("usd") or p.get("usd_foil")
            return float(v) if v else card["price"]
        if live["t"] == "ygo":
            d = client.get("https://db.ygoprodeck.com/api/v7/cardinfo.php",
                           params={"name": live["name"]}).json()
            c = d.get("data", [{}])[0]
            for s in c.get("card_sets", []):
                if s.get("set_code") == live["set"] and float(s.get("set_price") or 0) > 0:
                    return float(s["set_price"])
        if live["t"] == "pc":
            d = client.get("https://www.pricecharting.com/search-products",
                           params={"type": "prices", "q": live["q"]},
                           headers={"Accept": "application/json"}).json()
            for prod in d.get("products", []):
                if live["match"] in (prod.get("productName") or ""):
                    v = float(str(prod.get("price1", "")).replace("$", "").replace(",", "") or 0)
                    if v > 0:
                        return v
    except Exception:
        pass
    return card["price"]


def fmt_price(p):
    return "${:,.2f}".format(p)


def rounded(draw, box, radius, fill=None, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def make_card_tile(client, card, size=(225, 315)):
    """White-framed card scan with ink border + price chip, on transparency."""
    w, h = size
    tile = Image.new("RGBA", (w, h + 36), (0, 0, 0, 0))
    d = ImageDraw.Draw(tile)
    # hard shadow then frame
    rounded(d, (10, 10, w - 1, h - 1), 18, fill=INK)
    rounded(d, (0, 0, w - 11, h - 11), 18, fill=WHITE, outline=INK, width=5)
    # card art
    try:
        r = client.get(card["img"])
        art = Image.open(io.BytesIO(r.content)).convert("RGBA")
        aw, ah = w - 11 - 24, h - 11 - 24
        art.thumbnail((aw, ah), Image.LANCZOS)
        tile.paste(art, (12 + (aw - art.width) // 2, 12 + (ah - art.height) // 2), art)
    except Exception:
        pass
    # price chip
    font = ImageFont.truetype(FONT_PATH, 26)
    label = fmt_price(card["_price"])
    tw = d.textlength(label, font=font)
    chip = Image.new("RGBA", (int(tw) + 36, 48), (0, 0, 0, 0))
    cd = ImageDraw.Draw(chip)
    rounded(cd, (0, 0, chip.width - 5, 42), 12, fill=YELLOW, outline=INK, width=4)
    cd.text((18, 6), label, font=font, fill=INK)
    chip = chip.rotate(-4, expand=True, resample=Image.BICUBIC)
    tile.alpha_composite(chip, ((w - chip.width) // 2, h - 38))
    return tile


def build_banner():
    W, H = 1200, 630
    img = Image.new("RGBA", (W, H), CREAM + (255,))
    d = ImageDraw.Draw(img)

    # outer Tactile frame
    rounded(d, (12, 12, W - 13, H - 13), 26, outline=INK, width=6)

    f_word = ImageFont.truetype(FONT_PATH, 40)
    f_h1 = ImageFont.truetype(FONT_PATH, 64)
    f_sub = ImageFont.truetype(FONT_PATH, 27)
    f_chip = ImageFont.truetype(FONT_PATH, 21)
    f_rb = ImageFont.truetype(FONT_PATH, 26)

    # brand: RB sticker + wordmark
    sticker = Image.new("RGBA", (84, 84), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sticker)
    rounded(sd, (8, 8, 71, 71), 17, fill=INK)         # hard shadow
    rounded(sd, (2, 2, 65, 65), 17, fill=YELLOW, outline=INK, width=5)
    sd.text((14, 17), "RB", font=f_rb, fill=INK)
    sticker = sticker.rotate(6, expand=True, resample=Image.BICUBIC)
    img.alpha_composite(sticker, (56, 44))
    d.text((152, 62), "rarebox", font=f_word, fill=INK)

    # headline with marker behind "Trade."
    x0, y1, y2 = 60, 178, 258
    d.text((x0, y1), "Collect. Track.", font=f_h1, fill=INK)
    marker_w = d.textlength("Trade.", font=f_h1)
    d.rectangle((x0 - 6, y2 + 22, x0 + marker_w + 10, y2 + 72), fill=YELLOW)
    d.text((x0, y2), "Trade. ", font=f_h1, fill=INK)
    d.text((x0 + d.textlength("Trade. ", font=f_h1), y2), "Win.", font=f_h1, fill=INK)

    # subline
    d.text((x0 + 2, 386), "Live prices for six TCGs.", font=f_sub, fill=SECONDARY)
    d.text((x0 + 2, 422), "Your whole binder, one shelf.", font=f_sub, fill=SECONDARY)

    # chips: FREE / NO ACCOUNT / rarebox.io pill
    def chip(text, fill, text_fill, x, y):
        tw = d.textlength(text, font=f_chip)
        rounded(d, (x, y, x + tw + 30, y + 42), 12, fill=fill, outline=INK, width=4)
        d.text((x + 15, y + 8), text, font=f_chip, fill=text_fill)
        return x + tw + 30 + 14

    cx = chip("FREE", YELLOW, INK, x0, 496)
    cx = chip("NO ACCOUNT", PINK, INK, cx, 496)
    chip("RAREBOX.IO", INK, CREAM, cx, 496)

    # three cards, fanned on the right
    client = httpx.Client(timeout=3.0, follow_redirects=True,
                          headers={"User-Agent": "rarebox-og/1.0"})
    cards = pick_cards()
    for c in cards:
        c["_price"] = fetch_live_price(client, c)
    tiles = [make_card_tile(client, c) for c in cards]
    client.close()

    placements = [
        (655, 165, -8),   # back left
        (910, 175, 9),    # back right
        (775, 130, 2),    # front center (drawn last)
    ]
    order = [0, 1, 2]
    for idx in order:
        x, y, angle = placements[idx]
        t = tiles[idx].rotate(angle, expand=True, resample=Image.BICUBIC)
        img.alpha_composite(t, (x, y))

    return img.convert("RGB")


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            banner = build_banner()
        except Exception:
            # never break a link preview — plain branded fallback
            banner = Image.new("RGB", (1200, 630), CREAM)
            d = ImageDraw.Draw(banner)
            try:
                f = ImageFont.truetype(FONT_PATH, 84)
                d.text((80, 240), "rarebox", font=f, fill=INK)
            except Exception:
                pass
        buf = io.BytesIO()
        banner.save(buf, "PNG", optimize=True)
        data = buf.getvalue()
        self.send_response(200)
        self.send_header("Content-Type", "image/png")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "public, s-maxage=21600, stale-while-revalidate=86400")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(data)
