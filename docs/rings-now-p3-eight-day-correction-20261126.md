# Rings Now P3: eight-day snapshot correction (review only)
2026-11-26. Production v02 returned blocked/too_many_rows on authenticated POST and GET, HEAD 200, on owner's iPhone. G5 original evidence stands for v02 only. No production actions authorized here.

## Proposed delta
New zero-argument v03, no caller-provided clock or owner. Preserve v02 source and deployed function; no replacement or removal in this PR. Capture server clock once at integer millisecond precision after the unchanged JWT guard. Filter by exact started_at within inclusive [clock - 691200 seconds, clock] before order/limit. Seconds interval avoids calendar-day/DST semantics. Retain original RLS, invoker, ACL, six columns, single statement, limit 1001 and all-or-nothing result. Future and expired runs excluded; import date and activity_date never substitute for start. No rollout boundary hardcoded: the existing client gate must still independently enforce explicit selection, rollout boundary, exact start and expiry at use time. Snapshot is not permission to diagnose.

**Explicit policy decision for audit:** NULL started_at cannot prove membership in the 8-day window; omit it from the candidate set, never diagnose or repair it. This differs from v02 global missing-field block. Missing date/distance on in-window rows still blocks the whole candidate result. If the owner requires NULL-start rows to block all results regardless of age, this proposal must be revised; do not silently claim equivalence.

## Focused isolated regression (not run)
- Owner A has >1000 older runs plus one valid recent run: only recent row returned; B's recent rows and A's deleted rows excluded.
- exact 691200-second lower endpoint included; one microsecond earlier excluded; now included; one microsecond later excluded. Use deterministic clock for predicate tests, real clock for HTTP; do not alter production clocks or JWT.
- 0/1000/1001 in-window rows: empty / complete / blocked without rows.
- NULL start excluded (including historical rows), recent missing date or distance blocks; old missing date/distance does not block. No fallback or repair.
- Preserve v02 negative auth / strict expiry / no-grant and owner isolation checks on v03 POST/GET; HEAD status, six keys, concurrent writer snapshot regression; check execution privileges and no DML.
- Check existing index plan without ANALYZE before any production apply; avoid adding an index or paid service by default.

## Deployment and cleanup
No runtime/workflow/manifest changes here. Audit this narrow delta and run focused isolated checks with existing infrastructure under separate execution approval. Then approve exact SQL application separately; v03 exposure starts at creation. Keep UI OFF and rollout timestamp null. Update temporary page endpoint only after approval; verify a nonempty owner-only result on iPhone. Revoke/drop v02 only after dependency/identity checks and explicit approval; remove temporary page after evidence. No new gate numbering, no repeat of unchanged G4. No tests or production SQL executed by author in this PR.
