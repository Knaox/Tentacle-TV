"""Biscuit — A vu le même film quarante fois. Pleure toujours à la fin."""
from kit import *  # noqa: F401,F403
from scene import Scene


# ---------------------------------------------------------------- Biscuit
def _mirror(d):
    """Symétrique d'un chemin « M x y C … » autour de x = 500 (nombres par paires)."""
    out, nums = [], []
    for tok in d.split():
        try:
            nums.append(float(tok))
        except ValueError:
            out.append(tok)
            continue
        if len(nums) == 2:
            out.append(f"{1000 - nums[0]:g} {nums[1]:g}")
            nums = []
    return " ".join(out)


def draw():
    s = Scene()
    s.fill("aqua", FULL)
    s.tint("blue", rad(500, 460, 560, ((0, 0.0), (0.6, 0.05), (1, 0.7))), cell=12, angle=15)
    for x, y, r in [(170, 250, 9), (830, 230, 11), (860, 330, 6), (130, 360, 6), (780, 150, 6)]:
        s.paper(c(x, y, r))
    # Corps, collier.
    body = p("M 170 1000 C 190 820 300 700 500 690 C 700 700 810 820 830 1000 Z") + e(500, 676, 190, 70)
    s.fill("peach", body)
    s.fill("cream", e(500, 880, 150, 160))
    s.tint("orange", shade(body, 0, 700, 0, 1000, 0.0, 0.5), cell=10, angle=45)
    s.fill("red", tube([(330, 690), (500, 716), (670, 690)], 36, 36))
    s.fill("sun", c(500, 746, 22))
    # Oreilles tombantes, tachées, derrière la tête.
    ear_l = ("M 352 286 C 268 290 196 376 186 500 C 176 620 212 712 268 736 C 326 750 360 690 362 606 "
             "C 366 500 386 380 412 300 Z")
    ears = p(ear_l) + p(_mirror(ear_l))
    s.fill("peach", ears)
    s.fill("brown", clipped(ears, c(236, 600, 50) + c(300, 704, 26) + c(762, 520, 44) + c(716, 650, 24)))
    s.tint("orange", shade(ears, 0, 300, 0, 740, 0.25, 0.85), screen="e", cell=10, angle=45)
    # La tête.
    head = p("M 500 250 C 636 250 712 340 712 460 C 712 560 664 640 580 668 L 420 668 "
             "C 336 640 288 560 288 460 C 288 340 364 250 500 250 Z")
    s.fill("peach", head)
    s.fill("brown", clipped(head, e(600, 420, 96, 84, 20)))
    s.tint("orange", shade(head, 380, 300, 700, 700, 0.0, 0.42), screen="h", cell=10, angle=45)
    muzzle = e(500, 584, 132, 92)
    s.fill("cream", muzzle)
    s.tint("orange", shade(muzzle, 0, 560, 0, 680, 0.0, 0.35), screen="m", cell=8, angle=60)
    # Yeux brillants, émus, les larmes au bord.
    for x in (420, 580):
        w, pu, gl = eye(x, 452, 48, look=(0.0, -0.25), pupil=0.62)
        s.paper(w)
        s.fill("black", pu)
        s.tint("aqua", clipped(w, rect(x - 60, 470, 120, 40)), screen="w", cell=7, angle=30)
        s.stroke("aqua", 10, p(f"M {x - 40} 478 Q {x} 512 {x + 40} 478"))
        s.paper(c(x + 10, 428, 11), c(x - 12, 452, 6))
    s.stroke("black", 12, p("M 370 382 Q 404 352 450 350"), p("M 550 350 Q 596 352 630 382"))
    # Truffe, bouche qui tremble.
    s.fill("black", e(500, 548, 46, 32))
    s.paper(e(484, 538, 14, 8))
    s.stroke("black", 10, p("M 500 580 L 500 604"),
             p("M 446 640 Q 460 616 476 626 Q 490 634 500 604 Q 510 634 524 626 Q 540 616 554 640"))
    # La grosse larme, qui roule sur la joue.
    drop = p("M 392 540 C 344 604 342 664 392 666 C 442 664 440 604 392 540 Z")
    s.fill("aqua", tube([(404, 496), (400, 524), (394, 560)], 20, 24), drop)
    s.tint("blue", T(0.35, drop), screen="t", cell=7, angle=30)
    s.paper(e(376, 628, 9, 17, 20))
    # Le mouchoir à carreaux, tenu tout près du museau.
    s.fill("peach", tube([(780, 1010), (740, 880), (700, 800)], 100, 88), c(700, 790, 54))
    s.tint("orange", shade(tube([(780, 1010), (740, 880), (700, 800)], 100, 88), 0, 780, 0, 1000, 0.1, 0.5),
           screen="p", cell=8, angle=45)
    hanky = poly((598, 600), (690, 566), (746, 600), (766, 680), (738, 760), (668, 790), (614, 744), (626, 680))
    s.paper(hanky)
    check = "".join(rect(560, y, 240, 22) for y in range(578, 800, 50)) + "".join(rect(x, 540, 22, 280)
                                                                                  for x in range(600, 780, 50))
    s.tint("pink", clipped(hanky, T(0.55, check)), screen="f", cell=6, angle=30)
    s.stroke("pink", 12, hanky)
    fingers = c(642, 742, 22) + c(670, 760, 22) + c(700, 768, 21)
    s.fill("peach", fingers)
    s.tint("orange", T(0.3, fingers), screen="q", cell=7, angle=45)
    return s.layers()
