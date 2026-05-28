"""
Composite the per-school OG preview cards. Layout mirrors the canonical
public/og/portfolio.png generator: left column = avatar, "PORTFOLIO · 2026"
header, name, tagline, body, contact footer; right column = the school's
captured 3D court (scripts/og/.courts/{teamId}.png).

Run capture_courts.py first, then:  python3 scripts/og/make_og_cards.py
Output: public/og/teams/{slug}.png  (one per school in schools.json)
"""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
import json
import sys

ROOT = Path(__file__).resolve().parents[2]
PUB = ROOT / 'public'
COURTS = ROOT / 'scripts' / 'og' / '.courts'
OUT_DIR = PUB / 'og' / 'teams'
OUT_DIR.mkdir(parents=True, exist_ok=True)
SCHOOLS = json.loads((ROOT / 'scripts' / 'og' / 'schools.json').read_text())

SCALE = 2
W, H = 1200 * SCALE, 630 * SCALE
CREAM = '#fafaf6'
INK = '#18171a'
MUTED = '#7a7976'
RULE = '#d7d9df'

SERIF_BOLD = '/System/Library/Fonts/Supplemental/Georgia Bold.ttf'
SERIF_ITALIC = '/System/Library/Fonts/Supplemental/Georgia Italic.ttf'
SANS = '/System/Library/Fonts/HelveticaNeue.ttc'

TAGLINE = 'Basketball Analytics & Research'
BODY_TEXT = 'Looking to support a program through research, analytics, and software development.'


def font(path, size):
    return ImageFont.truetype(path, size)


def s(v):
    return v * SCALE


def trim_to_content(img, bg=(255, 255, 255), tolerance=4):
    px = img.convert('RGB').load()
    w, h = img.size
    def is_bg(c):
        return all(abs(c[i] - bg[i]) <= tolerance for i in range(3))
    top, bottom, left, right = 0, h, 0, w
    for y in range(h):
        if any(not is_bg(px[x, y]) for x in range(w)):
            top = y; break
    for y in range(h - 1, -1, -1):
        if any(not is_bg(px[x, y]) for x in range(w)):
            bottom = y + 1; break
    for x in range(w):
        if any(not is_bg(px[x, y]) for y in range(h)):
            left = x; break
    for x in range(w - 1, -1, -1):
        if any(not is_bg(px[x, y]) for y in range(h)):
            right = x + 1; break
    return img.crop((left, top, right, bottom))


def face_avatar(size):
    avatar_src = PUB / 'images' / 'ashton-avatar.jpg'
    src = Image.open(avatar_src).convert('RGBA')
    w, h = src.size
    side = min(w, h)
    src = src.crop(((w - side) // 2, (h - side) // 2,
                    (w + side) // 2, (h + side) // 2))
    src = src.resize((size, size), Image.LANCZOS)
    mask = Image.new('L', (size, size), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size, size), fill=255)
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    out.paste(src, (0, 0), mask)
    return out


def make_card(team_id: str, slug: str) -> bool:
    court_path = COURTS / f'{team_id}.png'
    if not court_path.exists():
        print(f'  [skip] {slug}: no court image at {court_path.name}')
        return False

    canvas = Image.new('RGBA', (W, H), CREAM)
    d = ImageDraw.Draw(canvas)

    # ---- right column: court -------------------------------------------
    court = trim_to_content(Image.open(court_path).convert('RGBA'))
    target_h = s(540)
    scale = target_h / court.height
    court = court.resize((int(court.width * scale), target_h), Image.LANCZOS)
    max_w = s(560)
    if court.width > max_w:
        cx = (court.width - max_w) // 2
        court = court.crop((cx, 0, cx + max_w, court.height))
    cx = W - s(20) - court.width
    canvas.alpha_composite(court, (cx, s(80)))
    court_left_unscaled = cx / SCALE

    # ---- left column: avatar + text ------------------------------------
    avatar_size = s(150)
    avatar = face_avatar(avatar_size)
    ring = Image.new('RGBA', (avatar_size + s(8), avatar_size + s(8)), (0, 0, 0, 0))
    ImageDraw.Draw(ring).ellipse((0, 0, ring.size[0], ring.size[1]), outline=RULE, width=s(2))
    ring.alpha_composite(avatar, (s(4), s(4)))
    canvas.alpha_composite(ring, (s(60), s(85)))

    header_f = font(SANS, s(15))
    header_text = 'PORTFOLIO · 2026'
    hb = d.textbbox((0, 0), header_text, font=header_f)
    d.text(((W - (hb[2] - hb[0])) // 2, s(25)), header_text, font=header_f, fill=MUTED, spacing=4)
    d.line([(s(60), s(60)), (W - s(60), s(60))], fill=RULE, width=s(1))

    title_text = 'Ashton Jantz'
    title_size = 84
    while title_size > 60:
        title_f = font(SERIF_BOLD, s(title_size))
        bbox = d.textbbox((s(60), s(240)), title_text, font=title_f)
        if bbox[2] <= s(court_left_unscaled - 20):
            break
        title_size -= 2
    d.text((s(60), s(240)), title_text, font=title_f, fill=INK)

    max_left_w = court_left_unscaled - 60 - 20

    sub_size = 30
    while sub_size > 18:
        sub_f = font(SERIF_ITALIC, s(sub_size))
        bbox = d.textbbox((0, 0), TAGLINE, font=sub_f)
        if (bbox[2] - bbox[0]) / SCALE <= max_left_w:
            break
        sub_size -= 1
    d.text((s(60), s(355)), TAGLINE, font=sub_f, fill=INK)

    body_f = font(SANS, s(18))
    lines, cur = [], ''
    for word in BODY_TEXT.split():
        test = (cur + ' ' + word).strip()
        bbox = d.textbbox((0, 0), test, font=body_f)
        if (bbox[2] - bbox[0]) / SCALE <= max_left_w:
            cur = test
        else:
            if cur:
                lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    y = s(420)
    for line in lines[:3]:
        d.text((s(60), y), line, font=body_f, fill='#3a3a37')
        y += s(26)

    footer_y = H - s(45)
    d.line([(s(60), footer_y - s(14)), (W - s(60), footer_y - s(14))], fill=RULE, width=s(1))
    footer_f = font(SANS, s(15))
    parts = ['ashtonbjantz@icloud.com', '(405) 696-9206', 'ashton-portfolio.onrender.com']
    d.text((s(60), footer_y), parts[0], font=footer_f, fill=INK)
    url_bbox = d.textbbox((0, 0), parts[2], font=footer_f)
    d.text((W - s(60) - (url_bbox[2] - url_bbox[0]), footer_y), parts[2], font=footer_f, fill=INK)
    phone_bbox = d.textbbox((0, 0), parts[1], font=footer_f)
    d.text(((W - (phone_bbox[2] - phone_bbox[0])) // 2, footer_y), parts[1], font=footer_f, fill=MUTED)

    out = OUT_DIR / f'{slug}.png'
    canvas.convert('RGB').save(out, 'PNG', optimize=True)
    print(f'  wrote {out.relative_to(PUB)} ({out.stat().st_size // 1024} KB)')
    return True


def main(only_slug: str | None = None) -> int:
    n = 0
    for sch in SCHOOLS:
        if only_slug and sch['slug'] != only_slug:
            continue
        if make_card(sch['teamId'], sch['slug']):
            n += 1
    print(f'\nGenerated {n} cards in {OUT_DIR}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main(sys.argv[1] if len(sys.argv) > 1 else None))
