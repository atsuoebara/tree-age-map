# Garmin Stage A — Free Plan Recovery & Single-Transaction Gate 0 Addendum (2026-11-09)

**Status: Gate 0 HOLD. NO PRODUCTION SQL executed or authorized.** This is documentation/CI-only in Draft PR #68.

## Verified account limitation

The linked Supabase organization for production `runners-rings` reports **plan: free**, `tier_free` in the **read-only** `get_organization` result, 2026-11-09. Official Supabase documentation states **Free projects have no automatic daily backups**; Pro/Team/Enterprise do, and paid add-on PITR is separate. Therefore do not assume a restorable managed backup exists for this production project. This is not evidence that a manual backup already exists.

Supabase references, checked 2026-11-09:
- https://supabase.com/kb/faqs/platform/free-plan-backups
- https://supabase.com/docs/guides/platform/backups
- https://supabase.com/docs/reference/cli/supabase-db-dump

**Cost guard:** Do NOT upgrade the organization, create paid branching, create a duplicate billable project, or enable PITR. Retain the no-additional-cost policy.

## Recovery prerequisite: NOT YET MET

Before any production Stage A approval:
1. A designated authorized operator obtains a **current manual logical database backup** via the supported CLI / `pg_dump` procedure, with access credentials kept out of chat/GitHub/CI logs. Store encrypted, access-restricted, OFF the live project. Do not mistake a schema-only backup for preservation of runs and Auth data.
2. Preserve verification artifacts that **do not expose private route JSON, passwords, JWTs or raw database dumps**: command/tool version, backup timestamp, file-size, checksum, included schemas, operator, secure storage location reference (not secret), and backup completion status. Never upload backup bytes to the repository, chat, public issue or a CI artifact.
3. Prove recovery against a **local disposable PostgreSQL database** using a properly selected subset or full logical backup handled on the operator's secured machine; verify expected schemas, functions/roles and sample table metadata. Do not expose a production-data clone publicly, and do not mistake synthetic tests for a real backup-restore proof.
4. Establish a rollback/migration recovery procedure for **post-COMMIT** failure: a separate approved cleanup migration and reversible plan, preserving any newly stored analysis. A full database restoration can lose all data saved after its backup; prefer targeted audited restoration/compensation for a schema-only rollout. Document the restore owner and approved decision thresholds.
5. If backup or restore test cannot be completed for free, **STOP**. Do not substitute mere file existence, untested command recommendations or a paid feature.

The current connected tooling can read project plan and catalogs but does not expose a safe action for creating and locally testing an encrypted logical backup; no such backup was executed or verified in this task.

## Single-transaction execution path: engineering recommendation, NOT run

The byte-identical Stage A candidate currently contains one top-level `BEGIN;` near its beginning and one `COMMIT;` at the end. It must execute as ONE uninterrupted PostgreSQL **session**, with error-stop behavior and no client-side splitter that commits statements individually. A client that parses and executes each statement separately is NOT an acceptable delivery mechanism.

**Proposed operator process, only after separate explicit authorization and a proven backup:**
- A vetted human operator connects through a supported direct or session-affine PostgreSQL connection with `psql`, **never a statement-per-request or transaction-pooled execution path**; verify `psql --version`, connection target, identity and TLS transport offline without publishing credentials.
- Use `psql -X -v ON_ERROR_STOP=1 -f <audited-file>` as the eventual single-session candidate. The audited file's explicit `BEGIN;` and `COMMIT;` are responsible for transaction atomicity. **Do not rely on `psql --single-transaction` to wrap a script that already contains an internal `COMMIT;`: its internal COMMIT can defeat the outer grouping.**
- Short lock/statement timeouts, when approved, must be applied **at the start of the very same transaction** (for example, `SET LOCAL lock_timeout` and `SET LOCAL statement_timeout` inserted in a *separately audited execution wrapper*). Do **not** silently modify the hash-pinned Stage A SQL candidate or use prior-session `SET LOCAL` (which would not persist).
- If the process is interrupted before the script's `COMMIT;`, PostgreSQL must roll back the open transaction when the session closes; if COMMIT has already succeeded, treat the change as applied and follow verified post-commit recovery. Do not re-run the SQL blindly after a connection-loss/unknown-COMMIT response; inspect database catalogs first.
- Make exit status, exact applied SHA, database target, transaction decision and post-apply probes part of an operator-only approval record, with no secrets.
- CI preflights must refuse hidden additional `BEGIN` / `COMMIT` / `ROLLBACK` or separate `CREATE INDEX CONCURRENTLY`; one explicit transaction is mandatory. **A lint check is not a proof of atomic execution on the hosted platform.**

## Action ownership & remaining decisions

- Operator identity, credential handling, safe release window, `lock_timeout` and `statement_timeout` values, expected index lock behavior, and post-COMMIT recovery owner: **NOT YET ASSIGNED/APPROVED**.
- Full backup + local restore rehearsal: **NOT DONE**.
- CI-only framing check: added in PR #68; no database writes.
- Existing Stage A catalog preflight and Muse independent audit: complete.
- Explicit permission to actually apply candidate: **NOT GIVEN**.
- Post-apply two-account hosted Supabase table-level RLS probes and trigger coexistence: **not yet possible**, must happen before new optional receiver activation.

**Decision: HOLD.** Do not execute `supabase/garmin-race-analysis-stage-a-apply-candidate.sql`, merge PR #68 or change the receiver until all required production-entry conditions are met.
