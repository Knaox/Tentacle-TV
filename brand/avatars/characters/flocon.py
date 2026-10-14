"""Flocon — Regarde des films de Noël toute l'année. Même en août."""
import math
from kit import *  # noqa: F401,F403
from scene import Scene


# ---------------------------------------------------------------- Flocon
def furry(cx, cy, rx, ry, n, depth, a0=0, a1=360, tilt=0.35, closed=True):
    """Ellipse hérissée de touffes (pointes de poils, un peu couchées)."""
    pts = []
    step = (a1 - a0) / n
    for k in range(n + (0 if closed else 1)):
        a = math.radians(a0 + k * step)
        pts.append((cx + rx * math.cos(a), cy + ry * math.sin(a)))
        if closed or k < n:
            jitter = 1 + 0.35 * math.sin(k * 2.7)
            at = math.radians(a0 + (k + 0.5 + tilt) * step)
            pts.append((cx + rx * (1 + depth * jitter) * math.cos(at), cy + ry * (1 + depth * jitter) * math.sin(at)))
    return poly(*[(round(x, 1), round(y, 1)) for x, y in pts])


def snowflake(x, y, r):
    d = []
    for k in range(3):
        a = math.radians(90 + k * 60)
        dx, dy = r * math.cos(a), r * math.sin(a)
        d.append(f"M {x - dx:.1f} {y - dy:.1f} L {x + dx:.1f} {y + dy:.1f}")
    for k in range(6):
        a = math.radians(90 + k * 60)
        bx, by = x + r * 0.6 * math.cos(a), y + r * 0.6 * math.sin(a)
        for s_ in (-1, 1):
            b = a + s_ * math.radians(45)
            d.append(f"M {bx:.1f} {by:.1f} L {bx + r * 0.3 * math.cos(b):.1f} {by + r * 0.3 * math.sin(b):.1f}")
    return "".join(p(x_) for x_ in d)


def draw():
    s = Scene()
    s.fill("blue", FULL)
    s.tint("fed", lin(0, 0, 0, 1000, ((0, 0.7), (0.6, 0.0))), cell=12, angle=75)
    for x, y, r in [(160, 250, 42), (838, 220, 34), (870, 560, 26), (130, 600, 24)]:
        s.paper_stroke(9, snowflake(x, y, r))
    for x, y in [(260, 130), (700, 110), (920, 400), (80, 430), (760, 330)]:
        s.paper(c(x, y, 9))
    # La fourrure.
    body = furry(500, 990, 400, 250, 26, 0.07, a0=180, a1=360, closed=True)
    head = furry(500, 470, 252, 270, 26, 0.13)
    s.paper(body, head)
    fur = body + head
    s.tint("lav", shade(fur, 400, 300, 800, 960, 0.0, 0.6), screen="f", cell=10, angle=45)
    # Le visage bleuté.
    face = e(500, 552, 180, 158)
    s.paper(face)
    s.tint("aqua", T(0.62, face), screen="v", cell=8, angle=30)
    s.tint("blue", shade(face, 0, 470, 0, 740, 0.0, 0.35), screen="v3", cell=9, angle=60)
    bangs = []
    xs = [300, 340, 382, 424, 466, 508, 550, 592, 634, 676, 704]
    pts = [(296, 380)]
    for i, x in enumerate(xs[:-1]):
        pts.append((x + 20, 446 + (14 if i % 2 else 0) + (12 if 3 < i < 7 else 0)))
        pts.append((xs[i + 1], 418))
    pts.append((704, 380))
    bang = poly(*pts)
    s.tint("blue", T(0.45, clipped(face, poly(*[(x, y + 22) for x, y in pts]))), screen="v2", cell=8, angle=20)
    s.paper(bang)
    s.tint("lav", shade(bang, 400, 380, 704, 460, 0.0, 0.6), screen="f", cell=10, angle=45)
    # Yeux plissés de bonheur, gros nez, grand sourire.
    for x in (424, 576):
        s.fill("black", e(x, 522, 34, 34))
        s.paper(c(x + 10, 508, 10))
        cheek = clipped(e(x, 522, 36, 36), e(x, 554, 54, 34))
        s.paper(cheek)
        s.tint("aqua", T(0.62, cheek), screen="v", cell=8, angle=30)
    s.tint("pink", T(0.6, e(376, 590, 36, 18), e(624, 590, 36, 18)), screen="b", cell=8, angle=15)
    mouth = p("M 396 600 Q 500 650 604 600 Q 596 708 500 710 Q 404 708 396 600 Z")
    s.fill("black", mouth)
    s.fill("red", clipped(mouth, e(500, 716, 70, 42)))
    s.fill("fed", e(500, 586, 36, 24))
    s.paper(c(486, 578, 8))
    # L'écharpe rayée.
    scarf = p("M 262 752 Q 500 846 738 752 L 752 830 Q 500 930 248 830 Z")
    tail = p("M 590 820 L 676 812 L 700 980 L 610 990 Z")
    stripes = "".join(rect(x, 600, 34, 600, rot=18) for x in range(150, 900, 68))
    for part in (tail, scarf):
        s.fill("red", part)
        s.fill("green", clipped(part, stripes))
        s.tint("black", shade(part, 0, 760, 0, 990, 0.0, 0.45), screen="s", cell=9, angle=45)
    for x in (622, 646, 670, 694):
        s.stroke("red", 10, p(f"M {x} 986 L {x + 2} 1010"))
    return s.layers()
