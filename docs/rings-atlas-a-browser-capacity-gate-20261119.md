# Atlas-2 / browser-only capacity measurement adapter v0.1 (audit-only)

This PR implements only a **pure ESM in-memory estimator** and synthetic negative-control tests. It is NOT installed on production pages or connected to Supabase, user records, session, indexedDB, navigator or network. It does not itself authenticate or prove complete fetches.

Run synthetic regression test in Node 18+:
  node tests/rings-atlas/atlas-a-browser-capacity.test.mjs

Files:
- tests/rings-atlas/atlas-a-browser-capacity.mjs
- tests/rings-atlas/atlas-a-browser-capacity.test.mjs
- docs/rings-atlas-a-browser-capacity-gate-20261119.md

## Input contract – deliberately NOT wired yet
External, separately audited integration would provide `estimateAtlasSnapshotSizes({complete,ownerContext,snapshots})` with **all eight** completion flags true: authValidated, boundOwner, cloudPagesComplete, localSourcesComplete, allPeriodsComputed, noErrors, snapshotCurrent, ownerScopeMatch. Owner-context flags: currentSessionConfirmed, noOwnerSwitch, afterBfcacheRevalidated. Flags are **untrusted caller claims** until the future integrator checks real session state, all cloud pages, local sources and source-version correctness. A malicious or incorrect caller could forge them; no security claim should be based on these flags alone. Real data measurement must be refused until integration audit + Atsuo explicit approval.

Each snapshot explicitly has `scope` (all, year YYYY or month YYYY-MM) plus `stats` containing exactly the needed 12 maps, totalDistanceKm, and runCount. The adapter whitelists only regional numeric bags and sums; input may contain raw activity poison fields but output must never expose them. Unrecognized scopes, duplicate scopes, missing all, missing bag, nonfinite numeric value or incomplete evidence are fail-closed.

## Output contract
Only scope identifiers, serialized UTF-8 byte lengths, run counts, region count (0 or ADM2-unknown —), category entry cardinalities, total and max bytes. Does not persist, log data, fetch records, import auth libraries, query browser globals, send telemetry, or mutate stats. No GPS, user ID, region names, original route/activity data in output. Note: return values do include aggregate run counts (the user has approved only a future private UI, never public logs).

## Requirement: completeness cannot be inferred from existing UI
Current `fetchCloudRuns` pages 50 rows and catches errors downstream in `loadCloudActivities`, which can return 0 while leaving cloudRows and partial in-memory activities. `cloudRunCount` is set when fetched, but no durable end-to-end validated aggregate-complete marker exists. Local GPX parsing can also fail. Therefore this adapter CANNOT safely obtain existing stats or assert account freshness by itself. Future integration requires explicit all-pages-complete and local-source/error evidence, session owner recheck, and atomic selection of all/year/month with guaranteed source version.

## Pending gates
1. Audit this isolated module and negative control.
2. Separate trusted completeness evidence collector specification and fixture tests, without real connection.
3. Explicit Atsuo authorization for **read-only, in-memory actual browser measurement** only after independent audit and G0 Safari evidence as needed. No production default code.
4. G1 A1/A2/A3 capacity comparison; real owner isolation G3 remains separate.

No deploy/merge/real activity access is authorized by this PR.
