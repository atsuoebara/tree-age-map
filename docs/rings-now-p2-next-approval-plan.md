# Rings Now P2 — next isolated diagnostic run: approval plan (NON-EXECUTABLE)

Status: DESIGN ONLY. No run, no authorization, no workflow activation.

## Verified starting point
- CLI safe diagnostics is integrated in main via PR #314 (squash commit 9514f98ab5f6cbba6a8cd5f366c3daab4be9afcc).
- Canonical manifest remains `BLOCKED_NOT_RUN`, `checkoutCommit: null`, `explicitExecutionApproval: false`.
- Workflow's sole job remains `if: ${{ false }}`.
- Prior isolated run #6 reached the probe but did not establish G4. Its older CLI lacked safe stage diagnostics.

## Required sequence (separate decisions)
1. **Source candidate**: choose and freeze an exact HEAD containing the audited diagnostic CLI and all required runner code. Review exact source and regression tests. This document is not approval evidence.
2. **Approval-only child**: create a **single-parent** commit whose only changed paths are the canonical manifest and disabled workflow. Manifest `checkoutCommit` must equal the child commit's parent (source HEAD), never the child itself. No code or documentation edits in this child.
3. **Independent audit**: auditor checks the exact source, child parent/diff, manifest values, workflow conditions, fail-closed checks, no production secrets/access, and the one-shot budget. No automatic transition from audit to dispatch.
4. **Owner decision**: separately obtain explicit authorization for exactly one isolated run at the approved child HEAD. Verify run-specific zero-additional-cost requirements before dispatch; do not treat prior billing checks as indefinite proof.
5. **Only after authorization**: manually dispatch once; collect safe stage diagnostics, verify independent cleanup evidence and H1–H6 rather than interpreting CLI self-report as G4 proof.

## Diagnostic interpretation
- `stageRecords`: execute / cleanup / verify, statuses and attempted/overran only.
- `opsSummary.known`: allowlisted progress markers; stop/remove counts reveal attempts, not independent resource absence.
- A CLI exit code 1 and hardcoded `g3Verified:false`, `actualP2Proven:false`, `resourceTerminationProven:false` remain NOT PROVEN.
- Missing stage records or a runner exception are not a pass; investigate separately without raw secret-bearing logs.

## Non-negotiable boundaries
- No production Supabase SQL/DB/Auth/FIT, no production ON, no merge of an approval child to main.
- No automatic workflow triggers or unbounded/paid runner changes.
- No dispatch based solely on this plan, an audit of diagnostic code, or a previous owner approval.
