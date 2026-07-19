"""GET /api/pricecharting_grades?id=PRICECHARTING_ID.

PriceCharting's CORS-open search JSON exposes only loose, PSA 10, and Grade 9.
The public product page contains the complete grade guide. This same-origin,
read-only proxy resolves a numeric product ID and returns a normalized map.
"""

from html.parser import HTMLParser
from http.server import BaseHTTPRequestHandler
import json
import re
import urllib.parse
import urllib.request

PC_HOST = "www.pricecharting.com"
MAX_HTML = 2_000_000
LABEL_KEYS = {
    "Ungraded": "ungraded",
    **{f"Grade {n}": f"grade{n}" for n in range(1, 10)},
    "Grade 9.5": "grade9_5",
    "TAG 10": "tag10",
    "ACE 10": "ace10",
    "SGC 10": "sgc10",
    "CGC 10": "cgc10",
    "PSA 10": "psa10",
    "BGS 10": "bgs10",
    "BGS 10 Black": "bgs10_black",
    "CGC 10 Pristine": "cgc10_pristine",
}


def parse_money(text):
    value = re.sub(r"[^0-9.]", "", text or "")
    if not value:
        return None
    try:
        number = float(value)
        return number if number >= 0 else None
    except ValueError:
        return None


class GradeTableParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_cell = False
        self.full_depth = 0
        self.cell_parts = []
        self.row = []
        self.prices = {}

    def handle_starttag(self, tag, attrs):
        attr_map = dict(attrs)
        if tag == "div" and (self.full_depth or attr_map.get("id") == "full-prices"):
            self.full_depth += 1
        if self.full_depth and tag in ("td", "th"):
            self.in_cell = True
            self.cell_parts = []

    def handle_data(self, data):
        if self.in_cell:
            self.cell_parts.append(data)

    def handle_endtag(self, tag):
        if tag in ("td", "th") and self.in_cell:
            self.row.append(" ".join("".join(self.cell_parts).split()))
            self.in_cell = False
        elif tag == "tr":
            if len(self.row) >= 2 and self.row[0] in LABEL_KEYS:
                value = parse_money(self.row[1])
                if value is not None:
                    self.prices[LABEL_KEYS[self.row[0]]] = value
            self.row = []
        elif tag == "div" and self.full_depth:
            self.full_depth -= 1


def parse_grade_prices(html):
    parser = GradeTableParser()
    parser.feed(html)
    return parser.prices


class handler(BaseHTTPRequestHandler):
    def _json(self, status, payload):
        body = json.dumps(payload, separators=(",", ":")).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=21600")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        raw_id = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query).get("id", [""])[0]
        if not re.fullmatch(r"\d{1,20}", raw_id):
            self._json(400, {"error": "invalid_id"})
            return
        url = f"https://{PC_HOST}/game/{raw_id}"
        req = urllib.request.Request(url, headers={
            "User-Agent": "Rarebox/1.4 (+https://rarebox.io)",
            "Accept": "text/html",
        })
        try:
            with urllib.request.urlopen(req, timeout=12) as response:
                final = urllib.parse.urlparse(response.geturl())
                if final.hostname != PC_HOST:
                    raise ValueError("unexpected_redirect")
                body = response.read(MAX_HTML + 1)
                if len(body) > MAX_HTML:
                    raise ValueError("response_too_large")
                prices = parse_grade_prices(body.decode("utf-8", "replace"))
                if not prices:
                    self._json(404, {"error": "no_grade_data"})
                    return
                self._json(200, {"id": raw_id, "product_url": response.geturl(), "prices": prices})
        except Exception:
            self._json(502, {"error": "upstream_unavailable"})
