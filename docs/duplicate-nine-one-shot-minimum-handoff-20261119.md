# One-shot read-only repair gate and minimum execution handoff — 2026-11-19

**Status: read-only screen only. No backup acquisition, no isolated actual-data restore, no DML, no authority to merge, pause or deploy.**

## Read-only evidence (live, pre-freeze)
The non-identifying candidate query was executed and returned **9 pairs, 9 distinct targets, 9 distinct survivors, 1 owner, target sum 66.361996km, survivor sum 65.102340km**. The two sums deliberately differ. This is a volatile observation, NOT an immutable freeze manifest. SQL is a single snapshot transaction and now explicitly BLOCKs if either sum differs, addressing the optional correction from PR #271 audit.

## What can be skipped vs. what cannot
* **SKIP** new synthetic fixture series (PRs #268/#269/#272 passed), broad Intervals user shutdown, changing generic Strava integration, rewriting past history, or requiring Atsuo to operate a desktop.
* **DO NOT SKIP** evidence that the designated 9 full rows and all dependent rows are recoverable, proof no new writes can race the scoped deletion, 9-target/9-survivor unique mapping and private GPS equality, same-snapshot child/cache state, matching PG17.6+float8 typed restore 100%, rollback proving exact row/key hashes, other users unaffected, independent auditor and explicit final production DELETE authorization.
* There are **4 connected Intervals accounts** and **2 owners of 17 active Intervals runs**; no global shutdown. No blanket deletion of all Intervals runs. Only the 9 verified duplicate rows are candidates.
* Current tools cannot export an encrypted scoped private backup directly to a verified isolated PG service. A **public GitHub Actions runner is not approved as a destination for GPS/IDs**, even if the repo/workflow is private-looking. A Supabase routine daily project backup is *not* a standalone 18-row restore test. Do not run a production delete based on either alone.

## Single explicit decision after evidence
When a trusted operator has established an encrypted private off-repo snapshot, isolated PG17.6 restore (same full row hashes and typed float8 values), owner-scoped short quiescence with no in-flight writers/Edge/pg_net or Garmin retries, and isolated failure injection/rollback, consolidate *one* evidence report for むせ:
- snapshot timestamp, target=9/survivor=9, target/survivor totals, GPS point counts, derived children and cache state
- private 100% full-row/typed field comparison, fail-injection/ROLLBACK result, retention and recovery custody attestation
- operation schedule and reviewed **private** exact-ID SQL locked to ownership and immutable snapshot hashes, DELETE RETURNING confined to private handler, all-child cascade verified
- post-op aggregated ranking change expected 66.361996km (subject to active runs since screen)
- 0 other-owner mutation and owner-specific writer handling, restart plan
Keep all private IDs/routes/hashes out of PR, chat and logs.

**No proof is to be marked PASS until actually run.** If a safe private endpoint or trusted operator is unavailable, BLOCK instead of lowering the recovery gate. No current production operation is performed by this PR.
