"""
Les notes d'Octave : ce que la pieuvre tient À LA PLACE de l'écran.

Trois propositions, chacune dans le repère 240 × 240 du logo, chacune
composée des mêmes primitives que lui : des contours fermés à remplir, rien
qui dépende d'une police ni d'un glyphe. Une note est un « objet tenu » comme
l'était l'écran : vitre sombre (`gT`), cadre au dégradé de la marque (`gV`),
et un éclat rose (`gP`) là où l'écran avait son play.

- `double` — la double-croche (deux têtes, deux hampes, une barre) enlacée
  comme l'écran : la barre prend la place du haut du cadre et ferme le dôme,
  les hampes courent sous les bras, les spirales se referment sur les têtes.
- `screen` — l'écran gardé tel quel, la double-croche en place du play.
- `quaver` — une croche seule, le crochet dessiné comme un bras (spine
  effilé, `geometry.tapered`) : la note devient un tentacule de plus.
"""
import math

from geometry import arm_spine, tapered


def ellipse_path(cx, cy, rx, ry, rot):
    """Ellipse inclinée de `rot` degrés, en deux arcs : un contour fermé."""
    a = math.radians(rot)
    dx, dy = rx * math.cos(a), rx * math.sin(a)
    x0, y0, x1, y1 = cx - dx, cy - dy, cx + dx, cy + dy
    arc = f"A {rx} {ry} {rot} 1 0"
    return (f"M {x0:.2f} {y0:.2f} {arc} {x1:.2f} {y1:.2f} "
            f"{arc} {x0:.2f} {y0:.2f} Z")


def polygon_path(points):
    """Polygone fermé ; ses angles s'arrondissent au trait (`linejoin` rond)."""
    return "M " + " L ".join(f"{x:.2f} {y:.2f}" for x, y in points) + " Z"


def head_anchor(cx, cy, rx, rot):
    """Le bord droit de la tête, où la hampe s'attache (côté du grand axe)."""
    a = math.radians(rot)
    return cx + rx * math.cos(a), cy + rx * math.sin(a)


# Une tête de note : (centre x, centre y, demi-grand axe, demi-petit axe, inclinaison).
# L'inclinaison classique d'une tête gravée est d'une vingtaine de degrés.
HEAD_ROT = -22


def beamed_pair(heads, stem_w, beam_top, beam_h):
    """
    Double-croche : deux têtes, deux hampes montées à droite de chaque tête,
    une barre qui les relie en haut. `beam_top` donne le haut de la barre à
    gauche puis à droite (la barre monte vers la droite, comme à la gravure).
    Rend la liste des contours, de l'arrière vers l'avant.
    """
    parts = []
    stems = []
    for cx, cy, rx, ry in heads:
        ax, ay = head_anchor(cx, cy, rx, HEAD_ROT)
        # La hampe naît dans la tête (un rien à l'intérieur), monte jusqu'à la barre.
        x1 = ax + 0.6
        x0 = x1 - stem_w
        stems.append((x0, x1, ay))
    (lx0, _, ly), (_, rx1, ry_) = stems
    yl, yr = beam_top
    slope = (yr - yl) / (rx1 - lx0)
    top_at = lambda x: yl + slope * (x - lx0)
    beam = [(lx0, top_at(lx0)), (rx1, top_at(rx1)),
            (rx1, top_at(rx1) + beam_h), (lx0, top_at(lx0) + beam_h)]
    for x0, x1, ay in stems:
        parts.append(polygon_path([(x0, top_at(x0) + 2), (x1, top_at(x1) + 2),
                                   (x1, ay - 2), (x0, ay + 1)]))
    parts.append(polygon_path(beam))
    for cx, cy, rx, ry in heads:
        parts.append(ellipse_path(cx, cy, rx, ry, HEAD_ROT))
    return parts


def double():
    """La double-croche enlacée : elle occupe la place de l'écran (58 → 182)."""
    heads = ((73, 180, 16, 11.5), (147, 176, 16, 11.5))
    return {"parts": beamed_pair(heads, stem_w=11, beam_top=(110, 104), beam_h=17),
            "glints": [(cx - 4, cy - 3.5, 3.2) for cx, cy, _, _ in heads]}


def screen_glyph():
    """La double-croche posée dans l'écran, à la place du play (114 → 142)."""
    heads = ((111, 162, 7.2, 5.2), (135, 159, 7.2, 5.2))
    return {"parts": beamed_pair(heads, stem_w=4.4, beam_top=(134, 130), beam_h=6.5)}


def quaver():
    """
    La croche seule : tête au centre, hampe à sa droite, et le crochet tracé
    comme un bras — spine en Bézier qui s'enroule (sous le demi-tour), contour
    effilé par `tapered`. Le crochet descend vers la droite, comme à la gravure.
    """
    head = (86, 180, 18, 13)
    ax, ay = head_anchor(head[0], head[1], head[2], HEAD_ROT)
    x1 = ax + 0.6
    x0 = x1 - 12
    top = 108
    stem = polygon_path([(x0, top), (x1, top), (x1, ay - 2), (x0, ay + 1)])
    # Le crochet part du haut de la hampe et s'enroule vers la spirale du bras
    # droit, qui le saisit comme le bras gauche saisit la tête.
    spine = arm_spine((x1 - 6, top + 2), (x1 + 30, top + 6), (x1 + 50, top + 26),
                      (x1 + 44, top + 52), 12, 7, -0.6, 0.45, cw=True)
    flag = tapered(spine, 14, 2.4)
    return {"parts": [stem, flag, ellipse_path(*head, HEAD_ROT)],
            "glints": [(head[0] - 5, head[1] - 4, 3.6)]}


PROPOSALS = {"double": double, "screen": screen_glyph, "quaver": quaver}
