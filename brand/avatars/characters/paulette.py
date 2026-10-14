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


class Moved:
    """La même scène, chaque dessin passé par une transformation (recadrer un personnage entier)."""

    def __init__(self, s, transform):
        self.s, self.t = s, transform

    def w(self, *els):
        return f'<g transform="{self.t}">{"".join(els)}</g>'

    def fill(self, ink, *els, **k):
        return self.s.fill(ink, self.w(*els), **k)

    def over(self, ink, *els):
        return self.s.over(ink, self.w(*els))

    def stroke(self, ink, width, *els, **k):
        return self.s.stroke(ink, width, self.w(*els), **k)

    def paper(self, *els):
        return self.s.paper(self.w(*els))

    def paper_stroke(self, width, *els):
        return self.s.paper_stroke(width, self.w(*els))

    def tint(self, ink, *els, **k):
        return self.s.tint(ink, self.w(*els), **k)


# ---------------------------------------------------------------- Paulette (tortue de mer)
def draw():
    s = Scene()
    s.fill("mint", FULL)
    s.tint("teal", lin(0, 600, 0, 1000, ((0, 0.0), (1, 0.6))), cell=12, angle=75)
    for x, y, r in [(110, 420, 15), (92, 360, 10), (112, 308, 7)]:
        s.paper_stroke(7, c(x, y, r))
    skin = "sun"
    SH = (140, 420, 420, 640, 0.0, 0.6)
    spot = lambda *xy: "".join(e(x, y, rx, rx * 0.7, 20) for x, y, rx in xy)
    t = Moved(s, "translate(0 44) translate(500 470) scale(1.06) translate(-500 -470)")
    # Nageoires de l'autre côté et arrière (sous la carapace).
    far_fl = tube([(600, 270), (690, 190), (742, 156)], 92, 30)
    rear = tube([(820, 580), (904, 646)], 80, 34)
    t.fill(skin, far_fl, rear)
    t.tint("green", T(0.55, far_fl, rear), screen="k", cell=9, angle=30)
    # Grande nageoire avant, en aile.
    FLIP_D = ("M 470 600 C 356 584 248 640 190 730 C 172 760 184 794 212 792 C 262 764 304 752 344 748 "
              "C 424 736 500 712 592 686 Z")
    t.fill(skin, p(FLIP_D))
    t.over("green", hexa(440, 628, 15, 10), hexa(396, 630, 13, 20), hexa(352, 640, 12, 5), hexa(310, 656, 11, 15),
           hexa(470, 662, 12, 0), hexa(420, 668, 11, 25), hexa(272, 680, 10, 0))
    t.tint("green", shade(p(FLIP_D), 0, 640, 0, 780, 0.0, 0.8), screen="k", cell=9, angle=30)
    # Cou épais, qui sort de sous la carapace.
    neck = tube([(500, 548), (420, 540), (360, 532)], 168, 150)
    t.fill(skin, neck)
    t.over("green", spot((404, 590, 11), (448, 566, 9), (372, 486, 8)))
    t.tint("green", shade(neck, *SH), screen="k", cell=9, angle=30)
    t.stroke("orange", 10, p("M 396 470 Q 380 530 396 600"))
    # Carapace.
    shell = e(676, 420, 320, 214, -14)
    t.fill("teal", shell)
    inner = e(684, 412, 282, 180, -14)
    cells = []
    for row in range(-2, 3):
        for col in range(-3, 4):
            cells.append(hexa(684 + col * 128 + (64 if row % 2 else 0), 412 + row * 112, 60, 30))
    t.fill("green", clipped(inner, rot(-14, 684, 412, *cells)))
    t.tint("teal", shade(shell, 540, 260, 860, 640, 0.0, 0.85), screen="s", cell=10, angle=45)
    # Tête de trois-quarts : ovale allongée, plaques sur le dessus, bec court un peu crochu.
    head = e(252, 518, 160, 106, -10)
    hook = poly((98, 534), (130, 552), (106, 586))
    t.fill(skin, head, hook)
    plates = "".join(hexa(x, y, 30, 0) for x, y in
                     [(168, 466), (232, 444), (300, 436), (366, 452)])
    t.fill("orange", clipped(head, plates))
    t.tint("green", shade(head, *SH), screen="k", cell=9, angle=30)
    t.tint("green", T(0.7, clipped(head, plates)), screen="k", cell=9, angle=30)
    # Yeux lourds, sereins.
    for x, y, r in [(286, 494, 32), (196, 488, 22)]:
        w, pu, gl = eye(x, y, r, look=(-0.3, 0.3), pupil=0.54)
        t.paper(w)
        t.fill("black", pu)
        t.paper(gl)
        lp = lid(x, y, r, -2, -2, bulge=-8)
        t.fill(skin, lp)
        t.tint("green", shade(lp, *SH), screen="k", cell=9, angle=30)
        t.stroke("black", 9, lid_line(x, y, r, -2, -2, bulge=-8))
    t.stroke("black", 10, p("M 118 584 Q 190 606 278 594 Q 304 590 318 574"))
    t.tint("pink", T(0.65, e(338, 576, 24, 14)), screen="b", cell=8, angle=15)
    # Lunettes rondes de lecture, posées sur le bec.
    t.stroke("black", 11, c(264, 548, 27), e(178, 540, 17, 23), p("M 196 534 Q 214 524 238 540"),
             p("M 290 542 L 364 526"))
    t.paper_stroke(8, p("M 254 554 L 268 536"), p("M 172 548 L 182 532"))
    return s.layers()
