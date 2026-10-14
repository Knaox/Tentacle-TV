"""Plaid — Ne regarde rien sans son plaid. Ni sans tenir une patte."""
from kit import *  # noqa: F401,F403
from scene import Scene


def R(rot, cx, cy, *els):
    """Tourne un groupe d'éléments autour de (cx, cy)."""
    return f'<g transform="rotate({rot} {cx} {cy})">{"".join(els)}</g>'


# ---------------------------------------------------------------- Plaid
def _heart(cx, cy, rot=0):
    d = (f"M {cx} {cy + 40} C {cx - 40} {cy + 12} {cx - 54} {cy - 26} {cx - 27} {cy - 39} "
         f"C {cx - 12} {cy - 45} {cx - 2} {cy - 34} {cx} {cy - 22} C {cx + 2} {cy - 34} {cx + 12} {cy - 45} {cx + 27} {cy - 39} "
         f"C {cx + 54} {cy - 26} {cx + 40} {cy + 12} {cx} {cy + 40} Z")
    return R(rot, cx, cy, p(d))


def draw():
    s = Scene()
    s.fill("teal", FULL)
    s.tint("aqua", rad(520, 560, 520, ((0, 0.55), (1, 0.0))), cell=12, angle=20)
    for x, y, rx, ry in [(220, 680, 44, 17), (220, 680, 78, 30), (880, 380, 32, 12)]:
        s.paper_stroke(7, e(x, y, rx, ry))
    # Tout le corps est dessiné debout, puis couché en diagonale et agrandi autour de la tête.
    rot, o, at, k = -30, (420, 340), (440, 370), 1.12

    def L(*els):
        return (f'<g transform="translate({at[0]} {at[1]}) scale({k}) rotate({rot}) translate({-o[0]} {-o[1]})">'
                f'{"".join(els)}</g>')

    # Les rides de l'eau le long du corps.
    s.paper_stroke(8, L(p("M 684 640 Q 734 820 704 1000"), p("M 166 680 Q 120 830 150 1000"),
                        p("M 732 700 Q 774 840 750 980")))
    # Le corps allongé, sur le dos.
    body = e(420, 780, 210, 360)
    s.fill("brown", L(body))
    s.tint("black", L(shade(body, 300, 500, 640, 900, 0.0, 0.45)), screen="s", cell=10, angle=45)
    # Le plaid écossais, qui épouse le corps.
    blanket = p("M 196 690 C 260 626 580 626 644 690 C 690 820 670 1000 630 1160 L 210 1160 "
                "C 170 1000 150 820 196 690 Z")
    s.fill("sun", L(blanket))
    rows = range(712, 1180, 110)
    cols = range(206, 700, 110)
    s.over("red", L(clipped(blanket, "".join(rect(100, y, 640, 44) for y in rows))))
    s.tint("red", T(0.6, L(clipped(blanket, "".join(rect(x, 600, 44, 600) for x in cols)))),
           screen="p", cell=8, angle=30)
    thin = ("".join(p(f"M 100 {y + 22} L 740 {y + 22}") for y in rows)
            + "".join(p(f"M {x + 22} 600 L {x + 22} 1200") for x in cols))
    s.paper_stroke(7, L(clipped(blanket, thin)))
    s.tint("brown", L(shade(blanket, 300, 700, 660, 1000, 0.0, 0.6)), screen="b2", cell=10, angle=45)
    # Le rabat, à l'envers : fond rouge, rayures soleil.
    fold = p("M 192 690 C 258 622 582 622 648 690 L 656 746 C 590 680 250 680 184 746 Z")
    s.fill("red", L(fold))
    s.over("sun", L(clipped(fold, "".join(rect(x, 600, 40, 180) for x in cols))))
    s.paper_stroke(7, L(clipped(fold, "".join(p(f"M {x + 20} 600 L {x + 20} 780") for x in cols))))
    # La tasse fumante, tenue par les deux petites pattes avant.
    mug = rect(366, 552, 108, 100, r=16)
    handle = ring(488, 600, 30, 15)
    s.fill("aqua", L(mug, handle))
    s.paper(L(rect(366, 584, 108, 18)))
    s.paper_stroke(14, p("M 542 572 C 520 546 562 530 542 496"), p("M 588 548 C 566 520 608 504 588 468"))
    arms = (tube([(286, 536), (330, 584), (358, 612)], 50, 44)
            + tube([(556, 540), (514, 590), (486, 618)], 50, 44))
    paws = e(360, 616, 30, 26, 30) + e(484, 620, 30, 26, -30)
    s.fill("brown", L(arms, paws))
    s.tint("black", T(0.5, L(arms, paws)), screen="o", cell=8, angle=60)
    # La tête : brune, plus large que haute, visage clair, oreilles minuscules collées bas.
    head = e(420, 340, 198, 146)
    s.fill("brown", L(c(234, 384, 20), c(606, 384, 20)))
    s.fill("brown", L(head))
    s.tint("black", L(shade(head, 340, 220, 560, 480, 0.0, 0.4)), screen="h", cell=9, angle=45)
    face = p("M 254 382 C 254 292 330 252 420 264 C 510 252 586 292 586 382 C 586 452 512 486 420 486 "
             "C 328 486 254 452 254 382 Z")
    s.fill("cream", L(face))
    s.tint("brown", L(shade(face, 380, 300, 560, 480, 0.0, 0.35)), screen="f", cell=8, angle=45)
    # Le museau large et plat : deux gros coussinets à moustaches, la truffe en triangle.
    pads = c(380, 414, 50) + c(460, 414, 50)
    s.paper(L(pads))
    s.fill("black", L(c(356, 404, 6), c(372, 428, 6), c(346, 434, 6), c(484, 404, 6), c(468, 428, 6), c(494, 434, 6)))
    s.fill("black", L(p("M 390 370 Q 420 362 450 370 Q 446 384 420 400 Q 394 384 390 370 Z")))
    s.stroke("black", 8, L(p("M 420 400 L 420 424"), p("M 394 446 Q 420 466 446 446")))
    whisk = (p("M 336 410 L 194 382") + p("M 338 430 L 198 446") + p("M 504 410 L 646 382") + p("M 502 430 L 642 446"))
    s.stroke("black", 6, L(whisk))
    # Les yeux fermés de bonheur, les joues roses.
    s.stroke("black", 12, L(p("M 316 330 Q 345 300 374 330"), p("M 466 330 Q 495 300 524 330")))
    s.tint("pink", T(0.75, L(e(300, 394, 34, 18), e(540, 394, 34, 18))), screen="b", cell=8, angle=15)
    # Le petit cœur qui flotte au-dessus.
    s.fill("red", _heart(752, 250, 12))
    return s.layers()
