# Rings Now G4 H2 — disposable GoTrue JWT expiry setting (DORMANT)

Scope: single isolated runtime GOTRUE_JWT_EXP=300 seconds; pure offline budget and claims checks; regression tests. **This is the documented five-minute minimum recommended by Supabase**. It only writes into the per-run GoTrue 0600 .env file under /tmp/rn-p2-*; no production Supabase Auth setting, persistent server, API or network.

The parent coordinator's shared 540,000ms job configuration with reserve 120,000ms and verify reserve 30,000ms yields at most 420,000ms execute budget, which *may* fit 301,000ms from issuance to strict exp+1 (subject to startup and actual elapsed time). There is **no guarantee** that H1 signup/migrations, A/B seed, H2 positives and fresh signins leave sufficient time. The policy requires remaining execute time at issuance, subtracts a separately declared setup reserve, and BLOCKS instead of shortening the token or borrowing cleanup. The runtime configuration by itself is not proof of what GoTrue issued. The pure claims check validates exp-iat=300 but does not verify signature or authenticated network provenance.

Critical: PR #235 is currently unmerged and separately audited. Actual runner implementation must confirm TTL from the real GoTrue login, issue fresh positive tokens after natural expiration of the retained A token, preserve the original JWT, check PostgREST denies it, enforce both monotonic/wall clock and cleanup reserve, and provide independently inspected execution evidence. This PR DOES NOT call the runner or start Docker; proof flags stay false.

Offline commands:
node --check tests/rings-now-p2-ephemeral-service-runtime.cjs
node --check tests/rings-now-p2-h2-isolated-gotrue-ttl.cjs
node --test tests/rings-now-p2-ephemeral-service-runtime.test.cjs tests/rings-now-p2-h2-isolated-gotrue-ttl.test.cjs

Review one-time 0600 private generated file, exact five-minute setting and postgrest shared secret, strict exp+1 boundary, no cleanup double charge, blocked budgets, invalid claims, existing runtime regression and no G4 proof promotion.

Existing manifest BLOCKED_NOT_RUN, explicitExecutionApproval false, productionAccess false, checkoutCommit null; workflow if:false. Holds #109/#201 remain. Not merged; no Docker, SQL, Actions or production ON.
