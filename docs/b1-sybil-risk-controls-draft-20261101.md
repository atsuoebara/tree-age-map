# B-1 Sybil risk mitigation draft (2026-11-01)

Status: design only, NOT approved. Consent OFF / release OFF / no production changes.

## Threat
One human can operate multiple accounts; account counts and external account IDs cannot reliably prove independent people. Shared external IDs, overlapping activity fingerprints and registration timing are investigation signals, not proof of fraud. An attacker can also fabricate unique external IDs and distinct activities.

## Decision rule
All country-year numeric cells remain HOLD until an independently audited strategy for distinct-person assurance exists and a concrete residual-risk judgment is approved. A minimum account count never converts a HOLD into publication approval. Signals can flag conflicts but missing signals do not establish safety. No automatic bans or punitive account actions from synthetic heuristics.

## Candidate controls to assess separately
- Look for duplicated external provider identifiers, with privacy, account linking and provider terms reviewed beforehand.
- Look for overlapping activity fingerprints and improbable repeated contributions, without publishing or retaining individual routes unnecessarily.
- Consider account maturity and observed contribution history only as supporting risk signals; avoid treating long tenure as a unique-person proof.
- Investigate false positives: shared devices, family members, migrated accounts, duplicated imports, legitimate multi-service sync.
- No requirement for identity documents or mandatory public profiles in initial design. Any new private signals require data-minimization and authorization review.

## Synthetic tests
`scripts/b1-sybil-hold.test.mjs`: 20 apparently independent accounts, 20 duplicate-linked accounts, 20 distinct-looking attacker accounts and 5-account small group. All decisions MUST remain HOLD, even when naive count threshold is passed. The test does **not** validate detection accuracy or independent-human verification.

## Outstanding approval gates
Independent audit of threat model, false positive and bypass paths; practical verification feasibility; real distributions (prior Atsuo permission); numeric acceptance thresholds; consent and withdrawal integration; API and caching; final authorization. If uniqueness is unverifiable, remove numeric country-year public totals from initial launch.
