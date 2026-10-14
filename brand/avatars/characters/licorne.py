"""Licorne — Fan de sagas fantastiques. Connaît la carte de tous les royaumes."""
import math
from kit import *  # noqa: F401,F403
from scene import Scene


# ---------------------------------------------------------------- petits outils du module
def rot(a, cx, cy, *els):
    return f'<g transform="rotate({a} {cx} {cy})">{"".join(els)}</g>'


def star(x, y, ro, ri=None, n=5, a0=-90.0):
    ri = ri or ro * 0.45
    pts = []
    for i in range(2 * n):
        r = ro if i % 2 == 0 else ri
        a = math.radians(a0 + i * 180 / n)
        pts.append((round(x + r * math.cos(a), 1), round(y + r * math.sin(a), 1)))
    return poly(*pts)


def sparkle(x, y, r, k=0.2):
    """Étincelle à quatre branches, côtés creusés."""
    q = r * k
    return p(f"M {x} {y - r} Q {x + q} {y - q} {x + r} {y} Q {x + q} {y + q} {x} {y + r} "
             f"Q {x - q} {y + q} {x - r} {y} Q {x - q} {y - q} {x} {y - r} Z")


# ---------------------------------------------------------------- Licorne (narval)
def draw():
    s = Scene()
    s.fill("lav", FULL)
    s.tint("violet", lin(0, 640, 0, 1000, ((0, 0.0), (1, 0.55))), cell=12, angle=75)
    # Corne spiralée, de biais vers le haut.
    tusk = tube([(404, 470), (226, 150)], 86, 12, cap=False) + c(226, 150, 6)
    s.fill("cream", tusk)
    bands = rot(4, 315, 310, *[rect(150, y, 330, 16) for y in range(110, 520, 34)])
    s.tint("sun", clipped(tusk, T(0.8, bands)), cell=7, angle=30)
    s.tint("sun", shade(tusk, 300, 300, 360, 330, 0.0, 0.5), screen="t", cell=9, angle=60)
    # Étoiles magiques autour de la corne.
    s.paper(sparkle(168, 300, 44), sparkle(350, 204, 26), sparkle(126, 404, 18))
    s.fill("sun", star(334, 120, 32, 14, a0=-80), star(206, 420, 22, 10, a0=-100))
    # Queue et corps.
    fluke = (tube([(770, 660), (842, 566), (860, 474)], 116, 40)
             + p("M 860 474 C 806 424 796 364 826 334 C 852 384 868 424 872 474 Z")
             + p("M 862 474 C 890 414 930 384 970 384 C 950 434 910 474 870 494 Z"))
    body = p("M 200 650 C 190 520 290 410 440 400 C 610 390 780 470 815 610 C 845 720 770 822 600 838 "
             "C 430 856 240 812 200 650 Z")
    s.fill("blue", fluke, body)
    belly = clipped(body, p("M 160 610 C 300 650 480 700 630 700 C 710 700 790 690 880 660 L 880 920 L 160 920 Z"))
    s.paper(belly)
    s.tint("cream", T(0.9, belly), screen="c", cell=8, angle=30)
    s.over("fed", c(610, 470, 22), c(670, 520, 16), c(712, 472, 12), c(566, 530, 12), c(752, 566, 18),
           c(830, 524, 12))
    s.tint("fed", shade(body + fluke, 400, 420, 720, 800, 0.0, 0.7), screen="s", cell=10, angle=45)
    s.fill("blue", p("M 548 730 C 600 744 650 800 640 846 C 596 838 556 790 548 730 Z"))
    # Yeux grands ouverts, émerveillés.
    for x, y in [(322, 566), (476, 552)]:
        w, pu, gl = eye(x, y, 58, look=(-0.45, -0.55), pupil=0.58)
        pr = 58 * 0.58
        px, py = x - 0.45 * (58 - pr) * 0.9, y - 0.55 * (58 - pr) * 0.9
        s.paper(w)
        s.fill("black", pu)
        s.paper(sparkle(round(px + pr * 0.3), round(py - pr * 0.3), 17, 0.18), c(round(px - pr * 0.4), round(py + pr * 0.4), 6))
    s.stroke("black", 11, p("M 270 470 Q 312 440 358 462"), p("M 430 452 Q 476 424 524 446"))
    s.fill("black", e(394, 664, 22, 28))
    s.fill("pink", e(396, 678, 13, 10))
    s.tint("pink", T(0.7, e(258, 632, 30, 16), e(532, 620, 30, 16)), screen="b", cell=8, angle=15)
    return s.layers()
