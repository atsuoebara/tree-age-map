# Duplicate-nine private backup: deterministic per-row hash protocol v1
Date 2026-11-19 JST. **Specification only, no private row hashes exported and no backup/restore performed.** Linked to PR #266 HEAD 17070f46, which passed independent audit as an evidence specification.

## Exact algorithm (freeze acquisition and isolated restore MUST run the same steps)

**Input = the complete current database row, not a hand-picked column subset.** Fixed function of each record:

```sql
-- Only in approved private snapshot and isolated restoration environments;
-- never print the per-row values, raw JSON, UID, run ID or GPS to public CI/PR.
SELECT
  encode(
    sha256(convert_to(to_jsonb(t)::text, 'UTF8')),
    'hex'
  ) AS row_sha256
FROM public.runs AS t
WHERE /* approved private exact 18-row manifest, not a broad unscoped query */;
```

Apply precisely this `encode(sha256(convert_to(to_jsonb(t)::text, 'UTF8')), 'hex')` to **each of the 18 full `public.runs` rows**, every matching row of all four derived tables, and `rr_private.region_rings_refresh_state` (including any other independently confirmed side-effect tables). No `row_to_json`, `jsonb_pretty`, host language JSON serialization or `concat_ws` substitutions. No GPS fields omitted, no timezone conversion in client, no rounded distance in hash.

A row hash MUST be associated in a **private** evidence manifest with its fully qualified table and primary/composite key, plus the `pg_get_serial_sequence` / schema version metadata as appropriate; compare same-key same-hash, not unordered lists, and assert there are no extra/missing keys. If a table has no unique row key, create an approved deterministic private row-identity representation from its real unique columns; if impossible, BLOCK. The public document may expose only aggregate pass/fail and row counts, never identities or per-row hashes.

**Serializer contract:** Both databases must use **PostgreSQL 17.6**, the same table definitions, same data types and column names, and explicitly identical database session settings: `TimeZone='UTC'`, `DateStyle='ISO, YMD'`, `IntervalStyle='postgres'`, `extra_float_digits=3` (where recognized). Do not compare JSONB hash outputs between differing PostgreSQL versions without an independently validated compatibility test; on mismatch BLOCK and use matching version. The fixed `to_jsonb(t)::text` preserves JSONB's structural value with a stable *PostgreSQL-version-scoped* textual serialization. This is **logical full-row** equality, not proof that raw input JSON formatting or physical heap bytes match. Therefore additionally verify native backup/restore checksum and typed domain invariants; do not overstate cryptographic hashes as a substitute for complete restore.

**Verified read-only prototype:** Production PostgreSQL **17.6**, builtin SHA-256 expression executed successfully against a *synthetic three-column row* (id, numeric, JSONB). Installed pgcrypto is not required. No real row hash was returned or retained. This verifies SQL syntax and builtin availability only, not cross-environment reproducibility or backup correctness.

### Hash-comparison dry-run sequence (not executed)

1. **After all-writer + pg_net + Garmin owner-scoped freeze**, in a single consistent read-only transaction snapshot, build encrypted **private** manifest: all 18 original full rows, all target linked rows in four derived tables, cache state row and other known effects; record table keys, row counts, distance totals, route point totals, exact values / per-row SHA-256, table schema hashes, PG version and session settings. No outputs containing IDs/route or raw hashes to public workflow logs.
2. Acquire the approved **encrypted private backup** using a backup format that faithfully preserves all typed values and FK/sequence/trigger relevant metadata, plus proper storage and custody. The manifest and backup must describe the **same consistent snapshot**; otherwise BLOCK.
3. Restore into a **physically isolated** PostgreSQL 17.6 environment, with matching schema/roles/constraints/types and disabled external network/webhooks. Recompute hashes using exactly the same SQL expression, with exactly the same session settings, then join by private fully qualified table + stable key. Assert **100% same keys and same hashes**, **0 missing**, **0 extra**, for all source, child, cache rows; assert the expected originally empty derived table is still empty.
4. Independently check both source groups 9 and 9, distances using exact stored numeric/float representations, individual route point counts (historical sample 23,726 per source), total full-backup GPS points 47,452 if frozen snapshot unchanged, and integrity of FK/sequence/owner associations. **Do not require equal source distances**: 9 Intervals rows historically total 66.361996 km; 9 Strava rows 65.102340km. Both child Today and municipality historically had 18 rows summing 131.464336km; those are historical observational values, NOT frozen immutable counts.
5. In isolated copy only, perform the separately reviewed delete/cascade fail-injection DML and ROLLBACK, recompute hashes against the frozen manifest, require exact **100%** restoration of every affected key/row. Test expected cache dirty-side-effect rollback. If any mismatch, extra, unknown row, version/schema drift, dump mismatch, queue/event/trigger outside isolation, or unverifiable retry => **BLOCK**.

## Security and methodological boundaries

- SHA-256 is a byte digest of the canonicalized full-row JSONB *text* (converted to UTF8). It does not itself hide private data from an attacker who can guess the row: row-level hashes stay **private**, not in public GitHub or ChatGPT output. Backup holds GPS and identities: encrypt, custody and restrict access.
- Commit only generic procedure and aggregated counts/percentages. Disallow command echo and raw debug logs of backup/manifest, query plans containing literal IDs or hash digests, or unencrypted dump artifacts.
- Per-row hash equality alone cannot detect a source row that was entirely **omitted from both** compared manifests: independently assert frozen key sets (18 parents, all child rows and cache state) and a consistent backup transaction.
- Since columns/schema may evolve, **explicit schema fingerprint and exact server version are mandatory**. Hashing `to_jsonb(t)` over every actual column prevents accidentally omitting fields, but newly added columns may still produce a mismatch or unreviewed semantics and must BLOCK.
- Ensure the cache state row snapshot reflects intentionally expected invalidation on parent and Today child DELETE, and `publication_enabled=false`, dirty=true, candidate=0 gate at freeze; do not demand post-delete cache state hash equals pre-delete prior to an intentional expected invalidation. For **rollback tests**, however, its original full-row hash must match again after ROLLBACK.

## Exact permissions status

**Nothing in this document performs acquisition, restoration, DML, data export, pause or deploy.**
- PR #266 audit passed **specification only**; the above is a strengthening of its hashing part.
- Separate approval needed before any production private backup/extraction and isolated restoration; scope includes private GPS and identities.
- Full execution-package gates remain: backup & 100% actual restore, stop/resume dry run, failure injection, exact treatment decision, time window, むせ independent full audit, Atsuo express approval.
