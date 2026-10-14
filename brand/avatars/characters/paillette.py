"""Paillette — Ne rate aucune cérémonie de récompenses. A déjà écrit son discours."""
import math
from kit import *  # noqa: F401,F403
from scene import Scene


# ---------------------------------------------------------------- utilitaires
def _star(x, y, R, r, n=5, rot=-90):
    """Étoile pleine à n branches."""
    pts = []
    for i in range(2 * n):
        a = math.radians(rot + i * 180 / n)
        rr = R if i % 2 == 0 else r
        pts.append((round(x + rr * math.cos(a), 1), round(y + rr * math.sin(a), 1)))
    return poly(*pts)


def _sparkle(x, y, R, w=0.22):
    """Paillette : étoile à quatre branches aux flancs creusés."""
    k = R * w
    return p(f"M {x} {y - R} Q {x + k} {y - k} {x + R} {y} Q {x + k} {y + k} {x} {y + R} "
             f"Q {x - k} {y + k} {x - R} {y} Q {x - k} {y - k} {x} {y - R} Z")


# ---------------------------------------------------------------- Paillette
def draw():
    s = Scene()
    s.fill("fed", FULL)
    s.tint("black", rad(500, 420, 620, ((0, 0.0), (0.5, 0.0), (1, 0.8))), cell=12, angle=15)
    for x, y, r in [(140, 300, 36), (830, 170, 34), (880, 480, 40), (170, 640, 26), (270, 120, 20), (122, 470, 16)]:
        s.paper(_sparkle(x, y, r))
    for x, y, r in [(780, 300, 22), (290, 770, 24), (690, 100, 20), (870, 650, 18)]:
        s.fill("sun", _sparkle(x, y, r))
    # Cou en S, corps arrondi, une aile nette qui sort par le bas.
    neck = tube([(560, 470), (650, 580), (602, 690), (542, 750), (532, 860)], 94, 126)
    body = e(530, 1010, 320, 210)
    s.fill("pink", neck, body)
    s.tint("burgundy", shade(neck, 480, 560, 660, 760, 0.0, 0.6) + shade(body, 300, 820, 900, 1000, 0.0, 0.35),
           cell=10, angle=45)
    wing = p("M 430 975 C 460 892 560 848 680 846 C 730 846 770 852 798 864 C 752 876 724 896 708 924 "
             "C 678 916 640 922 616 946 C 588 938 552 946 528 972 Z")
    s.fill("burgundy", wing)
    # Collier de perles à la base du cou.
    for i in range(4):
        u = i / 3
        x, y = 462 + 150 * u, 788 + 26 * math.sin(math.pi * u)
        pearl = c(round(x), round(y), 26)
        s.paper(pearl)
        s.tint("burgundy", shade(pearl, x - 8, y - 8, x + 26, y + 26, 0.0, 0.7), screen="p", cell=7, angle=30)
    # Tête, un peu agrandie autour de son centre.
    H = lambda els: f'<g transform="translate(480 380) scale(1.15) translate(-480 -380)">{els}</g>'
    head = c(540, 370, 165)
    s.fill("pink", H(head))
    s.tint("burgundy", H(shade(head, 450, 280, 700, 520, 0.0, 0.6)), cell=10, angle=45)
    s.tint("red", H(T(0.7, e(616, 452, 40, 24))), screen="b", cell=8, angle=15)
    # Bec : base pâle, pointe noire recourbée.
    beak = p("M 440 300 C 360 296 296 306 258 336 C 216 370 204 446 220 520 Q 236 552 262 522 "
             "C 272 474 292 444 338 434 C 382 428 414 436 446 448 Z")
    s.paper(H(beak))
    s.fill("black", H(clipped(beak, p("M 150 330 L 286 320 L 318 470 L 290 600 L 150 600 Z"))))
    s.stroke("black", 9, H(p("M 300 424 Q 380 404 446 420 Q 474 416 482 392")))
    # Yeux fermés de contentement, longs cils.
    for x, y, r in ((568, 318, 50), (428, 290, 30)):
        s.stroke("black", 10 if r > 40 else 8, H(p(f"M {x - r} {y} Q {x} {y + r * 0.8} {x + r} {y}")))
        for k in (-0.6, 0.0, 0.6):
            bx, by = x + k * r * 0.9, y + r * 0.42 * (1 - k * k) + 4
            s.stroke("black", 8 if r > 40 else 6, H(p(f"M {bx:.0f} {by:.0f} L {bx + k * r * 0.35:.0f} {by + r * 0.4:.0f}")))
    # Lunettes étoiles.
    s.over("sun", H(_star(568, 318, 104, 50, rot=-90) + _star(428, 290, 70, 34, rot=-84)))
    s.stroke("sun", 18, H(_star(568, 318, 104, 50) + _star(428, 290, 70, 34, rot=-84) + p("M 470 282 Q 490 270 512 280")))
    return s.layers()
