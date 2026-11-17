# Rings Now P2 G1 — publisher-page platform digest observations (candidate evidence ONLY)

Date recorded: 2026-11-17 (Asia/Tokyo). **Status: PARTIAL EVIDENCE / G1 NOT VERIFIED / P2 BLOCKED_NOT_RUN.** This document preserves specific full digests shown in publicly readable Docker Hub publisher pages, sourced via independent browser retrieval. **The developer has NOT queried a live registry manifest API or cryptographically verified its returned bytes**, and these observations do not constitute G1 approval or execution permission.

## Three observed publisher-page candidates

| Component | Official/publisher association and intended tag | linux/amd64 platform manifest digest (candidate) | Multi-platform INDEX digest (distinct; must NOT substitute for platform digest) |
|---|---|---|---|
| PostgreSQL | Docker Official Image `docker.io/library/postgres:17.12-trixie` | `sha256:6f7593c161689b6b02c78668b314af7da8811b592c5519108c57a49d0b6ad788` | `sha256:dbb9623d5121b5d2c2c9e2fba56e40193cbb3510d4af7f035b1ab1823aff3205` |
| Supabase GoTrue | Supabase `docker.io/supabase/gotrue:v2.197.0` | `sha256:839f529492d116b4e8b7777c953a27c381d34c15a744b1bcefde5eefaa1f9f9f` | `sha256:1736a63078f5922b198c4cbe50f80ab9a2d3b54fe8b7b6cfb2e9dc5dbbc12c6b` |
| PostgREST | Official PostgREST-maintained `docker.io/postgrest/postgrest:v14.18` | `sha256:c847127074bd26e1b8d3f7c0e6e01e5346f4b85dd34f5d699fd230af960827c0` | `sha256:c7cd7e265a85b05248abf53f4473fcec7e327c282d0bd0cf60f1551996d09fcf` |

**These values are page displays observed on 2026-11-17, not output from a registry API.** A tag may change independently of this note, especially for images with newly pushed tag metadata. Do not extrapolate a timestamped snapshot to registry state at the time of a later run.

## Primary source URLs and observed identity

1. **PostgreSQL**: Docker Hub official image listing `https://hub.docker.com/_/postgres`; platform page `https://hub.docker.com/layers/library/postgres/17.12/images/sha256-6f7593c161689b6b02c78668b314af7da8811b592c5519108c57a49d0b6ad788`. Page explicitly shows aliases `17.12-trixie`, `OS/ARCH linux/amd64`, manifest digest above and a separate index digest.
2. **GoTrue**: Supabase's published Compose configuration `https://github.com/supabase/supabase/blob/master/docker/docker-compose.yml` names `supabase/gotrue:v2.197.0`. Docker Hub page `https://hub.docker.com/layers/supabase/gotrue/v2.197.0/images/sha256-839f529492d116b4e8b7777c953a27c381d34c15a744b1bcefde5eefaa1f9f9f` identifies `linux/amd64` and distinct index/platform digests. This is publisher-page information, not a direct registry response.
3. **PostgREST**: Official project installation document `https://github.com/PostgREST/postgrest/blob/main/docs/explanations/install.rst` explicitly points to `postgrest/postgrest` as its official Docker image. Docker Hub platform page `https://hub.docker.com/layers/postgrest/postgrest/v14.18/images/sha256-c847127074bd26e1b8d3f7c0e6e01e5346f4b85dd34f5d699fd230af960827c0` shows `linux/amd64` manifest and distinct multi-platform index digest.
4. A separate `ghcr.io/supabase/postgrest` package may exist, but **must not be silently equated with** `docker.io/postgrest/postgrest`. Its digest and publisher context require separate evidence if used later.

## G1 independent checks still required (no action performed here)

- From the **same exact approved registry/repository/tag**, obtain the registry's signed/hashed manifest/index descriptor using a trusted registry-inspection client; record request date/time, client version, exact URL, Accept media types, registry response's `Docker-Content-Digest` (if supplied), manifest media type, platform selection and full returned descriptor.
- Establish `linux/amd64` by inspecting the **multi-platform index entry** and the **child manifest's content**. Differentiate index digest, child manifest digest, config digest and filesystem layer digest. Match the `linux/amd64` child digest against the proposed immutable image reference and this observed page; mismatches are STOP.
- Verify that the expected publisher owns the distribution namespace; for GoTrue use Supabase-maintained references; for PostgREST use its upstream maintainer namespace. Confirm versions and registry URL before any future runner reference is selected.
- Record the exact future runnable HEAD and have Muse independently verify the **raw registry outputs** and full three digests. No code should independently set `independentAudit=APPROVED_FOR_EXACT_HEAD` merely from page displays.
- Review G2 zero-additional-cost proof, G3 real isolation/cleanup, G4 audited executable runner HEAD and G5 **separate explicit owner authorization**. None is established by this note.

## File scope and invariants

**One new documentation file only.** Existing PR #189 static checker, manifest digests (still all null), disabled Actions workflow (`if: ${{ false }}`), SQL/fixtures, project code and production remain unmodified. P2 `BLOCKED_NOT_RUN` / `explicitExecutionApproval=false`, production OFF, `featureStartedAtMs=null`, and PR #109 HOLD remain in place. Do not promote the publisher-displayed candidates into the manifest in this PR.

## Independent Muse audit request

- Verify **one newly added document only** and check all three source URLs, tag↔platform↔manifest digest, and separate index digest values against publisher pages.
- Independently determine whether raw registry manifest fetching has happened. It has **not** been claimed. Do not award G1 PASS from page-only evidence.
- Check identity differences: Docker Official PostgreSQL, Supabase GoTrue, official PostgREST and distinct Supabase-maintained PostgREST package.
- Confirm unchanged manifest/workflow/production and zero P2/Actions/container/DB/SQL activity.
