"""Orbite — A vu tous les films de l'espace. Les trouve tous faux."""
from kit import *  # noqa: F401,F403
from scene import Scene


def _rot(ang, cx, cy, *els):
    return f'<g transform="rotate({ang} {cx} {cy})">{"".join(els)}</g>'


def _sparkle(x, y, r):
    """Étincelle à quatre branches."""
    k = r * 0.22
    return p(f"M {x} {y - r} Q {x + k} {y - k} {x + r} {y} Q {x + k} {y + k} {x} {y + r} "
             f"Q {x - k} {y + k} {x - r} {y} Q {x - k} {y - k} {x} {y - r} Z")


# ---------------------------------------------------------------- Orbite
def draw():
    s = Scene()
    s.fill("black", FULL)
    for x, y, r in [(120, 180, 7), (210, 90, 5), (860, 140, 6), (930, 300, 4), (80, 420, 5), (900, 520, 7),
                    (160, 600, 4), (820, 60, 4), (60, 260, 3), (880, 640, 4)]:
        s.paper(c(x, y, r))
    s.paper(_sparkle(780, 110, 26), _sparkle(150, 330, 18))
    # Combinaison, col, écusson.
    suit = p("M 110 1000 C 130 870 230 800 360 790 L 640 790 C 770 800 870 870 890 1000 Z")
    s.paper(suit)
    s.tint("lav", shade(suit, 300, 760, 800, 1000, 0.15, 0.8), screen="s", cell=10, angle=45)
    ring_ = rect(280, 740, 440, 92, r=46)
    s.fill("fed", ring_)
    s.tint("black", shade(ring_, 300, 740, 700, 830, 0.0, 0.6), cell=9, angle=30)
    patch = rect(248, 868, 92, 70, r=14, rot=-8)
    s.fill("red", patch)
    s.paper(_sparkle(294, 903, 22))
    # Casque, penché : il n'y croit pas.
    H = lambda *els: _rot(-10, 500, 450, *els)
    helmet = c(500, 450, 320)
    s.paper(H(helmet))
    s.tint("lav", H(shade(helmet, 320, 250, 760, 760, 0.0, 0.85)), screen="s", cell=10, angle=45)
    s.fill("red", H(rect(160, 410, 40, 90, r=16), rect(800, 410, 40, 90, r=16)))
    visor = p("M 230 470 C 230 330 350 250 500 250 C 650 250 770 330 770 470 C 770 610 660 690 500 690 "
              "C 340 690 230 610 230 470 Z")
    s.fill("lav", H(e(500, 470, 290, 238)))
    s.fill("fed", H(visor))
    s.tint("black", H(shade(visor, 0, 260, 0, 700, 0.1, 0.9)), screen="v", cell=10, angle=60)
    # Le reflet : un ciel de studio — planète et étoile pendues à leur fil (c'est du toc).
    refl = "".join(c(x, y, r) for x, y, r in [(330, 400, 6), (380, 560, 5), (690, 560, 6), (640, 640, 4),
                                               (300, 520, 4), (560, 600, 5)])
    s.paper(H(clipped(visor, refl)))
    s.paper_stroke(7, H(clipped(visor, p("M 610 240 L 610 372") + p("M 470 240 L 470 330"))))
    s.paper(H(_sparkle(470, 356, 30)))
    ring_e = e(610, 446, 150, 34, -14)
    s.stroke("pink", 18, H(clipped(visor, clipped(poly((300, 200), (900, 200), (900, 440), (300, 440)), ring_e))))
    planet = c(610, 446, 76)
    s.fill("sun", H(planet))
    s.tint("orange", H(shade(planet, 550, 380, 680, 520, 0.0, 0.9)), screen="p", cell=8, angle=15)
    s.stroke("pink", 18, H(clipped(visor, clipped(poly((300, 452), (900, 400), (900, 700), (300, 700)), ring_e))))
    # Reflet du verre.
    s.paper_stroke(30, H(p("M 300 520 C 282 420 330 330 420 296")))
    return s.layers()
