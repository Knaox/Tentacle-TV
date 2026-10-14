"""Chargement, l'escargot — sa coquille est un indicateur de chargement."""
import math
from kit import *  # noqa: F401,F403
from scene import Scene


def draw():
    s = Scene()
    s.fill("sun", FULL)
    s.tint("orange", rad(560, 500, 440, ((0, 0.0), (0.55, 0.0), (1, 0.75))), cell=12, angle=15)
    s.fill("black", e(520, 842, 380, 26))
    foot = p("M 140 820 C 146 700 196 598 262 560 C 330 522 372 566 386 640 L 712 704 "
             "C 806 722 866 770 884 822 C 700 846 330 846 140 820 Z")
    for (bx, by), (ex, ey) in [((246, 590), (214, 372)), ((300, 580), (330, 382))]:
        s.fill("mint", tube([(bx, by), ((bx + ex) / 2, (by + ey) / 2 + 20), (ex, ey)], 40, 30))
    s.fill("mint", foot)
    s.tint("teal", shade(foot, 0, 600, 0, 850, 0.0, 0.7), cell=10, angle=45)
    shell = c(568, 496, 232)
    s.fill("pink", shell)
    s.tint("purple", shade(shell, 400, 300, 760, 700, 0.0, 0.7), cell=11, angle=75)
    caps = []
    for i in range(12):
        a = math.radians(-90 + i * 30)
        x1, y1 = 568 + 98 * math.cos(a), 496 + 98 * math.sin(a)
        x2, y2 = 568 + 182 * math.cos(a), 496 + 182 * math.sin(a)
        caps.append(tube([(round(x1), round(y1)), (round(x2), round(y2))], 40, 40))
    s.paper(*caps)
    for i, cap_ in enumerate(caps):
        d = 1 - (i / 11) ** 0.8
        if d > 0.05:
            s.tint("purple", T(round(d, 2), cap_), screen="k", cell=8, angle=30)
    for x, y in [(214, 368), (330, 378)]:
        w, pu, gl = eye(x, y, 40, look=(0.1, 0.25), pupil=0.42)
        s.paper(w)
        s.fill("black", pu)
        s.paper(gl)
        s.fill("mint", clipped(c(x, y, 42), p(f"M {x - 60} {y - 70} L {x + 60} {y - 70} L {x + 60} {y - 4} L {x - 60} {y - 2} Z")))
        s.stroke("black", 8, p(f"M {x - 40} {y - 2} L {x + 40} {y - 4}"))
    s.stroke("black", 10, p("M 236 640 Q 262 660 290 640"))
    s.tint("pink", T(0.7, e(212, 620, 22, 13)), screen="b", cell=7, angle=15)
    return s.layers()
