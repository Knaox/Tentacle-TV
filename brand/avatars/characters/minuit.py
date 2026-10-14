"""Minuit, le hibou — lunettes 3D sous la lune, à la dernière séance."""
from kit import *  # noqa: F401,F403
from scene import Scene


def draw():
    s = Scene()
    s.fill("blue", FULL)
    s.tint("fed", lin(0, 0, 0, 1000, ((0, 0.9), (0.7, 0.0))), cell=12, angle=75)
    moon = c(808, 196, 74)
    s.paper(moon)
    s.tint("yellow", T(0.45, moon), screen="m", cell=9, angle=20)
    for x, y, r in [(150, 220, 7), (232, 140, 5), (700, 90, 6), (120, 420, 5), (880, 400, 6), (300, 80, 4)]:
        s.paper(c(x, y, r))
    s.stroke("brown", 46, p("M 60 880 Q 500 840 960 900"))
    body = p("M 500 262 C 660 262 742 420 742 600 C 742 760 640 870 500 870 C 360 870 258 760 258 600 "
             "C 258 420 340 262 500 262 Z")
    tufts = poly((330, 380), (300, 220), (440, 300)) + poly((670, 380), (700, 220), (560, 300))
    s.fill("brown", tufts, body)
    s.tint("black", shade(body, 0, 600, 0, 900, 0.0, 0.6), cell=10, angle=45)
    wings = e(292, 650, 70, 170, 12) + e(708, 650, 70, 170, -12)
    s.fill("burgundy", wings)
    belly = e(500, 700, 165, 160)
    s.fill("cream", belly)
    for y in (640, 700, 760):
        for x in range(420, 600, 46):
            s.stroke("brown", 9, p(f"M {x - 14} {y} L {x} {y + 14} L {x + 14} {y}"))
    disc = c(415, 462, 112) + c(585, 462, 112)
    s.fill("peach", disc)
    s.tint("orange", T(0.5, disc), screen="d", cell=9, angle=60)
    for x in (415, 585):
        w, pu, gl = eye(x, 466, 64, look=(0.15, 0.1), pupil=0.42)
        s.paper(w)
        s.fill("black", pu)
        s.paper(gl)
    s.over("red", rect(318, 396, 186, 136, r=26))
    s.over("aqua", rect(496, 396, 186, 136, r=26))
    s.stroke("black", 20, rect(318, 396, 186, 136, r=26), rect(496, 396, 186, 136, r=26))
    s.stroke("black", 16, p("M 318 440 L 262 420"), p("M 682 440 L 738 420"))
    s.fill("sun", poly((476, 548), (524, 548), (500, 600)))
    for x in (440, 560):
        s.stroke("sun", 16, p(f"M {x - 26} 900 L {x} 860 L {x + 26} 900"), p(f"M {x} 860 L {x} 908"))
    return s.layers()
