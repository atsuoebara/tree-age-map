# Rings Now P2 G1 — PostgreSQL tag/index drift audit addendum (NOT RUN)

Recorded 2026-11-17. **G1 BLOCKED; no execution authorized.** This addendum records the independent audit results for draft PR #190 without changing its audited HEAD `d1d4500597f685b2f06b9375c5dc9f3eb2940548`. PR #190 was **audited PASS with one observation (Muse addendum 108)**, but remained **UNMERGED** when this document was authored.

## Source distinction: index versus child manifest

| Item | Digest | Evidence provenance |
|---|---|---|
| PostgreSQL `docker.io/library/postgres:17.12-trixie` index **as recorded in PR #190** | `sha256:dbb9623d5121b5d2c2c9e2fba56e40193cbb3510d4af7f035b1ab1823aff3205` | Older publisher-page observation; **superseded for tag/index tracking** |
| PostgreSQL `17.12-trixie` index observed during Muse audit | `sha256:0d938e975177bef9f1f61f3f9dbcf2e0aa0a139568f66d3415ed8892eb97f6ac` | Muse addendum 108; direct registry response around **2026-11-17 14:47 JST** and byte-level SHA-256/header matching. Separately supported by the Docker Hub publisher page showing this index, but this developer did **not** independently fetch the raw registry response |
| PostgreSQL `linux/amd64` **child manifest** | `sha256:6f7593c161689b6b02c78668b314af7da8811b592c5519108c57a49d0b6ad788` | Muse addendum 108: fetched by digest from registry, SHA-256 of response bytes matched; child manifest is distinct from index |
| GoTrue `supabase/gotrue:v2.197.0` amd64 child manifest | `sha256:839f529492d116b4e8b7777c953a27c381d34c15a744b1bcefde5eefaa1f9f9f` | Muse addendum 108: digest-addressed registry response SHA-256 matched |
| PostgREST `postgrest/postgrest:v14.18` amd64 child manifest | `sha256:c847127074bd26e1b8d3f7c0e6e01e5346f4b85dd34f5d699fd230af960827c0` | Muse addendum 108: digest-addressed registry response SHA-256 matched |

PostgreSQL index change does **not** imply the `linux/amd64` child changed. **Do not replace child digest with index digest.** Docker Hub's pages may be served from different cache snapshots: the previously viewed page can still show `dbb9...` while the current tag listing shows `0d93...`. The index of a mutable tag may change again. For any eventual immutable image reference, fix the exact child manifest with `@sha256:6f7593...` and separately confirm the manifest contents for the intended platform and the registry namespace.

## Directly retrievable corroboration and limits

- Docker Hub current page: `https://hub.docker.com/layers/library/postgres/17/` (index shown as `0d938e...`; aliases include `17.12-trixie`).
- Docker Hub tag list: `https://hub.docker.com/_/postgres/tags?name=17.&page=1` (lists `17.12-trixie`, with `linux/amd64` digest beginning `6f7593c16168`).
- Historical/cached platform page `https://hub.docker.com/layers/library/postgres/17.12/images/sha256-6f7593c161689b6b02c78668b314af7da8811b592c5519108c57a49d0b6ad788` may show the prior index. This **does not** disprove Muse's direct registry result; use index content and timestamp when comparing.
- The raw HTTP requests and response bodies recorded by Muse are **not included here**, only the auditor's stated result. A follow-up independent HEAD audit should obtain durable full evidence metadata, reproduce the tag-index/child relationship, and examine actual registry bytes where required. Do not classify this developer-written summary as independent registry verification.

## Remaining tasks and unchanged safety boundary

1. PR #190 has **not** been merged under a `next` message: request explicit merge approval separately. Avoid editing its audited SHA; addendum is a distinct PR with its own audit.
2. Future evidence handoff must reconcile the stale PR #190 index observation with this new time-stamped index observation; record exact full digest, source, platform, verification method, precise HEAD, UTC/JST time and source media types. This document is **not** an update of the existing manifest.
3. PR #189's G1 evidence-format checker is already on main, but the manifest retains null digests. A separate audited manifest change and G1 gate decision are still required. **G1 is BLOCKED, not PASS.** G2–G5 remain unproven/unapproved.
4. No workflow, manifest, existing audited JavaScript, fixture, candidate SQL, website or production changes. Workflow `if: ${{ false }}`; `BLOCKED_NOT_RUN`; `explicitExecutionApproval=false`; production OFF; `featureStartedAtMs=null`; PR #109 HOLD.

## Muse independent audit request

At this new PR's exact HEAD, check the **one-file addendum only**, confirm PR #190 is not stealth-merged or edited, verify the index drift and child-manifest distinction against the original registry source (and your addendum 108 notes), and make clear G1 is still blocked. Check that no Actions, Docker, P2, SQL or production execution happened. Merging this document does not authorize other PR merges, manifest edits or P2 execution.
