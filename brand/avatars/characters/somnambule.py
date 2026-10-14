"""Somnambule — Ne se réveille que pour les suites. Puis se rendort."""
from kit import *  # noqa: F401,F403
from scene import Scene


# ---------------------------------------------------------------- Somnambule
def _reach_hand(x, y, droop=1.0):
    """Main tendue, paume vers le bas, doigts qui tombent un peu (poignet en x, y)."""
    palm = e(x + 34, y + 2, 44, 34, 8)
    fingers = []
    for k, (dy, ln) in enumerate([(-20, 70), (-2, 78), (16, 72), (32, 58)]):
        yy = y + dy
        fingers.append(tube([(x + 50, yy), (x + 50 + ln * 0.6, yy + 6 * droop), (x + 50 + ln, yy + 22 * droop)], 24, 20))
    thumb = tube([(x + 30, y - 22), (x + 58, y - 40), (x + 84, y - 40)], 22, 18)
    return palm + "".join(fingers) + thumb


def draw():
    s = Scene()
    s.fill("lav", FULL)
    s.tint("violet", lin(0, 0, 0, 1000, ((0, 0.0), (1, 0.55))), cell=12, angle=75)
    for x, y, k in [(760, 130, 1.0), (870, 255, 0.62)]:
        w = 76 * k
        s.paper_stroke(22 * k, p(f"M {x} {y} L {x + w} {y} L {x} {y + w} L {x + w} {y + w}"))
    # Pyjama rayé : le corps, en retrait.
    body = p("M 150 1000 C 160 860 230 740 340 700 L 520 700 C 600 730 640 830 650 1000 Z")
    s.fill("cream", body)
    s.fill("blue", clipped(body, "".join(rect(x, 600, 34, 500, rot=4) for x in range(150, 700, 80))))
    s.tint("purple", shade(body, 0, 700, 0, 1000, 0.35, 0.7), screen="f", cell=9, angle=30)
    # Les deux bras tendus devant lui.
    arms = [([(520, 716), (620, 680), (690, 660)], 68, 58), ([(360, 806), (540, 784), (700, 768)], 80, 66)]
    for i, (pts, w0, w1) in enumerate(arms):
        x, y = pts[-1]
        sl = tube(pts, w0, w1)
        s.fill("blue", sl)
        s.tint("purple", shade(sl, 0, y - w1, 0, y + w1, 0.0, 0.6) if i else T(0.45, sl), screen="f", cell=9, angle=30)
        s.fill("cream", clipped(sl, rect(x - 40, y - 80, 28, 160, rot=-8)))
        hand = _reach_hand(x + 8, y + 4)
        s.fill("mint", hand)
        s.tint("teal", shade(hand, 0, y - 40, 0, y + 50, 0.1, 0.8) if i else T(0.5, hand), cell=9, angle=45)
    # Tête.
    head = e(410, 420, 186, 194)
    ear = e(234, 456, 36, 54)
    s.fill("mint", ear, head)
    s.tint("teal", shade(head, 310, 270, 620, 660, 0.0, 0.7), cell=10, angle=45)
    # Cheveux en bataille, sous le bonnet : des mèches qui partent dans tous les sens.
    flicks = [[(600, 330), (650, 312), (690, 330)], [(560, 340), (590, 390), (566, 420)],
              [(420, 350), (400, 400), (430, 424)], [(300, 360), (250, 380), (230, 420)],
              [(264, 380), (226, 420), (220, 470)]]
    s.fill("black", *[tube(f, 50, 6) for f in flicks])
    # Bonnet de nuit qui tombe.
    cap = p("M 222 360 C 232 210 352 150 470 160 C 580 170 650 250 630 330 C 510 300 370 300 222 360 Z")
    tail = p("M 274 294 C 206 260 156 294 130 394 C 110 474 120 534 140 574 C 170 534 190 444 262 380 Z")
    s.fill("cream", tail, cap)
    s.fill("red", clipped(tail + cap, "".join(rect(x, 60, 40, 700, rot=30) for x in range(-40, 760, 90))))
    s.tint("purple", shade(tail + cap, 0, 160, 0, 580, 0.0, 0.5), screen="f", cell=9, angle=30)
    pom = c(140, 592, 50)
    s.paper(pom)
    s.tint("violet", shade(pom, 90, 540, 190, 640, 0.0, 0.8), screen="p", cell=8, angle=15)
    s.paper(rect(216, 318, 432, 56, r=28, rot=-6))
    # Yeux : un mi-clos, un fermé.
    w, pu, gl = eye(428, 470, 44, look=(0.15, 0.65), pupil=0.46)
    s.paper(w)
    s.fill("black", pu)
    s.paper(gl)
    s.fill("mint", clipped(c(428, 470, 46), p("M 356 390 L 496 390 L 496 476 L 356 470 Z")))
    s.stroke("black", 10, p("M 382 472 L 474 476"), knock=False)
    s.stroke("black", 12, p("M 540 476 Q 576 498 614 474"), knock=False)
    s.stroke("black", 8, p("M 554 490 L 546 506"), p("M 578 495 L 578 512"), p("M 600 490 L 608 506"), knock=False)
    # Bouche ouverte qui ronfle.
    s.fill("black", e(544, 584, 24, 28))
    # Pansement en croix.
    s.fill("peach", rect(268, 520, 112, 34, r=12, rot=40), rect(268, 520, 112, 34, r=12, rot=-40))
    return s.layers()
