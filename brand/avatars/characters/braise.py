"""Braise — Fait éclater le pop-corn d'un souffle. Parfois aussi le canapé."""
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


def lid(x, y, r, a, b):
    """Paupière : la calotte de l'œil au-dessus de la droite (x-r, y+a) → (x+r, y+b)."""
    return clipped(c(x, y, r + 3), p(f"M {x-r-40} {y-r-60} L {x+r+40} {y-r-60} L {x+r+40} {y+b} L {x-r-40} {y+a} Z"))


def put_eye(s, x, y, r, look=(0, 0), pupil=0.45):
    w, pu, gl = eye(x, y, r, look=look, pupil=pupil)
    s.paper(w)
    s.fill("black", pu)
    s.paper(gl)


# ---------------------------------------------------------------- Glorp
def popcorn(x, y, k=1.0):
    """Un grain de pop-corn : des bouffées, et un bout d'enveloppe."""
    puffs = "".join(c(round(x + dx * k), round(y + dy * k), round(r * k))
                    for dx, dy, r in [(-26, 8, 30), (6, -18, 32), (30, 10, 28), (0, 24, 26), (-14, -30, 20)])
    hull = p(f"M {x - 22 * k:.0f} {y + 30 * k:.0f} Q {x:.0f} {y + 62 * k:.0f} {x + 24 * k:.0f} {y + 30 * k:.0f} "
             f"Q {x + 2 * k:.0f} {y + 40 * k:.0f} {x - 22 * k:.0f} {y + 30 * k:.0f} Z")
    return puffs, hull


# ---------------------------------------------------------------- Braise
def draw():
    s = Scene()
    s.fill("purple", FULL)
    s.tint("black", lin(0, 0, 0, 1000, ((0, 0.0), (0.55, 0.0), (1, 0.6))), cell=12, angle=75)
    s.tint("pink", rad(800, 380, 330, ((0, 0.9), (1, 0.0))), screen="g", cell=12, angle=15)
    # L'aile, derrière : une aile de chauve-souris festonnée.
    wing = p("M 336 660 C 270 600 190 540 112 500 Q 176 566 150 664 Q 214 690 236 772 Q 296 770 350 800 Z")
    s.fill("teal", wing)
    s.tint("black", shade(wing, 110, 500, 340, 760, 0.0, 0.35), screen="w", cell=9, angle=30)
    s.stroke("green", 12, p("M 340 690 Q 220 580 118 504"), p("M 340 700 Q 230 660 152 662"), p("M 344 712 Q 280 720 238 768"))
    # Cou, corps, ventre.
    body = p("M 190 1000 C 210 880 270 760 340 660 L 520 600 C 590 700 620 840 640 1000 Z")
    s.fill("green", body)
    belly = p("M 476 618 C 556 700 580 840 590 1000 L 438 1000 C 446 860 440 740 410 650 Z")
    s.fill("sun", belly)
    scales = [p(f"M {446 + (y - 700) * 0.1:.0f} {y} Q 505 {y + 16} {566 + (y - 700) * 0.08:.0f} {y - 6}")
              for y in (720, 790, 860, 930)]
    s.stroke("orange", 10, *scales, knock=False)
    s.tint("teal", shade(body, 0, 700, 0, 1000, 0.0, 0.6), screen="h", cell=10, angle=45)
    # Crête dans le dos.
    for (x, y, a) in [(270, 330, -150), (240, 420, -170), (244, 520, 175), (300, 650, 160), (262, 760, 165), (232, 870, 170)]:
        ra = math.radians(a)
        bx, by = 26 * math.cos(ra + math.pi / 2), 26 * math.sin(ra + math.pi / 2)
        s.fill("sun", poly((round(x + bx), round(y + by)), (round(x + 60 * math.cos(ra)), round(y + 60 * math.sin(ra))),
                           (round(x - bx), round(y - by))))
    # Cornes.
    s.fill("cream", tube([(350, 286), (322, 220), (290, 180)], 44, 12), tube([(450, 262), (452, 196), (432, 150)], 42, 12))
    s.tint("sun", T(0.6, tube([(350, 286), (322, 220), (290, 180)], 44, 12), tube([(450, 262), (452, 196), (432, 150)], 42, 12)),
           screen="c", cell=8, angle=30)
    # Tête de trois quarts, museau vers le pop-corn.
    skull = e(420, 420, 178, 168)
    snout = p("M 470 410 C 560 380 690 400 740 450 C 776 488 770 548 724 566 C 640 600 520 590 460 560 Z")
    s.fill("green", skull, snout)
    head = skull + snout
    s.tint("teal", shade(head, 380, 330, 560, 640, 0.0, 0.7), screen="h", cell=10, angle=45)
    s.fill("teal", e(690, 448, 14, 10, -20), e(728, 470, 12, 9, -30))
    # Yeux mi-clos, contents d'eux-mêmes, qui lorgnent le pop-corn.
    for x, y, r in [(482, 380, 54), (604, 372, 38)]:
        put_eye(s, x, y, r, look=(0.6, -0.35), pupil=0.5)
        s.fill("green", lid(x, y, r, -4, 6))
        s.stroke("black", 8, p(f"M {x - r} {y - 4} L {x + r} {y + 6}"))
    s.fill("teal", tube([(426, 316), (484, 300), (540, 318)], 18, 12), tube([(570, 318), (606, 306), (640, 316)], 14, 10))
    # Sourire en coin, langue gourmande.
    s.stroke("black", 10, p("M 722 548 Q 640 566 560 540 Q 540 532 530 512"))
    s.fill("pink", e(556, 552, 18, 13, 30))
    # La petite flamme.
    flame = p("M 736 512 C 760 500 772 488 780 470 C 784 456 776 444 780 428 C 790 440 800 446 810 444 "
              "C 812 426 826 412 846 404 C 836 428 852 448 846 474 C 838 512 794 534 736 532 Z")
    s.fill("orange", flame)
    inner = p("M 752 520 C 784 506 800 492 808 472 C 814 484 822 494 816 508 C 806 524 782 528 752 526 Z")
    s.fill("yellow", inner)
    # Le grain qui éclate.
    s.paper(star(826, 340, 82, 44, n=8, rot=10))
    puffs, hull = popcorn(826, 334, 0.95)
    s.fill("cream", puffs)
    s.tint("sun", shade(puffs, 790, 300, 860, 380, 0.0, 0.7), screen="p", cell=8, angle=30)
    s.fill("orange", hull)
    return s.layers()
