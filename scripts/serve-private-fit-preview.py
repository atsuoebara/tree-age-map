#!/usr/bin/env python3
"""Temporary, auth-gated LAN preview for a user's own FIT, with NO upload route.
Run ONLY from a trusted home/private LAN. Not intended for hosting on the Internet.
The browser reads FIT bytes locally; the server serves read-only HTML/JS only.
"""
import argparse
import http.cookies
import http.server
import ipaddress
from pathlib import Path
import secrets
import threading
import time
import webbrowser
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent.parent
PREVIEW = "/previews/ima-wo-shirou-fit-local-file-draft-20261113.html"
SRC = {
    "race-fit-local-file-review.mjs", "race-fit-sdk-isolated-adapter.mjs",
    "race-fit-only-split-probe.mjs", "race-user-fit-only-gate.mjs",
    "race-fit-session-total-review.mjs", "race-fit-clock-anomaly-review.mjs",
    "race-fit-timer-event-review.mjs",
}
COOKIE = "rr_private_fit_review"
TTL_SECONDS = 900

def permitted(path):
    # Whitelist one HTML and ONLY its JavaScript dependency graph.
    if path == PREVIEW:
        return ROOT / path.lstrip("/")
    parts = path.lstrip("/").split("/")
    if len(parts) == 2 and parts[0] == "src" and parts[1] in SRC:
        return ROOT / "src" / parts[1]
    if len(parts) == 3 and parts[:2] == ["fit-sdk", "src"] and parts[2].endswith(".js"):
        name = parts[2]
        if name not in (".", "..") and name.replace("-", "").replace(".", "").isalnum():
            return ROOT / "fit-sdk" / "src" / name
    return None

def create_server(host, port=8765, token=None, now=time.monotonic, allow_insecure_lan=False):
    addr = ipaddress.ip_address(host)
    if addr.version != 4 or not (addr.is_private or addr.is_loopback) or addr.is_unspecified:
        raise ValueError("Choose your PC's private IPv4 address or 127.0.0.1; never bind a public/wildcard address")
    if not addr.is_loopback and not allow_insecure_lan:
        raise ValueError("Non-loopback HTTP preview is blocked by default: security review required")
    secret = token or secrets.token_urlsafe(32)
    expires = now() + TTL_SECONDS
    lock = threading.Lock()
    holder = {"client": None}
    class Preview(http.server.BaseHTTPRequestHandler):
        server_version = "RR-FIT-private-review"
        sys_version = ""
        def log_message(self, fmt, *args):
            pass  # Do not log URLs, cookies, IPs, tokens or FIT metadata.
        def send_common(self, code, mime="text/plain; charset=utf-8", cookie=None):
            self.send_response(code)
            self.send_header("Content-Type", mime)
            self.send_header("Cache-Control", "no-store, max-age=0")
            self.send_header("Referrer-Policy", "no-referrer")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("X-Robots-Tag", "noindex, nofollow, noarchive")
            self.send_header("Cross-Origin-Resource-Policy", "same-origin")
            self.send_header("Content-Security-Policy", "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'; img-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'")
            if cookie:
                self.send_header("Set-Cookie", cookie)
        def do_POST(self):
            self.send_common(405)
            self.send_header("Allow", "GET, HEAD")
            self.end_headers()
        def do_PUT(self):
            self.do_POST()
        def do_DELETE(self):
            self.do_POST()
        def do_HEAD(self):
            self.reply(True)
        def do_GET(self):
            self.reply(False)
        def reply(self, head):
            # A guessed Host header is not an acceptable origin. Refuse DNS
            # rebinding and aliases; preview works only at the configured IP.
            expected_host = f"{host}:{self.server.server_port}"
            if self.headers.get("Host") != expected_host:
                self.send_common(403); self.end_headers(); return
            if now() > expires:
                self.send_common(410); self.end_headers(); return
            path = urlsplit(self.path).path
            if path == "/open/" + secret:
                # Prefetch/HEAD must never consume the first-client capability.
                if head:
                    self.send_common(405); self.send_header("Allow", "GET"); self.end_headers(); return
                with lock:
                    if holder["client"] is None:
                        holder["client"] = self.client_address[0]
                    if holder["client"] != self.client_address[0]:
                        self.send_common(403); self.end_headers(); return
                cookie = f"{COOKIE}={secret}; HttpOnly; SameSite=Strict; Path=/; Max-Age={TTL_SECONDS}"
                self.send_common(303, cookie=cookie)
                self.send_header("Location", PREVIEW)
                self.end_headers()
                return
            cookies = http.cookies.SimpleCookie()
            try:
                cookies.load(self.headers.get("Cookie", ""))
                value = cookies.get(COOKIE)
            except http.cookies.CookieError:
                value = None
            with lock:
                allowed_ip = holder["client"] == self.client_address[0]
            if not allowed_ip or value is None or not secrets.compare_digest(value.value, secret):
                self.send_common(403); self.end_headers(); return
            if unquote(path) != path or "\\" in path:
                self.send_common(404); self.end_headers(); return
            file_path = permitted(path)
            if not file_path or not file_path.is_file() or not file_path.resolve().is_relative_to(ROOT):
                self.send_common(404); self.end_headers(); return
            try:
                data = file_path.read_bytes()
            except OSError:
                self.send_common(404); self.end_headers(); return
            mime = "text/html; charset=utf-8" if path == PREVIEW else "text/javascript; charset=utf-8"
            self.send_common(200, mime)
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            if not head:
                self.wfile.write(data)
    return http.server.ThreadingHTTPServer((host, port), Preview), secret

def main():
    p = argparse.ArgumentParser(description="Ephemeral FIT review on a trusted private LAN; serves NO real FIT bytes")
    p.add_argument("--host", default="127.0.0.1", help="Safe default: localhost only. iPhone cannot connect to localhost of PC.")
    p.add_argument("--allow-insecure-lan", action="store_true",
                   help="UNSAFE: enable cleartext LAN HTTP only after separate owner approval and audit")
    p.add_argument("--port", type=int, default=8765)
    p.add_argument("--open-browser", action="store_true", help="Open the local preview in this PC's default browser")
    args = p.parse_args()
    server, token = create_server(args.host, args.port, allow_insecure_lan=args.allow_insecure_lan)
    if args.host == "127.0.0.1":
        print("LOCAL PC ONLY: safe synthetic FIT rehearsal. This is NOT an iPhone link.")
    else:
        print("UNENCRYPTED LAN EXPERIMENT (do not use real FIT): iPhone on same trusted Wi-Fi.")
    url = f"http://{args.host}:{server.server_port}/open/{token}"
    print(url)
    if args.open_browser:
        if args.host != "127.0.0.1":
            server.server_close()
            raise ValueError("Automatic browser opening is only permitted on 127.0.0.1")
        threading.Timer(0.5, lambda: webbrowser.open(url)).start()
    print("Temporary access: 15 minutes, bound to first client IP. Stop with Ctrl+C.")
    print("Do not forward the port, share the URL, or use public Wi-Fi. HTTP is unencrypted.")
    try:
        server.serve_forever(poll_interval=0.2)
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()

if __name__ == "__main__":
    main()
