"""
Génère les cinq SVG de `brand/` ET les constantes TypeScript du composant web,
depuis une seule géométrie. Rien ici ne s'édite à la main.

    python3 brand/generate-svg.py

Les bras sont des SPIRALES rendues en trait à largeur dégressive. Trois approches
ont été essayées avant celle-ci :

  - Trait à largeur dégressive sur une trajectoire simple : produit toujours un
    tube lisse à bout arrondi, dont la forme prêtait à confusion.
  - Contour fermé festonné : juste en principe, mais là où un tentacule
    s'enroule, le rayon de courbure passe sous la demi-largeur et le bord
    concave se retourne. Sans enroulement, les bras deviennent des piques.
  - Spirale : la forme enroulée est la signature du tentacule et lève
    l'ambiguïté par la silhouette. Le trait reste la méthode de rendu, qui ne
    peut pas produire d'artefact.

Le relief ne vient PAS d'une arête lumineuse décalée — une bande claire délave le
bras au lieu de l'arrondir. Il vient de rangées de ventouses discrètes, chacune
ombrée, et de l'assombrissement de la naissance des bras.
"""
import pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from geometry import points, to_path, suckers, spire_gap

OUT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else pathlib.Path(__file__).parent)
ROOT = pathlib.Path(__file__).parent.parent

# ── Effilement : quatre paliers, pointe fine ────────────────────────────────
SEG_FRONT = [(3.4, "0 72 32 300"), (8, "0 50 26 300"), (15, "0 28 26 300"), (24, "32 300")]
SEG_BACK  = [(3.2, "0 72 32 300"), (7.5, "0 50 26 300"), (14, "0 28 26 300"), (22, "32 300")]
SEG_ANT   = [(2.6, "0 74 30 300"), (6, "0 52 26 300"), (11, "0 28 28 300"), (17, "32 300")]

# base, ctrl1, ctrl2, centre de spirale, r0, r1, angle d'entrée, tours, horaire.
# Rayons et tours inégaux : des spirales identiques alignées font motif.
# L'enroulement reste SOUS un demi-tour. Au-delà, la spirale se referme et
# l'extrémité lit « crochet » ; à cette ouverture elle s'incurve seulement, comme
# un tentacule au repos. Les valeurs varient légèrement d'un bras à l'autre.
FRONT = [
  (((88,176),(82,196),(76,205)), (57,212), 15.5, 10.0, -0.5, 0.50, False),
  (((108,181),(106,202),(103,212)), (93,227), 13.5, 8.7, -0.7, 0.54, False),
  (((132,181),(134,201),(137,211)), (147,223), 14.5, 9.4, -2.45, 0.48, True),
  (((152,176),(158,195),(164,204)), (183,215), 16.5, 10.6, -2.65, 0.52, True),
]
BACK = [
  (((60,170),(48,184),(38,192)), (22,201), 15, 9.7, -0.9, 0.50, False),
  (((180,170),(192,184),(202,192)), (218,201), 15, 9.7, -2.25, 0.50, True),
]
ANTENNAS = [
  (((64,62),(58,46),(53,38)), (42,26), 12, 7.7, 1.1, 0.46, True),
  (((176,62),(182,46),(187,38)), (198,26), 12, 7.7, 2.05, 0.46, False),
]

MANTLE = "M 120 54 C 152 54, 176 58, 186 68 C 194 76, 197 92, 197 118 C 197 144, 194 160, 186 168 C 176 178, 152 182, 120 182 C 88 182, 64 178, 54 168 C 46 160, 43 144, 43 118 C 43 92, 46 76, 54 68 C 64 58, 88 54, 120 54 Z"
TUBE = "M 120 76 C 145 76, 163 79, 171 86 C 177 92, 179 102, 179 118 C 179 134, 177 144, 171 150 C 163 157, 145 160, 120 160 C 95 160, 77 157, 69 150 C 63 144, 61 134, 61 118 C 61 102, 63 92, 69 86 C 77 79, 95 76, 120 76 Z"
GLASS = "M 120 79 C 143 79, 160 82, 168 88 C 172 91, 174 97, 175 106 C 150 98, 90 98, 65 106 C 66 97, 68 91, 72 88 C 80 82, 97 79, 120 79 Z"
SHINE = "M 120 58 C 150 58, 172 62, 182 70 C 188 76, 191 84, 192 96 C 160 82, 80 82, 48 96 C 49 84, 52 76, 58 70 C 68 62, 90 58, 120 58 Z"
SMILE = "M 110 145 C 115 154, 125 154, 130 145"
HAT_T = "translate(120 42) rotate(-8) scale(0.62) translate(-120 -48)"
HAT_TM = "translate(120 42) rotate(-8) scale(0.64) translate(-120 -48)"
HAT = "M 120 17 C 141 17, 157 28, 164 45 C 173 37, 184 31, 194 28 C 201 26, 205 31, 202 38 C 196 52, 185 63, 171 70 C 156 77, 139 80, 120 80 C 101 80, 84 77, 69 70 C 55 63, 44 52, 38 38 C 35 31, 39 26, 46 28 C 56 31, 67 37, 76 45 C 83 28, 99 17, 120 17 Z"
BAND = "M 76 50 C 92 60, 148 60, 164 50"
BRIM = "M 69 70 C 84 77, 101 80, 120 80 C 139 80, 156 77, 171 70"
SKULL = "M 120 27 C 128 27, 134 33, 134 40 C 134 44, 132 47, 129 49 L 129 52 C 129 54, 127 55, 125 55 L 115 55 C 113 55, 111 54, 111 52 L 111 49 C 108 47, 106 44, 106 40 C 106 33, 112 27, 120 27 Z"
CENTRE = (120, 150)

def build():
    """Tracés de bras et positions de ventouses, avec contrôle des spires."""
    arms = {"ant": [], "back": [], "front": []}
    cups = []
    for key, group, segs, towards, n in (("ant", ANTENNAS, SEG_ANT, (120, 70), 4),
                                         ("back", BACK, SEG_BACK, CENTRE, 6),
                                         ("front", FRONT, SEG_FRONT, CENTRE, 7)):
        for (base, c1, c2), centre, r0, r1, th, turns, cw in group:
            # Le contrôle ne vaut qu'au-delà d'un tour : en deçà, aucune spire
            # ne peut rattraper la précédente.
            if turns > 1:
                gap = spire_gap(r0, r1, turns)
                tip = segs[0][0]
                if gap <= tip * 1.4:
                    raise SystemExit(f"spires trop serrées ({key}) : jour {gap:.1f} pour une pointe de {tip}")
            pts = points(base, c1, c2, centre, r0, r1, th, turns, cw)
            arms[key].append(to_path(pts))
            cups += suckers(pts, segs[-1][0], towards, count=n, start=0.16, end=0.86)
    return arms, cups

ARMS, CUPS = build()
SHADOWS = "".join(f'<circle cx="{x+0.7:.1f}" cy="{y+0.9:.1f}" r="{r*1.18:.1f}"/>' for x, y, r in CUPS)
DOTS = "".join(f'<circle cx="{x-0.2:.1f}" cy="{y-0.3:.1f}" r="{r:.1f}"/>' for x, y, r in CUPS)

GRADS = '''<linearGradient id="gM" x1="40" y1="54" x2="200" y2="186" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#A78BFA"/><stop offset=".5" stop-color="#8B5CF6"/><stop offset="1" stop-color="#DB2777"/></linearGradient>
<linearGradient id="gA" x1="0" y1="170" x2="0" y2="235" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#4C1D95"/><stop offset=".18" stop-color="#7C3AED"/><stop offset="1" stop-color="#EC4899"/></linearGradient>
<linearGradient id="gB" x1="0" y1="160" x2="0" y2="215" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#3B0F73"/><stop offset=".2" stop-color="#4C1D95"/><stop offset="1" stop-color="#9D174D"/></linearGradient>
<linearGradient id="gT" x1="0" y1="78" x2="0" y2="156" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#2E1065"/><stop offset="1" stop-color="#160828"/></linearGradient>
<linearGradient id="gS" x1="0" y1="54" x2="0" y2="110" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff" stop-opacity=".3"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<linearGradient id="gG" x1="0" y1="78" x2="0" y2="130" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<linearGradient id="gH" x1="0" y1="14" x2="0" y2="78" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#3C3450"/><stop offset="1" stop-color="#15111F"/></linearGradient>
<linearGradient id="gBd" x1="76" y1="0" x2="164" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#8B5CF6"/><stop offset=".5" stop-color="#A855F7"/><stop offset="1" stop-color="#EC4899"/></linearGradient>'''

def arm_defs():
    out, i = [], 0
    ids = {"ant": [], "back": [], "front": []}
    for key in ("ant", "back", "front"):
        for d in ARMS[key]:
            out.append(f'<path id="t{i}" pathLength="100" d="{d}"/>')
            ids[key].append(f"t{i}"); i += 1
    return "".join(out), ids

ARM_DEFS, IDS = arm_defs()

def uses(keys, segs_by_key, extra=0, stroke=None):
    out = []
    for key in keys:
        for pid in IDS[key]:
            for w, da in segs_by_key[key]:
                s = f' stroke="{stroke}"' if stroke else ""
                out.append(f'<use href="#{pid}" stroke-width="{round(w+extra,1)}" stroke-dasharray="{da}"{s}/>')
    return "".join(out)

SEGS = {"ant": SEG_ANT, "back": SEG_BACK, "front": SEG_FRONT}
BODY = (f'<g fill="none" stroke="url(#gB)" stroke-linecap="round">{uses(("ant","back"), SEGS)}</g>'
        f'<g fill="none" stroke="url(#gA)" stroke-linecap="round">{uses(("front",), SEGS)}</g>'
        f'<g fill="#1B0B33" opacity=".22">{SHADOWS}</g><g fill="#fff" opacity=".26">{DOTS}</g>'
        f'<path d="{MANTLE}" fill="url(#gM)"/><path d="{SHINE}" fill="url(#gS)"/>'
        f'<path d="{TUBE}" fill="url(#gT)"/><path d="{GLASS}" fill="url(#gG)"/>'
        '<ellipse cx="98" cy="117" rx="19" ry="21" fill="#fff"/><ellipse cx="142" cy="117" rx="19" ry="21" fill="#fff"/>'
        '<circle cx="102" cy="121" r="9.5" fill="#1B0B33"/><circle cx="146" cy="121" r="9.5" fill="#1B0B33"/>'
        '<circle cx="97.5" cy="113" r="3.8" fill="#fff"/><circle cx="141.5" cy="113" r="3.8" fill="#fff"/>'
        f'<path d="{SMILE}" fill="none" stroke="#F472B6" stroke-width="4.6" stroke-linecap="round"/>'
        '<ellipse cx="76" cy="146" rx="10" ry="6" fill="#F472B6" opacity=".38"/>'
        '<ellipse cx="164" cy="146" rx="10" ry="6" fill="#F472B6" opacity=".38"/>')
HAT_G = (f'<g transform="{HAT_T}"><path d="{HAT}" fill="url(#gH)"/>'
         f'<path d="{BAND}" fill="none" stroke="url(#gBd)" stroke-width="6" stroke-linecap="round"/>'
         f'<path d="{SKULL}" fill="#fff"/>'
         '<g fill="#241145"><circle cx="115" cy="39" r="3.2"/><circle cx="125" cy="39" r="3.2"/></g></g>')
HEAD = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="240" height="240" role="img">'
NOTE = "<!-- GÉNÉRÉ par brand/generate-svg.py — ne pas éditer à la main. -->"

(OUT / "logo-color.svg").write_text(f'{HEAD}<title>Tentacle TV</title>{NOTE}<defs>{GRADS}{ARM_DEFS}</defs>{BODY}{HAT_G}</svg>\n')
(OUT / "logo-color-nohat.svg").write_text(f'{HEAD}<title>Tentacle TV — sans chapeau</title>{NOTE}<defs>{GRADS}{ARM_DEFS}</defs>{BODY}</svg>\n')

# ── Monochrome : détails creusés au masque, bras avant détachés d'un liseré ──
OUTLINE = 8
MASK = (f'<mask id="mCut"><rect width="240" height="240" fill="#fff"/>'
        f'<g fill="none" stroke-linecap="round">{uses(("front",), SEGS, OUTLINE, "#000")}{uses(("front",), SEGS, 0, "#fff")}</g>'
        f'<path d="{TUBE}" fill="#000"/>'
        '<ellipse cx="98" cy="116" rx="20" ry="22" fill="#fff"/><ellipse cx="142" cy="116" rx="20" ry="22" fill="#fff"/>'
        '<circle cx="101" cy="120" r="11" fill="#000"/><circle cx="145" cy="120" r="11" fill="#000"/>'
        f'<g transform="{HAT_TM}" fill="none" stroke="#000" stroke-linecap="round">'
        f'<path d="{BRIM}" stroke-width="9"/><path d="{BAND}" stroke-width="10"/></g>'
        f'<path transform="{HAT_TM}" fill="#000" d="{SKULL}"/></mask>')
MONO_BODY = (f'<g fill="none" stroke="currentColor" stroke-linecap="round">'
             f'{uses(("ant","back","front"), SEGS)}</g>'
             f'<path d="{MANTLE}"/><path d="{HAT}" transform="{HAT_TM}"/>')
(OUT / "logo-mono.svg").write_text(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="240" height="240" color="#FFFFFF" role="img">'
    f'<title>Tentacle TV — monochrome</title>{NOTE}<defs>{ARM_DEFS}{MASK}</defs>'
    f'<g mask="url(#mCut)" fill="currentColor">{MONO_BODY}</g></svg>\n')

# ── Icônes d'application : 86 % de large, fond plein (exigence Play) ─────────
SCALE = 1024 * 0.86 / 240
OFF = (1024 - 240 * SCALE) / 2
PLACE = f'transform="translate({OFF:.1f} {OFF:.1f}) scale({SCALE:.4f})"'
(OUT / "app-icon-color.svg").write_text(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024" role="img">'
    f"<title>Tentacle TV — icône d'application</title>{NOTE}<defs>{GRADS}{ARM_DEFS}"
    '<linearGradient id="bg" x1="0" y1="0" x2="1024" y2="1024" gradientUnits="userSpaceOnUse">'
    '<stop offset="0" stop-color="#241145"/><stop offset=".55" stop-color="#12081F"/><stop offset="1" stop-color="#000000"/></linearGradient>'
    '<radialGradient id="halo" cx="50%" cy="44%" r="62%"><stop offset="0" stop-color="#8B5CF6" stop-opacity=".46"/>'
    '<stop offset=".62" stop-color="#8B5CF6" stop-opacity=".10"/><stop offset="1" stop-color="#8B5CF6" stop-opacity="0"/></radialGradient></defs>'
    '<rect width="1024" height="1024" fill="url(#bg)"/><rect width="1024" height="1024" fill="url(#halo)"/>'
    f'<g {PLACE}>{BODY}{HAT_G}</g></svg>\n')
(OUT / "app-icon-mono.svg").write_text(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024" role="img">'
    f"<title>Tentacle TV — icône d'application (mono)</title>{NOTE}<defs>{ARM_DEFS}{MASK}"
    '<linearGradient id="bgm" x1="0" y1="0" x2="1024" y2="1024" gradientUnits="userSpaceOnUse">'
    '<stop offset="0" stop-color="#8B5CF6"/><stop offset=".52" stop-color="#A855F7"/><stop offset="1" stop-color="#DB2777"/></linearGradient>'
    '<radialGradient id="glow" cx="30%" cy="22%" r="78%"><stop offset="0" stop-color="#fff" stop-opacity=".22"/>'
    '<stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>'
    '<rect width="1024" height="1024" fill="url(#bgm)"/><rect width="1024" height="1024" fill="url(#glow)"/>'
    f'<g {PLACE} color="#FFFFFF"><g mask="url(#mCut)" fill="currentColor">{MONO_BODY}</g></g></svg>\n')

# ── Constantes TypeScript : le composant web ne peut pas lire les SVG, il lui
#    faut des variables CSS. Les générer supprime toute divergence possible. ──
def ts_list(name, items, doc):
    body = ",\n".join(f'  "{d}"' for d in items)
    return f"/** {doc} */\nexport const {name} = [\n{body},\n] as const;\n\n"

def ts_segs(name, segs, doc):
    body = ",\n".join(f'  {{ width: {w}, dash: "{da}" }}' for w, da in segs)
    return f"/** {doc} */\nexport const {name}: readonly ArmSegment[] = [\n{body},\n];\n\n"

ts = ('// GÉNÉRÉ par brand/generate-svg.py — ne pas éditer à la main.\n'
      '//\n'
      "// Les bras sont des SPIRALES : la forme enroulée est la signature du\n"
      "// tentacule et lève l'ambiguïté de silhouette qu'avait le tube lisse.\n"
      '// Le relief vient des ventouses ombrées, pas d\'une arête lumineuse — une\n'
      '// bande claire décalée délave le bras au lieu de l\'arrondir.\n\n'
      '/** Un palier de trait : largeur, et portion du tracé qu\'il couvre. */\n'
      'export interface ArmSegment {\n  width: number;\n  dash: string;\n}\n\n'
      '/** Une ventouse : centre et rayon, dans le repère 240×240. */\n'
      'export interface Sucker {\n  cx: number;\n  cy: number;\n  r: number;\n}\n\n')
ts += ts_segs("ARM_SEGMENTS", SEG_FRONT, "Bras avant. Du plus fin au plus épais : le gros recouvre les jonctions.")
ts += ts_segs("BACK_ARM_SEGMENTS", SEG_BACK, "Bras arrière.")
ts += ts_segs("ANTENNA_SEGMENTS", SEG_ANT, "Antennes.")
ts += ts_list("ANTENNA_PATHS", ARMS["ant"], "Les deux bras dressés en antennes.")
ts += ts_list("BACK_ARM_PATHS", ARMS["back"], "Bras extérieurs, derrière le corps.")
ts += ts_list("FRONT_ARM_PATHS", ARMS["front"], "Bras avant. Huit bras en tout, dont deux en antennes.")
ts += ("/** Ventouses : le relief du dessin. Chacune reçoit une ombre décalée. */\n"
       "export const SUCKERS: readonly Sucker[] = [\n"
       + ",\n".join(f'  {{ cx: {x:.1f}, cy: {y:.1f}, r: {r:.1f} }}' for x, y, r in CUPS)
       + ",\n];\n")
(ROOT / "apps/web/src/components/ui/tentacleArmPaths.generated.ts").write_text(ts)

print(f"5 SVG + tentacleArmPaths.generated.ts — {len(CUPS)} ventouses, "
      f"{sum(len(v) for v in ARMS.values())} bras")
