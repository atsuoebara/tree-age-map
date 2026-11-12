# Gate 0 — Free Plan manual backup and restore rehearsal runbook (2026-11-09)

**STATUS: PREPARATION ONLY / GATE 0 HOLD.** No production dump or restore has been performed or verified. Do not execute Stage A SQL.

## Official basis and important scope distinction

The connected Supabase organization is Free. Current official guidance recommends regularly exporting a Free plan project's data using the Supabase CLI. The Supabase CLI uses Docker; `supabase db dump` defaults to schema only (no data, no custom roles) and excludes some managed schemas. Therefore **one successful `db dump` with default flags is NOT a restorable full-project backup**.

- https://supabase.com/docs/guides/platform/backups
- https://supabase.com/docs/reference/cli/supabase-db-dump
- https://supabase.com/docs/guides/self-hosting/restore-from-platform
- https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore

Official self-hosted migration guidance demonstrates separately exporting **roles, schema, and data**. It also explicitly notes that Edge Functions, Storage file objects and application settings are outside the database dump. **Do not assume a Free-tier CLI dump contains `auth.users` or all application objects**: inspect the actual archive/SQL and verify the required tables and dependencies. If these are missing, obtain an authorized supplementary backup or **STOP**; do not silently claim full protection.

## 1. Authorized operator's local environment (not in GitHub Actions)

Prerequisites: one trusted operator with direct access to a computer with sufficient encrypted storage, Docker, supported Supabase CLI, `psql`, and a local disposable PostgreSQL 17 instance or isolated Supabase self-hosted stack compatible with the source extensions. Connection information and passwords stay in the operator's password manager or interactive environment; never paste them into the chat, GitHub issues, repository, Actions secrets or run logs.

Check installed versions on the operator's machine first:
```sh
supabase --version
supabase db dump --help
psql --version
```

Obtain the production **Session pooler** or direct connection string from the project's Dashboard **Connect** UI. Prefer a supported session-affine connection. Verify it identifies the intended production project. Do not reset production database passwords as a convenience unless separately approved, since that could interrupt running integrations.

Use a private backup directory outside the repo with restrictive permissions and an encrypted volume. Confirm adequate space and that full backup access is limited to the authorized operator.

## 2. Export checklist (local ONLY; illustrative commands)

The connected project is `fhwvntpzwyenendhcgbw`. Run the following only with the actual authorized session/direct `[DB_URL]` stored locally; **do not substitute a URL from this document**.

```sh
umask 077
# Set DB_URL interactively on your own trusted machine. Never include its value in tickets/logs.
supabase db dump --db-url "$DB_URL" --role-only -f roles.sql
supabase db dump --db-url "$DB_URL" -f schema.sql
supabase db dump --db-url "$DB_URL" --data-only --use-copy -f data.sql
```

**Security warning:** Each SQL file is sensitive and may contain route JSON, identifiers, user details or auth metadata. Do NOT save to the repository, upload through ChatGPT, print file contents to CI logs, or attach SQL to the independent audit report. Store encrypted and do not keep exposed plaintext beyond the controlled rehearsal.

**Completion checks (operator's secured machine):** all three commands exit successfully, files are nonempty, timestamps and SHA-256 checksums recorded **without printing content**. Check whether `schema.sql` and `data.sql` actually include every required application-owned and user-owned relation, especially `public.runs`, Garmin connection/inbox tables, `auth.users`, and extensions/dependency prerequisites. Verify no SQL errors and record exclusions. A GitHub file being present is not backup proof.

## 3. Isolated restore rehearsal (not production)

Use **locally running, disposable** Postgres 17 / compatible Supabase stack with no public ports, no production API keys and no outbound application webhooks. A plain Postgres 17 database is NOT by itself a full substitute for Supabase's managed auth/storage schemas and extensions. Check the target's compatibility and the restore scope.

For a full self-hosted restore, follow the official guide on roles→schema→data, including supported extension setup and controlled trigger behavior. One documented example from that guide:
```sh
psql -X -v ON_ERROR_STOP=1 --single-transaction \
  --file roles.sql --file schema.sql \
  --command 'SET session_replication_role = replica' \
  --file data.sql --dbname "$LOCAL_RESTORE_DB_URL"
```

**Only on the isolated restore target**; do not run this against production. Do not assume that restoring arbitrary platform SQL into plain Postgres works without Supabase roles/extensions or that disabled triggers make the rehearsal production-equivalent. Stop and investigate *any* error rather than suppressing it.

Perform evidence-based checks without publishing row data: presence of critical relations, `public.runs` record count vs source snapshot, Garmin schemas, key constraints, functions and RLS policies; referential-integrity checks and an owner-only read test where feasible. Record that data taken after snapshot time cannot be restored from it. Never share raw route information or passwords.

## 4. Sign-off evidence (only MET after actual rehearsal)

| Field | Required evidence | Current |
|---|---|---|
| Operator and backup date | named approved operator, JST completion timestamp | NOT DONE |
| Supabase CLI and database versions | versions, output files/flags | NOT DONE |
| Dump integrity | SHA-256 and byte lengths, encrypted storage location identifier | NOT DONE |
| Scope and exclusions | application + auth + Garmin data/roles/RLS/functions/extension list | NOT DONE |
| Restore rehearsal | target version, exit codes, logs scrubbed of secrets | NOT DONE |
| Restored data integrity | sanitized counts, expected constraints and sample access checks | NOT DONE |
| Recovery decision | restoration/compensating migration owner and stop thresholds | NOT DONE |

Only a **verified real backup and successful private restore** satisfies this gate. A synthetic CI database proves *mechanics* but cannot satisfy it. The audited Stage A rollback is valuable but not a substitute for real backup.

## 5. Next permissions and stop rules

- This runbook is safe to review; it does not authorize credential sharing, manual backup execution, DDL, paid add-ons or production application.
- If access to private, encrypted local storage or an adequate isolated restore stack is unavailable, **HOLD**. No additional charges may be incurred without separate agreement.
- After a credible real backup/restore proof and separate release-operator plan, obtain **fresh explicit Atsuo go/no-go** for the exact Stage A SQL application. No implicit authorization from the previous Gate 0 inspection.
