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
import http.client
import time
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
TWITTER = re.compile(r'<meta name="twitter:image" content="([^"]+)">')

def public_image_url(value: str) -> str | None:
    value = html.unescape(value)
    parsed = urlsplit(value)
    if (parsed.scheme != "https" or parsed.hostname != HOST
            or parsed.port is not None or not parsed.path.startswith(PREFIX)
            or parsed.username or parsed.password or parsed.query or parsed.fragment):
        return None
    return value

def read_url(url: str) -> bytes:
    """Read until EOF, check byte count, and retry transient partial responses."""
    last_error = None
    for attempt in range(2):
        try:
            req = urllib.request.Request(
                url, headers={"User-Agent": "RunnersRingsJournalOptimizer/1.0"}
            )
            with urllib.request.urlopen(req, timeout=25) as response:
                if public_image_url(response.geturl()) is None:
                    raise ValueError("Unexpected redirect URL")
                declared = response.headers.get("Content-Length")
                expected = int(declared) if declared is not None else None
                if expected is not None and expected > MAX_SOURCE:
                    raise ValueError("Image too large")
                chunks = []
                received = 0
                while True:
                    chunk = response.read(min(64 * 1024, MAX_SOURCE + 1 - received))
                    if not chunk:
                        break
                    chunks.append(chunk)
                    received += len(chunk)
                    if received > MAX_SOURCE:
                        raise ValueError("Image too large")
                if expected is not None and received != expected:
                    raise http.client.IncompleteRead(b"", expected - received)
                return b"".join(chunks)
        except (OSError, http.client.IncompleteRead) as exc:
            last_error = exc
            if attempt == 0:
                time.sleep(1)
    raise OSError(f"Incomplete image download after two attempts: {last_error}")

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

def encode_jpeg(original: bytes, max_width: int) -> bytes:
    """SNS-compatible JPEG; flatten transparent illustrations onto white."""
    with Image.open(io.BytesIO(original)) as img:
        if img.width * img.height > MAX_PIXELS:
            raise ValueError("Too many pixels")
        img = ImageOps.exif_transpose(img)
        if img.width > max_width:
            height = max(1, round(img.height * max_width / img.width))
            img = img.resize((max_width, height), Image.Resampling.LANCZOS)
        rgba = img.convert("RGBA")
        canvas = Image.new("RGB", rgba.size, (255, 255, 255))
        canvas.paste(rgba, mask=rgba.getchannel("A"))
        out = io.BytesIO()
        canvas.save(out, format="JPEG", quality=82, optimize=True)
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
        entry = previous.get(slug)
        # The generator normally restores the original image URL each run.
        # When rerun directly on optimized HTML, recover it from our manifest.
        og_value = html.unescape(match.group(1))
        optimized_url = f"https://runnersrings.com/journal/media/{slug}-hero.jpg"
        legacy_url = f"https://runnersrings.com/journal/media/{slug}-hero.webp"
        url = public_image_url(og_value)
        if url is None and og_value in (optimized_url, legacy_url) and isinstance(entry, dict):
            url = public_image_url(entry.get("url", ""))
        if url is None:
            # Never process unexpected external/social image URLs.
            continue
        thumb = MEDIA / (slug + ".webp")
        hero = MEDIA / (slug + "-hero.webp")
        social = MEDIA / (slug + "-hero.jpg")
        old_url = entry.get("url") if isinstance(entry, dict) else entry
        old_failed = isinstance(entry, dict) and entry.get("status") == "failed"
        if old_url == url and old_failed:
            # A failed source is not fetched again every 15 minutes.
            # It is retried only after the source URL changes.
            current[slug] = {"url": url, "status": "failed"}
            failed += 1
            print(f"WARNING: {slug} skipped: previously failed source unchanged")
            continue
        if old_url != url or not thumb.exists() or not hero.exists() or not social.exists():
            if old_url != url:
                thumb.unlink(missing_ok=True)
                hero.unlink(missing_ok=True)
                social.unlink(missing_ok=True)
            try:
                original = read_url(url)
                thumb_data = encode_webp(original, 600)
                hero_data = encode_webp(original, 1200)
                social_data = encode_jpeg(original, 1200)
                thumb.write_bytes(thumb_data)
                hero.write_bytes(hero_data)
                social.write_bytes(social_data)
                print(f"Optimized {slug}: {len(original)} -> {len(thumb_data)} + {len(hero_data)} + {len(social_data)} bytes")
            except (OSError, ValueError, UnidentifiedImageError, Image.DecompressionBombError) as exc:
                thumb.unlink(missing_ok=True)
                hero.unlink(missing_ok=True)
                social.unlink(missing_ok=True)
                current[slug] = {"url": url, "status": "failed"}
                failed += 1
                print(f"WARNING: {slug} retains original image: {type(exc).__name__}: {exc}")
                continue
        current[slug] = {"url": url, "status": "ready"}
        # Serve lightweight assets for the article body AND social previews.
        # The original source URL remains in manifest.json for future refreshes.
        replacement = f'/journal/media/{slug}-hero.webp'
        social_url = f'https://runnersrings.com/journal/media/{slug}-hero.jpg'
        new_source = HERO.sub(lambda m: m.group(1) + replacement + m.group(3), source)
        new_source = OG.sub(lambda m: f'<meta property="og:image" content="{social_url}">' if html.unescape(m.group(1)) in (url, social_url, legacy_url) else m.group(0), new_source)
        new_source = TWITTER.sub(lambda m: f'<meta name="twitter:image" content="{social_url}">' if html.unescape(m.group(1)) in (url, social_url, legacy_url) else m.group(0), new_source)
        # Keep BlogPosting structured data consistent with the visible hero / social card.
        for current_url in (url, legacy_url):
            new_source = new_source.replace('"image":' + json.dumps(current_url), '"image":' + json.dumps(social_url))
        if new_source != source:
            page.write_text(new_source, encoding="utf-8")
        completed += 1
    MANIFEST.write_text(json.dumps(current, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"Optimized images ready: {completed}; fallback to originals: {failed}")

if __name__ == "__main__":
    main()
