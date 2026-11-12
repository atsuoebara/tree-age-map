# Gate 0 backup/restore preparation evidence — 2026-11-09

**Gate 0 status: HOLD.** No real production backup or isolated restore of production data has occurred.

## Added to Draft PR #68
- `docs/garmin-race-stage-a-gate0-backup-restore-runbook-20261109.md`: Free-tier, local-only Supabase CLI roles/schema/data export; preserve secure credentials & private route data outside GitHub; inspect actual backup scope, including possible exclusions of managed auth and extensions; rehearsal using compatible isolated Supabase stack; sanitized evidence checklist.
- `.github/workflows/garmin-race-stage-a-backup-rehearsal.yml`: synthetic-only PostgreSQL 17 source with two fake runs, a fake Garmin connection; PG17 `pg_dump -Fc`, restore to another disposable DB, verify row counts and primary-key constraint; no production access or secrets.

## CI
- Initial CI #42574642645 failed due to built-in runner `pg_dump` 16 vs server 17 mismatch.
- Next CI #42574767354 failed due to an assertion shell quotation error. Both occurred only in disposable CI; no production access.
- Corrected CI #42574880074 **success**: synthetic local backup/restore completed and validated two fake runs, one Garmin connection, primary key.
- These prove a local PostgreSQL dump/restore procedure, **not** Supabase CLI compatibility or complete real production backup/recovery.

## Remaining controls
1. Trusted operator executes **actual** authorized manual backup on their own secure, encrypted computer. Sensitive data must never be uploaded to CI, GitHub, or chat.
2. Confirm exact backup scope (including `auth.users`, PostgreSQL extensions and all application-owned Garmin tables) and **perform actual isolated restore**, with private sanitized evidence.
3. Named operator, safe window, stop owner and production execution method/timeout documented.
4. Atsuo separately authorizes exact Stage A production application after independent audit and gates.

The absence of automatic Free-tier backups remains a real unresolved blocker. No production DB DDL/DML, merge, deploy, receiver change, branch with fees, or actual data export was performed in this task.
