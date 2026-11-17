# Rings Now P2 — existing real runner exception cleanup integration, 2026-11-17

**開発側分類：本道の既存runner修正（G4前の安全阻害を解消）、ただし実サービス未起動・G4未達。**

## Why this change blocks integration

PR #203 wired the real Docker CLI path into a staged lifecycle, but its outer `runWithSharedTimeBudget` `catch` returned `FAIL` without attempting cleanup. If the monotonic clock or shared coordinator threw **after Docker network/container creation**, a real Docker resource could be orphaned. This is a real lifecycle integration defect, not an independent new component or policy gate.

## Implementation in the existing runner

Only `tests/rings-now-p2-real-docker-runner.cjs` and its tests are modified.
- Coordinator exceptions now produce a **best-effort emergency cleanup** if, and only if, an empty run-owned baseline was previously established. Reuses the runner's existing `runStage('cleanup')` which re-lists run-owned resources by label, discovers partial creates and attempts only owner-checked stop/remove, then `runStage('verify')`.
- A pre-baseline exception never authorizes destructive actions against colliding/foreign resources.
- All coordinator failures remain `FAIL` **even if cleanup/verification self-report success**, and every G1/G2/G3/G4/P2 authorization flag remains unproven/false. No false G3 promotion.
- Emergency status explicitly records whether cleanup and verification were attempted, blocked, failed or CLI-reported clean. This is **not an independent Docker daemon inventory** and cannot prove orphan-free termination.

## Tests

The 9 existing tests remain. Three added tests verify:
1. Monotonic clock exception after network + all 3 container creations: emergency cleanup and empty simulated inventory, yet overall FAIL.
2. Same exception with a deliberately leaked container: verification FAIL, no claim of completion.
3. Clock exception before the trusted baseline: no Docker/cleanup commands issued.

**GitHub original-source V8 shim: 12/12 PASS.** This is **not** native Node execution. Muse should run `node --test tests/rings-now-p2-real-docker-runner.test.cjs` and probe: clock throws at each stage; partial-create races; unbounded injected command; network cleanup failure; cross-run labels; the exception path must not convert prior success into positive G3 proof.

## Remaining critical blockers (not fixed here)

1. Existing #200 adapter sends `SYNTHETIC_EMPTY`, has no required PostgreSQL writable tmpfs or GoTrue/PostgREST runtime env. Actual service boot and JWT/SQL/HTTP assertions not implemented.
2. The 15s CLI timeout does not terminate a Docker daemon action or a late create; actual daemon-level independent inventory and cancel/kill cleanup are **not implemented**. A permanently pending injected Promise can still hang the stage. The shared time budget is not a watchdog.
3. G1 real official digest provenance/image compatibility, G2 zero *additional* billing, G3 independent no-leak evidence, final executable G4, and Atsuo's separate G5 run approval remain required. **Do not accept this PR as completion of G4.**

Active manifest `BLOCKED_NOT_RUN`, every digest/reference null, billing `NOT_VERIFIED`, approval false. Workflow remains `if: ${{ false }}`; no Actions, Docker, SQL or P2 run. Feature OFF, `featureStartedAtMs=null`, PR #109 HOLD. PR #201 remains separate HOLD.

## Mu(se) independent review

**判定冒頭で本道／横道を明記。** Check exact PR HEAD and exactly the two modified existing files plus this record. Run native tests and failure injections. Verify no changes to workflow, manifest, candidate SQL, DB, production or synthetic-only #199 boundary. No merge, Docker, Actions, P2 execution approved.
