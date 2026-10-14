"""Caramel — Le pop-corn est fini avant la fin des bandes-annonces."""
from kit import *  # noqa: F401,F403
from scene import Scene


# ---------------------------------------------------------------- Caramel
def _corn(*pts):
    """Grains de pop-corn : chaque grain = trois bosses."""
    out = []
    for x, y, r in pts:
        out.append(c(x, y, r) + c(x - r * 0.7, y + r * 0.35, r * 0.72) + c(x + r * 0.62, y + r * 0.42, r * 0.7))
    return "".join(out)


def draw():
    s = Scene()
    s.fill("violet", FULL)
    s.tint("purple", rad(500, 430, 560, ((0, 0.0), (0.5, 0.15), (1, 0.85))), cell=12, angle=15)
    flying = _corn((176, 300, 24), (820, 250, 22), (858, 420, 18), (150, 470, 18))
    s.fill("cream", flying)
    s.tint("yellow", T(0.5, flying), screen="f", cell=7, angle=30)
    # Oreilles, corps, tête aux joues pleines.
    s.fill("brown", c(318, 196, 72), c(682, 196, 72))
    s.fill("peach", c(320, 202, 38), c(680, 202, 38))
    body = p("M 150 1000 C 160 760 270 620 500 620 C 730 620 840 760 850 1000 Z")
    head = e(500, 330, 210, 184) + c(358, 450, 118) + c(642, 450, 118)
    s.fill("brown", body, head)
    s.tint("black", shade(head + body, 0, 260, 0, 1000, 0.0, 0.55), cell=10, angle=45)
    s.tint("pink", T(0.45, c(344, 478, 54), c(656, 478, 54)), screen="b", cell=8, angle=15)
    s.paper(e(298, 420, 30, 15, -44), e(702, 420, 30, 15, 44))
    muzzle = e(500, 452, 84, 66)
    s.fill("cream", muzzle)
    s.tint("brown", shade(muzzle, 0, 420, 0, 520, 0.0, 0.4), screen="m", cell=8, angle=60)
    # Yeux ravis, fermés de bonheur ; les joues pleines les remontent.
    for x in (424, 576):
        s.stroke("black", 17, p(f"M {x - 38} 336 Q {x} 282 {x + 38} 336"))
        s.stroke("black", 9, p(f"M {x - 30} 252 Q {x} 236 {x + 30} 250"))
    s.fill("black", e(500, 420, 36, 24))
    s.paper(e(488, 412, 11, 6))
    s.stroke("black", 10, p("M 500 444 L 500 470"), p("M 474 482 Q 487 470 500 482 Q 513 494 526 482"))
    stuck = _corn((562, 488, 15))
    s.fill("cream", stuck)
    s.tint("yellow", T(0.55, stuck), screen="g", cell=6, angle=30)
    # Le seau, serré contre lui.
    heap = _corn((338, 640, 34), (400, 606, 38), (470, 592, 36), (540, 596, 38), (606, 608, 36), (664, 642, 32),
                 (372, 572, 28), (448, 552, 30), (520, 546, 28), (590, 560, 30), (636, 588, 26))
    s.fill("cream", heap)
    s.tint("yellow", T(0.55, heap), screen="h", cell=8, angle=30)
    bucket = poly((300, 650), (700, 650), (668, 1010), (332, 1010))
    s.fill("red", bucket)
    s.paper(clipped(bucket, "".join(poly((x, 640), (x + 46, 640), (x + 46 - (x + 23 - 500) * 0.09, 1020),
                                         (x - (x + 23 - 500) * 0.09, 1020)) for x in (316, 408, 500, 592))))
    s.tint("purple", shade(bucket, 400, 0, 720, 0, 0.0, 0.6), screen="p", cell=10, angle=45)
    s.paper(rect(286, 640, 428, 30, r=12))
    # Les bras qui l'enlacent.
    arms = (tube([(214, 650), (236, 768), (372, 800)], 110, 86) + c(384, 794, 50)
            + tube([(786, 650), (764, 768), (628, 800)], 110, 86) + c(616, 794, 50))
    s.fill("brown", arms)
    s.tint("black", shade(arms, 0, 700, 0, 860, 0.0, 0.5), screen="a2", cell=10, angle=45)
    s.stroke("black", 9, p("M 410 772 L 428 780"), p("M 414 800 L 432 804"), p("M 590 772 L 572 780"),
             p("M 586 800 L 568 804"))
    return s.layers()
