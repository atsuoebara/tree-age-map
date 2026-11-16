# Rings Now P2 — isolated synthetic test matrix (NOT RUN)

2026-11-17. Preparation only; no SQL executed, no GoTrue/PostgREST/Actions started. PR #177 remains separately awaiting independent audit.

The pure Node module defines 10 deterministic **synthetic scenario inputs and expected outcomes**: zero rows, 1,000 rows, 1,001 rows, started_at NULL, 1,001 with NULL (too_many_rows priority), other-owner rows, deleted rows, six-digit fractional seconds, exactly eight days and unauthenticated access.

- Owners are fixed fictitious UUIDs; no personal or production records are read.
- This data is **not** the proof of any SQL, RLS, snapshot, Auth/JWT, HTTP, 8-day computation or permission behavior. The isolated runtime must independently apply real SQL to a disposable DB and compare observed values to the expectations.
- Cases are capped at 1,001 and only produce in-memory arrays. No side effects on module import.
- The exact eight-day case is a **boundary expectation only**. JavaScript Date parsing is millisecond precision; actual microsecond boundary correctness still requires separate PostgreSQL-based evidence.
- Future implementation must derive rows from actual PostgREST RPC, not copy the expected result from this fixture.

No workflow/manifest/candidate SQL/production file changes. Hard stop remains `if: ${{ false }}`; P2 approval, billing evidence and immutable image digests remain unavailable.
