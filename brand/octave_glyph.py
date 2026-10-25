"""
Le glyphe d'Octave : ce qui représente le mode musique dans l'INTERFACE —
la bascule vers Octave, un onglet, une entrée de navigation —, de 16 à 24 px,
à côté des icônes du système (Lucide sur le web et le bureau). C'est aussi la
note que la mascotte montre sur son écran, dans le logo (`octave.py`).

Une croche, et son crochet est un BRAS de la mascotte : le même spine que les
bras du logo (`geometry.arm_spine`, Bézier puis spirale), effilé de la même
façon (`geometry.tapered`), qui s'enroule vers l'intérieur au lieu de pendre.
On lit d'abord une note — c'est ce qu'il faut comprendre dans une bascule —,
puis le tentacule. Aucun visage : des yeux creusés dans une forme pleine
lisaient « fantôme », « tête de mort » (le défaut du monochrome de la
mascotte, 2026-10-02).

Repère 240 × 240, comme `brand/*.svg`. Poids d'une icône Lucide à 24 px :
la hampe a la largeur de leur trait (2 px à 24 px, soit 20 ici, +2 pour
compenser l'absence d'arrondi) ; la tête et le crochet font la masse.
"""
import math

from geometry import arm_spine, tapered

# Inclinaison d'une tête gravée : une vingtaine de degrés.
HEAD_ROT = -22
# La tête : (centre x, centre y, demi-grand axe, demi-petit axe).
HEAD = (82, 182, 44, 32)
STEM_W = 22
STEM_TOP = 24

# Le crochet-bras : part du haut de la hampe, file à droite, descend et
# s'enroule (0,62 tour, la plage des bras du logo) ; base 26, pointe 8.
FLAG_W = (26, 8)
FLAG_TURNS = 0.62

# Le centre OPTIQUE du glyphe (milieu de son emprise, 38 → 197 × 24 → 214) :
# c'est lui qu'on pose au centre d'un écran ou d'un pouce.
OPTICAL_CENTER = (117, 119)


def ellipse_path(cx, cy, rx, ry, rot):
    """Ellipse inclinée de `rot` degrés, en deux arcs : un contour fermé."""
    a = math.radians(rot)
    dx, dy = rx * math.cos(a), rx * math.sin(a)
    x0, y0, x1, y1 = cx - dx, cy - dy, cx + dx, cy + dy
    arc = f"A {rx} {ry} {rot} 1 0"
    return f"M {x0:.2f} {y0:.2f} {arc} {x1:.2f} {y1:.2f} {arc} {x0:.2f} {y0:.2f} Z"


def polygon_path(points):
    """Polygone fermé."""
    return "M " + " L ".join(f"{x:.2f} {y:.2f}" for x, y in points) + " Z"


def glyph():
    """Les contours du glyphe, de l'arrière vers l'avant : hampe, crochet, tête."""
    cx, cy, rx, ry = HEAD
    a = math.radians(HEAD_ROT)
    # Le bord droit de la tête (côté du grand axe), où la hampe s'attache ;
    # elle naît dans la tête (un rien à l'intérieur) et monte jusqu'au crochet.
    ax, ay = cx + rx * math.cos(a), cy + rx * math.sin(a)
    x1 = ax + 1
    x0 = x1 - STEM_W
    stem = polygon_path([(x0, STEM_TOP), (x1, STEM_TOP), (x1, ay), (x0, ay + 6)])
    top = STEM_TOP
    spine = arm_spine((x0 + 10, top + 8), (x1 + 52, top + 6), (x1 + 84, top + 46),
                      (x1 + 60, top + 98), 24, 9, -0.1, FLAG_TURNS, cw=True)
    flag = tapered(spine, *FLAG_W)
    return [stem, flag, ellipse_path(cx, cy, rx, ry, HEAD_ROT)]


def placed(size, center, fill):
    """Le glyphe réduit à `size` (côté de son repère) et posé par son centre optique."""
    s = size / 240
    ox, oy = OPTICAL_CENTER
    tf = f"translate({center[0] - ox * s:.2f} {center[1] - oy * s:.2f}) scale({s:.4f})"
    return f'<g transform="{tf}" fill="{fill}">' + "".join(f'<path d="{d}"/>' for d in glyph()) + "</g>"


# Le glyphe EN COULEUR (sous 24 px, là où la mascotte n'est plus lisible) : le
# dégradé des bras (`gA` du logo), plus profond que celui du cadre — son violet
# clair (#A78BFA) tombait sous 3:1 sur fond clair. Lisible sur les deux fonds.
GLYPH_GRAD = ('<linearGradient id="gOg" x1="0" y1="24" x2="0" y2="214" gradientUnits="userSpaceOnUse">'
              '<stop offset="0" stop-color="#9333EA"/><stop offset=".45" stop-color="#D946EF"/>'
              '<stop offset="1" stop-color="#EC4899"/></linearGradient>')

HEAD_TAG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="240" height="240"{extra} role="img">'


def glyph_svg(color, note):
    """Le glyphe monochrome, à `currentColor` (couleur par défaut posée sur la racine)."""
    paths = "".join(f'<path d="{d}"/>' for d in glyph())
    return (HEAD_TAG.format(extra=f' color="{color}"') + f"<title>Octave</title>{note}"
            f'<g fill="currentColor">{paths}</g></svg>\n')


def glyph_color_svg(note):
    """Le glyphe au dégradé de la marque, pour les petites tailles en couleur."""
    paths = "".join(f'<path d="{d}"/>' for d in glyph())
    return (HEAD_TAG.format(extra="") + f"<title>Octave</title>{note}"
            f'<defs>{GLYPH_GRAD}</defs><g fill="url(#gOg)">{paths}</g></svg>\n')
