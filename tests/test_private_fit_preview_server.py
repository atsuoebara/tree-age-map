#!/usr/bin/env python3
"""Standard-library isolated HTTP contract tests. No uploads, FIT records, or external network."""
import http.client
import importlib.util
import posixpath
import re
from pathlib import Path
import threading
import unittest
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent.parent
SPEC = importlib.util.spec_from_file_location("fit_lan", ROOT / "scripts/serve-private-fit-preview.py")
M = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(M)

class GateTests(unittest.TestCase):
    def setUp(self):
        self.server, self.token = M.create_server("127.0.0.1", 0, token="synthetic-temporary-token")
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.port = self.server.server_port
    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)
    def ask(self, path, method="GET", cookie=None):
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=3)
        headers = {"Cookie": cookie} if cookie else {}
        conn.request(method, path, headers=headers)
        resp = conn.getresponse()
        data = resp.read()
        status = resp.status
        headers = dict(resp.getheaders())
        conn.close()
        return status, headers, data
    def test_protected_only_local_source(self):
        self.assertEqual(self.ask(M.PREVIEW)[0], 403)
        self.assertEqual(self.ask("/open/incorrect")[0], 403)
        # HEAD must not grant access or reserve the first-client IP.
        self.assertEqual(self.ask("/open/" + self.token, method="HEAD")[0], 405)
        status, headers, body = self.ask("/open/" + self.token)
        self.assertEqual(status, 303)
        self.assertEqual(headers["Location"], M.PREVIEW)
        self.assertEqual(body, b"")
        cookie = headers["Set-Cookie"].split(";", 1)[0]
        self.assertIn("SameSite=Strict", headers["Set-Cookie"])
        self.assertIn("HttpOnly", headers["Set-Cookie"])
        self.assertEqual(self.ask(M.PREVIEW)[0], 403)
        status, headers, html = self.ask(M.PREVIEW, cookie=cookie)
        self.assertEqual(status, 200)
        self.assertNotIn(b'type="file"', html)
        self.assertIn("旧FIT試作ページは終了しました".encode("utf-8"), html)
        self.assertIn("no-store", headers["Cache-Control"])
        self.assertIn("connect-src 'none'", headers["Content-Security-Policy"])
        self.assertIn("text/html", headers["Content-Type"])
        for resource in [
            "/src/race-fit-local-file-review.mjs",
            "/src/race-fit-clock-anomaly-review.mjs",
            "/src/race-user-fit-only-gate.mjs",
            "/fit-sdk/src/index.js",
            "/fit-sdk/src/decoder.js",
        ]:
            status, h, payload = self.ask(resource, cookie=cookie)
            self.assertEqual(status, 200, resource)
            self.assertIn("text/javascript", h["Content-Type"])
            self.assertTrue(payload)
        for denied in [
            "/", "/index.html", "/fit_importer.js", "/.git/config",
            "/supabase/functions/garmin-oauth/index.ts",
            "/previews/other.html", "/scripts/serve-private-fit-preview.py",
            "/fit-sdk/src/../index.js", "/fit-sdk/src/not-here.js",
            "/src/secret.mjs", "/src/../../index.html", "/src/%2e%2e/index.html",
        ]:
            self.assertEqual(self.ask(denied, cookie=cookie)[0], 404, denied)
        for method in ["POST", "PUT", "DELETE"]:
            self.assertEqual(self.ask(M.PREVIEW, method, cookie)[0], 405)
        self.assertEqual(self.ask(M.PREVIEW, "HEAD", cookie)[0], 200)
        self.assertEqual(self.ask("/src/race-fit-local-file-review.mjs", cookie="rr_private_fit_review=bad")[0], 403)
    def test_module_dependency_graph_is_complete_and_private(self):
        # The actual browser imports must all resolve via the authenticated server.
        _, headers, _ = self.ask("/open/" + self.token)
        cookie = headers["Set-Cookie"].split(";", 1)[0]
        discovered = set()
        to_visit = [M.PREVIEW]
        pattern = re.compile(r"""(?:from\s*|import\s*\(?\s*)["'](\.{1,2}/[^"']+)["']""")
        while to_visit:
            path = to_visit.pop()
            if path in discovered:
                continue
            discovered.add(path)
            status, response_headers, data = self.ask(path, cookie=cookie)
            self.assertEqual(status, 200, f"ESM dependency not served: {path}")
            self.assertIn("no-store", response_headers["Cache-Control"])
            body = data.decode("utf-8")
            for relative in pattern.findall(body):
                child = posixpath.normpath(posixpath.join(posixpath.dirname(path), relative))
                self.assertTrue(child.startswith("/"), child)
                self.assertTrue(child.endswith((".js", ".mjs")), child)
                to_visit.append(child)
        self.assertEqual(discovered, {M.PREVIEW}, "retired page must not load any SDK modules")
        self.assertFalse(any(p.startswith("/fit-sdk/src/") for p in discovered))
        self.assertFalse(any(p.startswith("/src/") for p in discovered))
        self.assertFalse(any(p.startswith("/supabase/") for p in discovered))
        self.assertFalse(any("fit_importer.js" in p for p in discovered))

    def test_host_header_is_fixed_to_server_ip(self):
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=3)
        conn.putrequest("GET", "/open/" + self.token, skip_host=True)
        conn.putheader("Host", "external.example")
        conn.endheaders()
        r = conn.getresponse()
        self.assertEqual(r.status, 403)
        r.read()
        conn.close()
        self.assertEqual(self.ask("/open/" + self.token)[0], 303)

    def test_expiration_and_wildcard_rejection(self):
        for host in ["0.0.0.0", "8.8.8.8"]:
            with self.assertRaises(ValueError):
                M.create_server(host, 0)
        current = [100.0]
        expired, _ = M.create_server("127.0.0.1", 0, token="expiry", now=lambda:current[0])
        try:
            t = threading.Thread(target=expired.serve_forever, daemon=True)
            t.start()
            current[0] += M.TTL_SECONDS + 1
            conn = http.client.HTTPConnection("127.0.0.1", expired.server_port, timeout=3)
            conn.request("GET", "/open/expiry")
            res = conn.getresponse()
            self.assertEqual(res.status, 410)
            res.read();conn.close()
        finally:
            expired.shutdown();expired.server_close();t.join(timeout=2)

if __name__ == "__main__":
    unittest.main()
