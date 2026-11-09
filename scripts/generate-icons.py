"""Generate WMC 225 app icons and social preview (deterministic, no external assets)."""

from __future__ import annotations

import os
from PIL import Image, ImageDraw, ImageFont

PUBLIC = os.path.join(os.path.dirname(__file__), "..", "public")
ICON_DIR = os.path.join(PUBLIC, "icons")
os.makedirs(ICON_DIR, exist_ok=True)

PINE = "#17231D"
PINE_SOFT = "#24352B"
ORANGE = "#F05A28"
LIME = "#D8F28A"
CREAM = "#F4F1EA"
SCALE = 4


def rounded_line(draw: ImageDraw.ImageDraw, xy, fill, width):
    draw.line(xy, fill=fill, width=width, joint="curve")
    radius = width // 2
    for x, y in (xy[0], xy[-1]):
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=fill)


def draw_mark(img: Image.Image) -> None:
    draw = ImageDraw.Draw(img)
    w, h = img.size
    unit = min(w, h)

    # subtle dot grid in the top-right
    dot = max(2, unit // 120)
    for gx in range(int(unit * 0.62), int(unit * 0.92), int(unit * 0.055)):
        for gy in range(int(unit * 0.12), int(unit * 0.42), int(unit * 0.055)):
            draw.ellipse((gx, gy, gx + dot, gy + dot), fill="#33463A")

    # Stylized W
    stroke = int(unit * 0.082)
    w_points = [
        (int(unit * 0.16), int(unit * 0.26)),
        (int(unit * 0.29), int(unit * 0.55)),
        (int(unit * 0.41), int(unit * 0.37)),
        (int(unit * 0.53), int(unit * 0.55)),
        (int(unit * 0.66), int(unit * 0.26)),
    ]
    for index in range(len(w_points) - 1):
        rounded_line(draw, [w_points[index], w_points[index + 1]], ORANGE, stroke)

    # Lime speed line + "225"
    rounded_line(
        draw,
        [(int(unit * 0.17), int(unit * 0.67)), (int(unit * 0.50), int(unit * 0.67))],
        LIME,
        int(unit * 0.035),
    )
    label_font = load_font(int(unit * 0.205))
    draw.text((int(unit * 0.54), int(unit * 0.56)), "225", font=label_font, fill=LIME)


def make_icon(size: int, safe: bool = False) -> Image.Image:
    img = Image.new("RGB", (size * SCALE, size * SCALE), PINE)
    if safe:
        inner = Image.new("RGB", (int(size * SCALE * 0.72), int(size * SCALE * 0.72)), PINE)
        draw_mark(inner)
        canvas = Image.new("RGB", (size * SCALE, size * SCALE), PINE)
        offset = (int(size * SCALE * 0.14), int(size * SCALE * 0.14))
        canvas.paste(inner, offset)
        img = canvas
    else:
        draw_mark(img)
    return img.resize((size, size), Image.Resampling.LANCZOS)


def load_font(size: int, bold: bool = True) -> ImageFont.FreeTypeFont:
    candidates = [
        r"C:\Windows\Fonts\segoeuib.ttf" if bold else r"C:\Windows\Fonts\segoeui.ttf",
        r"C:\Windows\Fonts\arialbd.ttf" if bold else r"C:\Windows\Fonts\arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    ]
    for path in candidates:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def make_og() -> None:
    W, H = 1200, 630
    img = Image.new("RGB", (W, H), PINE)
    draw = ImageDraw.Draw(img)

    # dots
    for gx in range(60, 1150, 22):
        for gy in range(40, 590, 22):
            draw.ellipse((gx, gy, gx + 2, gy + 2), fill="#24352b")

    # orange ring art
    draw.ellipse((760, -180, 1320, 380), outline="#3b2a20", width=64)
    draw.ellipse((850, 310, 1170, 630), fill="#1d2b23")
    draw.ellipse((890, 350, 1130, 590), outline=ORANGE, width=3)

    # logo mark
    mark = make_icon(104)
    img.paste(mark, (72, 58))

    font_logo = load_font(30)
    draw.text((196, 87), "WMC 225.", font=font_logo, fill="#FFFFFF")

    font_big = load_font(80)
    font_big2 = load_font(64)
    draw.text((72, 218), "Bengkel rapi.", font=font_big, fill=CREAM)
    draw.text((72, 310), "Kas jelas.", font=font_big, fill=ORANGE)
    draw.text((72, 410), "Transaksi, piutang, dan laba dalam satu alur.", font=font_big2, fill="#8FA096")

    # fake dashboard cards
    cards = [
        (760, 360, 1040, 455, "Omset hari ini", "Rp2.450.000", ORANGE),
        (760, 472, 1040, 567, "Piutang berjalan", "Rp1.280.000", LIME),
    ]
    for x1, y1, x2, y2, label, value, accent in cards:
        draw.rounded_rectangle((x1, y1, x2, y2), radius=18, fill="#223227")
        draw.rectangle((x1, y1, x1 + 5, y2), fill=accent)
        draw.text((x1 + 24, y1 + 18), label, font=load_font(19, False), fill="#93A59B")
        draw.text((x1 + 24, y1 + 46), value, font=load_font(28), fill="#FFFFFF")

    draw.text((72, 560), "MANAJEMEN BENGKEL MOBILE-FIRST", font=load_font(17), fill="#6C8175")
    img.save(os.path.join(PUBLIC, "og.png"), optimize=True)


for icon_size, name in [(192, "icon-192.png"), (512, "icon-512.png")]:
    make_icon(icon_size).save(os.path.join(ICON_DIR, name), optimize=True)

make_icon(512, safe=True).save(os.path.join(ICON_DIR, "icon-maskable-512.png"), optimize=True)
make_icon(180).save(os.path.join(ICON_DIR, "apple-touch-icon.png"), optimize=True)
make_icon(64).save(
    os.path.join(PUBLIC, "favicon.ico"),
    format="ICO",
    sizes=[(16, 16), (32, 32), (48, 48)],
)
make_og()
print("Icons, favicon, dan og.png berhasil dibuat.")
