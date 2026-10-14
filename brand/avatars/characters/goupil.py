"""Goupil — Adore les films de casse. A déjà repéré trois sorties de secours."""
from kit import *  # noqa: F401,F403
from scene import Scene


# ---------------------------------------------------------------- Goupil
def draw():
    s = Scene()
    s.fill("green", FULL)
    s.tint("black", rad(520, 470, 560, ((0, 0.0), (0.6, 0.0), (1, 0.55))), cell=12, angle=75)
    # La sortie de secours, repérée du coin de l'œil.
    sign = rect(84, 318, 150, 104, r=12)
    s.fill("teal", sign)
    s.paper_stroke(10, rect(98, 332, 122, 76, r=6))
    s.paper(c(150, 350, 11))
    s.paper_stroke(13, p("M 146 366 L 136 394"), p("M 144 372 L 166 382 L 176 372"), p("M 144 372 L 124 380"),
                   p("M 136 394 L 152 406"), p("M 136 394 L 118 400"))
    s.paper(poly((188, 352), (206, 370), (188, 388)))
    # Marinière de cambrioleur.
    jersey = p("M 160 1000 C 180 870 280 806 400 786 L 600 786 C 720 806 820 870 840 1000 Z")
    s.fill("black", jersey)
    s.paper(clipped(jersey, "".join(rect(100, y, 800, 34) for y in (836, 904, 972))))
    # Rubans du loup, noués derrière la tête.
    s.fill("black", p("M 690 420 C 760 380 820 372 884 392 L 862 420 L 892 446 C 820 432 770 440 700 462 Z"),
           p("M 700 446 C 770 470 812 506 840 566 L 808 556 L 806 590 C 784 540 750 512 690 480 Z"))
    ears = poly((292, 430), (232, 128), (462, 288)) + poly((708, 430), (768, 128), (538, 288))
    head = p("M 500 250 C 620 250 704 322 732 420 L 806 540 L 734 562 L 774 626 L 680 642 "
             "C 622 722 562 774 500 778 C 438 774 378 722 320 642 L 226 626 L 266 562 L 194 540 "
             "L 268 420 C 296 322 380 250 500 250 Z")
    s.fill("orange", ears, head)
    s.paper(poly((300, 392), (252, 180), (428, 300)), poly((700, 392), (748, 180), (572, 300)))
    s.tint("orange", T(0.55, poly((300, 392), (252, 180), (428, 300)), poly((700, 392), (748, 180), (572, 300))),
           screen="i", cell=8, angle=30)
    s.fill("black", clipped(ears, poly((180, 60), (330, 60), (300, 236), (200, 250))),
           clipped(ears, poly((820, 60), (670, 60), (700, 236), (800, 250))))
    cheeks = p("M 194 540 L 266 562 L 226 626 L 320 642 C 378 722 438 774 500 778 C 562 774 622 722 680 642 "
               "L 774 626 L 734 562 L 806 540 C 740 512 650 516 594 556 C 556 596 534 636 500 650 "
               "C 466 636 444 596 406 556 C 350 516 260 512 194 540 Z")
    s.tint("red", shade(head, 380, 300, 700, 760, 0.0, 0.75), screen="s", cell=10, angle=45)
    s.paper(cheeks)
    s.tint("lav", shade(cheeks, 0, 600, 0, 790, 0.0, 0.6), screen="s", cell=9, angle=45)
    # Le loup noir.
    mask = p("M 282 442 C 280 356 378 330 446 374 Q 500 410 556 398 C 622 376 712 394 716 446 "
             "C 720 498 670 528 610 518 Q 546 508 500 476 Q 454 508 390 518 C 330 528 280 498 284 446 Z")
    s.fill("black", mask)
    L, R = (402, 452), (600, 456)
    s.paper(e(L[0], L[1], 54, 34, 12), e(R[0], R[1], 54, 34, -12))
    s.fill("black", c(L[0] - 26, L[1] + 4, 22), c(R[0] - 30, R[1] + 6, 22))
    s.paper(c(L[0] - 18, L[1] - 4, 7), c(R[0] - 22, R[1] - 1, 7))
    s.fill("black", clipped(e(L[0], L[1], 56, 36, 12), poly((330, 380), (480, 380), (480, 428), (330, 420))))
    s.fill("black", clipped(e(R[0], R[1], 56, 36, -12), poly((530, 380), (680, 380), (680, 458), (530, 452))))
    # Truffe et sourire en coin.
    s.fill("black", e(500, 676, 34, 24))
    s.paper(e(488, 668, 10, 6))
    s.stroke("black", 11, p("M 500 698 L 500 716"), p("M 452 722 Q 480 730 500 716 Q 540 724 574 694"),
             p("M 566 686 L 584 706"))
    return s.layers()
