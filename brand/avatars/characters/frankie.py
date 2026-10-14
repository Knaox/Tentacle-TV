"""Frankie — Cousu de bouts de films. Aime tous les genres à la fois."""
import math
from kit import *  # noqa: F401,F403
from scene import Scene


# ---------------------------------------------------------------- Frankie
def draw():
    s = Scene()
    s.fill("orange", FULL)
    s.tint("red", rad(500, 480, 640, ((0, 0.0), (0.5, 0.0), (1, 0.8))), cell=12, angle=75)
    for bolt in ("M 130 150 L 190 150 L 150 220 L 210 220 L 120 330 L 150 240 L 100 240 Z",
                 "M 850 560 L 900 560 L 870 620 L 920 620 L 840 720 L 866 640 L 822 640 Z"):
        s.fill("sun", p(bolt))
    jacket = p("M 110 1000 C 130 900 220 860 330 850 L 670 850 C 780 860 870 900 890 1000 Z")
    s.fill("black", jacket)
    s.paper(poly((380, 850), (500, 960), (620, 850)))
    neck = rect(392, 700, 216, 190)
    s.fill("mint", neck)
    s.tint("teal", shade(neck, 0, 760, 0, 880, 0.3, 0.9), cell=10, angle=45)
    for x, nx in ((296, 272), (614, 694)):
        bolt = rect(x, 788, 90, 48, r=8)
        s.paper(bolt)
        s.tint("lav", shade(bolt, 0, 788, 0, 840, 0.1, 0.9), screen="m", cell=8, angle=30)
        nut = rect(nx, 764, 34, 96, r=8)
        s.paper(nut)
        s.tint("lav", T(0.75, nut), screen="m", cell=8, angle=30)
    # Les mains : deux index qui se cherchent (timide).
    for sx in (-1, 1):
        fist = e(500 + sx * 112, 940, 70, 56, sx * 10)
        s.fill("mint", fist, tube([(500 + sx * 70, 906), (500 + sx * 16, 888)], 34, 30))
        s.tint("teal", shade(fist, 0, 900, 0, 1000, 0.1, 0.8), cell=10, angle=45)
    head = p("M 272 290 L 728 278 L 740 690 Q 740 770 660 772 L 340 772 Q 262 770 262 690 Z")
    ears = rect(230, 470, 50, 120, r=16) + rect(722, 480, 46, 110, r=16)
    s.fill("mint", ears, head)
    s.tint("teal", shade(head + ears, 380, 0, 760, 0, 0.0, 0.75), cell=10, angle=45)
    # Une pièce rapportée, cousue.
    pc = ((604, 566), (716, 552), (722, 694), (614, 704))
    s.fill("lav", poly(*pc))
    s.tint("purple", shade(poly(*pc), 600, 0, 730, 0, 0.0, 0.6), screen="q", cell=9, angle=30)
    for (x0, y0), (x1, y1) in [(pc[0], pc[1]), (pc[3], pc[0])]:
        s.stroke("black", 8, p(f"M {x0} {y0} L {x1} {y1}"), knock=False)
        dx, dy = x1 - x0, y1 - y0
        d = math.hypot(dx, dy)
        nx, ny = -dy / d * 16, dx / d * 16
        for t in (0.2, 0.5, 0.8):
            x, y = x0 + dx * t, y0 + dy * t
            s.stroke("black", 8, p(f"M {x - nx:.0f} {y - ny:.0f} L {x + nx:.0f} {y + ny:.0f}"), knock=False)
    hair = p("M 258 330 C 250 230 300 176 380 168 L 630 160 C 710 166 752 220 744 330 L 744 348 L 258 360 Z")
    s.fill("black", hair)
    # Couture du front.
    s.stroke("black", 9, p("M 318 404 L 548 392"), knock=False)
    for x in range(340, 548, 42):
        s.stroke("black", 9, p(f"M {x - 2} 384 L {x + 4} 418"), knock=False)
    # Yeux de deux tailles, qui fuient vers le bas.
    for x, y, r, lid in [(400, 536, 58, (-18, -30)), (598, 528, 38, (-10, -16))]:
        w, pu, gl = eye(x, y, r, look=(-0.45, 0.6), pupil=0.46)
        s.paper(w)
        s.fill("black", pu)
        s.paper(gl)
        s.fill("mint", clipped(c(x, y, r + 2), p(f"M {x - r - 30} {y - r - 40} L {x + r + 30} {y - r - 40} "
                                                 f"L {x + r + 30} {y + lid[1]} L {x - r - 30} {y + lid[0]} Z")))
    s.stroke("black", 18, p("M 338 470 Q 400 466 448 444"), p("M 562 456 Q 600 464 638 482"))
    # Sourire timide, de travers.
    s.stroke("black", 11, p("M 456 664 Q 486 682 528 662"), knock=False)
    s.stroke("black", 8, p("M 528 662 L 540 650"), knock=False)
    s.fill("pink", e(352, 636, 44, 22), e(566, 630, 30, 16))
    s.layer_opts("pink", None, density=0.6)
    return s.layers()
