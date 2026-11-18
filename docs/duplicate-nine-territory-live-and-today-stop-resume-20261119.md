# Duplicate nine-run execution package: deployed Territory provenance and Today stop/resume review
2026-11-19 JST — **Design/evidence only. Not an authorization to pause, mutate, merge or deploy.**
References: PR #258 design approved; PR #259 preflight design approved (HEAD cc2d2f0f); PR #255 prevention already deployed.

## 1. Territory Japan: effective executed code confirmed

- GitHub Actions: `.github/workflows/rings-territory-sync.yml` job uses `actions/checkout@v4`, then runs `node scripts/sync-rings-territory.mjs`. Schedule: `41 0,12 * * *` UTC = 09:41 and 21:41 JST nominal, **run may be delayed**. Concurrency group `rings-territory-sync`, cancel-in-progress false, job timeout 50 min.
- The scheduled successful workflow run [44395578705](https://github.com/atsuoebara/tree-age-map/actions/runs/44395578705) reports **source commit `b44305fff5e81e49ea7b92ddb5d4b9ff079bfe34`**. File `scripts/sync-rings-territory.mjs` retrieved from that exact commit has Git blob SHA `f50fd0ed63b05c71c3eae1b889fc7896a0e6ddc6`, identical to current main. The actual run input query on lines 218–223 is `runs?select=id,activity_date,route,distance_km&user_id=...&activity_date=...&route=not.is.null&distance_km=gt.0&order=id&limit=50&offset=...` and **has no `deleted_at=is.null` predicate**.
- **Conclusion** for GitHub Actions deployed Japan Territory sync: it is known to have executed from the code without deleted-at filtering. This is **confirmed via the execution's commit provenance + contents**, not by a runtime HTTP query trace. Any independent deployed implementation outside GitHub Actions has NOT been ruled out.
- Important consequence: a **soft-deleted** duplicate run still meets the sync's read conditions; the upsert path can re-create its municipality-derived rows even if they are manually deleted. This strengthens the case that `deleted_at` only cannot be accepted and that a one-time soft-delete + downstream cleanup is not stable under current code. Do not quietly introduce a producer fix or make a treatment decision without separate review.

## 2. Rings Today: BOTH Actions schedules and DB live trigger

Repository `.github/workflows/rings-today-sync.yml`:
- current-year job scheduled `*/5 * * * *` UTC; concurrency group `rings-today-current`, `cancel-in-progress: false`, timeout 20 minutes.
- history job scheduled `*/15 * * * *` UTC; concurrency group `rings-today-history`, `cancel-in-progress: false`, timeout 55 minutes. Job also starts on workflow file push. Current job has manual workflow_dispatch.
- GitHub Actions alone is NOT the entire sync chain. Live production DB trigger on `public.runs`:
  `trg_rings_today_live_sync AFTER INSERT OR UPDATE OF route,distance_km,activity_date,deleted_at FOR EACH ROW EXECUTE FUNCTION enqueue_rings_today_live_sync()`.
  Read-only `pg_get_functiondef` confirms `enqueue_rings_today_live_sync` calls `net.http_post` to deployed `rings-today-live-sync` Edge Function; the hook has a secret and catches errors. Never disclose the secret.
- Checked repository Edge Function `supabase/functions/rings-today-live-sync/index.ts` (not equivalent to independent byte verification of the deployed Edge Function): looks up run by ID including deleted_at; explicitly deletes existing Today derived rows for that run, then skips insertion if run is deleted/ineligible, otherwise upserts regions. Trigger does **not** run after parent DELETE; therefore do not assume the Edge Function executes for physical deletion.
- `scripts/sync-rings-today.mjs` has `last_run_id` incremental cursor. After a target changes/deletes, a run already behind the cursor does not get automatically revisited by scheduled sync. The live trigger gives an additional path for UPDATE, but under concurrent work cannot be relied on as the sole repair protocol.

## 3. Proposed stop/resume runbook — requires independent review and privileged operator

**Before stop:**
1. Privileged operator must document how to disable/re-enable *this one* GitHub Actions workflow's scheduled execution, and how to block manual dispatch and overlapping active current/history jobs. GitHub workflow controls available in this ChatGPT connection do not include disable-workflow or cancel-workflow actions; **this plan has not disabled anything**.
2. Confirm actual orchestration at the chosen maintenance time, including delayed scheduled runs, current/history jobs and the outside-GitHub live trigger; inspect running/queued workflows and wait for clean completion or safely terminate per separately approved operator process.
3. For the live DB trigger/Edge path, independently audit whether an approved maintenance-mode guard, scoped hook suspension, or other method can prevent overlapping derived writes **without disabling arbitrary triggers globally**. A database trigger change is a separately authorized DB change and is not implied by maintenance approval.
4. Also inspect Strava/Intervals import paths and manually initiated syncs: the window is not safe if new writes can race into the same runs/derived objects. Restrict impact to the owner when possible; global disruptions are prohibited absent explicit approval.

**Stop gate:** confirm `rings-today-current` AND `rings-today-history` have 0 in-progress/queued active jobs; future invocations are held for the maintenance interval; live `net.http_post` path cannot interfere; target import writers and other derived jobs cannot race. If ANY one check cannot be demonstrated **BLOCK**, regardless of nominal 02:00–03:00 JST. Pause/disable actions have not been attempted.

**Maintenance:** Only with separately audited private rollback-capable SQL, an independently verified backup+restore, and explicit Atsuo approval. All nine strict source pairs and all 23,726 route points must be revalidated (<=2.0m max); dependent counts/hashes from frozen backup must be unchanged. Execute as exactly one approved transaction; all assertions are pass-or-ROLLBACK. Do not update/deactivate the hook or routes outside the approved scope. There is no runnable DML in this repository PR.

**Resume gate:** after DB transaction commits and explicit data consistency verification, ensure affected derived data matches restored/retained-run expectations, and process queued necessary recalculations using a separately approved non-duplicating workflow. Re-enable exact affected schedules and any scoped live-sync gate, confirm new expected jobs can run and no old queued job replays outdated data. Verify current/history and live trigger behavior, and audit 0 stuck/duplicate jobs. Record UTC/JST start and end and the workflow/commit IDs without exposing owner/run IDs, coordinates, tokens or secrets.

**Rollback:** if execution assertions fail, rollback the transaction while held. If post-commit regression appears, use independently tested private restore (requires its own plan/approval) and do not pretend an ordinary transaction rollback applies after COMMIT.

## 4. Status and next acceptance

- [x] Territory Japan GitHub Actions effective source identified; no deleted_at filter.
- [x] Rings Today two Actions schedules and DB live trigger identified.
- [x] Read-only technical stop/resume proposal documented.
- [ ] Confirm privilege/operator-specific ability to stop/resume schedules and live hook, with a **verified safe dry run** in isolated environment.
- [ ] Confirm actual deployed Edge Function source and potential alternative schedulers/writers.
- [ ] Private owner-scoped backup, restoration test, full count/distance/point/hash evidence.
- [ ] Select treatment soft versus hard through separate audit; if soft, missing Territory producer deleted filter must be fixed and deployed under separate explicit permission.
- [ ] Private final DML, transaction locks, target-only assertions, race-free maintenance execution time.
- [ ] むせ full execution-package audit, followed by Atsuo's explicit operation authorization.

This PR adds only documentary evidence and does not modify production or change any PR's approved HEAD.
