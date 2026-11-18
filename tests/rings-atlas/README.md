# Atlas-1: isolated synthetic fixture (not production)

File: tests/rings-atlas/atlas-1-synthetic.html. Local browser only; do not link from index.html or publish to production. No real API/auth/client, data, GPS, database, map, cache, network call, external link or service-worker registration. CSP denies connect-src; noindex is defense in depth, not privacy enforcement.

Five region categories: country, ADM1, overseas ADM2, Japanese prefecture, Japanese municipality. Four fixtures: all-time (120km/12runs/3regions), year 2026 (70/7/2), November 2026 (25/3/unknown —), zero-run Jan 2025 (0/0/0). Four states: checking, previous, confirmed, failed. Before successful confirmation, checking/failed never show false zero; previous is explicitly not verified. Synthetic mock sign-out hides all detailed values; this is not a real security boundary.

Period is the ONLY data encoded in allowlisted URL query. Changing period and synthetic handoff updates browser history; popstate re-reads it and resets status to checking. On Safari bfcache pageshow persisted, simulated user state becomes signed-out and private panel hidden, modelling a fail-closed UI; real auth still needs independent verification.

Audit steps: open locally; mock sign-in, switch three periods and zero fixture, each of four states, both languages; run self-checks; inspect 375px and 320px and iPad orientations. Use Back/Forward; confirm period follows URL and stale confirmed status resets. Navigate away/back and inspect pageshow.persisted with Safari debugger, verify panel hides only when actually persisted. Simulate sign-out and verify no breakdown visible. Distinguish static review from real Safari testing.

Atlas-1 must NOT touch index.html or existing production routes. No personal data, shared production aggregation, DB or network, real auth, GPS route, actual map highlight, production release. Map-link equivalence must be designed before Atlas-3. Related #253 and #254 must be handled separately and only with explicit merge approval.

## iPhone Safari local-network delivery (no production deployment)

On a PC with Python 3, in the repository folder run:

```sh
python3 tests/rings-atlas/serve-local.py --lan --port 8765
```

Windows fallback: `py -3 tests/rings-atlas/serve-local.py --lan --port 8765`. On iPhone connected to the SAME Wi-Fi, open Safari at `http://<PC local Wi-Fi IPv4>:8765/atlas` (replace placeholder with PC Wi-Fi IPv4). Default with no `--lan` binds localhost only. Server serves only `/atlas` and `/away`; no private-data API and no write endpoints. Do not forward port 8765 or deploy this route. Stop via Ctrl+C.

Use the new Away link then Safari Back and note `pageshow.persisted=true/false` in the header. When true, mock signed-in state MUST reset and regional data be hidden. When false, bfcache was not observed, not an automatic failure. Switching periods changes URL via history and Safari Back should restore the prior period with loading reset to checking. Record iPhone width and iPad orientation separately. Avoid `file://` because pushState can fail there. Safari bfcache depends on actual browser lifecycle; a static code audit alone is insufficient.
