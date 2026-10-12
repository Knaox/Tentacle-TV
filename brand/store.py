"""
Les visuels de la fiche Microsoft Store de Tentacle Server : l'AFFICHE 9:16
(logo principal de Windows 10/11, exigé pour la Xbox) et la ZONE 1:1.
`generate-svg.py` les écrit par `write()` ; `generate-icons.py` les rasterise
aux tailles de Partner Center (`TARGETS`), dans `brand/store/server/`.

Contrairement aux visuels MSIX (la mascotte seule sur transparent), ceux-ci
ont un fond OPAQUE plein bord : le Store les pose tels quels, les recadre et
en arrondit les coins. D'où une marge généreuse — le dessin et le nom tiennent
dans le cadre central (`SAFE`), rien d'utile ne touche un bord.

Le dessin est le logo DÉDIÉ du serveur (`server.py` : la mascotte et son badge),
jamais celui de l'app de bureau, sur la nuit de la marque : un violet très
sombre, une lumière violette derrière la mascotte, une touche de rose en bas,
et un disque de verre discret. Jamais rien de Jellyfin (règles de la fiche,
`docs/server/windows-store-listing.md`).

Le nom « Tentacle Server » n'est que sur l'affiche, en courbes Inter
(`wordmark.py`). Sans la police ou ses modules, les SVG déjà présents sont
gardés tels quels : rien n'est réécrit sans le nom.
"""
from geometry import save
import server, wordmark


# Le fond : une nuit violette, du haut vers le bas.
NIGHT = ("#1E0B3D", "#0A0615")
# La lumière derrière la mascotte (violet → magenta au cœur), et la touche de
# rose en bas à droite : le dégradé violet → rose de la marque, en discret.
GLOW = (("0", "#C026D3", ".42"), (".5", "#A855F7", ".16"), ("1", "#A855F7", "0"))
BLUSH = (("0", "#EC4899", ".22"), ("1", "#EC4899", "0"))
# Le disque de verre : un voile blanc à peine visible et son liseré.
GLASS_FILL, GLASS_EDGE = ".035", ".08"

# Le nom : blanc, puis « Server » au dégradé de la marque.
NAME, SUFFIX = "Tentacle", " Server"
NAME_WEIGHT = 700
NAME_TRACKING = -0.015
TEXT_STOPS = (("0", "#C084FC"), ("1", "#F472B6"))

# Les compositions : (largeur, hauteur) du viewBox, côté du carré de 240 du
# logo, centre du logo (y), et le nom (largeur visée, ligne de base) ou rien.
POSTER = "store-server-poster.svg"
TILE = "store-server-tile.svg"
LAYOUTS = {
    POSTER: {"size": (720, 1080), "logo": 380, "cy": 450, "name": (480, 842)},
    TILE: {"size": (1080, 1080), "logo": 600, "cy": 540, "name": None},
}

# Le centre de l'encombrement du logo du serveur, dans son carré de 240 —
# mesuré sur un rendu de `logo-server.svg` (41,5 → 236 × 13 → 234) : le badge
# décale le dessin vers la droite, c'est CE centre qui se pose au milieu.
LOGO_CENTER = (138.75, 123.5)
# Le disque de verre, en part du côté du logo.
DISC = 0.62

# Les PNG de Partner Center : (fichier, source, largeur, hauteur).
OUT_DIR = "brand/store/server"
TARGETS = (
    ("poster-9x16-720x1080.png", POSTER, 720, 1080),
    ("poster-9x16-1440x2160.png", POSTER, 1440, 2160),
    ("tile-1x1-1080x1080.png", TILE, 1080, 1080),
    ("tile-1x1-2160x2160.png", TILE, 2160, 2160),
)
# Le fond qui sert d'aplat sous le rendu : aucune transparence ne sort.
OPAQUE = NIGHT[1]


def _stops(stops):
    return "".join(f'<stop offset="{o}" stop-color="{c}" stop-opacity="{a}"/>' for o, c, a in stops)


def _background(w, h, cy, logo):
    r = logo * DISC
    defs = (f'<linearGradient id="stNight" x1="0" y1="0" x2="0" y2="{h}" gradientUnits="userSpaceOnUse">'
            f'<stop offset="0" stop-color="{NIGHT[0]}"/><stop offset="1" stop-color="{NIGHT[1]}"/></linearGradient>'
            f'<radialGradient id="stGlow">{_stops(GLOW)}</radialGradient>'
            f'<radialGradient id="stBlush">{_stops(BLUSH)}</radialGradient>')
    body = (f'<rect width="{w}" height="{h}" fill="url(#stNight)"/>'
            f'<ellipse cx="{w * 0.86:g}" cy="{h * 0.92:g}" rx="{w * 0.7:g}" ry="{h * 0.42:g}" fill="url(#stBlush)"/>'
            f'<circle cx="{w / 2:g}" cy="{cy:g}" r="{r * 1.5:.1f}" fill="url(#stGlow)"/>'
            f'<circle cx="{w / 2:g}" cy="{cy:g}" r="{r:.1f}" fill="#FFFFFF" fill-opacity="{GLASS_FILL}" '
            f'stroke="#FFFFFF" stroke-opacity="{GLASS_EDGE}" stroke-width="{max(1.5, w / 480):g}"/>')
    return defs, body


def _logo(art, w, cy, span):
    """Le logo du serveur, imbriqué tel quel dans un `<svg>` à sa place."""
    svg = server.logo(art)
    head_end = svg.index(">", svg.index("<svg")) + 1
    k = span / 240
    x, y = w / 2 - LOGO_CENTER[0] * k, cy - LOGO_CENTER[1] * k
    return f'<svg x="{x:.2f}" y="{y:.2f}" width="{span}" height="{span}" viewBox="0 0 240 240">' + svg[head_end:]


def _name(w, target, baseline):
    """Le nom en courbes, centré : « Tentacle » blanc, « Server » au dégradé."""
    d1, w1, upm, _ = wordmark.outline(NAME, NAME_WEIGHT, NAME_TRACKING)
    d2, w2, _, _ = wordmark.outline(SUFFIX, NAME_WEIGHT, NAME_TRACKING)
    k = target / (w1 + w2)
    x0 = (w - target) / 2
    defs = (f'<linearGradient id="stText" x1="{x0 + w1 * k:.1f}" y1="0" x2="{x0 + target:.1f}" y2="0" '
            f'gradientUnits="userSpaceOnUse">'
            + "".join(f'<stop offset="{o}" stop-color="{c}"/>' for o, c in TEXT_STOPS) + "</linearGradient>")
    at = f'transform="translate({x0:.2f} {baseline}) scale({k:.5f})"'
    body = (f'<g {at}><path d="{d1}" fill="#FFFFFF"/>'
            f'<path transform="translate({w1:.1f} 0)" d="{d2}" fill="url(#stText)"/></g>')
    return defs, body


def _compose(art, name, layout):
    w, h = layout["size"]
    span, cy = layout["logo"], layout["cy"]
    defs, body = _background(w, h, cy, span)
    if layout["name"]:
        text_defs, text = _name(w, *layout["name"])
        defs, body = defs + text_defs, body + text
    body += _logo(art, w, cy, span)
    title = "affiche 9:16" if name == POSTER else "zone 1:1"
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" role="img">'
            f'<title>Tentacle Server — Microsoft Store, {title}</title>{art["NOTE"]}<defs>{defs}</defs>{body}</svg>\n')


def write(out, art):
    """
    Écrit les visuels du Store dans `out` ; `art` porte les pièces du dessin.
    Rend le nombre de fichiers écrits — zéro, avec un avertissement, si la
    police du nom manque (les fichiers en place restent valables).
    """
    try:
        files = {name: _compose(art, name, layout) for name, layout in LAYOUTS.items()}
    except wordmark.Unavailable as e:
        print(f"  visuels du Store gardés tels quels — {e}")
        return 0
    for name, text in files.items():
        save(out / name, text)
    return len(files)
