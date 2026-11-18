# Rings Now: actual GoTrue H1 token expiry — evidence boundary (dormant)

Independent preparation from main while PR #235 awaits its separate audit. No dependency on #235 code. This PR does **not** connect any runtime, execute Docker, or promote G4 proof.

This pure helper captures the exact H1 A token as a nonenumerable secret. It validates H1 observation count, subject/role/audience, issued and expiry timestamps, and refuses already-expired tokens. Its budget planner allows a caller to decide whether genuine elapsed expiration could fit within a strictly bounded remaining window. It does **not** sleep, change exp, re-sign, alter clocks, invoke GoTrue, or claim wall-clock authenticity. Release is permitted only when an explicit later timestamp is strictly beyond original exp; even then, evidence remains CLAIMS_ONLY / NOT_SIGNATURE_PROVEN / NOT_REALTIME_PROOF.

**Critical constraints for actual future G4:** Authenticate GoTrue issuance via run-owned internal HTTP, independently verify real elapsed time and server clocks, and check PostgREST rejects the untouched token only after actual expiration. Do not treat an injected fake clock as evidence. Reauthenticate fresh A/B tokens separately for positive H2 cases because they must not expire while waiting. If waiting would consume the shared Docker timeout or cleanup reserve, fail closed rather than shorten time or remove the reserve. No use of production Supabase settings; no change to JWT expiry setting in this PR.

Official Supabase Auth documentation recommends against setting access token expiration below five minutes (and default is one hour). Even a five-minute local lifetime needs explicit runtime budget accounting and independent G2 cost check.

Offline audit: node --check tests/rings-now-p2-h2-gotrue-expiry-receipt.cjs and node --test tests/rings-now-p2-h2-gotrue-expiry-receipt.test.cjs. Verify the strict exp+1 boundary, the unmodified original JWT, failure paths, nonenumerable secrets and refusal to label clock-injected fixtures as G4 proof.

Unchanged manifest BLOCKED_NOT_RUN, explicitExecutionApproval:false, productionAccess:false, checkoutCommit:null, Actions if:false and existing HOLD statuses. Separate audit and merge approval required.
