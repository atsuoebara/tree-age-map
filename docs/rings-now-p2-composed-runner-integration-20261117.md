# Rings Now P2 — composed existing components runner (2026-11-17)

## Independent audit classification: **本道（既存部品の接続）**, but **NOT executable real P2**

This is the first *composed* harness that directly exercises code from PR #188 (shared-budget stage coordinator), #198 (watchdog and synthetic inventory), #199 (lifecycle/cleanup), and #200 (Docker CLI adapter and bounded command). It does not introduce another standalone policy gate. **No real Docker/CLI/Actions/SQL/HTTP/Auth/image pull** was run or is reachable from this harness.

### Actual connections (end-to-end synthetic test)

`runComposedP2Simulation` calls:
1. `runSyntheticP2Integration` (#188), with a fixed fake child runner and shared budget.
2. `runG3WatchdogSyntheticIntegration` (#198) using the **same fixed fake child contract** and synthetic inventory.
3. `createBoundedDockerCommand({execFileImpl: fixedInMemoryFakeExecFile})` (#200). It applies the existing bounded execFile configuration and returns results via a deterministic **in-memory** command emulator. The real system `execFile` is never passed and no OS process is invoked.
4. `createDockerCliAdapter({command})` (#200), creating the exact network/container argv and label checks through the simulated CLI.
5. A clearly designated `INJECTED_SYNTHETIC_DRIVER` wrapper for #199 (only because the underlying command is fake): `runG3SyntheticDockerLifecycle` creates the three simulated services, handles errors, performs cleanup, and inspects **simulated resources**. The real `DOCKER_CLI_ADAPTER_NOT_ADMITTED` evidence kind remains unchanged and **is not directly admitted** to #199.
6. The composite verdict requires all three components' synthetic success plus zero fake leftovers. On stage-validation rejection, the harness records BLOCKED and continues the synthetic lifecycle cleanup rather than aborting the whole pipeline. Failed cleanup, partial creation, resource leaks, CLI errors and watchdog failures cannot be overwritten by another success.

No application/JWT/RLS performance or P2 safety property is proven by a success status. Best possible: `COMPOSED_SYNTHETIC_COMPONENTS_CONSISTENT_NOT_REAL_P2`. **All** `g1Verified`, `g2Verified`, `g3Verified`, `g4Verified`, `actualResourcesVerified`, `resourceTerminationProven`, `actualP2Proven`, `p2ExecutionAuthorized`, `realDockerInvoked`, `realAuthJwtTested` are always false.

### Tests & observed findings

10 integrated test cases include normal three-service simulated lifecycle, bounded command adapter path, partial create, start failure, leaked resource, CLI timeout, forged owner, synthetic watchdog failure, invalid mode and forged inventory. **GitHub-source V8 shim 10/10 PASS (NOT native Node)**. During integration we found and corrected a handling bug: a synthetic inventory rejection stopped subsequent lifecycle cleanup; now a blocked stage still proceeds to the simulated lifecycle and cleanup. Request native Node: `node --test tests/rings-now-p2-composed-simulation-runner.test.cjs`.

### Remaining blockers to executable P2 — do not mistake harness completion for real readiness

- The combined runner currently has a deliberately fixed in-memory CLI backend. **A future executable Docker backend has NOT been coupled to the real lifecycle**. Existing #199 lifecycle rejects real-driver evidence. Never simply relabel `DOCKER_CLI_ADAPTER_NOT_ADMITTED` as synthetic for real CLI.
- Existing #200 command has a 15-second CLI timeout, but this is **not proof of Docker daemon termination**. No independent daemon resource inventory, after-timeout remediation, cancellation teardown or service healthchecks implemented.
- No bootable PostgreSQL/GoTrue/PostgREST configuration, synthetic credentials, ephemeral write paths, real DB migrations, signed JWT or HTTP/RLS tests. #201 separate pending audit is not a dependency and is not merged here.
- G1 official independent provenance and actual image compatibility, G2 **additional cost 0 yen** account evidence, G3 actual isolated lifecycle and no-leak proof remain incomplete. Thus G4 **real executable runner HEAD audit** has NOT occurred and G5 Atsuo explicit run approval has NOT occurred; H6/A1–A6 NOT RUN.
- Next integration priority: **one separately audited, truly executable isolated runner** using the existing components, with verifiable daemon cleanup and service configuration. All preconditions must be independently checked before lifting any stop switch; **never run before G1/G2/G3/G4 and separate G5**.

### Scope/safety

Exactly three **new files**: this document, `tests/rings-now-p2-composed-simulation-runner.cjs`, `tests/rings-now-p2-composed-simulation-runner.test.cjs`. No existing module or manifest changed. Disabled workflow `if: ${{ false }}`, active manifest `BLOCKED_NOT_RUN` with all digests null and billing `NOT_VERIFIED`; production OFF; `featureStartedAtMs=null`; PR #109 HOLD. No PR merge, Actions, Docker or P2 run is authorized.

### Muse audit request

**At report opening classify 本道/横道.** Verify the HEAD/diff, native 10 tests, real #188/#198/#199/#200 imports and call paths, fake CLI inability to invoke actual Docker, correct fail-closed propagation and continued synthetic cleanup. Attempt adversarial fake CLI exceptions, partial create/timeout, leaked resources, forged inventory and refusal to admit real adapter into synthetic gate. **Do not** call this G4 real executable runner audit yet. No merge or execution approval.
