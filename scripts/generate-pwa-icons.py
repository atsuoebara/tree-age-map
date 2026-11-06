#!/usr/bin/env python3
"""Generate PWA icons from the existing Runner's Rings icon.PNG.

Run: python -m pip install Pillow && python scripts/generate-pwa-icons.py
No network usage; the original icon is never changed.
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "icon.PNG"
OUT = ROOT / "assets" / "pwa"
BACKGROUND = (13, 24, 40, 255)


def render(size: int, name: str, padding: float = 0.0) -> None:
    with Image.open(SOURCE) as image:
        logo = image.convert("RGBA")
        side = round(size * (1 - 2 * padding))
        logo.thumbnail((side, side), Image.Resampling.LANCZOS)
        canvas = Image.new("RGBA", (size, size), BACKGROUND)
        canvas.alpha_composite(logo, ((size - logo.width) // 2, (size - logo.height) // 2))
        target = OUT / name
        canvas.convert("RGB").save(target, format="PNG", optimize=True)
        with Image.open(target) as check:
            assert check.size == (size, size)
            assert check.mode == "RGB"
        print(target.relative_to(ROOT))


if __name__ == "__main__":
    if not SOURCE.exists():
        raise SystemExit("icon.PNG not found")
    OUT.mkdir(parents=True, exist_ok=True)
    render(192, "icon-192.png")
    render(512, "icon-512.png")
    # Maskable content is kept within the central 60% safe region.
    render(512, "icon-maskable-512.png", padding=0.20)
    render(180, "apple-touch-icon.png")
