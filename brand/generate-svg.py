"""
Génère les quinze SVG de `brand/` ET les constantes TypeScript des clients,
depuis une seule géométrie. Rien ici ne s'édite à la main.

    python3 brand/generate-svg.py            # écrit brand/ + les modules TS
    python3 brand/generate-svg.py /tmp/out   # aperçu ailleurs, sans les TS

Dessin 2026-09 « l'Étreinte » : le poulpe est perché derrière l'écran qu'il
enlace de deux bras, deux pattes dépassent dessous, un play au centre, le
tricorne pirate sur la tête. Il remplace le « poulpe-téléviseur » de 2026-08,
dont les antennes dressées sur une tête carrée violette recomposaient l'emoji
diable — relevé par l'utilisateur, avec la consigne : une vraie tête en dôme,
des bras qui aient la signature du tentacule (courbe en S, effilement, bout
enroulé, ventouses), et un dégradé qui penche rose plutôt que violet.

Les bras sont des FORMES PLEINES effilées (voir geometry.py) : le rendu en
trait à paliers de dasharray a disparu, et avec lui la différence web/natif
(`pathLength` n'a plus à exister) — les trois modules TS générés sont
identiques.
"""
import pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from geometry import arm_spine, tapered, suckers, mirror_pts, spire_gap, width_at

BRAND = pathlib.Path(__file__).parent
OUT = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else BRAND
OUT.mkdir(parents=True, exist_ok=True)
PREVIEW = OUT.resolve() != BRAND.resolve()
ROOT = BRAND.parent

# ── Bras : (base, c1, c2), centre de spirale, r0, r1, θ0, tours, horaire,
#    largeur de base. Un seul côté se décrit ; l'autre est le miroir. ─────────
FRONT_ARM = (((86, 98), (66, 114), (61, 142)), (80, 174), 16, 9.5, 2.60, 0.65, False, 14)
BACK_LEG = (((90, 154), (72, 180), (74, 200)), (92, 214), 14, 8.5, 2.80, 0.55, False, 13)

# ── Pièces dessinées à la main ──────────────────────────────────────────────
HEAD = ("M 120 32 C 92 32, 70 52, 67 80 C 66 93, 70 102, 76 108 "
        "L 164 108 C 170 102, 174 93, 173 80 C 170 52, 148 32, 120 32 Z")
SHINE = ("M 120 36 C 98 36, 80 50, 76 70 C 96 60, 144 60, 164 70 "
         "C 160 50, 142 36, 120 36 Z")
SCREEN = {"x": 58, "y": 104, "w": 124, "h": 92, "rx": 16, "frame": 5}
PLAY = "M 114 134 L 142 150 L 114 166 Z"
SMILE = "M 114 95 C 117.5 100, 122.5 100, 126 95"
EYE_WHITES = ((99, 82, 15.5), (141, 82, 15.5))
EYE_PUPILS = ((102, 85, 8), (138, 85, 8))
EYE_GLINTS = ((104.5, 82, 3), (140.5, 82, 3))
CHEEKS = ((78, 96, 6.5, 4.5), (162, 96, 6.5, 4.5))

# Le tricorne est celui du dessin précédent, reposé sur le dôme (plus petit
# que l'ancien manteau, d'où l'échelle réduite). HAT_TM sert au monochrome.
HAT_T = "translate(120 33) rotate(-8) scale(0.64) translate(-120 -48)"
HAT_TM = HAT_T
HAT = "M 120 17 C 141 17, 157 28, 164 45 C 173 37, 184 31, 194 28 C 201 26, 205 31, 202 38 C 196 52, 185 63, 171 70 C 156 77, 139 80, 120 80 C 101 80, 84 77, 69 70 C 55 63, 44 52, 38 38 C 35 31, 39 26, 46 28 C 56 31, 67 37, 76 45 C 83 28, 99 17, 120 17 Z"
BAND = "M 76 50 C 92 60, 148 60, 164 50"
BRIM = "M 69 70 C 84 77, 101 80, 120 80 C 139 80, 156 77, 171 70"
SKULL = "M 120 27 C 128 27, 134 33, 134 40 C 134 44, 132 47, 129 49 L 129 52 C 129 54, 127 55, 125 55 L 115 55 C 113 55, 111 54, 111 52 L 111 49 C 108 47, 106 44, 106 40 C 106 33, 112 27, 120 27 Z"

def build():
    """Contours de bras et ventouses, avec garde-fou sur le jour des spires."""
    arms = {}
    for key, ((base, c1, c2), ctr, r0, r1, th, turns, cw, w) in (
            ("front", FRONT_ARM), ("back", BACK_LEG)):
        gap = spire_gap(r0, r1, turns)
        if gap <= width_at(0.6, w, 1.5):
            raise SystemExit(f"spires trop serrées ({key}) : jour {gap:.1f}")
        sp = arm_spine(base, c1, c2, ctr, r0, r1, th, turns, cw)
        arms[key] = [sp, mirror_pts(sp)]
    cups = []
    for sp in arms["front"]:
        cups += suckers(sp, FRONT_ARM[-1], (120, 150), count=4)
    return arms, cups

ARMS, CUPS = build()
FRONT_DS = [tapered(sp, FRONT_ARM[-1]) for sp in ARMS["front"]]
BACK_DS = [tapered(sp, BACK_LEG[-1]) for sp in ARMS["back"]]

# ── Dégradés : la consigne « plus rose que violet » se joue ici — le point
#    médian est passé du violet #8B5CF6 au fuchsia #D946EF. ──────────────────
GRADS = '''<linearGradient id="gV" x1="46" y1="26" x2="196" y2="214" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#A78BFA"/><stop offset=".42" stop-color="#D946EF"/><stop offset="1" stop-color="#EC4899"/></linearGradient>
<linearGradient id="gHd" x1="0" y1="26" x2="0" y2="140" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#C4B5FD"/><stop offset=".5" stop-color="#A855F7"/><stop offset="1" stop-color="#D946EF"/></linearGradient>
<linearGradient id="gA" x1="0" y1="118" x2="0" y2="230" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#9333EA"/><stop offset=".4" stop-color="#D946EF"/><stop offset="1" stop-color="#EC4899"/></linearGradient>
<linearGradient id="gT" x1="0" y1="104" x2="0" y2="196" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#341054"/><stop offset="1" stop-color="#190933"/></linearGradient>
<linearGradient id="gS" x1="0" y1="34" x2="0" y2="86" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<linearGradient id="gP" x1="114" y1="134" x2="142" y2="166" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#F0ABFC"/><stop offset="1" stop-color="#EC4899"/></linearGradient>
<linearGradient id="gH" x1="0" y1="14" x2="0" y2="78" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#3C3450"/><stop offset="1" stop-color="#15111F"/></linearGradient>'''

INK = "#241040"
S = SCREEN

def screen_rect(inset=0.0, fill="none", extra=""):
    return (f'<rect x="{S["x"]+inset}" y="{S["y"]+inset}" width="{S["w"]-2*inset}" '
            f'height="{S["h"]-2*inset}" rx="{S["rx"]-inset}" fill="{fill}"{extra}/>')

BODY = (
    f'<g fill="url(#gA)">{"".join(f"<path d=\"{d}\"/>" for d in BACK_DS)}</g>'
    f'<path d="{HEAD}" fill="url(#gHd)"/><path d="{SHINE}" fill="url(#gS)"/>'
    + screen_rect(fill="url(#gT)")
    + screen_rect(extra=f' stroke="url(#gV)" stroke-width="{S["frame"]}"')
    + "".join(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="#fff"/>' for cx, cy, r in EYE_WHITES)
    + "".join(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{INK}"/>' for cx, cy, r in EYE_PUPILS)
    + "".join(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="#fff"/>' for cx, cy, r in EYE_GLINTS)
    + "".join(f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="#DB2777" opacity=".5"/>'
              for cx, cy, rx, ry in CHEEKS)
    + f'<path d="{SMILE}" fill="none" stroke="{INK}" stroke-width="3.2" stroke-linecap="round"/>'
    + f'<path d="{PLAY}" fill="url(#gP)" stroke="url(#gP)" stroke-width="10" stroke-linejoin="round"/>')

HAT_G = (f'<g transform="{HAT_T}"><path d="{HAT}" fill="url(#gH)"/>'
         f'<path d="{BAND}" fill="none" stroke="url(#gV)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>'
         f'<path d="{SKULL}" fill="#F5F0FF"/>'
         '<g fill="#241145"><circle cx="115" cy="39" r="3.2"/><circle cx="125" cy="39" r="3.2"/></g></g>')

FRONT_G = (
    f'<g fill="url(#gA)">{"".join(f"<path d=\"{d}\"/>" for d in FRONT_DS)}</g>'
    '<g fill="#FBCFE8" opacity=".8">'
    + "".join(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.1f}"/>' for x, y, r in CUPS)
    + "</g>")

HEAD_TAG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="240" height="240" role="img">'
NOTE = "<!-- GÉNÉRÉ par brand/generate-svg.py — ne pas éditer à la main. -->"

(OUT / "logo-color.svg").write_text(
    f'{HEAD_TAG}<title>Tentacle TV</title>{NOTE}<defs>{GRADS}</defs>{BODY}{HAT_G}{FRONT_G}</svg>\n')
(OUT / "logo-color-nohat.svg").write_text(
    f'{HEAD_TAG}<title>Tentacle TV — sans chapeau</title>{NOTE}<defs>{GRADS}</defs>{BODY}{FRONT_G}</svg>\n')

# ── Monochrome : détails creusés au masque. L'écran devient un trou (son
#    cadre reste plein), le play y reste plein ; yeux et sourire se creusent
#    dans le dôme, pupilles re-pleines ; les bras avant se détachent du cadre
#    par un liseré. ─────────────────────────────────────────────────────────
fr = S["frame"] / 2
# Le liseré qui détache les bras avant ne vaut que sur l'ÉCRAN : plus haut, le
# bras longe la tête et doit fusionner avec elle — un clip le borne au cadre.
CLIP_ARMS = (f'<clipPath id="cArms"><rect x="0" y="{S["y"] - 4}" width="240" '
             f'height="{240 - S["y"] + 4}"/></clipPath>')
MASK = (f'<mask id="mCut"><rect width="240" height="240" fill="#fff"/>'
        + screen_rect(inset=fr, fill="#000")
        + f'<path d="{PLAY}" fill="#fff" stroke="#fff" stroke-width="10" stroke-linejoin="round"/>'
        + "".join(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="#000"/>' for cx, cy, r in EYE_WHITES)
        + "".join(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="#fff"/>' for cx, cy, r in EYE_PUPILS)
        + f'<path d="{SMILE}" fill="none" stroke="#000" stroke-width="3.2" stroke-linecap="round"/>'
        + f'<g transform="{HAT_TM}" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round">'
        f'<path d="{BRIM}" stroke-width="9"/><path d="{BAND}" stroke-width="10"/></g>'
        + f'<path transform="{HAT_TM}" fill="#000" d="{SKULL}"/>'
        + f'<g clip-path="url(#cArms)">'
        + "".join(f'<path d="{d}" fill="none" stroke="#000" stroke-width="8" stroke-linejoin="round"/>' for d in FRONT_DS)
        + "</g>"
        + "".join(f'<path d="{d}" fill="#fff"/>' for d in FRONT_DS)
        + '</mask>')
MONO_BODY = ("".join(f'<path d="{d}"/>' for d in BACK_DS)
             + f'<path d="{HEAD}"/>'
             + screen_rect(fill="currentColor")
             + f'<path d="{HAT}" transform="{HAT_TM}"/>'
             + "".join(f'<path d="{d}"/>' for d in FRONT_DS))
(OUT / "logo-mono.svg").write_text(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="240" height="240" color="#FFFFFF" role="img">'
    f'<title>Tentacle TV — monochrome</title>{NOTE}<defs>{CLIP_ARMS}{MASK}</defs>'
    f'<g mask="url(#mCut)" fill="currentColor">{MONO_BODY}</g></svg>\n')

# ── Icônes d'application : 86 % de large, fond plein (exigence Play) ─────────
SCALE = 1024 * 0.86 / 240
OFF = (1024 - 240 * SCALE) / 2
PLACE = f'transform="translate({OFF:.1f} {OFF:.1f}) scale({SCALE:.4f})"'
(OUT / "app-icon-color.svg").write_text(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024" role="img">'
    f"<title>Tentacle TV — icône d'application</title>{NOTE}<defs>{GRADS}"
    '<linearGradient id="bg" x1="0" y1="0" x2="1024" y2="1024" gradientUnits="userSpaceOnUse">'
    '<stop offset="0" stop-color="#241145"/><stop offset=".55" stop-color="#12081F"/><stop offset="1" stop-color="#000000"/></linearGradient>'
    '<radialGradient id="halo" cx="50%" cy="44%" r="62%"><stop offset="0" stop-color="#C026D3" stop-opacity=".40"/>'
    '<stop offset=".62" stop-color="#A855F7" stop-opacity=".10"/><stop offset="1" stop-color="#A855F7" stop-opacity="0"/></radialGradient></defs>'
    '<rect width="1024" height="1024" fill="url(#bg)"/><rect width="1024" height="1024" fill="url(#halo)"/>'
    f'<g {PLACE}>{BODY}{HAT_G}{FRONT_G}</g></svg>\n')
(OUT / "app-icon-mono.svg").write_text(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024" role="img">'
    f"<title>Tentacle TV — icône d'application (mono)</title>{NOTE}<defs>{CLIP_ARMS}{MASK}"
    '<linearGradient id="bgm" x1="0" y1="0" x2="1024" y2="1024" gradientUnits="userSpaceOnUse">'
    '<stop offset="0" stop-color="#A855F7"/><stop offset=".5" stop-color="#D946EF"/><stop offset="1" stop-color="#DB2777"/></linearGradient>'
    '<radialGradient id="glow" cx="30%" cy="22%" r="78%"><stop offset="0" stop-color="#fff" stop-opacity=".22"/>'
    '<stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>'
    '<rect width="1024" height="1024" fill="url(#bgm)"/><rect width="1024" height="1024" fill="url(#glow)"/>'
    f'<g {PLACE} color="#FFFFFF"><g mask="url(#mCut)" fill="currentColor">{MONO_BODY}</g></g></svg>\n')

# ── Compositions dérivées : bannières, écrans de lancement, couches tvOS ────
BG_CINEMA = ('<linearGradient id="bg" x1="0" y1="0" x2="{w}" y2="{h}" gradientUnits="userSpaceOnUse">'
             '<stop offset="0" stop-color="#241145"/><stop offset=".55" stop-color="#12081F"/>'
             '<stop offset="1" stop-color="#000000"/></linearGradient>'
             '<radialGradient id="halo" cx="50%" cy="44%" r="62%">'
             '<stop offset="0" stop-color="#C026D3" stop-opacity=".40"/>'
             '<stop offset=".62" stop-color="#A855F7" stop-opacity=".10"/>'
             '<stop offset="1" stop-color="#A855F7" stop-opacity="0"/></radialGradient>')

def compose(w, h, ratio, with_bg=True, with_hat=True, title=""):
    """
    Place la mascotte dans un cadre w×h, occupant `ratio` de la plus petite
    dimension. `with_bg` peint le fond cinéma — une icône d'application doit
    remplir son cadre, Play ayant déjà rejeté une livraison au motif inverse.
    """
    span = min(w, h) * ratio
    scale = span / 240
    ox, oy = (w - span) / 2, (h - span) / 2
    bg = (f'<rect width="{w}" height="{h}" fill="url(#bg)"/>'
          f'<rect width="{w}" height="{h}" fill="url(#halo)"/>') if with_bg else ""
    defs = GRADS + (BG_CINEMA.format(w=w, h=h) if with_bg else "")
    art = BODY + (HAT_G if with_hat else "") + FRONT_G
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" role="img">'
            f'<title>Tentacle TV{title}</title>{NOTE}<defs>{defs}</defs>{bg}'
            f'<g transform="translate({ox:.1f} {oy:.1f}) scale({scale:.4f})">{art}</g></svg>\n')

COMPOSITIONS = {
    # Avant-plan de l'icône adaptative Android : le système en rogne les bords,
    # d'où un cadrage plus large et un fond transparent.
    "app-icon-foreground.svg": (1024, 1024, 0.62, False, True, " — avant-plan adaptatif"),
    # Bannières et écrans de lancement.
    "banner-16x9.svg": (1280, 720, 0.72, True, True, " — bannière"),
    "banner-wide.svg": (620, 300, 0.78, True, True, " — bannière large"),
    "banner-topshelf.svg": (1920, 720, 0.68, True, True, " — Top Shelf"),
    "banner-topshelf-wide.svg": (2320, 720, 0.66, True, True, " — Top Shelf large"),
    "poster-2x3.svg": (720, 1080, 0.62, True, True, " — affiche"),
    # Le logo seul, sur transparent : posé par le système sur sa propre couleur.
    "logo-plain.svg": (1024, 1024, 0.92, False, True, " — logo seul"),
    # `LaunchLogo` tvOS n'est pas carré : une source carrée y serait étirée.
    "launch-logo.svg": (330, 360, 0.94, False, True, " — logo de lancement tvOS"),
    # tvOS attend deux COUCHES : le fond bouge moins que l'avant-plan.
    "tvos-back.svg": (400, 240, 0.001, True, True, " — couche arrière tvOS"),
    "tvos-front.svg": (400, 240, 0.86, False, True, " — couche avant tvOS"),
}
for name, (w, h, ratio, bg, hat, title) in COMPOSITIONS.items():
    if name == "tvos-back.svg":
        # Fond seul : la couche arrière ne porte pas la mascotte.
        (OUT / name).write_text(
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" role="img">'
            f'<title>Tentacle TV{title}</title>{NOTE}<defs>{BG_CINEMA.format(w=w, h=h)}</defs>'
            f'<rect width="{w}" height="{h}" fill="url(#bg)"/>'
            f'<rect width="{w}" height="{h}" fill="url(#halo)"/></svg>\n')
    else:
        (OUT / name).write_text(compose(w, h, ratio, bg, hat, title))

# ── Modules TypeScript : un SEUL contenu pour web, TV et mobile — les bras
#    étant des formes pleines, `pathLength` et les dasharray ont disparu, et
#    avec eux la différence web/natif. ──────────────────────────────────────
def ts_module():
    def circles(name, items, doc):
        rows = ",\n".join(f"  {{ cx: {cx}, cy: {cy}, r: {r} }}" for cx, cy, r in items)
        return f"/** {doc} */\nexport const {name}: readonly Circle[] = [\n{rows},\n];\n\n"
    out = ("// GÉNÉRÉ par brand/generate-svg.py — ne pas éditer à la main.\n"
           "//\n"
           "// Dessin « l'Étreinte » : le poulpe enlace l'écran. Les bras sont des\n"
           "// CONTOURS FERMÉS à remplir (fill), plus des traits à dasharray — le\n"
           "// même module sert le web et le natif.\n\n"
           "export interface Circle {\n  cx: number;\n  cy: number;\n  r: number;\n}\n\n"
           "export interface EllipseSpec {\n  cx: number;\n  cy: number;\n  rx: number;\n  ry: number;\n}\n\n"
           "/** Bras avant, gauche puis droit : ils enlacent l'écran, PAR-DESSUS. */\n"
           "export const FRONT_ARM_PATHS: readonly string[] = [\n"
           + ",\n".join(f'  "{d}"' for d in FRONT_DS) + ",\n] as const;\n\n"
           "/** Pattes arrière, gauche puis droite : elles dépassent SOUS l'écran. */\n"
           "export const BACK_ARM_PATHS: readonly string[] = [\n"
           + ",\n".join(f'  "{d}"' for d in BACK_DS) + ",\n] as const;\n\n")
    out += ("/** Ventouses des bras avant : le relief du dessin, chacune sur son ombre. */\n"
            "export const SUCKERS: readonly Circle[] = [\n"
            + ",\n".join(f"  {{ cx: {x:.1f}, cy: {y:.1f}, r: {r:.1f} }}" for x, y, r in CUPS)
            + ",\n];\n\n"
            "/** Décalage de l'ombre sous une ventouse, et son grossissement. */\n"
            "export const SUCKER_SHADOW = { x: 0.7, y: 0.9, scale: 1.18 } as const;\n\n"
            f'/** Le dôme de la tête. */\nexport const HEAD_PATH =\n  "{HEAD}";\n\n'
            f'/** Reflet du dôme (blanc fondu, opacité .28 → 0 de y=34 à 86). */\nexport const SHINE_PATH =\n  "{SHINE}";\n\n'
            "/** L'écran enlacé : rect arrondi + cadre. */\n"
            f"export const SCREEN = {{ x: {S['x']}, y: {S['y']}, width: {S['w']}, height: {S['h']}, rx: {S['rx']}, frameWidth: {S['frame']} }} as const;\n\n"
            f'/** Le play, au centre de l\'écran (stroke 10 joint rond pour l\'arrondi). */\nexport const PLAY_PATH = "{PLAY}";\n\n')
    out += circles("EYE_WHITES", EYE_WHITES, "Blancs des yeux.")
    out += circles("EYE_PUPILS", EYE_PUPILS, "Pupilles (encre #241040), regard vers le play.")
    out += circles("EYE_GLINTS", EYE_GLINTS, "Reflets des yeux.")
    out += ("/** Joues (rose #DB2777, opacité .5). */\n"
            "export const CHEEKS: readonly EllipseSpec[] = [\n"
            + ",\n".join(f"  {{ cx: {cx}, cy: {cy}, rx: {rx}, ry: {ry} }}" for cx, cy, rx, ry in CHEEKS)
            + ",\n];\n\n"
            f'/** Sourire (encre, trait 3.2 arrondi), au ras du cadre de l\'écran. */\nexport const SMILE_PATH = "{SMILE}";\n\n'
            "/** Le chapeau vit dans son propre repère ; voici comment l'y ramener. */\n"
            f'export const HAT_TRANSFORM = "{HAT_T}";\n\n')
    for name, value, doc in (("HAT_PATH", HAT, "La calotte du tricorne."),
                             ("HAT_BAND_PATH", BAND, "La bande dégradée du chapeau."),
                             ("HAT_BRIM_PATH", BRIM, "Le bord bas de la calotte (séparation en mono)."),
                             ("SKULL_PATH", SKULL, "Le crâne du pavillon.")):
        out += f'/** {doc} */\nexport const {name} =\n  "{value}";\n\n'
    return out

if not PREVIEW:
    TS = ts_module()
    for target in ("apps/web/src/components/ui/tentacleArmPaths.generated.ts",
                   "apps/tv/src/components/icons/tentacleArt.generated.ts",
                   "apps/mobile/src/components/tentacleArt.generated.ts"):
        path = ROOT / target
        if path.parent.exists():
            path.write_text(TS)
        else:
            print(f"  (ignoré, dossier absent : {target})")

print(f"{5 + len(COMPOSITIONS)} SVG — {len(CUPS)} ventouses, "
      f"{len(FRONT_DS) + len(BACK_DS)} bras"
      + (" (aperçu : modules TS non écrits)" if PREVIEW else " + 3 modules TS"))
