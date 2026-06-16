"""GET /api/op-jp-card-image?file=ST12-017_p1.png

Same-origin proxy for Japanese One Piece card images.

The official site serves images with Cross-Origin-Resource-Policy: same-site,
which blocks embedding from rarebox.io. This function acts as a locked-down
proxy so the app can display the images.

Security:
- Only accepts a strict allowlist of filenames.
- Never accepts paths, query strings, or other domains.
- Uses a short timeout.
"""

import os
import re
import urllib.request
from http.server import BaseHTTPRequestHandler

ALLOWED_FILENAME = re.compile(r"^[A-Z0-9-]{2,30}(?:_p\d+)?\.png$")
OFFICIAL_BASE = "https://www.onepiece-cardgame.com/images/cardlist/card/"


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        # Vercel passes query string in self.path
        if "?" not in self.path:
            self.send_error(400, "Missing file parameter")
            return

        qs = self.path.split("?", 1)[1]
        params = dict(p.split("=", 1) for p in qs.split("&") if "=" in p)
        filename = params.get("file", "")

        if not ALLOWED_FILENAME.match(filename):
            self.send_error(400, "Invalid filename")
            return

        url = OFFICIAL_BASE + filename

        try:
            req = urllib.request.Request(
                url,
                headers={
                    "User-Agent": "Rarebox/1.4 (+https://rarebox.io)",
                    "Referer": "https://www.onepiece-cardgame.com/",
                },
            )
            with urllib.request.urlopen(req, timeout=8) as resp:
                if resp.status != 200:
                    self.send_error(502, "Upstream error")
                    return

                data = resp.read()
                self.send_response(200)
                self.send_header("Content-Type", "image/png")
                self.send_header(
                    "Cache-Control", "public, max-age=31536000, immutable"
                )
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)
        except Exception:
            self.send_error(502, "Upstream fetch failed")
