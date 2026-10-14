"""Shérif Pince — Shérif des westerns. Dégaine la télécommande plus vite que son ombre."""
import math
from kit import *  # noqa: F401,F403
from scene import Scene


def star(x, y, ro, ri=None, n=5, a0=-90.0):
    ri = ri or ro * 0.45
    pts = []
    for i in range(2 * n):
        r = ro if i % 2 == 0 else ri
        a = math.radians(a0 + i * 180 / n)
        pts.append((round(x + r * math.cos(a), 1), round(y + r * math.sin(a), 1)))
    return poly(*pts)


def lid(x, y, r, a, b, below=False, grow=3, bulge=0.0):
    """Paupière : le segment de l'œil (rayon r) au-dessus (ou au-dessous) de la droite
    (x-r, y+a) → (x+r, y+b). Un vrai polygone : utilisable aussi comme découpe."""
    R = r + grow
    def side(px, py):
        ly = y + a + (b - a) * (px - (x - r)) / (2 * r) + bulge * (1 - ((px - x) / r) ** 2)
        return (py > ly) if below else (py < ly)
    angs = [i * 0.5 for i in range(720)]
    pts = [(x + R * math.cos(math.radians(t)), y + R * math.sin(math.radians(t))) for t in angs]
    inside = [side(*q) for q in pts]
    if not any(inside):
        return ""
    k0 = next(i for i in range(720) if not inside[i - 1] and inside[i]) if not all(inside) else 0
    seq = []
    for j in range(720):
        i = (k0 + j) % 720
        if not inside[i]:
            break
        seq.append(pts[i])
    return poly(*[(round(px, 1), round(py, 1)) for px, py in seq])


def lid_line(x, y, r, a, b, grow=5, bulge=0.0):
    k = (b - a) / (2 * r)
    if bulge:
        return clipped(c(x, y, r + grow), p(f"M {x - r} {y + a} Q {x} {y + (a + b) / 2 + 2 * bulge} {x + r} {y + b}"))
    return clipped(c(x, y, r + grow), p(f"M {x - r - 40} {y + a - k * 40} L {x + r + 40} {y + b + k * 40}"))


def move(dx, dy, *els):
    return f'<g transform="translate({dx} {dy})">{"".join(els)}</g>'


# ---------------------------------------------------------------- Shérif Pince (crabe)
def draw():
    s = Scene()
    s.fill("sun", FULL)
    dunes = p("M 0 720 L 70 720 L 92 656 L 210 656 L 232 720 L 420 728 C 560 710 700 744 820 720 "
              "L 840 684 L 920 684 L 938 720 L 1000 720 L 1000 1000 L 0 1000 Z")
    s.tint("orange", clipped(dunes, lin(0, 660, 0, 1000, ((0, 0.55), (1, 1.0)))), cell=12, angle=75)
    M = lambda *els: move(0, 40, *els)
    # Pattes.
    legs = []
    for side in (-1, 1):
        for k, (dx, dy) in enumerate([(0, 0), (20, 50), (36, 98)]):
            bx = 500 + side * (180 - dx)
            by = 670 + dy
            legs.append(tube([(bx, by), (bx + side * 130, by - 10 + k * 10), (bx + side * 190, by + 90 + k * 20)],
                             40, 14))
    s.fill("red", M(*legs))
    s.tint("brown", M(shade("".join(legs), 0, 650, 0, 900, 0.3, 0.8)), cell=10, angle=45)
    # Pince gauche, prête ; pince droite : la télécommande, dégainée.
    s.fill("red", M(tube([(262, 590), (190, 590), (160, 548)], 54, 46)))
    s.fill("red", M(e(150, 506, 54, 62, -20), tube([(126, 470), (120, 432), (146, 412)], 42, 14),
                    tube([(172, 464), (174, 432), (150, 412)], 40, 14)))
    remote = rect(748, 246, 64, 168, r=18, rot=12)
    s.fill("black", M(remote))
    for (x, y), ink in zip([(794, 276), (787, 314), (780, 350)], ["red", "aqua", "pink"]):
        s.fill(ink, M(c(x, y, 11)))
    s.fill("red", M(tube([(700, 630), (800, 600), (800, 490)], 56, 48)))
    s.fill("red", M(e(784, 446, 62, 66, 12), tube([(740, 430), (734, 386), (752, 360)], 44, 14),
                    tube([(824, 420), (830, 380), (812, 356)], 42, 14)))
    s.paper_stroke(11, M(p("M 806 230 Q 788 208 804 186 Q 820 164 802 146")))
    # Carapace.
    stalks = tube([(420, 470), (372, 400), (330, 344)], 34, 26) + tube([(560, 470), (608, 400), (650, 344)], 34, 26)
    s.fill("red", M(stalks))
    shell = p("M 230 610 C 230 500 340 448 490 448 C 640 448 750 500 750 610 C 750 712 640 770 490 770 "
              "C 340 770 230 712 230 610 Z")
    s.fill("red", M(shell))
    s.tint("brown", M(shade(shell, 300, 460, 640, 780, 0.0, 0.85)), cell=10, angle=45)
    # Étoile de shérif.
    sx, sy = 392, 664
    s.fill("sun", M(star(sx, sy, 66, 33), *[c(round(sx + 66 * math.cos(math.radians(-90 + 72 * i))),
                                              round(sy + 66 * math.sin(math.radians(-90 + 72 * i))), 12)
                                            for i in range(5)]))
    s.tint("orange", M(T(0.6, c(sx, sy, 20))), screen="b", cell=7, angle=30)
    # Bouche fermée, décidée.
    s.stroke("black", 12, M(p("M 448 568 L 524 560 Q 542 560 548 574")))
    # Yeux plissés de duel, sourcils froncés.
    for x, y, a, b, sg in [(330, 316, -16, 2, 1), (650, 316, 2, -16, -1)]:
        w, pu, gl = eye(x, y, 48, look=(0.0, 0.3), pupil=0.5)
        s.paper(M(w))
        s.fill("black", M(pu))
        s.paper(M(gl))
        s.fill("red", M(lid(x, y, 48, a, b), lid(x, y, 48, 20, 20, below=True)))
        s.stroke("black", 10, M(lid_line(x, y, 48, a, b)))
        s.stroke("black", 17, M(p(f"M {x - sg * 56} {y - 66} L {x + sg * 50} {y - 38}")))
    # Chapeau de cowboy, posé entre les yeux.
    brim = p("M 330 460 C 360 486 620 486 650 460 C 676 438 680 410 660 400 C 640 436 600 444 490 444 "
             "C 380 444 340 436 320 400 C 300 410 304 438 330 460 Z")
    crown = p("M 400 444 C 396 380 404 330 420 314 C 450 300 470 318 490 330 C 510 318 530 300 560 314 "
              "C 576 330 584 380 580 444 Z")
    s.fill("brown", M(crown, brim))
    s.fill("black", M(clipped(crown, rect(380, 404, 220, 30))))
    s.tint("black", M(shade(crown + brim, 400, 300, 600, 480, 0.0, 0.5)), screen="h", cell=9, angle=45)
    return s.layers()
