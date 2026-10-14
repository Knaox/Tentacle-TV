"""Smoking — Ne regarde qu'en noir et blanc. Trouve la couleur un peu vulgaire."""
from kit import *  # noqa: F401,F403
from scene import Scene


def _lid(x, y, r, a, b):
    """Paupière : ce qui, dans l'œil, est au-dessus de la droite (x-r, y+a) → (x+r, y+b)."""
    return clipped(c(x, y, r + 3), p(f"M {x - r - 40} {y - r - 60} L {x + r + 40} {y - r - 60} "
                                     f"L {x + r + 40} {y + b} L {x - r - 40} {y + a} Z"))


# ---------------------------------------------------------------- Smoking
def draw():
    s = Scene()
    # Gris moyen, éclairé en douche autour de la tête ; rayures de vieille pellicule.
    s.tint("black", rad(440, 330, 720, ((0, 0.1), (0.42, 0.32), (1, 0.85))), screen="bg", cell=11, angle=45)
    s.paper(rect(152, -10, 6, 1020, rot=1), rect(846, -10, 5, 1020, rot=-1), c(232, 150, 7), c(800, 690, 6), c(140, 760, 5))
    # Corps, aileron arrière.
    body = e(470, 830, 272, 330)
    s.fill("black", body, tube([(266, 690), (220, 820), (212, 950)], 72, 42))
    # Tête.
    head = c(450, 370, 160)
    s.fill("black", head)
    # Reflet sur le crâne, la lumière vient d'en haut à gauche.
    s.paper_stroke(18, p("M 318 452 Q 298 300 408 236"))
    s.tint("black", T(0.5, '<path d="M 318 452 Q 298 300 408 236" fill="none" stroke="white" stroke-width="22" stroke-linecap="round"/>'),
           screen="h", cell=8, angle=30)
    # Plastron.
    front = p("M 604 396 C 662 466 704 590 716 720 C 728 860 720 960 712 1040 L 318 1040 "
              "C 308 900 326 720 378 604 C 410 540 456 498 520 452 C 556 428 584 412 604 396 Z")
    s.paper(front)
    s.tint("black", shade(front, 420, 520, 730, 900, 0.0, 0.55), screen="g", cell=9, angle=45)
    # Bec levé, en silhouette dans la lumière.
    s.fill("black", p("M 546 296 Q 660 248 780 210 Q 692 302 614 404 Z"))
    # L'œil mi-clos qui toise, le sourcil haut.
    w, pu, gl = eye(498, 330, 44, look=(0.25, 0.8), pupil=0.5)
    s.paper(w)
    s.fill("black", pu)
    s.paper(gl)
    s.fill("black", _lid(498, 330, 44, 2, -4))
    # Monocle, son reflet, sa chaînette.
    s.paper_stroke(12, c(498, 330, 64))
    s.paper_stroke(8, p("M 452 314 Q 458 292 478 280"))
    chain = p("M 546 376 Q 556 470 604 520 Q 646 562 652 612")
    s.paper_stroke(8, clipped(head, chain))
    s.stroke("black", 8, clipped(front, chain))
    # Boutons de chemise, nœud papillon.
    s.fill("black", c(552, 650, 12), c(570, 738, 12), c(584, 826, 12))
    bow = (poly((520, 540), (446, 498), (452, 584)) + poly((520, 540), (590, 488), (600, 572)) + rect(500, 520, 42, 40, r=10, rot=-18))
    s.fill("black", f'<g transform="rotate(-6 520 540)">{bow}</g>')
    return s.layers()
