"""
Le logo de Tentacle Server pour Windows : la MÊME mascotte, et un badge
« serveur » en bas à droite. `generate-svg.py` les écrit par `write()` et lui
passe les pièces du dessin : rien ici ne redessine la mascotte.

Pourquoi un badge, et pas une autre mascotte : l'app de bureau et le serveur
se côtoient dans le menu Démarrer et la barre des tâches du même PC. Ils
doivent se reconnaître comme une famille (le poulpe, intact) et ne jamais se
confondre (le badge, lisible jusqu'à 16 px). Deux métaphores, pas une de plus
(règle des icônes de Windows) : le poulpe de la marque, la baie de serveur.

Le badge est une pastille au dégradé de la marque portant deux unités de baie
blanches, chacune sa diode et sa fente. Il est DÉTOURÉ : un jour transparent
le sépare du poulpe (masque `mServer`), pour qu'il se lise posé dessus et non
fondu dedans — sur fond clair comme sombre, sans liseré peint.

La mascotte recule de 14 vers la gauche (`SHIFT`) : le badge mord sur le coin
de l'écran et sur la spirale du bras droit, jamais sur le visage ni le play.
"""
from geometry import save


# Le badge, dans le carré de 240 du dessin : boîte, rayon, jour autour.
BADGE = {"x": 150, "y": 148, "size": 86, "rx": 22, "gap": 8}
# Décalage de la mascotte, pour que le badge ne couvre que le coin de l'écran.
SHIFT = -14
# Les deux unités de baie, relatives au coin du badge (x, y, largeur, hauteur).
UNITS = ((17, 22, 52, 18), (17, 46, 52, 18))
UNIT_RX = 5.5
# Diode « en ligne » et fente de chaque unité, relatives à l'unité.
LED = (9.5, 9, 3.6)
SLOT = (21, 7.25, 23, 3.5)

LED_COLOR = "#34D399"
SLOT_COLOR = "#3B0764"

GRAD = ('<linearGradient id="gSrv" x1="{x0}" y1="{y0}" x2="{x1}" y2="{y1}" gradientUnits="userSpaceOnUse">'
        '<stop offset="0" stop-color="#A855F7"/><stop offset=".5" stop-color="#D946EF"/>'
        '<stop offset="1" stop-color="#EC4899"/></linearGradient>')


def _rect(x, y, w, h, rx, fill):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}"/>'


def badge():
    """Les `defs` (dégradé, masque du jour) et le badge lui-même."""
    b = BADGE
    x, y, s = b["x"], b["y"], b["size"]
    g = b["gap"]
    defs = (GRAD.format(x0=x, y0=y, x1=x + s, y1=y + s)
            + '<mask id="mServer" maskUnits="userSpaceOnUse" x="0" y="0" width="240" height="240">'
            + '<rect width="240" height="240" fill="#fff"/>'
            + _rect(x - g, y - g, s + 2 * g, s + 2 * g, b["rx"] + g, "#000")
            + "</mask>")
    art = _rect(x, y, s, s, b["rx"], "url(#gSrv)")
    for ux, uy, uw, uh in UNITS:
        ax, ay = x + ux, y + uy
        art += _rect(ax, ay, uw, uh, UNIT_RX, "#FFFFFF")
        art += f'<circle cx="{ax + LED[0]}" cy="{ay + LED[1]}" r="{LED[2]}" fill="{LED_COLOR}"/>'
        art += _rect(ax + SLOT[0], ay + SLOT[1], SLOT[2], SLOT[3], SLOT[3] / 2, SLOT_COLOR)
    return defs, art


def _logo(art, with_hat, title):
    defs, mark = badge()
    body = art["BODY"] + (art["HAT_G"] if with_hat else "") + art["FRONT_G"]
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="240" height="240" role="img">'
            f'<title>Tentacle Server{title}</title>{art["NOTE"]}<defs>{art["GRADS"]}{defs}</defs>'
            f'<g mask="url(#mServer)"><g transform="translate({SHIFT} 0)">{body}</g></g>{mark}</svg>\n')


def logo(art):
    """Le logo du serveur, avec chapeau : la pièce que d'autres compositions posent (`store.py`)."""
    return _logo(art, True, "")


# Le logo que l'hôte charge lui-même (écran de démarrage, fenêtres) : chemin
# STABLE, recopié dans le paquet par `scripts/assemble/layout.mts`.
HOST_LOGO = "apps/server-windows/assets/logo.svg"


def write(out, art, root=None):
    """
    Écrit les logos du serveur dans `out` ; `art` porte les pièces du dessin
    (`GRADS`, `BODY`, `HAT_G`, `FRONT_G`) et la mention `NOTE`. Avec `root`
    (la racine du dépôt), recopie aussi le logo chez l'hôte. Rend le nombre de
    fichiers écrits dans `out`. Sans chapeau sous 24 px, comme le logo de l'app.
    """
    files = {
        "logo-server.svg": _logo(art, True, ""),
        "logo-server-nohat.svg": _logo(art, False, " — sans chapeau"),
    }
    for name, text in files.items():
        save(out / name, text)
    if root is not None and (root / HOST_LOGO).parent.exists():
        save(root / HOST_LOGO, files["logo-server.svg"])
    return len(files)
