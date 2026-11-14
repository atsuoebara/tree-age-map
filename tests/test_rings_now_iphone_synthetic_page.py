"""Synthetic-only iPhone FIT test page: verify exact fixture + hard privacy boundaries."""
import base64
from datetime import datetime, timezone
import hashlib
import importlib.util
from pathlib import Path
import re
import unittest
ROOT=Path(__file__).resolve().parent.parent
PAGE=ROOT/"previews/rings-now-iphone-synthetic-only-20261114.html"
GENERATOR=ROOT/"scripts/make-synthetic-race-fit-portable.py"
class SyntheticIphoneTest(unittest.TestCase):
 def test_fixture_matches_existing_generator_byte_for_byte(self):
  spec=importlib.util.spec_from_file_location("synthetic_fit_source",GENERATOR)
  module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
  page=PAGE.read_text(encoding="utf-8")
  encoded=re.search(r"const SYNTHETIC_B64='([^']+)'",page)
  expected=re.search(r"const EXPECTED_SHA256='([0-9a-f]{64})'",page)
  self.assertIsNotNone(encoded);self.assertIsNotNone(expected)
  generated=module.make_synthetic_fit()
  self.assertEqual(len(generated),294)
  self.assertEqual(base64.b64decode(encoded.group(1),validate=True),generated)
  self.assertEqual(hashlib.sha256(generated).hexdigest(),expected.group(1))
 def test_only_approved_synthetic_bytes_enter_decoder(self):
  page=PAGE.read_text(encoding="utf-8")
  self.assertIn("file.name!=='rings-now-synthetic-5km.fit'||file.size!==294",page)
  self.assertIn("const digest=hex(await crypto.subtle.digest('SHA-256',buffer));",page)
  self.assertIn("if(digest!==EXPECTED_SHA256)",page)
  self.assertIn("const result=reviewSingleUserFitBuffer(buffer",page)
  self.assertLess(page.index("if(digest!==EXPECTED_SHA256)"),page.index("const result=reviewSingleUserFitBuffer(buffer"))
  self.assertIn("result.analysisAllowed!==false||result.writeAllowed!==false",page)
  self.assertIn("candidate_unverified",page)
  self.assertIn("file.arrayBuffer()",page)
  self.assertIn("version!==choice",page)
 def test_no_private_data_egress_or_prod_access(self):
  page=PAGE.read_text(encoding="utf-8")
  for disallowed in (r"\bfetch\s*\(",r"XMLHttpRequest",r"WebSocket",r"localStorage",r"sessionStorage",
                     r"indexedDB",r"sendBeacon",r"navigator\.share",r"\bFormData\s*\(",r"supabase",
                     r"garmin\.com",r"strava\.com",r"\.fit'\s*,\s*'real"):
   self.assertIsNone(re.search(disallowed,page,re.I),disallowed)
  self.assertIn("connect-src 'none'",page)
  self.assertIn('name="robots" content="noindex,nofollow,noarchive"',page)
  self.assertIn("信号待ちやトイレ休憩、自動ポーズなどの影響により、正しく分析できない場合があります。",page)
  self.assertIn("Rings Now",page)
  self.assertIn("NOW × KNOW",page)
if __name__=="__main__": unittest.main()
