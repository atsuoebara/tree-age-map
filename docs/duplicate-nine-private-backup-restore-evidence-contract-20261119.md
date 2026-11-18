# November 2026 nine-run repair: PRIVATE backup/restore proof contract v0.1
2026-11-19 JST — **design + read-only numerical observation, NOT backup, NOT restore, NOT authorization**.
Prior independent audits: PR #262 conditional physical-delete proposal PASS; PR #265 operational region-cache isolation and Garmin owner-specific freeze design PASS.

## A. Read-only measured restore manifest (volatile snapshot, no private IDs/coords)

As of this SELECT, the nine unique November 2026 cross-source pairs give:
| Scope | Source rows / child rows | Sum distance km (raw, 6dp rounded) | Route point count |
|---|---:|---:|---:|
| `public.runs` Intervals duplicate **targets** | 9 | **66.361996** | **23,726** |
| `public.runs` Strava **survivors** | 9 | **65.102340** | **23,726** |
| `rings_today_run_region_distance` for all 18 runs | 18 | **131.464336** | — |
| `territory_run_municipality_distance` for all 18 | 18 | **131.464336** | — |
| `territory_run_region_distance` for all 18 | 0 | **0.000000** | — |
| `ranking_explore_verified` for all 18 | 18 | — | — |
| Candidate pair relation | 9 | **66.361996** (target source) | 23,726 point-wise aligned positions |

**Important precision: 23,726 is the count per imported source (and per aligned comparison), not both source routes combined. A full 18-run backup should contain **47,452 route points**, provided the snapshot remains unchanged.** The Strava and Intervals 9-run distance sums **differ by 1.259656 km** despite geographic route correspondence; do not force equality or assume the 9 Strava survivors total 66.36 km. The correction delta is the removed Intervals sum, **66.361996 km ≈ 66.36 km**, not the survivor sum.
These values are *fresh read-only evidence only*. Dependent counts have drifted historically due to background sync; freeze manifest must be recaptured **after all writers and async jobs are quiet**. A 1-row change against that frozen manifest => BLOCK. Do not publish IDs, user ID, GPS positions, ciphertext, or row-level hashes.

## B. Region-cache operational decision accepted with restrictions

PR #265 independent audit accepted leaving region-rings path fail closed, **without claiming a refresh worker is identified**.
- Current previously read-only observed values: `publication_enabled=false`, `is_dirty=true`, `region_rings_public_candidate` 0 rows.
- Before freeze, query **both** state and candidate tables again: any `publication_enabled=true`, **candidate count >=1**, or unaudited `is_dirty=false` => **BLOCK**.
- Include cache-control row in encrypted backup, single-transaction expected side effects, and post-execution state audit; both `runs` DELETE and Today child cascade may invalidate it.
- Do not trigger an undiscovered refresh worker, publish candidate rows, or flip publication flags.

## C. Garmin retry active without all-user shutdown

- `cron.job` has an active `garmin-activity-retry` job every 2 minutes. Global disable **NOT** authorized.
- Snapshot from PR #265: target-owner Garmin inbox 27 `saved`, 3 `duplicate`, 0 other states. Recheck live terminal-state definitions of deployed worker before declaring those states safe.
- Before freeze, derive the unique target owner inside a **private operator session**; query owner inbox grouped by `state`, require **0** rows in all nonterminal states, **0** in-flight owner processing in cron/Edge, **0** accepted new owner ingest, and owner-specific ingress embargo. If the owner cannot be isolated without affecting other users, **BLOCK**.
- Resume test: restore owner intake under a reviewed schedule, confirm expected operation without replaying Intervals duplicate, zero orphan inbox changes, other users unaffected.

## D. Private immutable backup and isolated restore evidence specification

**MUST happen after proper separate authorization, not in this PR:**
1. Scope a consistent snapshot to 18 exact `public.runs` rows (9 delete candidates + 9 survivors), **all columns and complete JSON GPS**. Include all derived rows for these 18 across the four verified FK children. Capture `rr_private.region_rings_refresh_state` and other confirmed side-effect state. Do not repurpose legacy `runs_duplicate_backup_20260828`.
2. Store backup **off public GitHub, no PR attachment, no tool output containing routes or IDs**. Define encryption, key custodian, retention period, access restrictions, checksum, and independent restore environment with no reachable production, callbacks, or integrations.
3. In an isolated DB with matching schema, triggers/RLS/identities/FKs, restore **18/18 source rows** and **100%** corresponding dependent rows. Verify both source row count groups (9/9), both summed distances **to exact DB representation**, all GPS point totals (23,726 + 23,726 on frozen snapshot), **all row contents and route checksums 100%**, 4 derived table counts/sums, owner consistency, no duplicate target ambiguity, FK integrity, relevant sequence state and cache dirty control. Differences => **BLOCK**.
4. For the isolated dry-run only, execute the candidate final SQL with one transaction; prove cascade children removed only for 9 targets, all 9 Strava survivors untouched, 0 other users touched, cache-control updates expected. Intentionally inject failures at candidate count, route max distance, derived-hash drift, and an artificial unexpected dependent count; ensure **ROLLBACK restores exact original snapshot** each time. This is **not performed**.
5. Return to private storage only aggregate proof: timestamp, schema/build version, source 9/9, distance sums, point counts, child counts/sums, sha256/HMAC full-row equality percentages, replay/rollback PASS indicators, and any errors. Public PR receives **only redacted aggregate evidence** and no keys, IDs, coordinates or raw content. Compare numerical values against the **fresh frozen snapshot**, not blindly against the historical table above.

## E. Reconcile execution readiness without inventing progress
- [x] All four FK edges and triggers mapped in earlier audit.
- [x] Current source and child read-only counts/distances/route point totals measured.
- [x] Region fail-closed isolation accepted by independent audit, with pre-freeze BLOCK constraints.
- [x] Garmin owner-specific embargo + nonterminal/active handling accepted as design.
- [ ] Private encrypted backup actually exported (NO).
- [ ] Independent isolated **RESTORE 100%** actually demonstrated (NO).
- [ ] Stop/resume dry-run of cron/Actions/pg_net/Edge/workers demonstrated (NO).
- [ ] Runtime-safe exact DML and failure injection executed on isolated environment (NO).
- [ ] Low-risk time window, full package independent むせ audit and Atsuo exact operation approval (NO).

**No database mutation, public GPS export, scheduler pause, production physical delete, approval to merge or deployment is performed in creating this document.**
