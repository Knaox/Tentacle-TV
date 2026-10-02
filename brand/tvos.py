"""
Les compositions de l'Apple TV : l'icône EN COUCHES. `generate-svg.py` les
écrit par `write()` et lui passe les pièces du dessin : rien ici ne redessine
la mascotte, tout se compose depuis elle.

L'icône suit la manière des apps d'Apple sur tvOS 26 (Réglages, Sing) : un
fond plein, le motif devant, en couches, et AUCUN reflet, ombre ni liseré
peint — le système pose les siens au focus (reflet qui suit le pouce, bord de
verre). Quatre couches, de l'arrière vers l'avant :

- le FOND, opaque : un violet de nuit, plus clair en haut. L'ancien fond
  cinéma tombait au noir pur dans un coin : sur l'accueil sombre de tvOS, la
  tuile s'y perdait et la mascotte flottait seule ;
- la LUMIÈRE : le halo des icônes de `brand/` (magenta au cœur, violet au
  bord), sur sa propre couche — il glisse derrière la mascotte quand l'icône
  s'incline ;
- le POULPE : tout le dessin, sauf les bras avant ;
- les BRAS avant, devant tout : à l'inclinaison, ils glissent devant l'écran
  qu'ils enlacent — « l'Étreinte » en relief. Leur base mord sur le dôme :
  aucun jour ne s'ouvre entre les deux couches.

Le cadrage est mesuré, pas deviné (sonde UIKit au simulateur tvOS 26.2 :
l'icône focalisée, inclinaison imposée au moteur de parallaxe du système, aux
neuf extrêmes) : la mascotte occupe 74 % de la hauteur de la tuile au repos,
l'encombrement des glyphes d'Apple, et son tricorne garde encore 11 % de marge
au pire de l'inclinaison.
"""

# Le cadre de l'icône, en points. L'App Store la prend à 1280×768 : même
# rapport, `generate-icons.py` rasterise chaque couche à la taille de sa cible.
ICON = (400, 240)
# Le carré de 240 du dessin, en part de la hauteur de la tuile. Le dessin
# remplit 90 % de son carré (13 → 228) : 0,82 le met à 74 % de la tuile.
ICON_SPAN = 0.82

# Le violet de nuit du fond, de haut en bas.
NIGHT = ("#43178C", "#1B0939")

# La lumière de la marque : la recette du halo de `brand/` (et de
# `TV_LIGHT.brandHalo` dans l'app), poussée pour se lire sur le violet.
LIGHT_STOPS = (("0", "#C026D3", ".82"), (".55", "#A855F7", ".24"), ("1", "#A855F7", "0"))
# Le rayon de la lumière, en part de la hauteur du cadre.
LIGHT_RADIUS = 0.62

def _svg(w, h, title, note, defs, body):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" role="img">'
            f'<title>Tentacle TV — {title}</title>{note}<defs>{defs}</defs>{body}</svg>\n')


def _stops(stops):
    return "".join(f'<stop offset="{o}" stop-color="{c}" stop-opacity="{a}"/>' for o, c, a in stops)


def _night(w, h):
    top, bottom = NIGHT
    defs = (f'<linearGradient id="night" x1="0" y1="0" x2="0" y2="{h}" gradientUnits="userSpaceOnUse">'
            f'<stop offset="0" stop-color="{top}"/><stop offset="1" stop-color="{bottom}"/></linearGradient>')
    return defs, f'<rect width="{w}" height="{h}" fill="url(#night)"/>'


def _light(w, h, rx, ry, stops=LIGHT_STOPS, gid="light"):
    """Une lumière ronde (ou étirée) au centre du cadre — un dégradé, sans bord."""
    defs = f'<radialGradient id="{gid}">{_stops(stops)}</radialGradient>'
    return defs, f'<ellipse cx="{w / 2:g}" cy="{h / 2:g}" rx="{rx:.1f}" ry="{ry:.1f}" fill="url(#{gid})"/>'


def _place(w, h, span):
    """Le carré de 240 du dessin, de côté `span`, centré dans le cadre."""
    s = span / 240
    return f'transform="translate({(w - span) / 2:.2f} {(h - span) / 2:.2f}) scale({s:.5f})"'


def _icon_layers(art):
    w, h = ICON
    note, grads = art["NOTE"], art["GRADS"]
    at = _place(w, h, h * ICON_SPAN)
    night_defs, night = _night(w, h)
    light_defs, light = _light(w, h, h * LIGHT_RADIUS, h * LIGHT_RADIUS)
    return {
        "tvos-back.svg": _svg(w, h, "icône tvOS, couche 1 : le fond", note, night_defs, night),
        "tvos-light.svg": _svg(w, h, "icône tvOS, couche 2 : la lumière", note, light_defs, light),
        "tvos-body.svg": _svg(w, h, "icône tvOS, couche 3 : le poulpe", note, grads,
                              f'<g {at}>{art["BODY"]}{art["HAT_G"]}</g>'),
        "tvos-front.svg": _svg(w, h, "icône tvOS, couche 4 : les bras avant", note, grads,
                               f'<g {at}>{art["FRONT_G"]}</g>'),
    }


def write(out, art):
    """
    Écrit les SVG de l'Apple TV dans `out` ; `art` porte les pièces du dessin
    (`GRADS`, `BODY`, `HAT_G`, `FRONT_G`) et la mention `NOTE`. Rend le nombre
    de fichiers écrits.
    """
    files = _icon_layers(art)
    for name, text in files.items():
        (out / name).write_text(text)
    return len(files)
