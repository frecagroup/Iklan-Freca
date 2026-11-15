"""Generate PWA icons (background merah) dari logo F Freca.

Pakai: python3 scripts/make_icons.py  (butuh Pillow)
Sumber: public/icon-1024.png sudah versi merah. Untuk membuat ulang dari logo biru
Absensi, taruh file Icon-logo.png (1024x1024, F putih di atas biru) di scripts/.
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
RED = (220, 38, 38)  # #DC2626 = theme_color


def recolor_blue_to_red(im: Image.Image) -> Image.Image:
    """F putih tetap putih; latar biru diganti merah (anti-alias dijaga)."""
    im = im.convert("RGB")
    px = im.load()
    out = Image.new("RGB", im.size)
    op = out.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, _, _ = px[x, y]
            a = max(0.0, min(1.0, (r - 32) / (255 - 32)))
            op[x, y] = tuple(round(RED[i] * (1 - a) + 255 * a) for i in range(3))
    return out


def main() -> None:
    blue_src = ROOT / "scripts" / "Icon-logo.png"
    if blue_src.exists():
        red = recolor_blue_to_red(Image.open(blue_src))
        red.save(PUBLIC / "icon-1024.png")
    else:
        red = Image.open(PUBLIC / "icon-1024.png").convert("RGB")

    for size, name in [
        (192, "icon-192.png"),
        (512, "icon-512.png"),
        (180, "apple-touch-icon.png"),
        (48, "favicon-48.png"),
        (32, "favicon-32.png"),
    ]:
        red.resize((size, size), Image.LANCZOS).save(PUBLIC / name)

    # Maskable: logo diperkecil 72% supaya F tetap di dalam safe-zone lingkaran
    canvas = Image.new("RGB", (1024, 1024), RED)
    inner = red.resize((738, 738), Image.LANCZOS)
    canvas.paste(inner, ((1024 - 738) // 2, (1024 - 738) // 2))
    canvas.resize((512, 512), Image.LANCZOS).save(PUBLIC / "icon-maskable-512.png")
    canvas.resize((192, 192), Image.LANCZOS).save(PUBLIC / "icon-maskable-192.png")

    red.convert("RGBA").resize((48, 48), Image.LANCZOS).save(ROOT / "app" / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    print("Ikon selesai dibuat.")


if __name__ == "__main__":
    main()
