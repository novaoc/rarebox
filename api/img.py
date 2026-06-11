"""GET /api/img?u=<url> — CORS relay for bulk offline-image downloads.

Four of the six card-image CDNs (ygoprodeck, lorcast, optcgapi, rgpub)
send no Access-Control-Allow-Origin header, so the browser can neither
read nor re-encode their images for the offline pack. This relay adds
the header. It is used ONLY by the Settings → Offline Card Images
downloader — normal browsing always loads images straight from the
source CDNs.

Strictly allowlisted by host (no open proxy), aggressively CDN-cached
(immutable card scans), and capped to small image responses.
"""

from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import urllib.request

ALLOWED_HOSTS = {
    "images.ygoprodeck.com",
    "cards.lorcast.io",
    "optcgapi.com",
    "cmsassets.rgpub.io",
}
MAX_BYTES = 4_000_000  # card scans are ≤ ~1MB; refuse anything strange


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        q = parse_qs(urlparse(self.path).query)
        target = (q.get("u") or [""])[0]
        parsed = urlparse(target)
        if parsed.scheme != "https" or parsed.hostname not in ALLOWED_HOSTS:
            self.send_response(400)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(b"unsupported url")
            return

        try:
            req = urllib.request.Request(
                target, headers={"User-Agent": "Rarebox/1.4 (+https://rarebox.io)"}
            )
            with urllib.request.urlopen(req, timeout=20) as resp:
                data = resp.read(MAX_BYTES + 1)
                ctype = resp.headers.get("Content-Type", "image/jpeg")
        except Exception:
            self.send_response(502)
            self.end_headers()
            return

        if len(data) > MAX_BYTES or not ctype.startswith("image/"):
            self.send_response(502)
            self.end_headers()
            return

        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Access-Control-Allow-Origin", "*")
        # Card scans never change — let Vercel's CDN absorb repeat downloads
        self.send_header(
            "Cache-Control", "public, max-age=86400, s-maxage=31536000, immutable"
        )
        self.end_headers()
        self.wfile.write(data)
