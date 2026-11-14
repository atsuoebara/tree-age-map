# Rings Now — fresh source / production integration preflight (review only)

Status: **HOLD**. This is a repository-only acceptance checklist, not an authorization to connect, fetch live runs, use a FIT, deploy, or turn the feature on.

## Existing implementation facts (read-only inspection)

- Public `index.html` has `fetchCloudRuns(options)`, which makes actual Supabase REST requests in 50-run pages. It selects route and other display fields and filters with `&user_id=eq.` and `&deleted_at=is.null`.
- `getCloudHeaders()` obtains a session via `refreshCurrentSession()` and supplies a bearer token to the cloud call.
- `loadCloudRowsCache()` uses IndexedDB to populate `preloadedCloudRows` for **display** on startup. `refreshCloudRowsInBackground()` may replace saved cache only for a later launch, not current display. Therefore **current `cloudRows` is not guaranteed to be fresh**.
- The existing calendar renders from `cloudRows`, and `rrImaWoShirouSelectCalendarRun` is behind `RR_IMA_WO_SHIROU_CALENDAR_ENTRY_ENABLED=false` and `RR_IMA_WO_SHIROU_FEATURE_STARTED_AT_MS=null`.

## Contract for future, separately approved integration

1. Do not reclassify `cloudRows`, `preloadedCloudRows`, IndexedDB, sessionStorage, or `getCloudRowsSnapshotKey()` as a freshly authenticated source for Rings Now. The calendar may still show cached distance and date. **Viewing a cached entry does not authorize analysis.**
2. Future Rings Now data acquisition must independently check an actual authenticated session and authenticated request context, not simply accept `ownerScoped` / `unmodifiedSnapshot` flags from caller-supplied data. Check RLS and revocation independently as part of the future integration's audit.
3. The future production request must bind every page to the same login identity, use an owner filter and deleted exclusion, and return only `id, user_id, activity_date, distance_km, started_at, deleted_at` (or explicitly document whether deleted_at is omitted and normalize locally). No route/GPS/HR/filename/token in responses to the isolated adapter.
4. The caller must observe account/logout/session-token changes while awaiting every page. Old responses must not mix into a new account; an empty/error response must not silently recover cached rows.
5. Pages should be stably ordered using a unique key; the maximum 1,000-row contract currently **blocks** larger sets rather than silently truncating. Decide on an approved strategy for accounts over 1,000 runs before connecting a real account.
6. Preserve each calendar day's date and distance and per-ID selection on days with several runs. Require owner to select `ガチラン` explicitly; never infer from GPS/file/distance.
7. Apply 691,200 seconds from the run start (inclusive at boundary, +1 ms invalid); do not infer an enablement timestamp or revive a run after expiration, late import or clock rollback.
8. FIT must remain on the device, and cannot be read until separate owner permission. Display the exact caution: `信号待ちやトイレ休憩、自動ポーズなどの影響により、正しく分析できない場合があります。` Do not remove signal/toilet stops or imply moving pace.
9. Preserve production OFF and rollout timestamp null; keep PR #109 draft/HOLD. Require independent auditor approval, explicit owner approval, then separate iPhone real-data and release gates.
10. Explicitly test an offline startup with a valid old cache, an expired/deleted run still present in cache, same-day multiple runs, logout/relogin while paging, switching users, page duplicates/out-of-order, and 1,000+ runs. All analysis must remain unavailable unless a fresh, independently authenticated and authorized snapshot is obtained.

## What this PR proves and does not prove

The accompanying static test locks down **existing code text and isolation invariants only**. It can detect accidental route changes or a new public import before review. It does **not** establish live Auth, RLS effectiveness, a correct production fetch transport, FIT decoding, or iPhone behavior.

Do not merge any still-HOLD PR without separate owner authorization. No modifications to `index.html`, `sw.js`, Supabase, databases or deployments are part of this checklist.
