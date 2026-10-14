"""Mistigri, le chat détective — feutre, imperméable, ombre de store de film noir."""
from kit import *  # noqa: F401,F403


S = {"screen": True}


def draw():
    head = e(500, 560, 205, 180) + poly((300, 545), (262, 645), (338, 655)) + poly((700, 545), (738, 645), (662, 655))
    ear = poly((598, 425), (692, 245), (712, 455))
    inner_ear = poly((622, 425), (686, 300), (696, 440))
    rot = 'transform="rotate(-8 480 385)"'
    crown_d = "M 335 378 C 330 300 342 232 362 200 C 430 176 466 204 480 216 C 500 196 560 172 602 186 C 616 232 622 300 616 366 Z"
    brim = f'<ellipse cx="480" cy="388" rx="258" ry="46" {rot}/>'
    crown = f'<path d="{crown_d}" {rot}/>'
    band = clipped(crown, f'<rect x="300" y="318" width="400" height="44" {rot}/>')
    hat = brim + crown
    coat = p("M 110 1000 L 200 770 Q 228 704 300 684 L 420 770 L 500 870 L 580 770 L 700 684 Q 772 704 800 770 L 890 1000 Z")
    lapels = poly((240, 790), (296, 600), (430, 780)) + poly((760, 790), (704, 600), (570, 780))
    shirt = poly((420, 760), (580, 760), (500, 880))
    tie = p("M 488 760 L 512 760 L 522 800 L 500 880 L 478 800 Z")
    eyes = e(425, 555, 52, 40) + e(578, 555, 52, 40)
    lids = (clipped(e(425, 555, 54, 42), poly((350, 450), (500, 450), (500, 542), (350, 552)))
            + clipped(e(578, 555, 54, 42), poly((500, 450), (650, 450), (650, 540), (500, 532))))
    pupils = e(432, 568, 10, 30) + e(586, 566, 10, 32)
    nose = poly((480, 612), (520, 612), (500, 634))
    mouth = p("M 466 652 Q 483 672 500 652 Q 517 672 534 652")
    whiskers = (p("M 335 628 L 185 606") + p("M 338 652 L 190 668") + p("M 665 628 L 815 606") + p("M 662 652 L 810 668"))
    silhouette = head + ear + hat + coat + lapels + shirt
    blinds = "".join(rect(-200, y, 1400, 46, rot=-24) for y in range(-300, 1300, 118))
    return [
        ("sun", A(coat, lapels) + E(shirt), {}),
        ("orange", shade(lapels, 0, 600, 0, 800, 0.15, 0.75), S),
        ("red", A(FULL) + E(silhouette) + SE(7, whiskers), {}),
        ("fed", A(hat, tie) + E(ear), {}),
        ("pink", A(nose, inner_ear), {}),
        ("yellow", A(eyes), {}),
        ("aqua", shade(eyes, 0, 530, 0, 600, 0.0, 0.8), dict(S, cell=9)),
        ("black", A(head, ear) + E(eyes, nose, inner_ear) + SE(7, mouth, whiskers) + A(lids, pupils, band)
         + A(c(500, 935, 12)) + SA(6, p("M 500 880 L 500 1000")), {}),
        ("black", A(blinds) + E(eyes) + SE(10, whiskers) + E(head, ear), dict(S, density=0.42, cell=10, angle=45)),
    ]
