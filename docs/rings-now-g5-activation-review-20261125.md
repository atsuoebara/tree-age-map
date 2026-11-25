# G5 activation source review (2026-11-25)
Source parent: e5e0ab60323fa3e194bdd36c73c059b249bb244f. This is not authorization to dispatch.

The workflow remains disabled and the canonical manifest remains blocked. The activation gate checks real checkout metadata, exact two-file approval-child diff, one parent, expected ref, first attempt, clean worktree, bounded approval window, and existing manifest/environment gate. Pure synthetic tests exercise structure only; they do not prove audit, billing, or actual one-dispatch uniqueness. A fresh dispatch can also have attempt 1; the final activation child must include a separately reviewed one-dispatch eligibility check equivalent to the G4 mechanism. Do not activate without it.

## Timing
G4 Run #20 (45555439867) completed in 328 seconds total per the prior auditor report. Retrieved job metadata shows steps completed but no per-step timestamps; no measured G5 startup bound exists. Execute 480 s, cleanup/verify reserve 120 s, total 600 s, job ceiling 12 min. Existing H2 gate requires 301 s + 60 s = 361 s at H2 entry; startup/H1 including added probes must fit 119 s. Concurrent script nominal writer sleeps total 4 s, reader sleeps 1.5 s concurrently, but SQL, CLI and scheduling overhead remain unmeasured. Added probe uses existing 15 s per CLI timeout, not a guaranteed end-to-end wall-clock limit. No claim that 119 s is sufficient. Review whether the expiry probe should be moved before refresh/seed and whether the additional tests fit; preserve all cleanup reserves and fail closed.

## Activation prerequisites
Independent audit of source; exact approved child (workflow and manifest only); zero-cost account confirmation; one-dispatch eligibility; owner approval of exact final SHA; no production connection. PT401 real response remains unverified. No approval values have been changed.
