"""Mâchoire — Connaît Les Dents de la mer par cœur. Le spoile à tout le monde."""
from kit import *  # noqa: F401,F403
from scene import Scene


def _eye(s, x, y, r, look=(0, 0), pupil=0.45):
    w, pu, gl = eye(x, y, r, look=look, pupil=pupil)
    s.paper(w)
    s.fill("black", pu)
    s.paper(gl)


# ---------------------------------------------------------------- Mâchoire
def draw():
    s = Scene()
    s.fill("orange", FULL)
    s.tint("sun", rad(220, 160, 560, ((0, 0.9), (1, 0.0))), cell=12, angle=15)
    for x, y, r in [(860, 640, 18), (900, 570, 12), (880, 510, 8)]:
        s.paper_stroke(7, c(x, y, r))
    body = p("M 108 566 C 116 430 262 318 470 300 C 640 286 800 330 1010 420 L 1010 780 "
             "C 860 820 700 846 520 836 C 330 826 158 744 110 624 Z")
    dorsal = p("M 600 312 C 640 230 680 168 736 140 C 724 210 728 270 772 330 Z")
    fin = p("M 560 790 C 600 850 660 900 740 930 C 700 870 690 820 690 790 Z")
    s.fill("fed", body, dorsal)
    s.fill("cream", clipped(body, p("M 60 640 C 300 720 620 740 1040 650 L 1040 1040 L 60 1040 Z")))
    s.fill("fed", fin)
    s.tint("black", shade(body + dorsal + fin, 300, 300, 600, 900, 0.0, 0.55), screen="s", cell=10, angle=45)
    # Les ouïes.
    s.stroke("black", 11, p("M 650 470 Q 630 530 650 600"), p("M 690 466 Q 670 526 690 596"),
             p("M 730 462 Q 710 522 730 592"))
    # Le grand sourire taquin.
    mouth = p("M 168 590 C 270 640 450 652 600 578 C 590 680 470 760 340 750 C 250 740 186 680 168 590 Z")
    s.fill("black", mouth)
    s.fill("red", clipped(mouth, e(380, 760, 140, 60)))
    up = "".join(poly((x, y - 6), (x + 44, y - 4), (x + 22, y + 40)) for x, y in
                 [(186, 600), (232, 618), (282, 630), (334, 636), (386, 636), (438, 630), (488, 618), (538, 600)])
    lo = "".join(poly((x, y + 8), (x + 44, y + 4), (x + 20, y - 34)) for x, y in
                 [(220, 692), (270, 722), (324, 738), (378, 740), (432, 728), (486, 704)])
    s.paper(clipped(mouth, up + lo))
    s.stroke("black", 12, p("M 600 578 Q 626 560 628 534"))
    # Les yeux, qui regardent par-dessus les lunettes.
    for x, y, r in ((318, 410, 24), (522, 380, 32)):
        _eye(s, x, y, r, look=(-0.55, 0.25), pupil=0.55)
        s.fill("fed", lid_cap(x, y, r, -8, -16))
        s.stroke("black", 8, p(f"M {x - r - 4} {y - 6} L {x + r + 4} {y - 16}"))
    # Les lunettes de soleil, descendues sur le museau.
    dy = 46
    far = p(f"M 240 {404 + dy} C 240 {390 + dy} 254 {384 + dy} 270 {384 + dy} L 370 {384 + dy} "
            f"C 384 {384 + dy} 392 {394 + dy} 388 {410 + dy} L 376 {454 + dy} C 372 {470 + dy} 360 {476 + dy} 344 {476 + dy} "
            f"L 284 {476 + dy} C 264 {476 + dy} 250 {466 + dy} 246 {448 + dy} Z")
    near = p(f"M 424 {380 + dy} C 424 {364 + dy} 438 {356 + dy} 456 {356 + dy} L 586 {356 + dy} "
             f"C 604 {356 + dy} 612 {368 + dy} 608 {386 + dy} L 596 {446 + dy} C 592 {466 + dy} 576 {476 + dy} 556 {476 + dy} "
             f"L 476 {476 + dy} C 452 {476 + dy} 436 {464 + dy} 432 {444 + dy} Z")
    s.fill("black", far, near)
    s.stroke("black", 14, p(f"M 388 {400 + dy} Q 406 {390 + dy} 426 {392 + dy}"), p(f"M 606 {380 + dy} L 648 {388 + dy}"))
    s.paper(clipped(far, rect(292, 380, 22, 160, rot=30)), clipped(near, rect(500, 360, 26, 170, rot=30)),
            clipped(near, rect(540, 360, 10, 170, rot=30)))
    # Les sourcils : l'un haussé, l'autre bas.
    s.stroke("black", 14, p("M 476 318 Q 526 286 580 312"), p("M 282 376 Q 314 366 346 372"))
    return s.layers()
