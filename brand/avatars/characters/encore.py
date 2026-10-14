"""Encore — Un épisode. Puis un autre. Puis encore un."""
from kit import *  # noqa: F401,F403
from scene import Scene


def _eye_lid(x, y, r, a, b):
    """Paupière : la part de l'œil au-dessus de la droite (x-r, y+a) → (x+r, y+b)."""
    return clipped(c(x, y, r + 3), p(f"M {x - r - 40} {y - r - 60} L {x + r + 40} {y - r - 60} "
                                      f"L {x + r + 40} {y + b} L {x - r - 40} {y + a} Z"))


# ---------------------------------------------------------------- Encore
def _rot(deg, x, y, *els, k=1.0):
    return (f'<g transform="translate({x} {y}) rotate({deg}) scale({k}) translate({-x} {-y})">'
            f'{"".join(els)}</g>')


def draw():
    s = Scene()
    s.fill("mint", FULL)
    s.tint("teal", lin(0, 380, 0, 1000, ((0, 0.0), (1, 0.7))), cell=12, angle=75)
    # La branche, et les épisodes comptés dessus.
    branch = tube([(-40, 214), (300, 186), (640, 176), (1040, 150)], 64, 50, cap=False)
    leaves = (e(336, 128, 42, 16, -62) + e(378, 122, 38, 15, -118) + e(668, 112, 42, 16, -64)
              + e(706, 108, 34, 14, -116))
    # Corps et bras, derrière la tête.
    body = e(500, 930, 250, 210)
    arms = [([(370, 800), (300, 520), (236, 232)], 104, 76), ([(630, 800), (700, 520), (764, 226)], 104, 76)]
    s.fill("brown", body, *(tube(pts, a, b) for pts, a, b in arms))
    s.tint("black", shade(body + "".join(tube(pts, a, b) for pts, a, b in arms), 0, 300, 0, 1000, 0.0, 0.5),
           cell=10, angle=45)
    s.fill("brown", branch)
    s.fill("green", leaves)
    s.tint("teal", T(0.5, leaves), screen="l", cell=7, angle=30)
    s.tint("black", shade(branch, 0, 150, 0, 230, 0.0, 0.55), screen="br", cell=8, angle=45)
    s.paper_stroke(12, p("M 470 160 L 472 200"), p("M 500 160 L 502 198"), p("M 530 158 L 532 196"),
                   p("M 560 156 L 562 194"), p("M 456 192 L 578 160"), p("M 610 154 L 612 192"),
                   p("M 640 152 L 642 190"))
    # Pattes agrippées : les griffes passent par-dessus la branche.
    for x, y, d in [(236, 226, -1), (764, 220, 1)]:
        s.fill("brown", c(x, y, 46))
        s.fill("black", *(tube([(x + dx, y - 10), (x + dx + 6 * d, y - 62), (x + dx + 26 * d, y - 74)], 18, 8)
                          for dx in (-26, 0, 26)))
    # La tête, un peu penchée : l'air béat.
    def H(*els):
        return _rot(-8, 500, 540, *els, k=1.1)

    head = p("M 500 300 C 650 300 728 400 728 520 C 728 650 630 740 500 740 C 370 740 272 650 272 520 "
             "C 272 400 350 300 500 300 Z")
    tufts = poly((452, 310), (476, 270), (500, 304)) + poly((496, 304), (530, 276), (544, 312))
    face = e(500, 548, 176, 150)
    s.fill("cream", H(head, tufts))
    s.tint("brown", H(T(0.62, head, tufts)), screen="h", cell=9, angle=30)
    s.fill("cream", H(face))
    s.tint("brown", H(shade(face, 0, 520, 0, 720, 0.0, 0.35)), screen="f", cell=9, angle=60)
    # Le masque : deux bandes sombres qui filent vers les tempes.
    bands = (p("M 470 520 C 470 470 420 456 382 470 C 340 486 300 530 278 566 C 330 560 372 556 414 560 "
               "C 448 562 470 548 470 520 Z")
             + p("M 530 520 C 530 470 580 456 618 470 C 660 486 700 530 722 566 C 670 560 628 556 586 560 "
                 "C 552 562 530 548 530 520 Z"))
    s.tint("purple", H(T(0.7, e(420, 576, 52, 20), e(580, 576, 52, 20))), screen="k",
           cell=7, angle=15)
    s.fill("brown", H(bands))
    for x in (424, 576):
        w, pu, gl = eye(x, 516, 30, look=(0.0, 0.6), pupil=0.5)
        s.paper(H(w))
        s.fill("black", H(pu))
        s.paper(H(gl))
        s.fill("brown", H(_eye_lid(x, 516, 30, 6, 6)))
        s.stroke("black", 9, H(p(f"M {x - 32} 522 Q {x} 530 {x + 32} 522")))
    s.fill("black", H(e(500, 600, 30, 20)))
    s.paper(H(e(490, 594, 9, 5)))
    s.stroke("black", 10, H(p("M 440 634 Q 500 686 560 634")))
    s.tint("pink", H(T(0.6, e(380, 620, 30, 16), e(620, 620, 30, 16))), screen="b",
           cell=8, angle=15)
    return s.layers()
