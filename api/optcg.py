"""GET /api/optcg?action=sets | action=cards&set=OP-01

Proxy for optcgapi.com (One Piece Card Game). optcgapi serves card data and
market prices but sends no CORS headers, so the browser can't call it directly —
this serverless function fetches it server-side and re-exposes it with CORS.
Card images are hosted on optcgapi.com and load fine in <img> tags directly.
"""

from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import json
import httpx

from api._shared import cache_get, cache_set, HEADERS

BASE = "https://optcgapi.com/api"


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        params = parse_qs(urlparse(self.path).query)
        action = params.get("action", ["sets"])[0]
        set_id = (params.get("set", [""])[0]).strip()

        try:
            if action == "sets":
                key = "optcg:sets"
                cached = cache_get(key)
                if cached is not None:
                    self._json({"sets": cached, "cached": True})
                    return
                data = self._fetch(f"{BASE}/allSets/")
                sets = [
                    {"set_id": s.get("set_id"), "set_name": s.get("set_name")}
                    for s in data if s.get("set_id")
                ]
                cache_set(key, sets)
                self._json({"sets": sets})

            elif action == "cards":
                if not set_id:
                    self._json({"error": "missing set param"}, 400)
                    return
                key = f"optcg:cards:{set_id}"
                cached = cache_get(key)
                if cached is not None:
                    self._json({"cards": cached, "cached": True})
                    return
                data = self._fetch(f"{BASE}/sets/{set_id}/")
                cards = [
                    {
                        "id": c.get("card_set_id"),
                        "name": c.get("card_name"),
                        "number": c.get("card_set_id"),
                        "rarity": c.get("rarity"),
                        "price": c.get("market_price"),
                        "image": c.get("card_image"),
                    }
                    for c in data if c.get("card_set_id")
                ]
                cache_set(key, cards)
                self._json({"cards": cards})

            else:
                self._json({"error": "unknown action"}, 400)

        except httpx.HTTPStatusError as e:
            self._json({"error": f"upstream {e.response.status_code}"}, 502)
        except Exception as e:
            self._json({"error": str(e)}, 502)

    def _fetch(self, url):
        with httpx.Client(timeout=20, headers=HEADERS, follow_redirects=True) as client:
            r = client.get(url)
            r.raise_for_status()
            return r.json()

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def _json(self, data, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self._cors()
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
