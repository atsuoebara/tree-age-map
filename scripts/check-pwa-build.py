#!/usr/bin/env python3
"""Keep service-worker static-cache generation aligned with the visible build."""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
INDEX = (ROOT / "index.html").read_text(encoding="utf-8")
SW = (ROOT / "sw.js").read_text(encoding="utf-8")


def exactly_one(text, pattern, label):
    found = re.findall(pattern, text)
    if len(found) != 1:
        raise ValueError(f"Expected exactly one {label}, got {len(found)}")
    return found[0]


try:
    app = exactly_one(INDEX, r"const APP_BUILD = '([0-9.]+)'", "APP_BUILD")
    sw = exactly_one(SW, r"const RR_BUILD = '([0-9.]+)'", "RR_BUILD")
    if app != sw:
        raise ValueError(f"APP_BUILD {app} does not match SW cache build {sw}")
    print(f"PASS: APP_BUILD and RR_BUILD both {app}")
except ValueError as error:
    print(f"FAIL: {error}", file=sys.stderr)
    sys.exit(1)
