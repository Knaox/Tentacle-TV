"""Zapette — A volé la télécommande. Ne la rendra pas."""
import math
from kit import *  # noqa: F401,F403
from scene import Scene


# ---------------------------------------------------------------- Encore
def _rot(deg, x, y, *els, k=1.0):
    return (f'<g transform="translate({x} {y}) rotate({deg}) scale({k}) translate({-x} {-y})">'
            f'{"".join(els)}</g>')


# ---------------------------------------------------------------- Zapette
def _rings(pts, w0, w1, at, half=0.5):
    """Anneaux en travers d'un tube, aux fractions `at` de sa longueur."""
    s = tube_pts(pts)
    out = []
    m = len(s)
    for f in at:
        i = min(m - 2, max(1, int(f * (m - 1))))
        a, b = s[i - 1], s[i + 1]
        dx, dy = b[0] - a[0], b[1] - a[1]
        d = math.hypot(dx, dy) or 1
        w = (w0 + (w1 - w0) * i / (m - 1)) * 0.9
        x, y = s[i]
        nx, ny = -dy / d, dx / d
        out.append(tube([(round(x - nx * w, 1), round(y - ny * w, 1)), (round(x + nx * w, 1), round(y + ny * w, 1))],
                        w * half, w * half, cap=False))
    return "".join(out)


def draw():
    s = Scene()
    s.fill("orange", FULL)
    s.tint("red", rad(500, 470, 560, ((0, 0.0), (0.55, 0.1), (1, 0.8))), cell=12, angle=15)
    s.tint("sun", rad(500, 360, 300, ((0, 0.75), (1, 0.0))), screen="g", cell=12, angle=75)

    def H(*els):
        return _rot(6, 500, 460, *els)

    def fur(ink_shape, dens, scr):
        # Le gris du raton : lavande, assombrie d'une trame de bleu.
        s.fill("lav", ink_shape)
        s.tint("fed", T(dens, ink_shape), screen=scr, cell=8, angle=45)

    # La queue annelée, enroulée derrière lui.
    tail_pts = [(690, 780), (836, 690), (884, 548), (830, 404)]
    tail = tube(tail_pts, 132, 92)
    fur(tail, 0.3, "t")
    s.fill("black", clipped(tail, _rings(tail_pts, 132, 92, (0.36, 0.58, 0.8)) + c(830, 404, 56)))
    # Corps voûté, oreilles, tête.
    body = p("M 140 1000 C 128 830 200 650 340 616 C 420 600 580 600 660 616 C 800 650 872 830 860 1000 Z")
    fur(body, 0.62, "b")
    ears = (p("M 292 384 C 266 300 268 216 300 168 C 362 176 424 228 446 282 Z")
            + p("M 708 384 C 734 300 732 216 700 168 C 638 176 576 228 554 282 Z"))
    s.paper(H(ears))
    s.fill("black", H(p("M 314 344 C 302 292 304 244 320 212 C 358 224 394 254 410 286 Z"),
                      p("M 686 344 C 698 292 696 244 680 212 C 642 224 606 254 590 286 Z")))
    head = p("M 500 250 C 612 250 690 310 712 400 L 792 500 L 722 528 L 762 588 L 650 602 "
             "C 610 642 560 662 500 662 C 440 662 390 642 350 602 L 238 588 L 278 528 L 208 500 "
             "L 288 400 C 310 310 388 250 500 250 Z")
    fur(H(head), 0.26, "h")
    s.tint("fed", H(shade(head, 0, 420, 0, 660, 0.0, 0.5)), screen="hs", cell=10, angle=75)
    # Sourcils blancs relevés au milieu : coupable.
    s.paper(H(e(408, 370, 66, 22, -18), e(592, 370, 66, 22, 18)))
    # Le masque naturel.
    mask = p("M 236 474 C 278 424 358 404 430 422 Q 470 432 500 420 Q 530 432 570 422 C 642 404 722 424 764 474 "
             "C 742 524 692 564 640 560 C 590 556 560 524 530 504 Q 500 494 470 504 C 440 524 410 556 360 560 "
             "C 308 564 258 524 236 474 Z")
    s.fill("black", H(mask, poly((482, 424), (518, 424), (510, 300), (490, 300))))
    snout = p("M 356 566 C 416 560 448 524 470 506 Q 500 496 530 506 C 552 524 584 560 644 566 "
              "C 622 616 572 654 500 660 C 428 654 378 616 356 566 Z")
    s.paper(H(snout))
    s.tint("lav", H(shade(snout, 0, 560, 0, 660, 0.0, 0.7)), screen="m", cell=8, angle=60)
    for x in (406, 594):
        w, pu, gl = eye(x, 474, 38, look=(0.9, -0.1), pupil=0.48)
        s.paper(H(w))
        s.fill("black", H(pu))
        s.paper(H(gl))
    s.fill("black", H(e(500, 530, 32, 21)))
    s.paper(H(e(489, 523, 10, 6)))
    # Le rictus ravi, dents serrées.
    mouth = p("M 420 572 Q 500 606 580 572 Q 572 640 500 644 Q 428 640 420 572 Z")
    s.fill("black", H(mouth))
    s.paper(H(p("M 436 584 Q 500 610 564 584 Q 558 628 500 632 Q 442 628 436 584 Z")))
    s.stroke("black", 7, H(p("M 470 596 L 470 630"), p("M 500 602 L 500 634"), p("M 530 596 L 530 630"),
                           p("M 440 610 Q 500 630 560 610")))
    s.tint("pink", H(T(0.6, e(330, 596, 36, 16), e(670, 596, 36, 16))), screen="k", cell=8, angle=15)
    # La télécommande, serrée contre lui.
    def R(*els):
        return _rot(-10, 500, 820, *els)

    s.fill("black", R(rect(438, 690, 124, 300, r=30)))
    s.fill("red", R(c(500, 738, 19)))
    s.fill("yellow", R(c(470, 792, 15)))
    s.fill("aqua", R(c(530, 792, 15)))
    s.fill("pink", R(c(470, 840, 15)))
    s.fill("green", R(c(530, 840, 15)))
    s.paper(R(rect(462, 880, 76, 14, r=7), rect(462, 910, 76, 14, r=7)))
    arms = (tube([(214, 900), (320, 900), (432, 852)], 100, 78)
            + tube([(786, 880), (690, 836), (582, 776)], 100, 78))
    fur(arms, 0.2, "a")
    s.tint("fed", shade(arms, 0, 760, 0, 940, 0.0, 0.5), screen="as", cell=10, angle=75)
    s.fill("fed", c(436, 850, 38), c(574, 774, 38))
    s.fill("fed", c(466, 826, 15), c(474, 852, 15), c(468, 878, 14), c(546, 752, 14), c(540, 778, 14),
           c(546, 802, 13))
    return s.layers()
