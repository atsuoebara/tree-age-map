# Rings Now G4 H2: ordered 7-case integration contract (NOT RUN)

This is a batched PR covering H1-to-H2 data handoff, A/B SQL seed prerequisite, token expiry and denied-role prerequisite gates, seven fixed HTTP cases, non-secret reporting and offline tests. It has no implicit I/O. This is **not yet attached to the real runner**.

Execution order: H1 two private tokens/IDs checked -> candidate SQL built for A/B -> injected owner-checked disposable DB seed must report success -> injected genuinely expired signature-intact A JWT -> injected restricted-role A JWT -> seven fixed H2 requests sequentially -> exact owner/row counts or proper HTTP denial -> sanitized outcome. Every failure blocks completion.

Important unresolved prerequisites: actual runner-owned 0600 SQL file adapter, reliable genuine GoTrue expired JWT, valid dedicated-role signed JWT with proven provenance. No token is generated or edited here. Actual SQL, Docker, JWT and HTTP are NOT executed in this PR. The injected callback report does not establish G4 truth.

Status remains H2_SEVEN_CASES_CLI_REPORTED_NOT_G4_PROOF; h1Verified/h2Verified/g4Verified remain false.

The runtime runner, Docker adapter, SQL candidate, manifest and workflow are unchanged. BLOCKED_NOT_RUN, if:false, productionAccess false and user approval false remain, no G5. No billing or production changes. Separate audit and owner merge consent required.

Independent test: node --check both new CommonJS modules, then node --test tests/rings-now-p2-h2-sequence.test.cjs tests/rings-now-p2-h2-postgrest-http.test.cjs tests/rings-now-p2-h2-isolated-seed-sql.test.cjs.
