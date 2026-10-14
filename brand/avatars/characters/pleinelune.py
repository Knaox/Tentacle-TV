"""Pleine Lune — Un film par mois. Toujours le même soir."""
import math
from kit import *  # noqa: F401,F403
from scene import Scene


def _rot(ang, cx, cy, *els):
    return f'<g transform="rotate({ang} {cx} {cy})">{"".join(els)}</g>'


def _tuft(x, y, ang, length, width):
    """Une touffe de poils : un triangle posé en (x, y), pointé vers `ang` (degrés)."""
    a = math.radians(ang)
    tx, ty = x + length * math.cos(a), y + length * math.sin(a)
    nx, ny = -math.sin(a) * width / 2, math.cos(a) * width / 2
    return poly((round(x + nx), round(y + ny)), (round(tx), round(ty)), (round(x - nx), round(y - ny)))


# ---------------------------------------------------------------- Pleine Lune
def draw():
    s = Scene()
    s.fill("violet", FULL)
    s.tint("purple", rad(620, 360, 680, ((0, 0.0), (0.45, 0.0), (1, 0.85))), cell=12, angle=75)
    for x, y, r in [(120, 210, 7), (210, 120, 5), (90, 380, 5), (920, 690, 6), (880, 840, 5), (180, 300, 4)]:
        s.paper(c(x, y, r))
    moon = c(620, 360, 285)
    s.paper(moon)
    s.tint("sun", shade(moon, 400, 140, 840, 600, 0.3, 0.7), screen="m", cell=9, angle=20)
    s.over("sun", c(740, 230, 42), c(820, 400, 28), c(735, 540, 50), c(540, 150, 22), c(845, 280, 16))
    s.layer_opts("sun", None, density=0.45)
    # Le cri : trois traits qui partent de la gueule.
    for ang in (-88, -58, -28):
        t = math.radians(ang)
        x0, y0 = 640 + 130 * math.cos(t), 340 + 130 * math.sin(t)
        x1, y1 = 640 + 215 * math.cos(t), 340 + 215 * math.sin(t)
        s.stroke("violet", 18, p(f"M {x0:.0f} {y0:.0f} L {x1:.0f} {y1:.0f}"), knock=False)
    P = (440, 560)
    R = lambda *els: _rot(-52, P[0], P[1], *els)
    # Oreille du fond, puis le cou et ses touffes.
    s.fill("burgundy", poly((350, 430), (360, 250), (446, 404)))
    neck = p("M 170 1000 C 170 860 210 740 280 670 C 360 600 480 560 556 572 C 620 650 670 760 700 860 L 740 1000 Z")
    back = []
    throat = [_tuft(x, y, a, 80, 64) for x, y, a in
              [(570, 600, 15), (612, 664, 25), (648, 734, 32), (676, 806, 38), (700, 884, 45)]]
    s.fill("brown", neck, *back, *throat)
    s.tint("burgundy", shade(neck + "".join(back + throat), 340, 640, 700, 1000, 0.0, 0.75), cell=10, angle=45)
    # Gueule ouverte (repère : profil tourné vers la droite, puis basculé).
    mouth = poly((500, 598), (760, 552), (736, 664), (496, 622))
    s.fill("black", R(mouth))
    s.fill("pink", R(clipped(mouth, e(640, 650, 100, 26, 12))))
    muzzle = p("M 470 470 C 570 455 680 480 744 506 C 770 516 774 552 750 562 L 560 600 L 500 590 Z")
    jaw = p("M 520 606 L 716 652 C 736 664 726 696 696 698 C 630 702 560 692 500 662 Z")
    head = c(440, 560, 170)
    cheek = [_tuft(x, y, a, 90, 76) for x, y, a in [(290, 640, 150), (340, 700, 128), (410, 726, 108)]]
    s.fill("brown", head, *cheek, R(muzzle, jaw))
    s.paper(R(poly((672, 570), (700, 565), (688, 602))))
    s.tint("burgundy", shade(head + "".join(cheek), 0, 560, 0, 760, 0.0, 0.7), screen="b", cell=10, angle=45)
    s.tint("burgundy", R(shade(jaw, 0, 640, 0, 700, 0.1, 0.8)), screen="b", cell=10, angle=45)
    # Oreille de devant.
    s.fill("brown", poly((270, 520), (210, 300), (380, 436)))
    s.fill("burgundy", poly((286, 492), (240, 350), (340, 444)))
    # Truffe, œil fermé de bonheur, sourcil levé.
    s.fill("black", R(p("M 728 504 C 760 496 784 512 782 532 C 780 552 756 558 738 548 C 722 538 716 512 728 504 Z")))
    s.stroke("black", 15, R(p("M 498 516 Q 534 548 572 516")), knock=False)
    s.fill("burgundy", R(p("M 486 486 C 510 452 556 448 590 470 C 560 466 530 470 500 494 Z")))
    return s.layers()
