"""Bambou — Refait toutes les chorégraphies des films de kung-fu. Le salon en garde des traces."""
import math
from kit import *  # noqa: F401,F403
from scene import Scene


def _lid(x, y, r, a, b):
    """Paupière : ce qui, dans l'œil, est au-dessus de la droite (x-r, y+a) → (x+r, y+b)."""
    return clipped(c(x, y, r + 3), p(f"M {x - r - 40} {y - r - 60} L {x + r + 40} {y - r - 60} "
                                     f"L {x + r + 40} {y + b} L {x - r - 40} {y + a} Z"))


# ---------------------------------------------------------------- Bambou
def _ribbon(pts, w0, w1, notch=0.6):
    """Pan de tissu : bande effilée, bout fendu en V."""
    sp = tube_pts(pts)
    L, R = [], []
    m = len(sp)
    for i, (x, y) in enumerate(sp):
        a, b = sp[max(0, i - 1)], sp[min(m - 1, i + 1)]
        dx, dy = b[0] - a[0], b[1] - a[1]
        d = math.hypot(dx, dy) or 1
        nx, ny = -dy / d, dx / d
        ww = (w0 + (w1 - w0) * i / (m - 1)) / 2
        L.append((x + nx * ww, y + ny * ww))
        R.append((x - nx * ww, y - ny * ww))
    (ex, ey), (px, py) = sp[-1], sp[-3]
    dx, dy = ex - px, ey - py
    d = math.hypot(dx, dy) or 1
    tip = (ex - dx / d * w1 * notch, ey - dy / d * w1 * notch)
    pts_ = L + [tip] + R[::-1]
    return p("M " + " L ".join(f"{x:.1f} {y:.1f}" for x, y in pts_) + " Z")


def draw():
    s = Scene()
    s.fill("yellow", FULL)
    rays = ""
    for i in range(14):
        a0 = math.radians(i * 360 / 14)
        a1 = a0 + math.radians(360 / 28)
        rays += poly((500, 470), (round(500 + 900 * math.cos(a0)), round(470 + 900 * math.sin(a0))),
                     (round(500 + 900 * math.cos(a1)), round(470 + 900 * math.sin(a1))))
    s.tint("orange", T(0.55, rays), cell=11, angle=15)
    # Traits de vitesse autour de la patte levée.
    s.stroke("orange", 16, p("M 118 470 Q 92 560 112 650"), p("M 74 520 Q 60 580 74 640"))
    # Corps.
    body = e(500, 980, 300, 250)
    s.paper(body)
    s.fill("black", p("M 160 1000 C 180 820 300 740 400 740 L 600 740 C 700 740 820 820 840 1000 Z"))
    s.paper(e(500, 990, 190, 170))
    # Oreilles.
    s.fill("black", c(285, 255, 88), c(715, 255, 88))
    # Pans du bandeau, qui volent derrière la tête.
    s.fill("red", _ribbon([(740, 318), (800, 262), (850, 250), (892, 214)], 58, 50),
           _ribbon([(740, 336), (812, 350), (850, 392), (900, 386)], 54, 46))
    # Tête.
    head = e(500, 470, 282, 248)
    s.paper(head)
    s.tint("black", shade(head, 330, 300, 700, 760, 0.0, 0.5), screen="g", cell=9, angle=45)
    # Bandeau rouge et son nœud.
    s.fill("red", clipped(head, p("M 180 300 Q 500 236 820 300 L 820 362 Q 500 298 180 362 Z")))
    s.fill("red", e(764, 326, 34, 40, -20))
    s.tint("burgundy", T(0.7, e(764, 326, 34, 40, -20)), screen="k", cell=7, angle=30)
    # Taches des yeux, sourcils froncés.
    for x, sg in ((390, 1), (610, -1)):
        patch = e(x, 470, 74, 98, 34 * sg) + poly((x - 92 * sg, 368), (x + 70 * sg, 420), (x + 62 * sg, 450), (x - 90 * sg, 412))
        s.fill("black", patch)
        w, pu, gl = eye(x + 6 * sg, 452, 34, look=(0.4 * sg, 0.1), pupil=0.5)
        s.paper(w)
        s.fill("black", pu)
        s.paper(gl)
        s.fill("black", _lid(x + 6 * sg, 452, 34, -26 if sg > 0 else 6, 6 if sg > 0 else -26))
    # Museau, nez, bouche serrée.
    s.fill("black", p("M 456 548 Q 500 536 544 548 Q 540 584 500 596 Q 460 584 456 548 Z"))
    s.stroke("black", 10, p("M 500 594 L 500 620"), p("M 462 632 Q 500 618 538 632"))
    # Patte levée en garde, poing serré.
    s.fill("black", tube([(320, 920), (214, 820), (180, 680), (196, 560)], 128, 102))
    s.fill("black", e(200, 516, 52, 90, -8))
    s.fill("black", c(690, 860, 78))
    s.paper_stroke(9, p("M 650 840 Q 690 830 724 846"), p("M 656 876 Q 692 866 722 880"))
    return s.layers()
