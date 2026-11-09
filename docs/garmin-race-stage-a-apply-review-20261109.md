# Garmin Race Analysis — Stage A: Schema Application Candidate
**2026-11-09 | Draft PR only | NOT AUTHORIZED TO APPLY**

## Purpose and separation of concerns

This PR copies the **unchanged, independently reviewed** schema SQL from Draft PR #67 (`supabase/garmin-race-analysis-schema-review.sql`) into `supabase/garmin-race-analysis-stage-a-apply-candidate.sql`. It does **not** change the production intake receiver, existing three-argument Garmin commit RPC, user interface, permission reconcile flow, or actual Supabase database.

**Important:** A copied SQL file in the repository is NOT a deployed migration. It is deliberately outside `supabase/migrations` and has NOT been executed. Its footer includes historical audit blockers from the original draft. The table/triggers/functions remain the precise reviewed body; this checklist supersedes the historical footer for rollout decisions. Compare the SQL body byte-for-byte to PR #67 before any apply.

## Gate 0 — required before any apply

1. **Atsuo explicitly approves the particular production change**, the planned timing and test/rollback criteria. Approval of PR #67's design does not authorize any apply, merge or deploy.
2. Muse independently audits the **exact SQL candidate** in this PR, particularly security-definer trigger ownership, function grants, sequence privileges, existing soft-delete compatibility, execution ordering and performance effects of the new index on `runs(id,user_id)`.
3. Confirm the actual production schemas, existing object names, FK relationships, grants, owner and expected `auth.uid()` behavior via **read-only** checks immediately before applying. No assumption that the schema is still identical to 2026-11-09.
4. Ensure an effective restore/recovery plan for the specific schema change. SQL `BEGIN/COMMIT` permits transactional DDL rollback only **until commit**, not after. If already applied, any reversal is a separately audited migration; do **not** blindly drop a table containing user data.
5. Confirm no deployment hook, migration runner or CI unexpectedly executes the file. Leave the production Garmin receiver **unchanged and disabled for the new optional-analysis path**.

## Stage A application — future explicit task, not executed here

- Apply the reviewed SQL *once* via the controlled Supabase migration mechanism, under a vetted owner that can create the SECURITY DEFINER functions.
- Do not expose analysis in public views or UI, and do not call the new four-argument RPC. The existing three-argument RPC is unchanged in this stage.
- Inspect created `run_race_analysis`, RLS policies/grants/sequence grants and trigger/function ownership; test whether ordinary existing Garmin run writes and soft deletes still work.
- **Actual hosted Supabase role probe with two synthetic/authorized test accounts**, as required by Muse's C4 final verdict: one owner can read only own eligible analysis, another cannot; authenticated/anon cannot write, call the proposed RPC or read private connection/inbox tables. Because the table is new, generating controlled analysis fixtures may require a narrowly authorized service-only test transaction. Remove all fixtures. Do not enable the new receiver until probes pass.
- Verify authoritative permission-loss/disable/disconnect trigger purges only analysis; saved canonical run remains. The above probes must run before intake activation.

## Rollout halt conditions

Any RLS/grant mismatch, failed/slow existing run write, unexpected trigger effects, other-user data access, unexpected migration drift or unresolved cleanup failure is a **STOP**. Preserve the receiver's current behavior. Do not turn on optional Garmin analysis, and do not proceed to stage B without a new explicit go/no-go.

## Follow-on work, outside Stage A

- **Stage B:** separately audited four-argument commit RPC integration with the live receiver and optional sensor/segment code, per-activity bounded fallback, no change to 8,000,000-byte raw request limit.
- **Stage C:** wire approved Japanese and English UI copy, include `Insufficient data (coverage: XX%)` / `データ不足（計測範囲：XX%）` if showing coverage; align Japanese quality notice to say repeated timestamp **or distance**. These were implementation hand-offs, not design-gate blockers.
- **Stage D:** owner-only opt-in/activation followed by actual Edge ACK, memory and processing observations. Start with Atsuo's account only; expand only with separately documented approval.
- Any account-deletion endpoint remains a separate product decision. Keep the GPS backup table `runs_duplicate_backup_20260828` in the deletion inventory if that work is later undertaken.

## Existing audit evidence (design, not live application)

- PR #67: https://github.com/atsuoebara/tree-age-map/pull/67
- C4 role fidelity: https://github.com/atsuoebara/tree-age-map/actions/runs/42567319037
- C4 lifecycle: reviewed synthetic PostgreSQL fixture in #67
- R1/C6 and R3: verified synthetic Deno tests, not real Edge observations.

**This PR must remain Draft until Atsuo specifically authorizes the next step.**
