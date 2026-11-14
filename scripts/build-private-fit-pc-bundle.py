#!/usr/bin/env python3
"""Build minimal LOCAL-PC-ONLY FIT trial ZIP from exact audited dependency graph.
No real FIT, user data, credentials, Git metadata, Supabase code, or network calls.
"""
import importlib.util
import io
from pathlib import Path, PurePosixPath
import posixpath
import re
import sys
import zipfile

ROOT=Path(__file__).resolve().parent.parent
PREVIEW="previews/ima-wo-shirou-fit-local-file-draft-20261113.html"
BASE={
 PREVIEW,
 "scripts/open-local-fit-preview-windows.cmd",
 "scripts/serve-private-fit-preview.py",
}
IMPORT=re.compile(r"""(?:from\s*|import\s*\(?\s*)["'](\.{1,2}/[^"']+)["']""")

def load_approved(path):
    spec=importlib.util.spec_from_file_location("fit_preview_server",ROOT/"scripts/serve-private-fit-preview.py")
    mod=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.permitted("/"+path) is not None

def collect():
    approved=set(BASE)
    queue=[PREVIEW]
    while queue:
        current=queue.pop()
        body=(ROOT/current).read_text(encoding="utf-8")
        for relative in IMPORT.findall(body):
            target=posixpath.normpath(posixpath.join(posixpath.dirname(current),relative))
            if target.startswith("../") or target.startswith("/") or not target.endswith((".mjs",".js")):
                raise ValueError("Unsafe import path in "+current)
            if not load_approved(target):
                raise ValueError("Unapproved module dependency "+target)
            if target not in approved:
                approved.add(target)
                queue.append(target)
    if len(approved)<15:
        raise ValueError("Missing expected FIT SDK modules")
    return sorted(approved)

def build_zip():
    items=collect()
    spec=importlib.util.spec_from_file_location("fit_generator",ROOT/"scripts/make-synthetic-race-fit-portable.py")
    maker=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(maker)
    fixture=maker.make_synthetic_fit()
    if len(fixture)!=294:
        raise AssertionError("Expected deterministic synthetic 5km FIT")
    readme="""Runner's Rings | local PC FIT test (development-only)

1. Extract this entire ZIP into a folder on your Windows PC.
2. Double-click scripts\\open-local-fit-preview-windows.cmd
3. A Python 3 installation is needed. The launcher does NOT install software.
4. First, choose synthetic-5km-27min.fit from this folder. Do not start with a real FIT.
5. Check both boxes and click the on-device review button.
6. Expected: 5.00km, 27:00; 1km splits 5:15 / 5:18 / 5:20 / 5:24 / 5:43.
7. Press Ctrl+C in the command window to stop the temporary server.

Only 127.0.0.1 (this PC) is used; no LAN or public server.
This is an unreleased prototype. Do NOT use your real FIT yet.
Keep all files together. Do not run scripts directly from inside the ZIP.
"""
    buf=io.BytesIO()
    # Freeze entry metadata: reproducible package SHA regardless of clock/mtime.
    def add_stable(archive,name,data):
        info=zipfile.ZipInfo(name,date_time=(2020,1,1,0,0,0))
        info.compress_type=zipfile.ZIP_DEFLATED
        info.external_attr=0o600 << 16
        archive.writestr(info,data,compress_type=zipfile.ZIP_DEFLATED,compresslevel=9)
    with zipfile.ZipFile(buf,"w",zipfile.ZIP_DEFLATED,compresslevel=9) as archive:
        for item in items:
            src=ROOT/item
            if not src.is_file() or src.is_symlink() or not src.resolve().is_relative_to(ROOT):
                raise ValueError("Unapproved or missing source: "+item)
            add_stable(archive,item,src.read_bytes())
        add_stable(archive,"synthetic-5km-27min.fit",fixture)
        add_stable(archive,"README-FIRST.txt",readme)
    return buf.getvalue(),items

if __name__=="__main__":
    if len(sys.argv)!=2 or not sys.argv[1].lower().endswith(".zip"):
        raise SystemExit("Usage: python scripts/build-private-fit-pc-bundle.py <output.zip>")
    output=Path(sys.argv[1])
    binary,items=build_zip()
    with output.open("xb") as stream:
        stream.write(binary)
    print(f"Created {output}: {len(items)} approved source files, one synthetic FIT; {len(binary)} bytes")
