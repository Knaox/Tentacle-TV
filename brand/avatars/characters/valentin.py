"""Valentin — Pleure à toutes les comédies romantiques. Même aux mauvaises."""
import math
from kit import *  # noqa: F401,F403
from scene import Scene


# ---------------------------------------------------------------- petits outils du module
def rot(a, cx, cy, *els):
    return f'<g transform="rotate({a} {cx} {cy})">{"".join(els)}</g>'


def heart(x, y, s, a=0):
    d = (f"M {x} {y + 0.85 * s} C {x - 0.15 * s} {y + 0.65 * s} {x - s} {y + 0.2 * s} {x - s} {y - 0.25 * s} "
         f"C {x - s} {y - 0.7 * s} {x - 0.45 * s} {y - 0.85 * s} {x} {y - 0.4 * s} "
         f"C {x + 0.45 * s} {y - 0.85 * s} {x + s} {y - 0.7 * s} {x + s} {y - 0.25 * s} "
         f"C {x + s} {y + 0.2 * s} {x + 0.15 * s} {y + 0.65 * s} {x} {y + 0.85 * s} Z")
    return rot(a, x, y, p(d))


def drop(x, y, r):
    """Goutte, pointe en haut."""
    return p(f"M {x} {y - 2.1 * r} C {x + 0.4 * r} {y - 1.2 * r} {x + r} {y - 0.6 * r} {x + r} {y} "
             f"A {r} {r} 0 1 1 {x - r} {y} C {x - r} {y - 0.6 * r} {x - 0.4 * r} {y - 1.2 * r} {x} {y - 2.1 * r} Z")


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


def spike(x, y, ang, ln=40, w=34):
    """Épine : base centrée en (x, y), pointe dans la direction `ang` (degrés)."""
    a = math.radians(ang)
    ux, uy = math.cos(a), math.sin(a)
    return poly((round(x - uy * w / 2, 1), round(y + ux * w / 2, 1)), (round(x + ux * ln, 1), round(y + uy * ln, 1)),
                (round(x + uy * w / 2, 1), round(y - ux * w / 2, 1)))


# ---------------------------------------------------------------- Valentin (hippocampe)
def draw():
    s = Scene()
    s.fill("pink", FULL)
    s.tint("red", rad(500, 480, 540, ((0, 0.0), (0.6, 0.0), (1, 0.6))), cell=12, angle=15)
    s.paper(heart(808, 214, 44, 14), heart(874, 322, 24, -12))
    head = e(566, 262, 126, 98, -28)
    snout = tube([(492, 300), (404, 348), (320, 396)], 82, 52)
    lip = e(314, 400, 18, 34, -30)
    body = p("M 498 324 C 468 388 408 428 394 508 C 378 608 420 702 520 750 L 612 744 "
             "C 676 664 708 548 696 440 C 690 370 690 300 668 244 Z")
    crest = "".join(spike(x, y, a, 44, 38) for x, y, a in
                    [(604, 176, -70), (656, 206, -30), (690, 268, -10), (700, 340, 0), (702, 410, 5)])
    coronet = spike(548, 178, -100, 54, 36) + spike(580, 176, -60, 46, 32)
    FIN_D = "M 692 476 Q 806 470 818 566 Q 806 628 700 646 Z"
    s.fill("orange", crest, coronet, p(FIN_D))
    s.paper_stroke(9, clipped(p(FIN_D), p("M 700 506 L 830 506 M 700 552 L 840 566 M 700 598 L 830 624")))
    s.fill("sun", body, head, snout, lip)
    SH = (380, 240, 700, 760, 0.0, 0.85)
    s.tint("orange", shade(body + head + snout + lip, *SH), cell=10, angle=45)
    s.stroke("orange", 11, clipped(body, p("M 380 490 Q 450 512 530 494 M 374 560 Q 452 586 540 566 "
                                           "M 384 630 Q 462 660 556 640 M 424 696 Q 494 722 584 704")))
    # Mouchoir, pincé dans la boucle de la queue, qui flotte.
    tissue = poly((462, 806), (432, 762), (396, 748), (378, 708), (334, 724), (302, 700), (282, 746), (302, 780),
                  (272, 814), (302, 848), (348, 838), (382, 870), (424, 842), (462, 828))
    s.paper(tissue)
    s.tint("lav", shade(tissue, 300, 720, 460, 860, 0.0, 0.55), screen="t", cell=8, angle=30)
    s.stroke("lav", 7, p("M 334 724 L 352 772 L 302 780"), p("M 352 772 L 400 790 L 396 748"),
             p("M 348 838 L 372 806 L 420 812"))
    s.over("aqua", c(330, 806, 13), c(402, 830, 9))
    tail = tube([(572, 724), (592, 810), (546, 872), (466, 874), (420, 826), (440, 772), (494, 772), (504, 818),
                 (472, 834)], 108, 22)
    s.fill("sun", tail)
    s.tint("orange", shade(tail, 420, 740, 600, 880, 0.2, 0.9), cell=10, angle=45)
    # Œil embué, sourcil en accent circonflexe.
    ex, ey, er = 572, 270, 56
    w, pu, gl = eye(ex, ey, er, look=(-0.25, -0.3), pupil=0.58)
    s.paper(w)
    s.fill("black", pu)
    s.paper(gl, c(ex - 22, ey + 6, 10))
    s.over("aqua", clipped(c(ex, ey, er), rect(ex - 90, ey + 16, 180, 90)))
    lp = lid(ex, ey, er, -50, -14)
    s.fill("sun", lp)
    s.tint("orange", shade(lp, *SH), cell=10, angle=45)
    s.stroke("black", 9, lid_line(ex, ey, er, -50, -14))
    s.stroke("black", 14, p(f"M {ex - 56} {ey - 54} L {ex - 18} {ey - 90} L {ex + 42} {ey - 66}"))
    s.stroke("aqua", 16, p(f"M {ex - 30} {ey + er - 6} Q {ex - 44} {ey + 84} {ex - 46} {ey + 104}"))
    s.fill("aqua", drop(ex - 46, ey + 140, 30), drop(468, 468, 14))
    s.tint("red", T(0.7, e(626, 336, 32, 20), e(330, 384, 22, 30)), screen="b", cell=8, angle=15)
    return s.layers()
