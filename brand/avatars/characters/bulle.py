"""Bulle, le poisson-globe — gonflé de peur, piquants dressés, sursaut dessiné."""
import math
from kit import *  # noqa: F401,F403
from scene import Scene


def draw():
    s = Scene()
    s.fill("purple", FULL)
    s.tint("violet", rad(500, 520, 470, ((0, 1.0), (0.6, 0.6), (1, 0.0))), cell=12, angle=15)
    s.fill("orange", poly((735, 520), (840, 438), (812, 520), (840, 604)))
    spikes = []
    for i in range(18):
        a = math.radians(i * 20 + 6)
        bx, by = 500 + 236 * math.cos(a), 520 + 236 * math.sin(a)
        tx, ty = 500 + 312 * math.cos(a), 520 + 312 * math.sin(a)
        px, py = -math.sin(a) * 22, math.cos(a) * 22
        spikes.append(poly((round(bx + px), round(by + py)), (round(tx), round(ty)), (round(bx - px), round(by - py))))
    s.fill("orange", *spikes)
    body = c(500, 520, 250)
    s.fill("sun", body)
    s.fill("cream", clipped(body, e(500, 700, 250, 160)))
    s.over("brown", c(400, 330, 16), c(470, 300, 12), c(560, 318, 18), c(630, 360, 13), c(350, 400, 11),
           c(660, 430, 10))
    s.tint("orange", shade(body, 0, 380, 0, 780, 0.0, 0.7), cell=10, angle=45)
    s.fill("orange", p("M 300 560 C 230 520 200 600 240 640 C 270 620 290 600 310 600 Z"))
    for x in (420, 588):
        w, pu, gl = eye(x, 470, 72, pupil=0.2)
        s.paper(w)
        s.fill("black", pu)
        s.paper(gl)
    s.stroke("black", 12, p("M 360 372 Q 410 340 462 360"), p("M 546 360 Q 598 336 650 368"))
    s.fill("black", e(505, 608, 24, 30))
    s.tint("pink", T(0.65, e(362, 560, 34, 18), e(650, 560, 34, 18)), screen="b", cell=8, angle=15)
    for d in ("M 500 230 L 500 180", "M 410 246 L 380 206", "M 590 246 L 620 206"):
        s.paper_stroke(12, p(d))
    s.fill("aqua", p("M 712 330 C 690 370 692 398 716 402 C 740 398 742 370 712 330 Z"))
    return s.layers()
