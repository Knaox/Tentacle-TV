"""Cassandre — Devine la fin dès la première scène. Ne se trompe jamais."""
from kit import *  # noqa: F401,F403
from scene import Scene


def _sparkle(x, y, r):
    """Étincelle à quatre branches."""
    k = r * 0.22
    return p(f"M {x} {y - r} Q {x + k} {y - k} {x + r} {y} Q {x + k} {y + k} {x} {y + r} "
             f"Q {x - k} {y + k} {x - r} {y} Q {x - k} {y - k} {x} {y - r} Z")


# ---------------------------------------------------------------- Cassandre
def draw():
    s = Scene()
    s.fill("green", FULL)
    s.tint("teal", lin(0, 0, 0, 1000, ((0, 0.7), (0.6, 0.0))), cell=12, angle=75)
    s.paper(_sparkle(150, 620, 26), _sparkle(850, 590, 30), _sparkle(800, 740, 16), _sparkle(200, 770, 14))
    robe = p("M 120 1000 C 150 880 260 820 380 810 L 620 810 C 740 820 850 880 880 1000 Z")
    s.fill("violet", robe)
    s.tint("black", shade(robe, 300, 800, 800, 1000, 0.0, 0.6), cell=10, angle=45)
    # Mèches derrière le visage.
    hair = (p("M 340 400 C 250 450 220 560 250 640 C 270 700 230 740 200 730 C 230 790 320 770 330 700 "
              "C 300 760 380 800 400 740 C 360 700 350 600 380 520 Z")
            + p("M 660 400 C 750 450 780 560 750 640 C 730 700 770 740 800 730 C 770 790 680 770 670 700 "
                "C 700 760 620 800 600 740 C 640 700 650 600 620 520 Z"))
    s.fill("red", hair)
    s.tint("burgundy", shade(hair, 0, 500, 0, 800, 0.0, 0.7), cell=10, angle=45)
    face = e(500, 576, 162, 188)
    s.fill("peach", face)
    s.tint("orange", shade(face, 400, 420, 650, 770, 0.0, 0.5), cell=9, angle=45)
    s.tint("burgundy", clipped(face, T(0.55, e(500, 430, 330, 66, -5))), screen="h", cell=9, angle=30)
    # Nez pointu, en crochet.
    nose = p("M 506 520 C 516 566 534 606 566 632 C 530 646 480 640 432 664 C 470 620 492 566 506 520 Z")
    s.fill("peach", nose)
    s.tint("orange", shade(nose, 0, 540, 0, 650, 0.2, 0.8), screen="n", cell=8, angle=15)
    # Œil ouvert (complice) et clin d'œil.
    w, pu, gl = eye(420, 548, 40, look=(0.25, 0.0), pupil=0.5)
    s.paper(w)
    s.fill("black", pu)
    s.paper(gl)
    s.fill("peach", clipped(c(420, 548, 42), p("M 360 490 L 480 490 L 480 534 L 360 528 Z")))
    s.stroke("black", 9, p("M 378 530 L 462 534"), knock=False)
    s.stroke("black", 13, p("M 560 552 Q 596 524 632 552"), knock=False)
    s.stroke("black", 8, p("M 566 540 L 552 530"), p("M 626 540 L 640 530"), knock=False)
    s.stroke("black", 12, p("M 372 476 Q 420 446 468 474"), p("M 560 500 L 636 494"), knock=False)
    s.stroke("black", 11, p("M 470 712 Q 524 730 580 694"), knock=False)
    s.stroke("black", 8, p("M 580 694 L 592 704"), knock=False)
    s.fill("pink", e(380, 648, 34, 18), e(630, 640, 34, 18))
    s.layer_opts("pink", None, density=0.5)
    # Chapeau cabossé.
    crown = p("M 320 410 C 370 320 390 230 430 160 C 460 110 520 74 590 80 C 650 86 700 120 726 168 "
              "C 670 150 620 166 596 214 C 576 270 620 340 680 400 Z")
    brim = e(500, 404, 340, 62, -5)
    s.fill("violet", crown)
    s.fill("sun", clipped(crown, poly((300, 330), (700, 318), (700, 382), (300, 394))))
    s.tint("black", shade(crown, 420, 0, 700, 0, 0.0, 0.7), cell=10, angle=45)
    s.stroke("black", 10, p("M 470 150 Q 520 200 540 250"), knock=False)
    s.fill("violet", brim)
    s.tint("black", shade(brim, 0, 360, 0, 470, 0.0, 0.7), cell=10, angle=45)
    # Boule de cristal, et ses mains.
    ball = c(500, 846, 132)
    s.paper(ball)
    s.tint("aqua", clipped(ball, rad(470, 820, 150, ((0, 0.1), (0.6, 0.5), (1, 1.0)))), screen="g", cell=9, angle=20)
    s.stroke("violet", 14, clipped(ball, p("M 440 880 C 450 830 530 820 550 860 C 562 890 520 906 500 884")), knock=False)
    s.paper_stroke(14, p("M 420 804 Q 440 764 480 752"))
    for sx in (-1, 1):
        hand = e(500 + sx * 146, 930, 46, 62, sx * 30)
        s.fill("peach", hand)
        s.tint("orange", shade(hand, 0, 880, 0, 1000, 0.0, 0.6), cell=9, angle=45)
    return s.layers()
