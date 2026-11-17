# Rings Now P2 G1 — Audited-registry observation handoff (NOT G1 PASS)

2026-11-17. This PR adds a **machine-readable handoff of the independent auditor's reported registry observations**, together with an offline consistency test. It deliberately does **not** modify the live manifest or activate P2.

## Evidence chain and exact distinctions

- PR #190 recorded publisher-page candidates. Muse addendum 108 independently observed at approximately **2026-11-17 14:47 JST** that the Docker registry returned index bytes whose SHA-256 matched the supplied digest headers, then retrieved child manifests by digest and checked byte-level SHA-256 for **all three** `linux/amd64` images.
- Muse addendum 109 verified the follow-up document's consistency with addendum 108. An attempted later registry recheck timed out at Docker Hub authentication, so the earlier timestamped observation—not a newly retrieved raw response—is the basis for this handoff.
- PostgreSQL `17.12-trixie` **index** had changed from previously displayed `dbb9623d…` to observed `0d938e97…`; its `linux/amd64` **child** remained `6f7593c1…`. Never mix these artifact types or treat a mutable tag as an immutable pin.
- GoTrue `v2.197.0` child `839f5294…` and PostgREST `v14.18` child `c8471270…` are likewise captured in full in `docs/rings-now-p2-g1-auditor-registry-evidence-20261117.json`.
- The JSON is explicitly labeled `AUDITOR_REPORTED_REGISTRY_OBSERVATION`, not an independently fetched registry response. Exact registry request/response bytes, complete headers, Accept media types and verifier client version are **not attached**. Its timestamp is an *approximate minute*, not a fabricated exact event time. A future reviewer must confirm provenance and current image identity independently as appropriate.

## Actual changes

**Three new files only:** the JSON handoff, `tests/rings-now-p2-g1-evidence-ledger.test.cjs` (six Node offline checks), and this document. No edits to the original PR #190/#191 records, PR #189 static gate, runner, workflow, manifest, fixture, candidate SQL or public site.

## Admission decision and next gate

This evidence is sufficient to make the auditor's reported **digest candidates reproducible in a structured record**. It is *not* sufficient to set `g1Verified=true` or any P2 permission: only a later independently audited stage can decide whether all required official-source and raw-registry proof is present. The record does not satisfy PR #189's future evidence format: manifest `checkoutCommit` and pinned `reference` are still null, so a direct `inspectG1Evidence` call on this pair must remain BLOCKED. Do not manufacture `checkedOutCommit` or `verifier` flags to make that format appear complete.

**No G1–G5 gate is closed by this PR.** G2 future cost-free proof, G3 real process/resource teardown, G4 exact executable-runner audit, and G5 Atsuo's separate explicit P2 authorization remain open. Workflow `if: ${{ false }}`, manifest `BLOCKED_NOT_RUN`, `explicitExecutionApproval=false`, production OFF/`featureStartedAtMs=null`, PR #109 HOLD remain unchanged.

## Muse independent review requested

Check the **three new files** only, run `node --test tests/rings-now-p2-g1-evidence-ledger.test.cjs`, compare all three child digests and both PostgreSQL index digests against addenda 108/109, and distinguish *auditor's prior report* from *attached raw registry evidence*. Ensure that missing raw responses, exact timestamps and client version remain clearly declared. Confirm manifest values stay null and P2 hard-stop unchanged. This PR's merge would be separate and does not approve manifest edits or P2 execution.
