"""Cape — Connaît l'ordre de visionnage de tous les films de super-héros."""
import math
from kit import *  # noqa: F401,F403
from scene import Scene


def draw():
    s = Scene()
    s.fill("red", FULL)
    cx, cy = 500, 470
    rays = []
    for i in range(16):
        a0, a1 = math.radians(i * 22.5), math.radians(i * 22.5 + 11)
        rays.append(poly((cx, cy), (round(cx + 900 * math.cos(a0)), round(cy + 900 * math.sin(a0))),
                         (round(cx + 900 * math.cos(a1)), round(cy + 900 * math.sin(a1)))))
    s.tint("sun", clipped("".join(rays), rad(cx, cy, 640, ((0, 0.1), (0.4, 0.5), (1, 0.8)))), cell=10, angle=15)
    # Les ailes, en cape : pointes à mi-hauteur, ourlet festonné.
    wings = p("M 500 360 C 380 350 300 330 220 360 C 160 382 110 420 84 470 Q 140 530 230 545 "
              "Q 270 620 350 640 Q 390 730 474 776 L 500 806 L 526 776 Q 610 730 650 640 Q 730 620 770 545 "
              "Q 860 530 916 470 C 890 420 840 382 780 360 C 700 330 620 350 500 360 Z")
    tail = tube([(500, 780), (508, 880), (530, 990)], 24, 10)
    # Les lobes de la tête, dressés comme les oreilles d'une cagoule.
    lobes = (tube([(418, 378), (396, 318), (370, 266)], 74, 52)
             + tube([(582, 378), (604, 318), (630, 266)], 74, 52))
    s.fill("fed", wings, tail, lobes)
    s.tint("black", shade(wings + lobes, 300, 300, 700, 800, 0.0, 0.6), screen="s", cell=10, angle=45)
    # Le dessous, plus clair : tête plate et large.
    belly = p("M 392 354 C 440 340 560 340 608 354 C 646 430 644 530 604 620 C 574 690 532 740 500 796 "
              "C 468 740 426 690 396 620 C 356 530 354 430 392 354 Z")
    s.fill("lav", belly)
    s.tint("violet", shade(belly, 420, 400, 620, 800, 0.0, 0.8), screen="v", cell=9, angle=75)
    # L'emblème : un éclair, avec son ombre de bande dessinée.
    bolt = [(524, 584), (452, 676), (498, 676), (466, 756), (556, 652), (508, 652), (540, 584)]
    s.fill("black", poly(*[(x + 12, y + 10) for x, y in bolt]))
    s.fill("sun", poly(*bolt))
    # Le loup.
    mask = p("M 336 424 C 300 404 292 382 300 356 C 360 378 422 380 470 408 Q 500 424 530 408 "
             "C 578 380 640 378 700 356 C 708 382 700 404 664 424 C 644 482 584 500 532 472 Q 500 458 468 472 "
             "C 416 500 356 482 336 424 Z")
    s.fill("black", mask)
    for x, sgn in ((420, 1), (580, -1)):
        s.paper(e(x, 444, 42, 26))
        s.fill("black", c(x - 2 * sgn, 438, 13))
        s.fill("black", clipped(e(x, 444, 44, 28), poly((x - 60, 400), (x + 60, 400),
                                                           (x + 60, 430 + 14 * sgn), (x - 60, 430 - 14 * sgn))))
    # Bouche résolue, menton levé.
    s.stroke("black", 13, p("M 420 540 Q 500 566 590 528"), p("M 584 520 L 600 536"))
    return s.layers()
