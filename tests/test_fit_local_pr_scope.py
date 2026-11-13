"""Synthetic tests for allowlist logic; no production code writes."""
import importlib.util
from pathlib import Path
import unittest
ROOT=Path(__file__).resolve().parent.parent
s=importlib.util.spec_from_file_location("scope",ROOT/"scripts/check-fit-local-pr-scope.py")
mod=importlib.util.module_from_spec(s);s.loader.exec_module(mod)
class ScopeTests(unittest.TestCase):
    def test_exact_scope(self):
        self.assertEqual(mod.classify(["src/race-fit-local-file-review.mjs","tests/test_fit_local_pr_scope.py"]),[])
    def test_block_production_and_renames(self):
        unsafe=["index.html","sw.js","supabase/functions/garmin-activity-push/index.ts","scripts/test-garmin-oauth.mjs","fit-sdk/src/index.js",".github/workflows/deploy.yml","src/race-fit-secret.mjs"]
        self.assertEqual(mod.classify(unsafe),sorted(unsafe))
    def test_no_unapproved_source_even_with_approved_files(self):
        self.assertEqual(mod.classify(["src/race-user-fit-only-gate.mjs","src/race-fit-local-file-review.mjs","src/garmin-oauth-handler.mjs"]),["src/garmin-oauth-handler.mjs"])
if __name__=="__main__":unittest.main()
