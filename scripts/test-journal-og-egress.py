#!/usr/bin/env python3
"""Offline regression tests for Journal social-image optimization."""
import importlib.util
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from PIL import Image

SCRIPT = Path(__file__).with_name("optimize-journal-images.py")
spec = importlib.util.spec_from_file_location("journal_optimizer", SCRIPT)
optimizer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(optimizer)
SLUG = "journal-20261110-test"
ORIGINAL = ("https://fhwvntpzwyenendhcgbw.supabase.co"
            "/storage/v1/object/public/journal-images/posts/1/example.png")
SOCIAL = f"https://runnersrings.com/journal/media/{SLUG}-hero.jpg"


def fixture_html():
    return f"""<!doctype html><html><head>
<meta property="og:image" content="{ORIGINAL}">
<meta name="twitter:image" content="{ORIGINAL}">
<script type="application/ld+json">{{"image":"{ORIGINAL}"}}</script>
</head><body><img class="hero" src="{ORIGINAL}" alt="" loading="lazy"></body></html>"""


class TestJournalSocialImages(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        root = Path(self.tmp.name) / "journal"
        self.articles = root / "articles"
        self.media = root / "media"
        self.media.mkdir(parents=True)
        page = self.articles / SLUG / "index.html"
        page.parent.mkdir(parents=True)
        page.write_text(fixture_html(), encoding="utf-8")
        self.page = page
        self.patches = [
            patch.object(optimizer, "ROOT", root),
            patch.object(optimizer, "ARTICLES", self.articles),
            patch.object(optimizer, "MEDIA", self.media),
            patch.object(optimizer, "MANIFEST", self.media / "manifest.json"),
        ]
        for p in self.patches:
            p.start()
            self.addCleanup(p.stop)
        image = Image.new("RGB", (1280, 720), (100, 140, 180))
        out = io.BytesIO()
        image.save(out, "PNG")
        self.png = out.getvalue()

    def test_social_card_uses_pages_while_original_is_preserved(self):
        with patch.object(optimizer, "read_url", return_value=self.png) as download:
            optimizer.main()
            download.assert_called_once_with(ORIGINAL)
        page = self.page.read_text(encoding="utf-8")
        self.assertIn(f'<meta property="og:image" content="{SOCIAL}">', page)
        self.assertIn(f'<meta name="twitter:image" content="{SOCIAL}">', page)
        self.assertIn('"image":"' + SOCIAL + '"', page)
        self.assertIn(f'src="/journal/media/{SLUG}-hero.webp"', page)
        self.assertTrue((self.media / f"{SLUG}-hero.webp").exists())
        self.assertTrue((self.media / f"{SLUG}.webp").exists())
        with Image.open(self.media / f"{SLUG}-hero.jpg") as social:
            self.assertEqual(social.format, "JPEG")
            self.assertEqual(social.size, (1200, 675))
        with Image.open(self.media / f"{SLUG}-hero.webp") as hero:
            self.assertEqual(hero.format, "WEBP")
        manifest = json.loads((self.media / "manifest.json").read_text())
        self.assertEqual(manifest[SLUG], {"url": ORIGINAL, "status": "ready"})

        # A second invocation without regenerating pages must remain stable.
        with patch.object(optimizer, "read_url") as download:
            optimizer.main()
            download.assert_not_called()
        self.assertEqual(self.page.read_text(encoding="utf-8"), page)
        self.assertEqual(json.loads((self.media / "manifest.json").read_text()), manifest)

    def test_missing_jpeg_rebuilds_once_then_stays_stable(self):
        with patch.object(optimizer, "read_url", return_value=self.png):
            optimizer.main()
        (self.media / f"{SLUG}-hero.jpg").unlink()
        with patch.object(optimizer, "read_url", return_value=self.png) as download:
            optimizer.main()
            download.assert_called_once_with(ORIGINAL)
        with patch.object(optimizer, "read_url") as download:
            optimizer.main()
            download.assert_not_called()
        self.assertTrue((self.media / f"{SLUG}-hero.jpg").exists())

    def test_legacy_webp_social_url_is_upgraded_to_jpeg(self):
        with patch.object(optimizer, "read_url", return_value=self.png):
            optimizer.main()
        old = f"https://runnersrings.com/journal/media/{SLUG}-hero.webp"
        page = self.page.read_text(encoding="utf-8").replace(SOCIAL, old)
        self.page.write_text(page, encoding="utf-8")
        with patch.object(optimizer, "read_url") as download:
            optimizer.main()
            download.assert_not_called()
        self.assertIn(f'<meta property="og:image" content="{SOCIAL}">', self.page.read_text())

    def test_transparent_image_converts_to_compatible_jpeg(self):
        rgba = Image.new("RGBA", (1600, 1000), (0, 0, 0, 0))
        out = io.BytesIO()
        rgba.save(out, "PNG")
        encoded = optimizer.encode_jpeg(out.getvalue(), 1200)
        with Image.open(io.BytesIO(encoded)) as social:
            self.assertEqual(social.format, "JPEG")
            self.assertEqual(social.size, (1200, 750))
            self.assertEqual(social.getpixel((0, 0)), (255, 255, 255))

    def test_download_failure_leaves_original_preview(self):
        with patch.object(optimizer, "read_url", side_effect=OSError("offline")):
            optimizer.main()
        page = self.page.read_text(encoding="utf-8")
        self.assertEqual(page, fixture_html())
        manifest = json.loads((self.media / "manifest.json").read_text())
        self.assertEqual(manifest[SLUG]["status"], "failed")
        self.assertFalse((self.media / f"{SLUG}-hero.webp").exists())
        self.assertFalse((self.media / f"{SLUG}-hero.jpg").exists())


if __name__ == "__main__":
    unittest.main()
