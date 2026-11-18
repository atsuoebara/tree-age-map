# Rings Now G4 H2 — actual Node clock bridge, dormant (2026-11-18)

This PR isolates the real-time clock binding from the larger unmerged PR #235. It depends only on PR #236 and #237 already in main.

createRealExpiryClock takes an **explicit parent execute stage monotonic deadline**. It uses performance.now(), Date.now(), and timers/promises.setTimeout, with no overridable timing callback and no timer at import. Each chunk is at most 30s, and both before and after sleep it must be inside the execute stage. The pure PR #237 wait coordinator then checks both the wall-clock exp and measured monotonic elapsed time.

The parent's runWithSharedTimeBudget has **already reserved cleanup and verification time** when allocating its execute stage. To avoid subtracting it twice, the bridge passes (remaining execution time + cleanup reserve) to the earlier planner, which subtracts cleanup once, recovering precisely the execute stage remainder. The hard monotonic executeDeadlineMs is nevertheless enforced separately in real sleep.

The bridge and its tests are **not wired to the actual runner** yet. They do not change GoTrue TTL or run Docker. The expiry candidate is still not cryptographically proven: this is merely a future clock binding and cannot independently prove that the H1 token was issued by GoTrue or that PostgREST denied its use. All proof flags remain false. If the original H1 token TTL outlasts the execution budget, return BLOCKED immediately without sleeping.

IMPORTANT remaining integration: await exact independent audit and explicit merge authorization for PR #235; configure disposable GoTrue JWT TTL compatible with budget while preserving Supabase's minimum guidance; capture an unchanged H1 token; use this real bridge only inside the canonical approved runner's bounded execute stage; re-signin positive cases after expiry if needed; invoke actual isolated PostgREST to prove expiry denial; cleanup and independent audit. No synthetic token should be called evidence of GoTrue natural expiry.

Audit: node --check tests/rings-now-p2-h2-real-clock-expiry-bridge.cjs; node --test tests/rings-now-p2-h2-real-clock-expiry-bridge.test.cjs tests/rings-now-p2-h2-gotrue-monotonic-wait.test.cjs tests/rings-now-p2-h2-gotrue-expiry-receipt.test.cjs. Actual short Node timer smoke is ~15ms, no long wait, Docker, SQL or network. Reject deadline races and secret leakage.

All production, manifest and workflow code remains untouched: BLOCKED_NOT_RUN, explicitExecutionApproval:false, productionAccess:false, checkoutCommit:null, Actions if:false; no merge or execution without separate owner authorization.
