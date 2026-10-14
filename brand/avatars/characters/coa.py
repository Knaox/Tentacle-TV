"""Coâ — Chante par-dessus toutes les comédies musicales. Juste. Enfin, presque."""
from kit import *  # noqa: F401,F403
from scene import Scene


def _group(x, y, rot, s, inner):
    return f'<g transform="translate({x} {y}) rotate({rot}) scale({s})">{inner}</g>'


def _note(x, y, s=1.0, rot=0):
    """Croche : tête, hampe, crochet."""
    g = (e(0, 0, 30, 22, -22) + rect(17, -122, 14, 122)
         + p("M 17 -122 C 44 -100 82 -88 72 -34 C 64 -66 46 -76 31 -80 L 31 -122 Z"))
    return _group(x, y, rot, s, g)


def _notes2(x, y, s=1.0, rot=0):
    """Deux croches liées."""
    g = (e(0, 0, 30, 22, -22) + e(100, -16, 30, 22, -22) + rect(17, -118, 14, 118) + rect(117, -134, 14, 118)
         + poly((17, -118), (131, -134), (131, -104), (17, -88)))
    return _group(x, y, rot, s, g)


def _lid(x, y, r, a, b):
    """Paupière : ce qui, dans l'œil, est au-dessus de la droite (x-r, y+a) → (x+r, y+b)."""
    return clipped(c(x, y, r + 3), p(f"M {x - r - 40} {y - r - 60} L {x + r + 40} {y - r - 60} "
                                     f"L {x + r + 40} {y + b} L {x - r - 40} {y + a} Z"))


# ---------------------------------------------------------------- Coâ
def draw():
    s = Scene()
    s.fill("pink", FULL)
    s.tint("purple", rad(500, 470, 560, ((0, 0.0), (0.55, 0.0), (1, 0.8))), cell=12, angle=15)
    # Notes de papier qui s'envolent (la dernière, un peu de travers).
    s.paper(_note(168, 345, 0.95, -14), _notes2(782, 352, 0.72, 10), _note(236, 176, 0.62, 24))
    # Corps, nœud papillon.
    body = e(500, 960, 330, 230)
    s.fill("green", body)
    s.fill("cream", e(500, 990, 210, 170))
    # Canotier, posé derrière les yeux.
    rot = 'transform="rotate(-11 500 250)"'
    brim = f'<ellipse cx="500" cy="262" rx="300" ry="46" {rot}/>'
    crown = f'<path d="M 382 258 L 392 136 Q 500 118 608 136 L 618 258 Z" {rot}/>'
    top = f'<ellipse cx="500" cy="136" rx="108" ry="22" {rot}/>'
    band = clipped(crown, f'<rect x="370" y="192" width="260" height="48" {rot}/>')
    s.fill("sun", brim, crown)
    s.tint("orange", shade(brim + crown, 0, 140, 0, 300, 0.0, 0.6), screen="h", cell=8, angle=60)
    s.fill("cream", top)
    s.fill("red", band)
    # Tête et yeux globuleux.
    domes = c(360, 328, 114) + c(640, 328, 114)
    head = e(500, 545, 312, 255) + domes
    s.fill("green", head)
    s.tint("teal", shade(head, 330, 330, 720, 820, 0.0, 0.75), cell=10, angle=45)
    for x, sg in ((360, 1), (640, -1)):
        # Grands yeux levés vers les cintres, paupière qui remonte vers le milieu : il y croit.
        w, pu, gl = eye(x, 352, 64, look=(-0.15 * sg, -0.75), pupil=0.4)
        s.paper(w)
        s.fill("black", pu)
        s.paper(gl)
        a, b = (-34, -58) if sg > 0 else (-58, -34)
        s.fill("green", _lid(x, 352, 64, a, b))
        # Sourcils hauts, le bout intérieur relevé.
        s.stroke("black", 15, p(f"M {x - 46 * sg} 280 Q {x - 2 * sg} 260 {x + 40 * sg} 250"))
    # Narines.
    s.fill("black", e(470, 528, 10, 7), e(530, 528, 10, 7))
    # La bouche grande ouverte.
    mouth = p("M 330 588 Q 500 628 670 588 C 664 724 584 790 500 790 C 416 790 336 724 330 588 Z")
    s.fill("black", mouth)
    s.fill("pink", clipped(mouth, e(500, 790, 110, 70)))
    s.fill("red", poly((500, 830), (412, 790), (412, 870)), poly((500, 830), (588, 790), (588, 870)))
    s.fill("red", rect(474, 806, 52, 48, r=12))
    s.tint("burgundy", T(0.6, poly((500, 830), (588, 790), (588, 870))), screen="t", cell=7, angle=30)
    return s.layers()
