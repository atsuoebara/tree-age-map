#!/usr/bin/env python3
"""Require a strictly newer APP_BUILD when a PR changes index.html."""
import re
import subprocess
import sys

PATTERN = re.compile(r"\\bconst\\s+APP_BUILD\\s*=\\s*['\"](\\d{4}\\.\\d{2}\\.\\d{2}\\.\\d+)['\"]")


def git(*args):
    return subprocess.check_output(["git", *args], text=True).strip()


def parse_build(commit):
    html = git("show", f"{commit}:index.html")
    matches = PATTERN.findall(html)
    if len(matches) != 1:
        raise ValueError(f"{commit}: expected exactly one APP_BUILD constant, found {len(matches)}")
    result = tuple(int(part) for part in matches[0].split("."))
    year, month, day, sequence = result
    from datetime import date
    date(year, month, day)  # Reject malformed calendar dates.
    if sequence < 1:
        raise ValueError("Build sequence must start at 1")
    return result, matches[0]


def main(base, head):
    changed = git("diff", "--name-only", base, head).splitlines()
    if "index.html" not in changed:
        print("PASS: index.html unchanged; no APP_BUILD increment required.")
        return 0
    old, old_str = parse_build(base)
    new, new_str = parse_build(head)
    if new <= old:
        print(f"FAIL: index.html changed, but APP_BUILD was not advanced: {old_str} -> {new_str}", file=sys.stderr)
        return 1
    print(f"PASS: APP_BUILD advanced: {old_str} -> {new_str}")
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("Usage: check-build-version.py BASE_SHA HEAD_SHA")
    try:
        sys.exit(main(sys.argv[1], sys.argv[2]))
    except (subprocess.CalledProcessError, ValueError) as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        sys.exit(1)
