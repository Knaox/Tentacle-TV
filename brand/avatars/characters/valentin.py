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
    # Silhouette : tête penchée, nuque arquée, gorge creusée, ventre en avant — un S.
    SIL = ("M 482 236 C 490 186 524 152 568 148 C 616 144 654 170 664 212 "
           "C 670 244 662 270 672 304 C 700 392 708 494 690 584 C 676 654 640 712 600 752 "
           "L 530 756 C 478 728 440 668 440 592 C 440 512 466 456 512 420 "
           "C 534 404 544 382 536 360 C 526 340 504 332 486 332 Z")
    snout = tube([(504, 292), (430, 318), (358, 350), (302, 376)], 94, 42)
    fillet = (p("M 430 280 Q 480 262 494 196 L 530 300 Z")
              + p("M 430 356 Q 494 352 540 392 L 530 300 Z"))
    flare = e(292, 381, 17, 32, -24)
    crest = "".join(spike(x, y, ang, 44, 36) for x, y, ang in
                    [(668, 232, -20), (686, 330, -8), (704, 420, 0), (706, 500, 4)])
    coronet = spike(544, 164, -108, 52, 34) + spike(578, 154, -82, 58, 34) + spike(612, 162, -56, 48, 32)
    FIN_D = "M 688 540 Q 800 534 812 620 Q 800 676 676 690 Z"
    s.fill("orange", crest, coronet, p(FIN_D))
    s.paper_stroke(9, clipped(p(FIN_D), p("M 690 568 L 830 566 M 690 612 L 840 624 M 690 656 L 830 680")))
    body = p(SIL) + snout + fillet + flare
    s.fill("sun", body)
    SH = (420, 200, 700, 760, 0.0, 0.85)
    s.tint("orange", shade(body, *SH), cell=10, angle=45)
    # Joue (opercule) qui détache la tête du cou, anneaux du ventre.
    s.stroke("orange", 11, p("M 540 352 Q 612 352 654 290"))
    s.stroke("orange", 11, clipped(p(SIL), p("M 430 470 Q 520 492 620 466 M 430 540 Q 530 566 640 540 "
                                             "M 434 610 Q 530 638 650 610 M 460 680 Q 540 704 640 680")))
    # Mouchoir à liseré rouge, pincé dans la spirale de la queue.
    HANKY_D = ("M 462 822 C 446 760 430 690 404 610 Q 380 640 344 626 Q 312 612 290 640 Q 262 664 222 652 "
               "Q 244 690 238 724 Q 230 760 256 784 Q 278 808 268 852 Q 312 856 350 846 Q 404 832 462 822 Z")
    hanky = p(HANKY_D)
    s.paper(hanky)
    s.tint("lav", shade(hanky, 300, 640, 460, 860, 0.0, 0.5), screen="t", cell=8, angle=30)
    s.stroke("red", 10, clipped(hanky, '<g transform="translate(336 732) scale(0.8) translate(-336 -732)">'
                                       f'<path d="{HANKY_D}"/></g>'))
    s.stroke("lav", 8, p("M 448 800 Q 422 756 386 726"), p("M 446 812 Q 412 802 366 798"))
    s.over("aqua", c(330, 716, 15), c(380, 784, 11))
    tail = tube([(566, 740), (590, 818), (556, 882), (476, 894), (424, 852), (436, 790), (488, 780), (504, 826),
                 (474, 844)], 100, 22)
    s.fill("sun", tail)
    s.tint("orange", shade(tail, 420, 760, 600, 890, 0.2, 0.9), cell=10, angle=45)
    # Œil embué, dans la tête ; sourcil en accent circonflexe.
    ex, ey, er = 576, 246, 48
    w, pu, gl = eye(ex, ey, er, look=(-0.3, -0.3), pupil=0.6)
    s.paper(w)
    s.fill("black", pu)
    s.paper(gl, c(ex - 18, ey + 6, 9))
    s.over("aqua", clipped(c(ex, ey, er), rect(ex - 80, ey + 14, 160, 80)))
    lp = lid(ex, ey, er, -42, -12)
    s.fill("sun", lp)
    s.tint("orange", shade(lp, *SH), cell=10, angle=45)
    s.stroke("black", 9, lid_line(ex, ey, er, -42, -12))
    s.stroke("black", 12, p(f"M {ex - 48} {ey - 44} L {ex - 14} {ey - 78} L {ex + 40} {ey - 60}"))
    s.stroke("aqua", 15, p(f"M {ex - 28} {ey + er - 6} Q {ex - 40} {ey + 76} {ex - 42} {ey + 96}"))
    s.fill("aqua", drop(ex - 42, ey + 130, 28), drop(484, 468, 14))
    s.tint("red", T(0.7, e(628, 300, 28, 18), e(312, 370, 22, 26)), screen="b", cell=8, angle=15)
    s.fill("black", e(281, 386, 6, 14, -24))
    return s.layers()
