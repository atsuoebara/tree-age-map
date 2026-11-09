#!/usr/bin/env python3
"""Generate lightweight public Journal images without changing originals.

Run after scripts/generate-journal.mjs.  Optimized assets are committed to
GitHub Pages; Supabase Storage keeps the original uploaded photographs.
Network downloads are restricted to this project's public journal-images.
"""
from __future__ import annotations
import html
import io
import json
import re
import urllib.request
from pathlib import Path
from urllib.parse import urlsplit
from PIL import Image, ImageOps, UnidentifiedImageError

ROOT = Path("journal")
ARTICLES = ROOT / "articles"
MEDIA = ROOT / "media"
MANIFEST = MEDIA / "manifest.json"
HOST = "fhwvntpzwyenendhcgbw.supabase.co"
PREFIX = "/storage/v1/object/public/journal-images/"
MAX_SOURCE = 6 * 1024 * 1024
MAX_PIXELS = 25_000_000
Image.MAX_IMAGE_PIXELS = MAX_PIXELS
HERO = re.compile(r'(<img class="hero" src=")([^"]+)(" alt="" loading="lazy">)')
OG = re.compile(r'<meta property="og:image" content="([^"]+)">')

def public_image_url(value: str) -> str | None:
    value = html.unescape(value)
    parsed = urlsplit(value)
    if (parsed.scheme != "https" or parsed.hostname != HOST
            or parsed.port is not None or not parsed.path.startswith(PREFIX)
            or parsed.username or parsed.password or parsed.query or parsed.fragment):
        return None
    return value

def read_url(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "RunnersRingsJournalOptimizer/1.0"})
    with urllib.request.urlopen(req, timeout=25) as response:
        if public_image_url(response.geturl()) is None:
            raise ValueError("Unexpected redirect URL")
        content = response.read(MAX_SOURCE + 1)
    if len(content) > MAX_SOURCE:
        raise ValueError("Image too large")
    return content

def encode_webp(original: bytes, max_width: int) -> bytes:
    with Image.open(io.BytesIO(original)) as img:
        if img.width * img.height > MAX_PIXELS:
            raise ValueError("Too many pixels")
        img = ImageOps.exif_transpose(img)
        if img.width > max_width:
            height = max(1, round(img.height * max_width / img.width))
            img = img.resize((max_width, height), Image.Resampling.LANCZOS)
        # Do not discard alpha transparency from illustrations.
        img = img.convert("RGBA" if "A" in img.getbands() or "transparency" in img.info else "RGB")
        out = io.BytesIO()
        img.save(out, format="WEBP", quality=77, method=5)
        return out.getvalue()

def main() -> None:
    MEDIA.mkdir(parents=True, exist_ok=True)
    try:
        previous = json.loads(MANIFEST.read_text(encoding="utf-8"))
        if not isinstance(previous, dict):
            previous = {}
    except (OSError, ValueError):
        previous = {}
    current = {}
    completed = failed = 0
    for page in sorted(ARTICLES.glob("*/index.html")):
        slug = page.parent.name
        if not re.fullmatch(r"[a-zA-Z0-9_-]+", slug):
            raise ValueError("Unexpected Journal slug")
        source = page.read_text(encoding="utf-8")
        match = OG.search(source)
        if not match:
            continue
        url = public_image_url(match.group(1))
        if url is None:
            # The generator itself already validates URLs; be defensive here too.
            continue
        thumb = MEDIA / (slug + ".webp")
        hero = MEDIA / (slug + "-hero.webp")
        if previous.get(slug) != url or not thumb.exists() or not hero.exists():
            # Never reuse stale images if an editor changes a post image.
            if previous.get(slug) != url:
                thumb.unlink(missing_ok=True)
                hero.unlink(missing_ok=True)
            try:
                original = read_url(url)
                thumb_data = encode_webp(original, 600)
                hero_data = encode_webp(original, 1200)
                thumb.write_bytes(thumb_data)
                hero.write_bytes(hero_data)
                print(f"Optimized {slug}: {len(original)} -> {len(thumb_data)} + {len(hero_data)} bytes")
            except (OSError, ValueError, UnidentifiedImageError) as exc:
                failed += 1
                print(f"WARNING: {slug} retains original image: {exc}")
                continue
        current[slug] = url
        # Keep original og:image and schema.org URL for social metadata and provenance.
        replacement = f'/journal/media/{slug}-hero.webp'
        new_source = HERO.sub(lambda m: m.group(1) + replacement + m.group(3), source)
        if new_source != source:
            page.write_text(new_source, encoding="utf-8")
        completed += 1
    MANIFEST.write_text(json.dumps(current, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"Optimized images ready: {completed}; fallback to originals: {failed}")

if __name__ == "__main__":
    main()
