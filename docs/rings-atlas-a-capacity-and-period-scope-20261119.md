# Atlas-2 Method A: capacity and period scope, design gate
Date 2026-11-19. Test-only, no persistent cache, actual data or new API.

## Synthetic capacity profiler
Run: node tests/rings-atlas/atlas-a-capacity-synthetic.cjs (Node 18+).
Outputs UTF-8 JSON and gzip byte counts for synthetic activity counts 0,12,100,500,1843,5000,10000, plus synthetic annual and monthly examples. Synthetic 1843 does not measure actual 1843 runs. No network, real activity read, database, localStorage, write endpoint or identity.

Snapshot property allowlist: schema, scope, totalDistanceKm, runCount, municipalityDistance/RunCount, prefectureDistance/RunCount, countryDistance/RunCount, regionDistance/RunCount, admin1Distance/RunCount, admin2Distance/RunCount, regions. Never include original activities, routes, GPS latlngs, user ID, email, ringCells, activityCellIndex or tokens. Actual ownership belongs in a separate authenticated storage envelope, not public URL.

## Three mutually-exclusive period scopes
ALL = all complete owner runs across all calendar years, not trailing 12 months.
YEAR YYYY = only records matching existing selectedYear semantics (local activity-date year).
MONTH YYYY-MM = records matching existing selectedYear and selectedMonth, including same-day multiple runs; not import timestamp. No fallbacks between scopes; reject incomplete or illegal keys. An empty confirmed period is zero, an incomplete or failed period is unknown, and unknown overseas ADM2 follows existing sentinel rule.

## Options pending decision
A1 all-only: small, but cannot derive year/month from aggregate-only all; route classification would need to be repeated or supported by a second complete data source.
A2 all + year + month: direct period switches; larger aggregate size and more invalidation when data are edited.
A3 all + year + monthly on demand from a verified complete owner-local dataset: fewer stored snapshots, but must prove full local data and no second GPS fetch.
Do not choose before real cardinality and lifespan measurement. Candidate A snapshots must include full computed state only, not partially downloaded pages.

## Invalidation and privacy conditions
New, corrected, deleted, re-imported or duplicate-resolved activity invalidates affected year/month and ALL; changes to geographic boundaries or aggregation rules invalidate every scope. Unknown freshness never becomes confirmed zero. A sign-out, account switch A to B, multi-tab writes, stale callbacks and Safari bfcache require auth and owner revalidation; never display A values to B.
No anonymous publication of regional breakdown, no public URL owner key, no durable storage without a separate audit and explicit approval. Do not confuse geographic region values with regional ranking public statistics.

## What remains unmeasured
The full-period serialized byte size of actual owner statistics, complete all/year/month snapshots, peak client memory, account-specific regional cardinality, slow-phone performance, cache TTL and storage quota are UNKNOWN. Measuring real owner data, even just bytes, requires a separately audited, read-only, user-approved in-browser tool; only output aggregate byte counts and entry totals, never location keys or routes or raw values.
G0 iPhone Safari #257 unfinished, G2 partial #273/#276 passed audits but not merged, G3 live auth-owner isolation unfinished. Method A versus B/C still awaits G1 review and Atsuo approval.
