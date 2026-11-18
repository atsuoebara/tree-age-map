"""Verify the exact Windows test ZIP is self-contained, minimal and privacy-safe."""
import importlib.util
import io
from pathlib import Path
import sys
import tempfile
import unittest
import zipfile

ROOT=Path(__file__).resolve().parent.parent
spec=importlib.util.spec_from_file_location("fit_bundle",ROOT/"scripts/build-private-fit-pc-bundle.py")
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class BundleTest(unittest.TestCase):
    def test_approved_contents_only(self):
        binary,paths=mod.build_zip()
        self.assertGreater(len(paths),15)
        self.assertEqual(len(paths),len(set(paths)))
        with zipfile.ZipFile(io.BytesIO(binary)) as archive:
            names=set(archive.namelist())
            self.assertEqual(names,set(paths)|{"README-FIRST.txt","synthetic-5km-27min.fit"})
            self.assertEqual(len(archive.read("synthetic-5km-27min.fit")),294)
            self.assertIn(b"127.0.0.1",archive.read("scripts/open-local-fit-preview-windows.cmd"))
            self.assertIn(b"127.0.0.1",archive.read("README-FIRST.txt"))
            self.assertFalse(any(p.startswith(("supabase/","docs/",".git/",".github/")) for p in names))
            self.assertFalse(any("password" in p.lower() or "token" in p.lower() for p in names))
            self.assertFalse(any(p.endswith((".env",".json",".ts",".map")) for p in names))
            self.assertFalse(any(p.startswith("/") or ".." in Path(p).parts for p in names))
            self.assertFalse(any(p.endswith(".fit") and p!="synthetic-5km-27min.fit" for p in names))
            self.assertTrue(all(p.startswith(("previews/","src/","fit-sdk/src/","scripts/")) for p in paths))
            for info in archive.infolist():
                self.assertLess(info.file_size,5_000_000)
            with tempfile.TemporaryDirectory() as temp:
                archive.extractall(temp)
                p=Path(temp)
                self.assertTrue((p/"scripts/open-local-fit-preview-windows.cmd").is_file())
                self.assertTrue((p/"fit-sdk/src/index.js").is_file())
                self.assertTrue((p/"src/race-fit-local-file-review.mjs").is_file())
    def test_real_fit_use_is_conditional_and_original_never_bundled(self):
        binary,_=mod.build_zip()
        with zipfile.ZipFile(io.BytesIO(binary)) as archive:
            names=archive.namelist()
            self.assertEqual([n for n in names if n.lower().endswith(".fit")],["synthetic-5km-27min.fit"])
            readme=archive.read("README-FIRST.txt").decode("utf-8")
            launcher=archive.read("scripts/open-local-fit-preview-windows.cmd").decode("utf-8")
            self.assertIn("independent audit passes and the owner explicitly approves",readme)
            self.assertIn("Until then use only the synthetic sample",readme)
            self.assertIn("never a production diagnosis",readme)
            self.assertIn("2026-11-03",readme)
            self.assertIn("do not upload it to GitHub",readme)
            self.assertIn("Never bind to LAN",readme)
            self.assertIn("only after independent audit and owner approval",launcher)
            self.assertNotIn("--allow-insecure-lan",launcher)
            self.assertNotIn("Do NOT use your real FIT yet.",readme)

    def test_reproducible_bytes(self):
        a,_=mod.build_zip()
        b,_=mod.build_zip()
        self.assertEqual(a,b,"ZIP must be deterministic for repeatable audit")

if __name__=="__main__":
    unittest.main()
