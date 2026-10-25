"""
Le glyphe d'Octave : ce qui représente le mode musique dans l'INTERFACE —
la bascule vers Octave, un onglet, une entrée de navigation —, de 16 à 24 px,
à côté des icônes du système (Lucide sur le web et le bureau).

Une croche, et son crochet est un BRAS de la mascotte : le même spine que les
bras du logo (`geometry.arm_spine`, Bézier puis spirale), effilé de la même
façon (`geometry.tapered`), qui s'enroule vers l'intérieur au lieu de pendre.
On lit d'abord une note — c'est ce qu'il faut comprendre dans une bascule —,
puis le tentacule. Une seule couleur (`currentColor`), aucun visage : des
yeux creusés dans une forme pleine lisaient « fantôme », « tête de mort »
(le défaut du monochrome de la mascotte, 2026-10-02).

Repère 240 × 240, comme `brand/*.svg`. Poids d'une icône Lucide à 24 px :
la hampe a la largeur de leur trait (2 px à 24 px, soit 20 ici, +2 pour
compenser l'absence d'arrondi) ; la tête et le crochet font la masse.
"""
from geometry import arm_spine, tapered
from octave_notes import HEAD_ROT, ellipse_path, head_anchor, polygon_path

# La tête : (centre x, centre y, demi-grand axe, demi-petit axe), inclinée de
# HEAD_ROT comme une tête gravée.
HEAD = (82, 182, 44, 32)
STEM_W = 22
STEM_TOP = 24

# Le crochet-bras : part du haut de la hampe, file à droite, descend et
# s'enroule (0,62 tour, la plage des bras du logo) ; base 26, pointe 8.
FLAG_W = (26, 8)
FLAG_TURNS = 0.62


def glyph():
    """Les contours du glyphe, de l'arrière vers l'avant : hampe, crochet, tête."""
    cx, cy, rx, ry = HEAD
    ax, ay = head_anchor(cx, cy, rx, HEAD_ROT)
    # La hampe naît dans la tête (un rien à l'intérieur) et monte jusqu'au crochet.
    x1 = ax + 1
    x0 = x1 - STEM_W
    stem = polygon_path([(x0, STEM_TOP), (x1, STEM_TOP), (x1, ay), (x0, ay + 6)])
    top = STEM_TOP
    spine = arm_spine((x0 + 10, top + 8), (x1 + 52, top + 6), (x1 + 84, top + 46),
                      (x1 + 60, top + 98), 24, 9, -0.1, FLAG_TURNS, cw=True)
    flag = tapered(spine, *FLAG_W)
    return [stem, flag, ellipse_path(cx, cy, rx, ry, HEAD_ROT)]


HEAD_TAG = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="240" height="240"'
            ' color="{color}" role="img">')


def glyph_svg(color, note):
    """Le glyphe en document autonome, à `currentColor` (couleur par défaut sur la racine)."""
    paths = "".join(f'<path d="{d}"/>' for d in glyph())
    return (HEAD_TAG.format(color=color) + f"<title>Octave</title>{note}"
            f'<g fill="currentColor">{paths}</g></svg>\n')
