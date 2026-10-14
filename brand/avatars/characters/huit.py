"""Huit, le poulpe — télécommande, soda, pop-corn : pas un bras de libre."""
from kit import *  # noqa: F401,F403
from scene import Scene


def draw():
    s = Scene()
    s.fill("aqua", FULL)
    s.tint("teal", lin(0, 560, 0, 1000, ((0, 0), (1, 0.9))), cell=12, angle=75)
    for x, y, r in [(150, 190, 24), (112, 262, 13), (868, 160, 19), (900, 226, 11), (838, 108, 8)]:
        s.paper_stroke(7, c(x, y, r))
    # Accessoires (derrière les bras qui les tiennent).
    remote = rect(176, 178, 64, 152, r=16, rot=-18)
    s.fill("black", remote)
    for (x, y), ink in zip([(196, 212), (222, 222), (203, 252), (214, 286)], ["red", "yellow", "aqua", "pink"]):
        s.fill(ink, c(x, y, 9))
    cup = poly((150, 610), (258, 610), (244, 770), (164, 770))
    s.fill("red", cup)
    s.paper(clipped(cup, "".join(rect(140, y, 140, 16) for y in (650, 690, 730))))
    s.stroke("yellow", 14, p("M 214 610 L 238 520"))
    s.paper(rect(142, 596, 124, 22, r=8))
    bucket = poly((736, 612), (870, 612), (850, 780), (756, 780))
    corn = "".join(c(x, y, r) for x, y, r in [(752, 600, 30), (790, 576, 32), (830, 586, 30), (862, 606, 26),
                                               (772, 548, 24), (814, 546, 26), (846, 566, 20)])
    s.fill("cream", corn)
    s.tint("yellow", T(0.55, corn), cell=8, angle=30)
    s.fill("red", bucket)
    s.paper(clipped(bucket, "".join(rect(x, 600, 18, 200) for x in (752, 790, 828))))
    # Bras.
    arms = [
        ([(400, 480), (318, 522), (250, 482), (222, 400), (228, 330)], 74, 30, 1),
        ([(420, 520), (360, 622), (292, 680), (232, 684)], 72, 30, -1),
        ([(462, 540), (450, 662), (400, 766), (424, 852), (474, 858)], 68, 22, 1),
        ([(538, 540), (562, 672), (622, 772), (602, 852), (556, 850)], 68, 22, -1),
        ([(584, 522), (650, 622), (730, 688), (800, 690)], 72, 30, 1),
        ([(622, 470), (722, 432), (782, 352), (762, 290), (722, 300)], 68, 22, -1),
    ]
    for pts, w0, w1, side in arms:
        s.fill("violet", tube(pts, w0, w1))
    for pts, w0, w1, side in arms:
        s.paper(suckers(pts, w0, w1, side=side, every=4, start=6))
    mantle = p("M 335 440 C 300 300 360 150 500 145 C 640 150 700 300 665 440 C 650 510 590 550 500 552 "
               "C 410 550 350 510 335 440 Z")
    s.fill("violet", mantle)
    s.over("pink", c(440, 240, 26), c(560, 210, 18), c(600, 300, 30), c(400, 330, 16), c(520, 300, 12))
    s.tint("purple", shade(mantle, 430, 0, 690, 0, 0.0, 0.85), cell=10, angle=45)
    for x in (445, 560):
        w, pu, gl = eye(x, 410, 46, look=(0.55, 0.45))
        s.paper(w)
        s.fill("black", pu)
        s.paper(gl)
    s.tint("pink", T(0.7, e(410, 478, 34, 20), e(598, 478, 34, 20)), screen="b", cell=8, angle=15)
    s.stroke("black", 12, p("M 470 492 Q 503 522 536 492"))
    return s.layers()
