"""Bip — Trouve les robots de cinéma très mal joués."""
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


# ---------------------------------------------------------------- Bip
def draw():
    s = Scene()
    s.fill("aqua", FULL)
    s.tint("teal", lin(0, 500, 0, 1000, ((0, 0.0), (1, 0.75))), cell=12, angle=75)
    for x, y, r in [(170, 250, 34), (850, 690, 26), (840, 210, 20)]:
        s.paper(star(x, y, r, r * 0.22, n=4))
    # Corps, cou en accordéon.
    torso = p("M 210 1000 L 236 880 Q 244 846 290 846 L 710 846 Q 756 846 764 880 L 790 1000 Z")
    s.fill("teal", torso)
    s.tint("black", shade(torso, 300, 0, 780, 0, 0.0, 0.5), screen="t", cell=10, angle=45)
    panel = rect(380, 892, 240, 120, r=16)
    s.fill("black", panel)
    for x, ink in [(430, "red"), (500, "sun"), (570, "aqua")]:
        s.fill(ink, c(x, 940, 20))
    for y in (770, 806):
        s.fill("black", rect(420, y, 160, 30, r=14))
    s.fill("teal", rect(430, 790, 140, 22, r=10))
    # Oreilles, antenne.
    for x in (198, 744):
        s.fill("red", rect(x, 486, 58, 124, r=16))
        s.tint("black", shade(rect(x, 486, 58, 124, r=16), x, 0, x + 58, 0, 0.0, 0.5), screen="t", cell=10, angle=45)
    s.stroke("black", 14, p("M 500 330 L 520 196"))
    s.fill("black", e(500, 334, 60, 26))
    s.fill("red", c(522, 176, 36))
    s.paper(c(510, 164, 10))
    # Tête carrée.
    head = rect(250, 326, 500, 444, r=44)
    s.fill("teal", head)
    s.tint("black", shade(head, 320, 340, 760, 780, 0.0, 0.55), screen="t", cell=10, angle=45)
    s.paper_stroke(12, p("M 286 420 L 286 380 Q 288 362 306 360 L 420 360"))
    for x, y in [(290, 400), (710, 400), (290, 730), (710, 730)]:
        s.fill("black", c(x, y, 13))
    # Yeux-cadrans : l'un plissé par un volet, l'autre grand ouvert sous un sourcil haussé.
    for x in (390, 610):
        s.fill("sun", c(x, 530, 86))
        s.tint("orange", shade(c(x, 530, 86), x - 60, 0, x + 80, 0, 0.0, 0.6), screen="o", cell=9, angle=30)
        s.paper(c(x, 530, 64))
        for a in (-150, -90, -30):
            ra = math.radians(a)
            s.stroke("black", 8, p(f"M {x + 48 * math.cos(ra):.0f} {530 + 48 * math.sin(ra):.0f} "
                                   f"L {x + 60 * math.cos(ra):.0f} {530 + 60 * math.sin(ra):.0f}"))
    s.fill("black", c(424, 548, 26), c(646, 540, 28))
    s.paper(c(432, 540, 8), c(655, 531, 9))
    shutter = clipped(c(390, 530, 66), p("M 300 420 L 480 420 L 480 528 L 300 520 Z"))
    s.fill("teal", shutter)
    s.tint("black", T(0.45, shutter), screen="t", cell=10, angle=45)
    s.stroke("black", 10, p("M 324 520 L 456 528"))
    s.fill("black", rect(316, 420, 152, 30, r=12, rot=5))
    s.fill("black", rect(540, 352, 146, 30, r=12, rot=7))
    s.fill("red", c(612, 368, 9))
    # Bouche-grille, de travers : un « mouais » de haut-parleur.
    mouth = rect(470, 664, 170, 52, r=18, rot=-7)
    s.fill("black", mouth)
    s.fill("teal", clipped(mouth, rect(440, 682, 240, 10, rot=-7)))
    return s.layers()
