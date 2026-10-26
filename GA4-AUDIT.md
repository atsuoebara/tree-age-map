# GA4 audit — 2026-10-26 (JST)

Source of truth: GitHub main 466fe6f431427b75b0457d783ddc3ec4b1e1d6a8 and its ROADMAP.md. Independent worktree; sources/ untouched.

## Confirmed findings and minimal changes

- Measurement ID already used consistently: G-CX6V4G2ML5. No mismatched IDs found.
- today.html on GitHub and the public HTTPS site returned no Google tag. This is a confirmed instrumentation gap explaining why direct Today visits cannot send their own page_view. It does not prove that every absence in the supplied GA4 report has this single cause; report filters, property stream mapping and ingestion were not inspected.
- Added the existing standard tag to 26 previously untagged public HTML pages. Existing tagged index, territory, journal and generated articles are unchanged except the two index feature events below. Standard config sends one automatic page_view; no redundant manual page_view added.
- Actual Growth Rings Timelapse UI and video generation are in index.html (generateTimelapseShareVideo). timelapse.html is a public explanatory landing page. Panel opening does not navigate or change URL, so it should not fabricate a separate page_view. Added timelapse_open only on successful panel opening and timelapse_complete only after recorder stop and preview creation. Completion has video_type=period or monthly_review; no dates, distances, routes, user IDs or video data added to event parameters. Real video rendering was not exercised.
- journal-post.html loads a published article asynchronously and sets document.title in draw(). Its config disables the initial generic page_view. One explicit page_view follows successful title assignment, using the canonical slug URL; language redraws do not duplicate it, and missing/error articles do not produce an article view. No history navigation is implemented in this page.
- Today date/language controls, ranking filters and Territory controls update the existing page rather than navigate to a distinct page. No speculative custom events or virtual pageviews added. index history replacement is existing OAuth cleanup; property Enhanced Measurement settings were not inspected or changed.
- Journal generator already includes the correct standard tag; no generator changes required. No tag added to admin/preview/lab/local experiment/verification/OAuth-return pages, listed below. OAuth-return exclusion avoids introducing collection of authentication query parameters.

## Validation

- node scripts/check-ga4.cjs: PASS for all 68 HTML classifications, one loader/config and matching ID on 62 tracked pages, tag initialization, changed inline script syntax, delayed article success/missing/error, language redraw deduplication, and actual panel handler open/close/no-data branches.
- Real headless Edge loaded modified today.html at the production origin using intercepted HTML and real Google gtag.js. Observed exactly one outgoing page_view, tid=G-CX6V4G2ML5, dt=Rings Today | Runner's Rings. Collection was aborted for this local test to avoid recording a synthetic local visit.
- git diff check with core.whitespace=cr-at-eol passes (three baseline files retain CRLF in Git blobs).
- Existing check-index.js fails the same selected-route blue-line assertion (two missing patterns) both on pristine source main and on modified code; all five index inline script blocks parse successfully. This is not a newly introduced GA4 failure.
- Two untouched nested legacy generated article files already contain an invalid newline in their sharing script. Their earlier standalone tag scripts are valid. The audit reports these pre-existing syntax errors separately; they are outside this minimal GA4 patch.
- GA4 administrator report ingestion, property/data-stream mapping, Enhanced Measurement configuration, filters and DebugView remain unverified. Browser network acceptance is not proof that a standard report has processed an event. Supplied screenshot ends 2026-10-25, so it cannot show visits recorded after this fix on 2026-10-26. No past visits can be reconstructed by adding tags.

Google reference: https://developers.google.com/analytics/devguides/collection/ga4/views (config sends page_view by default; disable before manual pageviews).

## Complete HTML inventory

| HTML | Measurement / exclusion |
| --- | --- |
| about-runners-rings.html | One automatic page_view via config |
| contact.html | One automatic page_view via config |
| developer-message.html | One automatic page_view via config |
| faq.html | One automatic page_view via config |
| garmin-return.html | OAuth return page; may receive authentication parameters |
| googlede761637420561cb.html | Google ownership verification payload |
| gps-art.html | One automatic page_view via config |
| how-to.html | One automatic page_view via config |
| index-usa-adm2-local-geojson.html | Local geometry experiment |
| index.html | One automatic page_view via config |
| journal/articles/journal-20260926-110552-a42342a0/index.html | One automatic page_view via config |
| journal/articles/journal-20260926-110552-a42342a0/journal-20260926-110552-a42342a0/index.html | One automatic page_view via config |
| journal/articles/journal-20260927-135444-4e7e40d3/index.html | One automatic page_view via config |
| journal/articles/journal-20260927-135444-4e7e40d3/journal-20260927-135444-4e7e40d3/index.html | One automatic page_view via config |
| journal/articles/journal-20260927-221326-00b55b1a/index.html | One automatic page_view via config |
| journal/articles/journal-20260929-212656-d8ded808/index.html | One automatic page_view via config |
| journal/articles/journal-20260929-230507-a10f4d17/index.html | One automatic page_view via config |
| journal/articles/journal-20260930-163011-57a69ab1/index.html | One automatic page_view via config |
| journal/articles/journal-20261001-223359-35586df7/index.html | One automatic page_view via config |
| journal/articles/journal-20261002-223502-a35b79c8/index.html | One automatic page_view via config |
| journal/articles/journal-20261003-220400-c30dfc9e/index.html | One automatic page_view via config |
| journal/articles/journal-20261009-000907-3e3dcf84/index.html | One automatic page_view via config |
| journal/articles/journal-20261012-054320-40c83476/index.html | One automatic page_view via config |
| journal/articles/journal-20261015-230658-f07fa368/index.html | One automatic page_view via config |
| journal/articles/journal-20261016-060449-e2d031bf/index.html | One automatic page_view via config |
| journal/articles/journal-20261016-125136-3ad97d01/index.html | One automatic page_view via config |
| journal/articles/journal-20261016-164421-064612a9/index.html | One automatic page_view via config |
| journal/articles/journal-20261017-134956-7eb0d1cc/index.html | One automatic page_view via config |
| journal/articles/journal-20261017-142445-75e41d5a/index.html | One automatic page_view via config |
| journal/articles/journal-20261018-083715-efa7d82b/index.html | One automatic page_view via config |
| journal/articles/journal-20261018-083832-ab6cebf6/index.html | One automatic page_view via config |
| journal/articles/journal-20261018-105616-1dd2b82c/index.html | One automatic page_view via config |
| journal/articles/journal-20261019-141203-b9a0b01c/index.html | One automatic page_view via config |
| journal/articles/journal-20261019-142053-c42fabf2/index.html | One automatic page_view via config |
| journal/articles/journal-20261019-144929-83f924ab/index.html | One automatic page_view via config |
| journal/articles/journal-20261020-143649-2aea2608/index.html | One automatic page_view via config |
| journal/articles/journal-20261020-163549-db5a87d0/index.html | One automatic page_view via config |
| journal/articles/journal-20261021-123927-7484c0d5/index.html | One automatic page_view via config |
| journal/articles/journal-20261022-131735-7a9d0107/index.html | One automatic page_view via config |
| journal/articles/journal-20261023-181216-34abd31c/index.html | One automatic page_view via config |
| journal/articles/journal-20261023-181529-12d1870d/index.html | One automatic page_view via config |
| journal/articles/journal-20261024-134659-4a3f09bc/index.html | One automatic page_view via config |
| journal/articles/journal-20261026-120539-14d19a2b/index.html | One automatic page_view via config |
| journal-001.html | One automatic page_view via config |
| journal-002.html | One automatic page_view via config |
| journal-003.html | One automatic page_view via config |
| journal-004.html | One automatic page_view via config |
| journal-005.html | One automatic page_view via config |
| journal-006.html | One automatic page_view via config |
| journal-007.html | One automatic page_view via config |
| journal-008.html | One automatic page_view via config |
| journal-009.html | One automatic page_view via config |
| journal-010.html | One automatic page_view via config |
| journal-011.html | One automatic page_view via config |
| journal-012.html | One automatic page_view via config |
| journal-admin.html | Editorial administration |
| journal-post.html | Manual page_view after published article title |
| journal-v2-preview.html | Preview |
| journal.html | One automatic page_view via config |
| partners.html | One automatic page_view via config |
| privacy.html | One automatic page_view via config |
| ranking.html | One automatic page_view via config |
| rings-layers-lab.html | Experiment (noindex,nofollow) |
| sample.html | One automatic page_view via config |
| terms.html | One automatic page_view via config |
| territory.html | One automatic page_view via config |
| timelapse.html | One automatic page_view via config |
| today.html | One automatic page_view via config |

## Deployment

Pending publication and production verification. This section will be updated with observed evidence, not inferred success.
