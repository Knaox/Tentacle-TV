"""
Les visuels des paquets MSIX — Tentacle TV (bureau) et Tentacle Server pour
Windows. `generate-icons.py` les CRÉE d'après cette table : leurs noms et leurs
tailles sont fixés par Windows, pas relevés sur des fichiers en place.

Pourquoi des bordures autour du logo, avant (relevé du 2026-10-12) : chaque
visuel n'existait qu'en un exemplaire non qualifié, le carré à coins continus
de l'app (`app-icon-rounded.svg`), plein cadre. Sans variantes
`targetsize-*_altform-unplated`, Windows pose l'icône de la liste des
applications (barre des tâches, Démarrer, recherche) RÉDUITE sur une PLAQUE à
la couleur d'accent (`BackgroundColor="transparent"`) : la plaque débordait
autour du carré, et dans ses coins arrondis. Les tuiles (Windows 10) posaient
le même carré bord à bord, sans les 16 % de marge exigés. Et aucun
`resources.pri` n'indexait de variante : même présentes, Windows ne les aurait
pas vues (`.github/scripts/msix-resources.mjs` le construit désormais).

D'où, ici : la mascotte SEULE sur transparent (alpha droit, rendue à la taille
exacte, jamais réduite d'une autre), à toutes les échelles et tailles cibles,
claires et sombres ; aucune plaque peinte. Sous 24 px, sans chapeau (règle de
`logo-color-nohat.svg`). Sources : https://learn.microsoft.com/windows/apps/
design/iconography/app-icon-construction et …/uwp/launch-resume/live-tile-icons.
"""

# Les deux paquets : dossier des visuels → (logo, logo des petites tailles).
# Tentacle Server garde son chapeau même sous 24 px (choix de Damien,
# 2026-10-12 : c'est lui qui le fait reconnaître dans la barre des tâches).
PACKAGES = {
    "apps/desktop-electron/msix/Assets": ("logo-color.svg", "logo-color-nohat.svg"),
    "apps/server-windows/msix/Assets": ("logo-server.svg", "logo-server.svg"),
}

SCALES = (100, 125, 150, 200, 400)
# Tailles cibles de l'icône de la liste (Windows 11 : barre des tâches,
# Démarrer, recherche, Alt+Tab) — la liste « requise » de Microsoft.
TARGET_SIZES = (16, 20, 24, 30, 32, 36, 40, 48, 60, 64, 72, 80, 96, 256)
# Les trois habits d'une taille cible : sur plaque, sur thème sombre, sur
# thème clair. Le même dessin pour les trois : la mascotte garde 3:1 de
# contraste sur les deux thèmes (dôme clair, écran sombre au cadre rose).
TARGET_FORMS = ("", "_altform-unplated", "_altform-lightunplated")
# Au-dessous, le tricorne n'est plus qu'une tache.
NOHAT_BELOW = 24

# Part du petit côté qu'occupe la plus grande dimension du dessin MESURÉ.
FILL_ICON = 0.92  # icône sans plaque : le cadre est l'icône
FILL_PLATED = 0.78  # posée par Windows sur sa plaque : un peu d'air dedans
FILL_TILE = 0.62  # tuiles et écran de lancement : ≥ 16 % de marge (Microsoft)

# Visuel → (largeur, hauteur) à 100 %, et sa part occupée.
SCALED = {
    "Square44x44Logo": ((44, 44), FILL_PLATED),
    "Square71x71Logo": ((71, 71), FILL_TILE),
    "Square150x150Logo": ((150, 150), FILL_TILE),
    "Wide310x150Logo": ((310, 150), FILL_TILE),
    "Square310x310Logo": ((310, 310), FILL_TILE),
    "StoreLogo": ((50, 50), FILL_ICON),
    "SplashScreen": ((620, 300), FILL_TILE),
}


def _scaled(px, scale):
    # Arrondi au demi supérieur, comme le tableau de Microsoft (71 × 1,25 → 89).
    return int(px * scale / 100 + 0.5)


def assets(logo, nohat):
    """Liste (nom de fichier, largeur, hauteur, source SVG, part occupée)."""
    out = []
    for name, ((w, h), fill) in SCALED.items():
        for s in SCALES:
            sw, sh = _scaled(w, s), _scaled(h, s)
            out.append((f"{name}.scale-{s}.png", sw, sh, nohat if min(sw, sh) <= NOHAT_BELOW else logo, fill))
    for size in TARGET_SIZES:
        src = nohat if size <= NOHAT_BELOW else logo
        for form in TARGET_FORMS:
            out.append((f"Square44x44Logo.targetsize-{size}{form}.png", size, size, src, FILL_ICON))
    return out


def framed(svg, bbox, w, h, fill):
    """
    Le SVG source recadré pour un visuel w×h : son `viewBox` s'élargit autour
    du dessin MESURÉ (`bbox`, en unités du dessin) pour que sa plus grande
    dimension occupe `fill` du petit côté, centrée. Tout reste vectoriel : la
    marge n'est pas un collage de pixels.
    """
    x0, y0, x1, y1 = bbox
    k = fill * min(w, h) / max(x1 - x0, y1 - y0)
    vw, vh = w / k, h / k
    vx, vy = (x0 + x1) / 2 - vw / 2, (y0 + y1) / 2 - vh / 2
    head_end = svg.index(">", svg.index("<svg")) + 1
    head = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vx:.3f} {vy:.3f} {vw:.3f} {vh:.3f}" '
            f'width="{w}" height="{h}">')
    return head + svg[head_end:]


# L'icône de la zone de notification de Tentacle Server (`trayWindow.ts` la
# charge à SM_CXSMICON : 16, 20, 24, 32 selon l'échelle) — et de quoi servir
# les grandes tailles à l'Explorateur.
TRAY = ("apps/server-windows/assets/tray.ico", (16, 20, 24, 32, 40, 48, 64, 256))

# Les visuels que l'hôte du serveur charge lui-même (écran de démarrage,
# fenêtres) : chemins STABLES, recopiés dans le paquet par `layout.mts`.
SERVER_HOST_ASSETS = (
    ("apps/server-windows/assets/logo.png", 256, 256, "logo-server.svg", FILL_ICON),
    ("apps/server-windows/assets/logo@2x.png", 512, 512, "logo-server.svg", FILL_ICON),
)
