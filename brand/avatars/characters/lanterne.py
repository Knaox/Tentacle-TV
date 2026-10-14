"""Lanterne, la baudroie — ne regarde de l'horreur qu'après minuit ; sa lueur éclaire l'écran."""
from kit import *  # noqa: F401,F403


BODY = 'M 170 560 C 200 420 360 300 520 300 C 660 300 790 360 830 450 L 845 520 C 855 640 760 760 600 800 C 430 840 260 760 200 640 Z'
TAIL = 'M 215 600 L 80 470 C 60 560 62 650 86 735 Z'
FIN = 'M 420 640 C 440 720 400 770 330 780 C 370 730 380 690 360 640 Z'
DORSAL = 'M 360 330 C 330 260 300 240 250 250 C 300 290 310 330 300 380 Z'
MOUTH = 'M 600 520 C 680 470 780 452 846 470 L 852 612 C 790 660 700 668 612 600 Z'
STALK = 'M 600 312 C 610 170 770 120 790 230'


def _teeth():
    up = "".join(p(f"M {x} {y} L {x+28} {y-4} L {x+16} {y+44} Z")
                 for x, y in [(640, 512), (684, 494), (728, 482), (772, 476), (812, 474)])
    lo = "".join(p(f"M {x} {y} L {x+30} {y+2} L {x+12} {y-40} Z")
                 for x, y in [(650, 616), (700, 632), (750, 630), (800, 618)])
    return up + lo


def draw():
    eye_w = c(565, 418, 62)
    lid = clipped(c(565, 418, 64), p("M 470 300 L 660 300 L 660 392 L 470 418 Z"))
    silhouette = p(BODY) + p(TAIL) + p(DORSAL)
    glow_hole = ('<defs><radialGradient id="lh" cx="790" cy="250" r="420" gradientUnits="userSpaceOnUse">'
                 '<stop offset="0" stop-color="black"/><stop offset="0.25" stop-color="black"/>'
                 '<stop offset="1" stop-color="black" stop-opacity="0"/></radialGradient></defs>'
                 '<circle cx="790" cy="250" r="420" fill="url(#lh)"/>')
    return [
        ("yellow", A(c(790, 250, 42)) + radial(790, 250, 330, "gl"), {"screen": True, "angle": 15, "cell": 12}),
        ("yellow", A(c(790, 250, 40)), {}),
        ("pink", A(p(BODY), p(TAIL), p(FIN), p(DORSAL)) + SA(16, p(STALK)) + E(eye_w, _teeth()) + A(lid), {}),
        ("purple", shade(p(BODY), 0, 420, 0, 820) + E(eye_w, p(MOUTH)), {"screen": True, "angle": 45, "cell": 11}),
        ("fed", A(FULL) + E(silhouette, c(790, 250, 70)) + SE(40, p(STALK)) + glow_hole
         + E(c(892, 650, 20), c(925, 585, 13), c(905, 528, 8)), {"screen": True, "angle": 75, "cell": 12}),
        ("black", A(p(MOUTH), c(590, 440, 26)) + SA(9, p("M 500 415 L 630 396")) + E(_teeth(), c(599, 431, 8)), {}),
    ]
