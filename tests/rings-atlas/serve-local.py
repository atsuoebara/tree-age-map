#!/usr/bin/env python3
"""Fixture-only Atlas-1 server. No production app code or private data."""
import argparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ATLAS = Path(__file__).resolve().parent / "atlas-1-synthetic.html"
AWAY = b"""<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><h1>Atlas-1 away test</h1><p>No real data. Use Safari Back to return to Atlas-1 and check pageshow.persisted.</p><button onclick="history.back()" style="font-size:20px;padding:12px">Back / &#25147;&#12427;</button></body></html>"""

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_fixture(False)
    def do_HEAD(self):
        self.send_fixture(True)
    def do_POST(self):
        self.send_error(405)
    def send_fixture(self, head_only):
        path = urlsplit(self.path).path
        if path in ("/", "/atlas", "/atlas-1-synthetic.html"):
            data, status, mime = ATLAS.read_bytes(), 200, "text/html; charset=utf-8"
        elif path == "/away":
            data, status, mime = AWAY, 200, "text/html; charset=utf-8"
        else:
            data, status, mime = b"Not found", 404, "text/plain; charset=utf-8"
        self.send_response(status)
        for name, value in [
            ("Content-Type", mime), ("Content-Length", str(len(data))),
            ("Cache-Control", "max-age=0"), ("X-Content-Type-Options", "nosniff"),
            ("X-Robots-Tag", "noindex,nofollow,noarchive"), ("Referrer-Policy", "no-referrer"),
            ("Content-Security-Policy", "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'; img-src 'none'; form-action 'none'; base-uri 'none'")
        ]:
            self.send_header(name, value)
        self.end_headers()
        if not head_only:
            self.wfile.write(data)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--lan", action="store_true", help="Same-Wi-Fi iPhone access")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    if not 1024 <= args.port <= 65535:
        parser.error("Port must be 1024-65535")
    host = "0.0.0.0" if args.lan else "127.0.0.1"
    with ThreadingHTTPServer((host, args.port), Handler) as server:
        print(f"Atlas-1 synthetic-only server: http://{host}:{args.port}/atlas")
        print("With --lan use your PC local Wi-Fi IP in Safari on the same network.")
        print("Stop with Ctrl+C; never forward/open this port to the Internet.")
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass

if __name__ == "__main__":
    main()
