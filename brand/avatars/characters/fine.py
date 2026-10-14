"""Fine — Flotte devant les documentaires. Se trouve très photogénique."""
import math
from kit import *  # noqa: F401,F403
from scene import Scene


def sparkle(x, y, r, k=0.2):
    """Étincelle à quatre branches, côtés creusés."""
    q = r * k
    return p(f"M {x} {y - r} Q {x + q} {y - q} {x + r} {y} Q {x + q} {y + q} {x} {y + r} "
             f"Q {x - q} {y + q} {x - r} {y} Q {x - q} {y - q} {x} {y - r} Z")


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


def wave(x0, y0, steps, dy, amp, ph, freq=1.0, drift=0.0):
    return [(round(x0 + amp * math.sin(ph + i * freq) + drift * i, 1), round(y0 + i * dy, 1)) for i in range(steps)]


def ell_d(x, y, rx, ry):
    return f"M {x - rx} {y} A {rx} {ry} 0 1 0 {x + rx} {y} A {rx} {ry} 0 1 0 {x - rx} {y} Z"


def eo(*ds):
    """Chemin pair-impair : la première forme, trouée par les suivantes."""
    return f'<path fill-rule="evenodd" d="{" ".join(ds)}"/>'


# ---------------------------------------------------------------- Fine (méduse)
def _bell_path():
    d = "M 245 470 C 228 300 345 150 500 150 C 655 150 772 300 755 470 "
    n = 6
    w = (755 - 245) / n
    for i in range(n):
        x1 = 755 - (i + 1) * w
        d += f"Q {755 - (i + 0.5) * w:.1f} 518 {x1:.1f} 470 "
    return d + "Z"


def draw():
    s = Scene()
    # Fond : bordeaux, ouvert en trame au centre — le projecteur braqué sur la star.
    s.tint("burgundy", rad(500, 400, 560, ((0, 0.16), (0.42, 0.42), (0.78, 0.92), (1, 1.0))), cell=12, angle=15)
    s.tint("pink", rad(500, 380, 330, ((0, 0.35), (1, 0.0))), screen="g", cell=10, angle=65)
    R = lambda *els: f'<g transform="translate(500 360) rotate(-7) scale(1.12) translate(-500 -360)">{"".join(els)}</g>'
    BELL_D = _bell_path()
    BELL = p(BELL_D)
    # Rubans (sous la cloche), translucides : ils se croisent.
    ribbons = [
        (wave(412, 470, 7, 95, 48, 0.0, 1.0, -8), 78, 26, "pink"),
        (wave(566, 470, 7, 95, 52, 2.7, 1.0, 4), 74, 26, "violet"),
        (wave(486, 470, 7, 95, 40, 1.4, 1.1, 10), 68, 22, "lav"),
    ]
    thin = [(wave(x, 476, 7, 92, 22, ph, 0.8, dr), ink) for x, ph, dr, ink in
            [(296, 0.6, -14, "lav"), (346, 2.2, -6, "violet"), (652, 1.0, 8, "violet"), (706, 2.6, 14, "lav")]]
    for pts, ink in thin:
        s.over(ink, R(tube(pts, 18, 9)))
    for pts, w0, w1, ink in ribbons:
        s.over(ink, R(tube(pts, w0, w1)))
    # La cloche : lavande ; une gelée rose au bord, une jupe violette, qui se croisent.
    s.fill("lav", R(BELL))
    s.over("pink", R(clipped(BELL, eo(BELL_D, ell_d(532, 392, 214, 204)))))
    s.over("violet", R(clipped(BELL, p("M 200 446 Q 500 414 800 446 L 800 560 L 200 560 Z"))))
    SH = (390, 240, 720, 540, 0.0, 0.5)
    s.tint("violet", R(shade(BELL, *SH)), screen="s", cell=10, angle=45)
    # Reflet brillant.
    s.paper_stroke(26, R(p("M 300 366 Q 298 252 396 190")))
    s.paper(R(c(304, 414, 13)))
    s.paper(R(sparkle(668, 214, 38)))
    # Visage : yeux mi-clos de star qui pose, un sourcil levé, sourire en coin.
    for x, y, r, a, b in [(428, 368, 46, -2, 4), (578, 362, 46, 4, -4)]:
        w, pu, gl = eye(x, y, r, look=(0.3, 0.5), pupil=0.56)
        s.paper(R(w))
        s.fill("black", R(pu))
        s.paper(R(gl))
        lp = lid(x, y, r, a, b)
        s.fill("lav", R(lp))
        s.tint("violet", R(shade(lp, *SH)), screen="s", cell=10, angle=45)
        s.stroke("black", 11, R(lid_line(x, y, r, a, b)))
    s.stroke("black", 9, R(p("M 382 368 L 362 352")), R(p("M 624 358 L 644 340")))
    s.stroke("black", 11, R(p("M 394 308 Q 428 298 462 310")), R(p("M 544 286 Q 580 254 620 278")))
    s.tint("pink", T(0.75, R(e(398, 432, 32, 17), e(614, 424, 32, 17))), screen="b", cell=8, angle=15)
    s.stroke("black", 11, R(p("M 478 446 Q 514 462 554 436")), R(p("M 550 424 Q 564 436 558 450")))
    return s.layers()
