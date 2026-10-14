"""Glorp — Est venu sur Terre pour les films. Reste pour le pop-corn."""
import math
from kit import *  # noqa: F401,F403
from scene import Scene


def star(x, y, r_out, r_in, n=4, rot=0):
    pts = []
    for i in range(n * 2):
        a = math.radians(rot + i * 180 / n - 90)
        rr = r_out if i % 2 == 0 else r_in
        pts.append((round(x + rr * math.cos(a), 1), round(y + rr * math.sin(a), 1)))
    return poly(*pts)


# ---------------------------------------------------------------- Glorp
def popcorn(x, y, k=1.0):
    """Un grain de pop-corn : des bouffées, et un bout d'enveloppe."""
    puffs = "".join(c(round(x + dx * k), round(y + dy * k), round(r * k))
                    for dx, dy, r in [(-26, 8, 30), (6, -18, 32), (30, 10, 28), (0, 24, 26), (-14, -30, 20)])
    hull = p(f"M {x - 22 * k:.0f} {y + 30 * k:.0f} Q {x:.0f} {y + 62 * k:.0f} {x + 24 * k:.0f} {y + 30 * k:.0f} "
             f"Q {x + 2 * k:.0f} {y + 40 * k:.0f} {x - 22 * k:.0f} {y + 30 * k:.0f} Z")
    return puffs, hull


def draw():
    s = Scene()
    s.fill("fed", FULL)
    s.tint("black", rad(500, 520, 620, ((0, 0.0), (0.6, 0.15), (1, 0.7))), cell=12, angle=75)
    for x, y, r in [(150, 260, 26), (860, 560, 22), (230, 120, 14), (120, 520, 14)]:
        s.paper(star(x, y, r, r * 0.25, n=4))
    for x, y in [(300, 90), (700, 100), (90, 380), (900, 430), (180, 640), (840, 160), (620, 70)]:
        s.paper(c(x, y, 6))
    dome = e(500, 470, 290, 300)
    s.paper(dome)
    # Glorp.
    s.fill("green", e(500, 650, 110, 80))
    for d in ("M 444 288 Q 410 230 376 214", "M 556 288 Q 590 230 626 206"):
        s.stroke("green", 14, p(d))
    s.fill("pink", c(372, 210, 24), c(630, 200, 24))
    s.paper(c(364, 202, 7), c(622, 192, 7))
    head = p("M 500 262 C 640 262 716 340 712 432 C 708 534 612 596 500 598 C 388 596 292 534 288 432 "
             "C 284 340 360 262 500 262 Z")
    s.fill("green", head)
    s.over("teal", c(410, 322, 16), c(632, 360, 18), c(586, 300, 10))
    s.tint("teal", shade(head, 360, 300, 680, 620, 0.0, 0.8), screen="h", cell=10, angle=45)
    # Le dôme : une vitre surimprimée.
    s.over("aqua", dome)
    s.layer_opts("aqua", None, density=0.45)
    # Trois yeux émerveillés, levés vers le pop-corn.
    for x, y, r in [(500, 392, 64), (372, 450, 48), (628, 450, 48)]:
        w, pu, gl = eye(x, y, r, look=(0.6, -0.75), pupil=0.44)
        s.paper(w)
        s.fill("black", pu)
        s.paper(gl)
        pr = r * 0.44
        px, py = x + 0.6 * (r - pr) * 0.9, y - 0.75 * (r - pr) * 0.9
        s.paper(c(round(px - pr * 0.4), round(py + pr * 0.45), max(4, round(pr * 0.16))))
    mouth = p("M 456 522 Q 500 530 544 520 Q 542 580 500 582 Q 458 580 456 522 Z")
    s.fill("black", mouth)
    s.fill("pink", clipped(mouth, e(500, 586, 30, 22)))
    # La soucoupe.
    body = e(500, 770, 352, 96)
    s.fill("violet", body)
    s.tint("purple", shade(body, 0, 740, 0, 870, 0.0, 0.85), screen="v", cell=10, angle=45)
    rim = e(500, 712, 300, 44)
    s.fill("lav", rim)
    s.tint("purple", T(0.5, clipped(rim, e(500, 680, 300, 44))), screen="v2", cell=8, angle=20)
    for i in range(7):
        x = 230 + i * 90
        y = 786 - 18 * math.cos((x - 500) / 352 * 1.4)
        s.fill("sun", e(round(x), round(y), 20, 15))
    s.fill("green", e(400, 704, 34, 22, -12), e(600, 704, 34, 22, 12))
    # Reflets sur la vitre.
    s.paper_stroke(14, p("M 262 470 Q 262 300 380 220"))
    s.paper(c(408, 202, 9))
    # Le pop-corn qui flotte.
    puffs, hull = popcorn(806, 286, 1.2)
    s.paper(puffs)
    s.tint("sun", shade(puffs, 760, 240, 850, 340, 0.0, 0.7), screen="p", cell=8, angle=30)
    s.fill("orange", hull)
    s.paper_stroke(8, p("M 720 214 L 742 232"), p("M 742 180 L 756 204"))
    return s.layers()
