"""Le Comte — Ne sort que pour la séance de minuit. Déteste les spoilers… et l'ail."""
import math
from kit import *  # noqa: F401,F403
from scene import Scene


# ---------------------------------------------------------------- utilitaires
def crescent(cx, cy, r, ox, oy, r2):
    """Croissant : le disque (cx, cy, r) privé du disque (ox, oy, r2)."""
    d = math.hypot(ox - cx, oy - cy)
    a = (r * r - r2 * r2 + d * d) / (2 * d)
    h = math.sqrt(max(0.0, r * r - a * a))
    ux, uy = (ox - cx) / d, (oy - cy) / d
    mx, my = cx + a * ux, cy + a * uy
    p1 = (mx - h * uy, my + h * ux)
    p2 = (mx + h * uy, my - h * ux)
    return p(f"M {p1[0]:.1f} {p1[1]:.1f} A {r} {r} 0 1 1 {p2[0]:.1f} {p2[1]:.1f} "
             f"A {r2} {r2} 0 0 0 {p1[0]:.1f} {p1[1]:.1f} Z")


def lid(x, y, r, a, b):
    """Paupière : la calotte de l'œil au-dessus de la droite (x-r, y+a) → (x+r, y+b)."""
    return clipped(c(x, y, r + 3), p(f"M {x-r-40} {y-r-60} L {x+r+40} {y-r-60} L {x+r+40} {y+b} L {x-r-40} {y+a} Z"))


def put_eye(s, x, y, r, look=(0, 0), pupil=0.45):
    w, pu, gl = eye(x, y, r, look=look, pupil=pupil)
    s.paper(w)
    s.fill("black", pu)
    s.paper(gl)


# ---------------------------------------------------------------- Le Comte
def draw():
    s = Scene()
    s.fill("burgundy", FULL)
    s.tint("black", lin(0, 0, 0, 1000, ((0, 0.6), (0.55, 0.0))), cell=12, angle=75)
    moon = crescent(800, 186, 62, 828, 166, 54)
    s.paper(moon)
    s.tint("yellow", T(0.4, moon), screen="m", cell=9, angle=20)
    for x, y, r in [(130, 260, 6), (230, 150, 5), (660, 110, 5), (880, 330, 6)]:
        s.paper(c(x, y, r))
    # Cape et haut col.
    cape = p("M 70 1000 C 90 880 170 800 330 770 L 670 770 C 830 800 910 880 930 1000 Z")
    collar = p("M 150 880 Q 110 560 196 282 Q 330 360 404 560 L 596 560 Q 670 360 804 282 "
               "Q 890 560 850 880 Z")
    s.fill("black", cape, collar)
    lining = (p("M 192 822 Q 162 580 226 340 Q 330 410 396 600 L 440 800 Z")
              + p("M 808 822 Q 838 580 774 340 Q 670 410 604 600 L 560 800 Z"))
    s.fill("red", lining)
    s.tint("black", shade(lining, 0, 380, 0, 840, 0.0, 0.55), screen="s", cell=10, angle=45)
    shirt = poly((432, 720), (568, 720), (500, 880))
    s.paper(shirt)
    s.fill("red", c(500, 790, 24))
    s.paper(c(492, 782, 7))
    # Oreilles pointues.
    ears = p("M 312 420 Q 250 360 214 352 Q 236 450 318 540 Z") + p("M 688 420 Q 750 360 786 352 Q 764 450 682 540 Z")
    face = p("M 500 205 C 640 205 700 320 698 450 C 696 590 600 700 500 716 C 400 700 304 590 302 450 "
             "C 300 320 360 205 500 205 Z")
    s.paper(ears, face)
    s.tint("lav", shade(face + ears, 360, 300, 700, 740, 0.0, 0.6), screen="f", cell=9, angle=45)
    s.tint("lav", T(0.8, p("M 236 380 Q 268 430 300 470 L 300 500 Q 262 440 236 380 Z"),
                    p("M 764 380 Q 732 430 700 470 L 700 500 Q 738 440 764 380 Z")), screen="f2", cell=8, angle=20)
    # Cheveux plaqués, pointe sur le front.
    hair = p("M 292 470 C 280 300 360 182 500 182 C 640 182 720 300 708 470 L 690 474 "
             "C 680 410 650 352 590 330 C 552 330 520 350 500 392 C 480 350 448 330 410 330 "
             "C 350 352 320 410 310 474 Z")
    s.fill("black", hair)
    s.paper_stroke(10, p("M 372 250 Q 430 214 500 212"), p("M 600 236 Q 650 262 676 320"))
    # Cernes, yeux, sourcils (l'un baissé, l'autre levé haut).
    s.tint("lav", T(0.6, crescent(422, 520, 46, 422, 506, 46), crescent(580, 518, 48, 580, 504, 48)), screen="c", cell=8, angle=60)
    put_eye(s, 422, 490, 37, look=(0.5, 0.45), pupil=0.5)
    s.paper(lid(422, 490, 37, -14, -6))
    s.tint("lav", T(0.6, lid(422, 490, 37, -14, -6)), screen="f", cell=9, angle=45)
    s.stroke("black", 8, p("M 382 476 L 464 484"))
    put_eye(s, 580, 484, 41, look=(0.45, 0.3), pupil=0.46)
    s.fill("black", tube([(356, 432), (420, 444), (470, 452)], 14, 26))
    s.fill("black", tube([(540, 410), (590, 360), (648, 382)], 24, 12))
    # Nez fin, sourire en coin, deux crocs.
    s.tint("lav", T(1.0, p("M 506 500 Q 528 560 508 580 Q 496 584 488 576 Q 506 556 506 500 Z")), screen="c", cell=8, angle=60)
    mouth = p("M 422 604 Q 500 618 590 584 Q 576 668 506 670 Q 446 668 422 604 Z")
    s.fill("black", mouth)
    s.fill("red", clipped(mouth, e(512, 666, 50, 24)))
    s.paper(poly((452, 606), (480, 610), (466, 646)), poly((530, 604), (558, 598), (548, 638)))
    s.stroke("black", 8, p("M 584 580 Q 600 576 606 562"))
    s.tint("pink", T(0.55, e(366, 580, 34, 16), e(642, 576, 34, 16)), screen="b", cell=8, angle=15)
    return s.layers()
