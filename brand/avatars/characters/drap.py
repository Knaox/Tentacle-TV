"""Drap — Ne fait peur à personne. Regarde tout caché sous son drap."""
from kit import *  # noqa: F401,F403
from scene import Scene

# Le drap est dessiné à sa taille d'origine puis agrandi autour de son centre.
GROW = 'transform="translate(500 548) scale(1.13) translate(-500 -548)"'


def _grown(*els):
    return f'<g {GROW}>{"".join(els)}</g>'


def _cushion():
    """Un coussin rebondi : bords creusés, coins en pointe."""
    return p("M 318 560 Q 500 600 690 548 Q 662 672 700 792 Q 500 756 310 806 Q 344 684 318 560 Z")


def draw():
    s = Scene()
    s.fill("teal", FULL)
    s.tint("black", lin(0, 0, 0, 1000, ((0, 0.6), (0.62, 0.0))), cell=12, angle=75)
    # La lueur de l'écran, à droite : c'est là qu'il regarde.
    s.tint("aqua", rad(930, 470, 430, ((0, 0.95), (1, 0.0))), screen="g", cell=12, angle=20)
    for x, y in [(410, 904), (598, 910)]:
        shoe = p(f"M {x - 72} {y + 32} C {x - 74} {y - 30} {x + 40} {y - 42} {x + 74} {y + 10} L {x + 76} {y + 36} Z")
        s.fill("red", shoe)
        s.paper(rect(x - 76, y + 24, 152, 18, r=8))
        s.paper_stroke(6, p(f"M {x - 20} {y - 14} L {x + 6} {y - 4}"), p(f"M {x - 10} {y - 26} L {x + 16} {y - 16}"))
    sheet = p("M 290 880 C 282 700 262 520 296 396 C 330 252 410 178 504 178 C 604 178 682 262 708 400 "
              "C 738 540 726 720 716 870 Q 690 908 660 872 Q 630 836 600 874 Q 570 910 540 872 "
              "Q 512 836 482 874 Q 452 912 420 872 Q 392 836 360 876 Q 324 916 290 880 Z")
    s.paper(_grown(sheet))
    s.tint("lav", _grown(shade(sheet, 380, 0, 720, 0, 0.0, 0.8)), screen="s", cell=10, angle=45)
    s.stroke("lav", 10, _grown(p("M 640 420 Q 660 560 650 700")))
    # Les plis au-dessus des trous font des sourcils inquiets.
    s.stroke("lav", 11, _grown(p("M 398 342 Q 432 334 468 312"), p("M 536 316 Q 572 336 608 344")))
    s.fill("black", _grown(e(436, 398, 34, 48, 8), e(570, 404, 36, 50, -8)))
    # Les yeux, au fond des trous, filent vers l'écran.
    s.paper(_grown(c(456, 412, 12), c(592, 418, 13)))
    s.tint("pink", T(0.6, _grown(e(404, 476, 30, 14), e(608, 482, 30, 14))), screen="b", cell=8, angle=15)
    # Le coussin serré contre lui, et les deux bosses du drap qui le tiennent.
    cushion = _cushion()
    s.fill("pink", cushion)
    s.tint("burgundy", shade(cushion, 0, 600, 0, 800, 0.0, 0.7), screen="c", cell=9, angle=60)
    s.paper_stroke(7, p("M 352 590 Q 500 622 662 580"), p("M 344 772 Q 500 736 674 766"))
    s.fill("red", c(506, 680, 16))
    s.paper(c(502, 676, 5))
    for x, y in [(306, 676), (704, 660)]:
        s.paper(e(x, y, 48, 58))
        s.tint("lav", shade(e(x, y, 48, 58), 0, y - 40, 0, y + 60, 0.0, 0.7), screen="h", cell=9, angle=45)
    return s.layers()
