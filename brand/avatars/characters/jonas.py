"""Jonas — Exige le plus grand écran. Même dans son bain."""
from kit import *  # noqa: F401,F403
from scene import Scene


def _eye(s, x, y, r, look=(0, 0), pupil=0.45):
    w, pu, gl = eye(x, y, r, look=look, pupil=pupil)
    s.paper(w)
    s.fill("black", pu)
    s.paper(gl)


# ---------------------------------------------------------------- Jonas
def draw():
    s = Scene()
    s.fill("yellow", FULL)
    # Le carrelage de la salle de bain, tramé.
    grid = ("".join(rect(x, -10, 12, 1020) for x in range(90, 1000, 170))
            + "".join(rect(-10, y, 1020, 12) for y in range(70, 1000, 170)))
    s.tint("sun", T(0.6, grid), cell=8, angle=30)
    # Le jet d'eau en éventail.
    root = (440, 186)
    jets = [
        [root, (380, 150), (318, 180), (292, 240)],
        [root, (400, 120), (352, 104)],
        [root, (440, 92)],
        [root, (482, 120), (530, 104)],
        [root, (500, 150), (562, 180), (588, 240)],
    ]
    spout = tube([(440, 320), (434, 250), (440, root[1])], 54, 40)
    spout += "".join(tube(j, 38, 22) for j in jets)
    drops = "".join(c(x, y, r) for x, y, r in [(286, 292, 16), (334, 92, 13), (440, 54, 15), (548, 92, 13),
                                               (594, 292, 16), (250, 210, 10), (630, 210, 10)])
    s.paper(spout, drops)
    s.tint("aqua", shade(spout + drops, 380, 80, 520, 300, 0.25, 0.85), screen="w", cell=8, angle=60)
    # La baleine.
    body = p("M 92 600 C 82 430 230 300 440 296 C 620 292 760 368 808 510 C 846 620 830 740 750 818 "
             "C 670 892 520 922 360 904 C 220 888 112 806 98 690 Z")
    tail = tube([(700, 720), (790, 640), (820, 540), (806, 450)], 160, 64)
    fluke = p("M 806 470 C 770 440 728 410 716 350 C 760 350 792 380 808 412 C 826 372 856 344 904 336 "
              "C 900 392 862 440 806 470 Z")
    whale = body + tail + fluke
    s.fill("blue", whale)
    s.tint("fed", shade(whale, 300, 360, 760, 900, 0.0, 0.85), screen="s", cell=10, angle=45)
    # Le ventre à sillons.
    throat = p("M 40 650 C 240 716 452 720 612 652 L 900 760 L 900 1000 L 40 1000 Z")
    grooves = "".join(p(f"M 70 {712 + 44 * k} C 260 {772 + 42 * k} 480 {780 + 38 * k} 720 {700 + 44 * k}")
                      for k in range(6))
    s.paper_stroke(16, clipped(body, clipped(throat, grooves)))
    s.paper_stroke(16, p("M 168 470 Q 196 392 276 352"))
    # La mousse du bain.
    foam = "".join(c(x, y, r) for x, y, r in [(110, 880, 64), (210, 915, 80), (330, 895, 70), (450, 925, 84),
                                              (575, 905, 74), (700, 925, 80), (815, 885, 70), (915, 915, 66)])
    s.paper(foam)
    s.tint("aqua", shade(foam, 0, 820, 0, 1000, 0.0, 0.8), screen="f", cell=8, angle=20)
    # La nageoire, posée sur la mousse comme un bras sur le bord de la baignoire.
    flipper = tube([(560, 792), (664, 846), (776, 860)], 104, 56)
    s.fill("blue", flipper)
    s.tint("fed", shade(flipper, 560, 790, 780, 900, 0.2, 0.8), screen="s", cell=10, angle=45)
    # L'œil satisfait, paupière mi-close.
    ex, ey, er = 556, 540, 36
    _eye(s, ex, ey, er, look=(-0.35, 0.35), pupil=0.5)
    s.fill("blue", lid_cap(ex, ey, er, 4, -6))
    s.stroke("black", 9, p(f"M {ex - er - 6} {ey + 6} L {ex + er + 4} {ey - 7}"))
    s.stroke("black", 10, p(f"M {ex - 30} {ey - 54} Q {ex + 4} {ey - 72} {ex + 36} {ey - 56}"))
    # Le sourire immense.
    s.stroke("black", 20, p("M 96 630 C 240 712 462 718 612 640 C 638 626 656 604 662 576"))
    return s.layers()
