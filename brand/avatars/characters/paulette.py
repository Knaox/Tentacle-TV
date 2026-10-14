"""Paulette — Ne zappe jamais. Les films de trois heures, c'est son rythme de croisière."""
import math
from kit import *  # noqa: F401,F403
from scene import Scene


# ---------------------------------------------------------------- petits outils du module
def rot(a, cx, cy, *els):
    return f'<g transform="rotate({a} {cx} {cy})">{"".join(els)}</g>'


def hexa(x, y, r, a0=0.0):
    return poly(*[(round(x + r * math.cos(math.radians(a0 + 60 * i)), 1),
                   round(y + r * math.sin(math.radians(a0 + 60 * i)), 1)) for i in range(6)])


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


# ---------------------------------------------------------------- Paulette (tortue de mer)
def draw():
    s = Scene()
    s.fill("mint", FULL)
    s.tint("teal", lin(0, 600, 0, 1000, ((0, 0.0), (1, 0.6))), cell=12, angle=75)
    for x, y, r in [(170, 330, 18), (142, 266, 12), (176, 212, 8)]:
        s.paper_stroke(7, c(x, y, r))
    skin = "sun"
    far_fl = tube([(700, 330), (790, 250), (866, 214)], 100, 36)
    rear = tube([(870, 540), (930, 580)], 70, 30)
    s.fill(skin, far_fl, rear)
    s.tint("green", T(0.55, far_fl, rear), screen="k", cell=9, angle=30)
    shell = e(640, 450, 280, 200, -18)
    s.fill("teal", shell)
    inner = e(646, 440, 244, 168, -18)
    cells = []
    for row in range(-2, 3):
        for col in range(-3, 4):
            x = 646 + col * 128 + (64 if row % 2 else 0)
            y = 440 + row * 112
            cells.append(hexa(x, y, 60, 30))
    s.fill("green", clipped(inner, rot(-18, 646, 440, *cells)))
    s.tint("teal", shade(shell, 520, 280, 820, 640, 0.0, 0.85), screen="s", cell=10, angle=45)
    # Cou, tête, nageoire avant.
    neck = tube([(620, 540), (520, 520)], 200, 210)
    head = e(372, 468, 186, 160, -4)
    SH = (260, 330, 520, 640, 0.0, 0.6)
    s.fill(skin, neck, head)
    s.tint("green", shade(neck + head, *SH), screen="k", cell=9, angle=30)
    FLIP_D = ("M 470 596 C 380 604 270 656 200 736 C 178 762 184 792 210 790 C 262 760 304 746 344 740 "
              "C 424 726 500 702 590 680 Z")
    s.fill(skin, p(FLIP_D))
    s.over("green", e(446, 640, 22, 14, -12), e(372, 662, 18, 12, -20), e(306, 694, 14, 10, -32))
    s.tint("green", shade(p(FLIP_D), 0, 640, 0, 770, 0.0, 0.8), screen="k", cell=9, angle=30)
    # Yeux lourds, sereins, au-dessus des lunettes.
    for x, y, r, a, b in [(296, 428, 44, 6, 0), (448, 422, 48, 0, 6)]:
        w, pu, gl = eye(x, y, r, look=(0.05, 0.3), pupil=0.5)
        s.paper(w)
        s.fill("black", pu)
        s.paper(gl)
        lp = lid(x, y, r, a, b, bulge=-12)
        s.fill(skin, lp)
        s.tint("green", shade(lp, *SH), screen="k", cell=9, angle=30)
        s.stroke("black", 9, lid_line(x, y, r, a, b, bulge=-12))
    s.stroke("black", 10, p("M 292 592 Q 374 628 466 586"), p("M 284 582 Q 286 594 296 598"),
             p("M 474 576 Q 474 590 462 594"))
    s.tint("pink", T(0.65, e(238, 572, 28, 16), e(516, 560, 30, 16)), screen="b", cell=8, angle=15)
    # Lunettes rondes de lecture, tout au bout du bec.
    s.stroke("black", 12, c(302, 530, 34), c(448, 526, 36), p("M 336 526 Q 374 508 412 522"),
             p("M 484 522 L 562 500"))
    s.paper_stroke(9, p("M 288 536 L 306 514"), p("M 432 532 L 452 510"))
    return s.layers()
