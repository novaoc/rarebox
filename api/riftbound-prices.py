"""GET /api/riftbound-prices — TCGplayer market prices for every Riftbound card.

Proxies tcgcsv.com (daily TCGplayer dumps; no CORS, hence this function) and
returns one combined map keyed by TCGplayer product id:

    { "prices": { "659765": { "normal": null, "foil": 68.68 }, ... } }

riftcodex.com card objects carry the same `tcgplayer_id`, so the frontend can
join prices exactly — no fuzzy name/number matching. This covers promo sets
(PR / OPP / JDG) that PriceCharting barely lists, and full 280-350 card sets
that PriceCharting's 100-result search cap truncates.
"""

from http.server import BaseHTTPRequestHandler
import asyncio
import json
import time

import httpx

TCGCSV = "https://tcgcsv.com/tcgplayer"
RIFTBOUND_CATEGORY = 89  # "Riftbound League of Legends Trading Card Game"

# tcgcsv ToS: identify with a custom app User-Agent (generic/missing UAs are
# blocked), and only re-sync when last-updated.txt has a newer timestamp.
HEADERS = {
    "User-Agent": "Rarebox/1.4 (+https://rarebox.io)",
    "Accept": "application/json",
}

# ── Cache (in-memory, per-instance) ──────────────────────────────────────────
# Prices are cached against tcgcsv's last-updated.txt timestamp and reused
# until that timestamp changes (tcgcsv updates once a day and asks consumers
# not to re-sync more often). The stamp itself is only polled every 30 min.
_cache: dict = {}
STAMP_TTL = 60 * 30

def cache_get(key: str):
    entry = _cache.get(key)
    if entry and time.time() < entry["expires"]:
        return entry["data"]
    return None

def cache_set(key: str, data, ttl):
    _cache[key] = {"data": data, "expires": time.time() + ttl}


async def fetch_last_updated() -> str:
    async with httpx.AsyncClient(timeout=10, headers=HEADERS) as client:
        r = await client.get("https://tcgcsv.com/last-updated.txt")
        r.raise_for_status()
        return r.text.strip()


async def fetch_all_prices() -> dict:
    async with httpx.AsyncClient(timeout=25, follow_redirects=True, headers=HEADERS) as client:
        groups_resp = await client.get(f"{TCGCSV}/{RIFTBOUND_CATEGORY}/groups")
        groups_resp.raise_for_status()
        groups = groups_resp.json().get("results", [])

        async def fetch_group(group_id):
            try:
                r = await client.get(f"{TCGCSV}/{RIFTBOUND_CATEGORY}/{group_id}/prices")
                r.raise_for_status()
                return r.json().get("results", [])
            except Exception:
                return []  # one missing group must not sink the whole map

        results = await asyncio.gather(*(fetch_group(g["groupId"]) for g in groups))

    prices: dict[str, dict] = {}
    for rows in results:
        for row in rows:
            pid = str(row.get("productId", ""))
            if not pid:
                continue
            price = row.get("marketPrice") or row.get("midPrice")
            if not price:
                continue
            sub = "foil" if (row.get("subTypeName") or "").lower() == "foil" else "normal"
            prices.setdefault(pid, {"normal": None, "foil": None})[sub] = price
    return prices


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        # Re-sync only when tcgcsv's daily dump actually changed.
        stamp = cache_get("stamp")
        if stamp is None:
            try:
                stamp = asyncio.run(fetch_last_updated())
                cache_set("stamp", stamp, STAMP_TTL)
            except Exception:
                stamp = None

        entry = _cache.get("prices")
        if entry and (stamp is None or entry["stamp"] == stamp):
            self._json({"prices": entry["data"], "cached": True})
            return

        try:
            prices = asyncio.run(fetch_all_prices())
            if not prices:
                if entry:  # serve stale rather than nothing
                    self._json({"prices": entry["data"], "cached": True})
                    return
                self._json({"error": "tcgcsv returned no prices"}, 502)
                return
            _cache["prices"] = {"data": prices, "stamp": stamp, "expires": float("inf")}
            self._json({"prices": prices, "cached": False})
        except Exception as e:
            if entry:
                self._json({"prices": entry["data"], "cached": True})
                return
            self._json({"error": str(e)}, 502)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def _json(self, data, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "public, max-age=3600, s-maxage=21600")
        self._cors()
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
