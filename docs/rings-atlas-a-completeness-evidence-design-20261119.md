# Atlas A – synthetic completeness evidence collector (audit-only)

Not wired into site, not an authentication mechanism, and not an approval for real capacity measurement. Run tests: node tests/rings-atlas/atlas-a-completeness-model.test.mjs.

The isolated pure ESM state machine observes **caller-declared** events: begin(revision), successively ordered pages of exactly pageSize except the terminal short page, local store fully enumerated + parsed without errors, every validated all/year/month scope compiled, finish with unchanged revision, unchanged owner/session, no concurrent writes, fresh authentication and bfcache validation. Any failed page, skipped offset, duplicate page, parsing error, owner switch, sign-out, mutation or bfcache invalidates the attempt. The results expose only synthetic metadata. A page with count less than pageSize marks terminal; if exactly pageSize more data may exist and another request is mandatory.

IMPORTANT SECURITY GAPS: Events are not authoritative evidence: an arbitrary caller can forge success and revision. Current production fetchCloudRuns paginates 50 and loadCloudActivities catches errors into zero. Local GPX ingestion can silently skip failures and even initiate cloud writes. Therefore DO NOT hook this model to any real code until separately reviewed trusted evidence capture: immutable session/owner generation, complete page result provenance, zero skipped local parses, immutable activity revision, source consistency and no-write read-only mode. In-flight callbacks after logout/mutation and tab races need epoch guards. The model's single-page ordered loop does not prove remote snapshot consistency across concurrent writes: production version or stable ordering/transaction needs independent verification.

Never infer full account data from displayed 1,843 or from cache alone. In particular no real auth and source integrity can be certified by this module. No interface to #278 exists; G0 iPhone Safari, owner-isolation G3, method selection G1 and Atsuo's separate measurement authorization remain blocked.

Files are limited to tests/ and docs/. No production HTML, data, build, API, Supabase, network, or storage changes.
