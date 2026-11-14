#!/usr/bin/env python3
"""Fail closed when the isolated FIT PR contains any unrelated production change.
This is a CI change-scope guard, not a substitute for independent review.
"""
from pathlib import Path
import subprocess
import sys

ROOT=Path(__file__).resolve().parent.parent
ALLOWED={
 ".github/workflows/fit-local-review-isolated.yml",
 "previews/ima-wo-shirou-fit-local-file-draft-20261113.html",
 "src/race-user-fit-only-gate.mjs",
 "src/race-fit-only-split-probe.mjs",
 "src/race-fit-sdk-isolated-adapter.mjs",
 "src/race-fit-session-total-review.mjs",
 "src/race-fit-clock-anomaly-review.mjs",
 "src/race-fit-timer-event-review.mjs",
 "src/race-fit-local-file-review.mjs",
 "scripts/make-synthetic-race-fit-portable.py",
 "scripts/make-synthetic-race-fit.mjs",
 "scripts/serve-private-fit-preview.py",
 "scripts/open-local-fit-preview-windows.cmd",
 "scripts/build-private-fit-pc-bundle.py",
 "scripts/check-fit-local-pr-scope.py",
 "tests/race-user-fit-only-gate.test.mjs",
 "tests/race-fit-only-split-probe.test.mjs",
 "tests/race-fit-sdk-isolated-adapter.test.mjs",
 "tests/race-fit-session-total-review.test.mjs",
 "tests/race-fit-clock-anomaly-review.test.mjs",
 "tests/race-fit-timer-event-review.test.mjs",
 "tests/race-fit-local-file-review.test.mjs",
 "tests/race-fit-local-ui-controller.test.mjs",
 "tests/race-fit-private-rehearsal-fixture.test.mjs",
 "tests/race-fit-portable-python-fixture.test.mjs",
 "tests/race-fit-pc-chromium-smoke.test.mjs",
 "tests/race-fit-synthetic-marathon.test.mjs",
 "tests/test_private_fit_preview_server.py",
 "tests/test_fit_windows_local_launcher.py",
 "tests/test_private_fit_pc_bundle.py",
 "tests/test_fit_local_pr_scope.py",
 # FIT public-preview retirement regression paths (security PR only).
 "tests/rings-now-iphone-file-readiness.test.cjs",
 "tests/rings-now-private-fit-delivery-gate.test.cjs",
 "tests/rings-now-private-fit-input-gate.test.mjs",
 "tests/rings-now-private-fit-ui-controller.test.mjs",
 "docs/rings-now-legacy-preview-retirement-20261114.md",
 ".github/workflows/rings-now-legacy-preview-retirement.yml",

}
def classify(files):
    return sorted(set(files)-ALLOWED)

def changed_names(base,head):
    data=subprocess.check_output(
        ["git","diff","--name-only","--diff-filter=ACDMRTUXB","-z",base,head],
        cwd=ROOT,
    )
    return [part.decode("utf-8") for part in data.split(b"\0") if part]

if __name__=="__main__":
    if len(sys.argv)!=3:
        raise SystemExit("Usage: check-fit-local-pr-scope.py BASE_SHA HEAD_SHA")
    errors=classify(changed_names(sys.argv[1],sys.argv[2]))
    if errors:
        print("BLOCKED: unrelated paths in isolated FIT branch:",file=sys.stderr)
        for name in errors: print("  "+name,file=sys.stderr)
        sys.exit(1)
    print("PASS: FIT PR changed-file scope matches explicit allowlist")
