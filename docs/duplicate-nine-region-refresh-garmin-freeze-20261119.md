# Nine-run cleanup — region refresh disposition and Garmin retry freeze gate
Date: 2026-11-19 JST
Scope: READ-ONLY production database/Edge metadata and repository inspection. **Design-only; all writes and execution actions HOLD.**
References: PR #262 treatment proposal audit PASS; PR #263 partial inventory PASS; PR #264 inventory document audit PASS. This document answers the PR #264 reviewer questions and does **not** claim full execution-package audit completion.

## A. Region-rings cache: what exists, what is currently exposed, and the unresolved refresh-worker question

**Live production read-only snapshot:**
- `rr_private.region_rings_refresh_state`: 1 state row; `is_dirty = true`, `publication_enabled = false`.
- `rr_private.region_rings_public_candidate`: **0 rows**.
- Live `cron.job`: only active scheduled entry `garmin-activity-retry` (`*/2 * * * *`). No region-rings refresh cron entry.
- Inspecting live `public`/`rr_private` function definitions for references to `region_rings_refresh_state` or `region_rings_public_candidate` located **only** `rr_private.invalidate_region_rings_cache()`. It sets dirty and does not rebuild the candidate table.
- 25 active Edge deployment metadata entries were inspected in PR #264; none was named region refresh / ring refresh. This is a **name-based and enumerated inventory observation**, not proof that unrelatedly named code cannot write the table.
- Main-repository search of the refresh state string finds B-1 design SQL/docs/fixtures; no verified production refresh worker. A runtime worker invoked externally under another name remains unexcluded.

**Proposed disposition for reviewer (NOT asserted closure yet):**
The feature currently has **fail-closed publication OFF, candidate cache empty, state dirty** and no proven automated rebuilding worker. For *this nine-run correction*, do not create/start a refresh worker or publish/recalculate region candidate data merely to satisfy a deleted-run cleanup. Treat the lack of worker as a **documented deliberate operational HOLD**, **provided** an independent reader/Edge/worker/external-writer inventory confirms publication and cache writes remain disabled/absent, and after the approved physical deletion the dirty marker remains true and candidate rows remain 0. If the auditor demands a worker or discovers active consumption/write, keep the whole package **BLOCK** pending a separate scoped remediation; do not call this "refresh worker identified".

**Before final approval:** re-query both `rr_private` tables under freeze, audit external/unqualified references and complete the B-1 publication path, test the two invalidation triggers in isolated dry run, and prove no user-visible regional public release or sensitive disaggregated values. Any unexpected candidate rows, publication ON, or dirty=false without independently reviewed refresh is **BLOCK**.

## B. Garmin `pg_cron`: actual recipient, pending owner inbox, freeze conditions

**Live read-only verification:**
- `cron.job` has one active entry: `garmin-activity-retry` every **2 minutes**. No settings changed. Cron command was not printed into the public evidence (may contain privileged endpoint/token material).
- `public.garmin_activity_inbox` has columns `user_id`, `state`, `attempts`, `next_retry_at`, `updated_at`, `connection_version` and other private fields. Run IDs, owner UUID, external IDs, payloads and tokens are intentionally absent from this public document.
- Owner derived by querying strict November Strava–Intervals candidate pairs without exporting private identifiers. On the read-only snapshot, **30 inbox rows for the owner**, grouped as **27 `saved`, 3 `duplicate`**, and **0 in other states**. Whole inbox snapshot (all users) was 53 saved, 5 duplicate, 3 ignored.
- This snapshot means no `pending`/`processing`/retry state was present *at the time of SELECT* for the target owner. It does **not** prove the owner cannot receive another Garmin request, that an Edge invocation is not running, or that a cron run will never be retried.

**Proposed mandatory operator freeze and resume checks (no action taken):**
1. Derive candidate owner again under a private owner-scoped manifest; exactly one owner and 9:9 pairs. Gate **0** owner inbox rows in **any nonterminal state** (terminal set only after revalidating live `garmin_commit_activity` and Garmin Edge workers; currently saved/duplicate/ignored appear terminal). Require **0** active `processing` and **0** ready/queued `next_retry_at` for the owner. Inspect both `garmin-activity-retry` pg_cron *in-progress* runs and any Garmin Edge in-flight request; **0** accepted-but-uncommitted target-owner writes. One unknown state or unknown retry => **BLOCK**.
2. Agree an owner-scoped intake embargo or independently demonstrated lock for Garmin ingest/push and cross-source imports; an empty inbox by itself does not freeze Garmin writes. Operator documents a safe method for the 2-minute cron (pause or owner-specific exclusion) and must prove no unrelated-user disruption. Since the job may operate for other users, **global cron disable is not automatically authorized**.
3. Record the exact scheduled job status and a private evidence snapshot after inputs stopped; double-check counts with same snapshot immediately before approved transaction. Any count/state change => **BLOCK and refreeze**.
4. On resume, restore only approved source intake and job controls, verify Garmin inbox states/attempts remain consistent, processing completes as expected without reinserting any of the nine duplicate Intervals rows, and other users remain unaffected.

## C. Execution status, invariants and next review
- Physical delete of nine Intervals duplicates remains **conditional preferred candidate only**, with no final choice or authorization.
- Existing November duplication: 9 distinct Intervals targets ↔ 9 distinct Strava survivors, same owner, 66.36 km, 23,726 route points, max 1.367 m from earlier read-only evidence. Both monthly and annual personal distance **delta −66.36 km** are mandatory fresh-baseline checks.
- Future work: isolate complete external consumer/writer inventory (including the region publication path); backup **18** full source rows and four FK-derived data sets privately, include dirty-cache state and row fingerprints, prove restore of count/distance/GPS-point/hash 100% in isolation; safe stop/resume dry run covering Today Actions + live pg_net worker/Edge and Garmin cron, final private single-transaction DML with strict 9-row assertions/rollback and failure injection, confirm exact low-activity window; then むせ full-package audit followed by Atsuo separate explicit approval.
- iPhone/session/service-worker cache comparison is a **post-execution** acceptance item; monthly NATIONS remains nonpublic/disabled.
- **NO production DB writes, no cron/Actions pause, no Edge redeploy, no PR merge, no export or modification of private run data** were made in this investigation.

## D. Explicit audit request

Please review whether the evidence of region publication OFF + zero candidates + dirty=true and no positively identified worker is sufficient to document a **fail-closed, intentionally untouched region-cache path** for this run-remediation package, or whether external invocation/refresh uncertainty requires a separate blocker. Independently verify the Garmin owner inbox zero-nonterminal gate and the need to drain the active two-minute retry job before freeze. **Do not interpret this document as a full dependency closure or as execution authorization.**
