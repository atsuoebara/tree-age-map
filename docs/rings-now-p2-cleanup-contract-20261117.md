# Rings Now P2 — cleanup contract only (NOT RUN)

2026-11-17. The module `tests/rings-now-p2-cleanup-contract.cjs` is an isolated, dependency-injected control contract for future P2 runners. It calls only the three callbacks explicitly supplied by its caller; no Auth/HTTP/DB, subprocesses, Actions, filesystem writes, secrets, credentials or network are used on import.

Callbacks:
- `execute()` returns status PASS, FAIL or NOT_PROVEN.
- `cleanup()` returns `{status:'CLEAN'}` after attempting cleanup.
- `verifyCleanup()` returns `{verified:true}` only after independently observing final resource cleanup.

It never returns PASS unless execution is PASS, cleanup returned CLEAN, and independent verification is true. Execute failure still attempts cleanup and verification; cleanup exception forces FAIL; ambiguous result or unverifiable cleanup cannot be PASS.

**Limits:** A malicious or incorrectly implemented callback could assert fictitious cleanup success. This helper cannot prove callback provenance, network isolation, database deletion, or resource absence. Strong process kill / runner cancellation can prevent `finally` from running; a separate runner-level cleanup/isolation guarantee and external audit remain required. No real timeout, image pull, Docker cleanup or disposal was performed. This code cannot be wired into a P2 runner without separate G1–G5 checks, audit and Atsuo's explicit approval.

PR #179 (G3 design) is separately pending audit; its HEAD is unchanged. Existing workflow `if: ${{ false }}`, manifest `BLOCKED_NOT_RUN`, production OFF, started_at null and PR #109 HOLD remain unchanged.
