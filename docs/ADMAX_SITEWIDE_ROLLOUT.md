# Ninja AdMax: site-wide rollout (2026-11-28)

Scope supersedes the Journal-only proposal. One bottom-of-page slot on index and public user-facing Runner's Rings pages, including generated Journal articles, Rings People, maps, rankings and user tools. Exclude administration, review/preview/lab, verification, auth callbacks, embedded processing frames, offline fallback, and the separate cycle site. No additional charge.

## Activation gates (all required)
- Ninja confirms the exact isolated-frame placement and measurement are supported. A div or async script is not isolation; same-origin JavaScript can access browser auth storage.
- A controlled, independently isolated advertising origin must determine the country from trusted server-side request metadata before any Ninja request. EEA, UK, other European countries and unknown/ambiguous regions are blocked. Initial Japan-only allowlist is a conservative candidate, not a final country rollout decision. Browser language, timezone and user geolocation permission are not substitutes.
- No third-party advertising JS on runnersrings.com as part of this change; no credentials or tokens passed to the frame; no parent messaging bridge. Sandbox without allow-same-origin is preferred if provider confirms compatibility. Validate cookies, referrers, click behavior and direct navigation to the frame endpoint.
- Verify no extra costs, actual hosting capabilities, and privacy disclosure before activation. Do not change DNS or hosting without approval.
- One shared bottom slot per top-level document, outside bilingual article bodies; never on embedded documents. Mobile 320x50, no overlay, sufficient separation from controls, no overflow, no blocked navigation on failure. Rollback centrally disables loading.
- Existing Google ads.txt row and 685 supplied Ninja records retained; existing AdSense configuration unchanged by this PR. Existing AdSense security exposure is a separate issue, not proof that new scripts are safe.

## Implementation status
Preparation only. No advertising endpoint, provider script, live region lookup, or page injection is enabled. Confirm provider compatibility and hosting before activation.
