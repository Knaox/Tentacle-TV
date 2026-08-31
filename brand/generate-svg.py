"""Génère les cinq SVG de brand/ depuis une seule géométrie."""
import pathlib, sys

OUT = pathlib.Path(sys.argv[1])

# ── Effilement : quatre paliers, pointe FINE ────────────────────────────────
# Trois paliers laissaient une tige presque cylindrique finissant sur une boucle
# serrée — le trait y repassait sur lui-même et reformait une masse au bout.
ARM      = [(26, "30 300"), (17, "0 26 24 300"), (9, "0 46 26 300"), (3.6, "0 68 34 300")]
BACK_ARM = [(25, "30 300"), (16, "0 26 24 300"), (8.5, "0 46 26 300"), (3.4, "0 68 34 300")]
ANTENNA  = [(19, "30 300"), (12, "0 26 26 300"), (6, "0 48 26 300"), (2.8, "0 70 32 300")]

# ── Huit bras : deux dressés en antennes, six en dessous ────────────────────
ANT_L = "M 64 64 C 58 46, 54 32, 45 25 C 38 20, 32 25, 37 31"
ANT_R = "M 176 64 C 182 46, 186 32, 195 25 C 202 20, 208 25, 203 31"
# Les pointes s'incurvent doucement ; aucune ne se referme en boucle.
BACK_ARMS  = ["M 62 172 C 47 189, 30 199, 17 202 C 11 203, 8 200, 10 196",
              "M 178 172 C 193 189, 210 199, 223 202 C 229 203, 232 200, 230 196"]
# Longueurs et courbures volontairement inégales : quatre fuseaux parallèles de
# même longueur lisaient « peigne », et la régularité rendait la masse plus
# lourde qu'elle n'est.
FRONT_ARMS = ["M 88 180 C 82 199, 71 212, 57 218 C 50 221, 45 218, 47 213",
              "M 108 184 C 106 207, 100 226, 90 237 C 86 241, 81 240, 83 235",
              "M 132 184 C 135 205, 141 221, 151 231 C 155 235, 160 234, 158 229",
              "M 152 180 C 158 200, 169 215, 184 222 C 191 225, 196 222, 194 217"]

MANTLE = "M 120 54 C 152 54, 176 58, 186 68 C 194 76, 197 92, 197 118 C 197 144, 194 160, 186 168 C 176 178, 152 182, 120 182 C 88 182, 64 178, 54 168 C 46 160, 43 144, 43 118 C 43 92, 46 76, 54 68 C 64 58, 88 54, 120 54 Z"
TUBE = "M 120 76 C 145 76, 163 79, 171 86 C 177 92, 179 102, 179 118 C 179 134, 177 144, 171 150 C 163 157, 145 160, 120 160 C 95 160, 77 157, 69 150 C 63 144, 61 134, 61 118 C 61 102, 63 92, 69 86 C 77 79, 95 76, 120 76 Z"
GLASS = "M 120 79 C 143 79, 160 82, 168 88 C 172 91, 174 97, 175 106 C 150 98, 90 98, 65 106 C 66 97, 68 91, 72 88 C 80 82, 97 79, 120 79 Z"
SHINE = "M 120 58 C 150 58, 172 62, 182 70 C 188 76, 191 84, 192 96 C 160 82, 80 82, 48 96 C 49 84, 52 76, 58 70 C 68 62, 90 58, 120 58 Z"
SMILE = "M 110 145 C 115 154, 125 154, 130 145"

# Les ventouses disent « tentacule » mieux que la silhouette seule : elles
# rompent la régularité du fuseau et ancrent la lecture.
SUCKERS = [(79,197,3.2),(69,208,2.6),(59,214,2.0), (104,204,3.2),(99,220,2.6),(91,231,2.0),
           (137,203,3.2),(143,217,2.6),(150,226,2.0), (162,199,3.2),(172,211,2.6),(182,218,2.0),
           (34,195,2.5),(206,195,2.5)]

HAT_T  = "translate(120 42) rotate(-8) scale(0.62) translate(-120 -48)"
HAT_TM = "translate(120 42) rotate(-8) scale(0.64) translate(-120 -48)"
HAT   = "M 120 17 C 141 17, 157 28, 164 45 C 173 37, 184 31, 194 28 C 201 26, 205 31, 202 38 C 196 52, 185 63, 171 70 C 156 77, 139 80, 120 80 C 101 80, 84 77, 69 70 C 55 63, 44 52, 38 38 C 35 31, 39 26, 46 28 C 56 31, 67 37, 76 45 C 83 28, 99 17, 120 17 Z"
BAND  = "M 76 50 C 92 60, 148 60, 164 50"
BRIM  = "M 69 70 C 84 77, 101 80, 120 80 C 139 80, 156 77, 171 70"
SKULL = "M 120 27 C 128 27, 134 33, 134 40 C 134 44, 132 47, 129 49 L 129 52 C 129 54, 127 55, 125 55 L 115 55 C 113 55, 111 54, 111 52 L 111 49 C 108 47, 106 44, 106 40 C 106 33, 112 27, 120 27 Z"

def arm(d, segs, extra=0, stroke=None):
    """Du plus fin au plus épais : le gros recouvre les jonctions."""
    s = f' stroke="{stroke}"' if stroke else ""
    return "".join(f'<path d="{d}" pathLength="100" stroke-width="{w+extra}" stroke-dasharray="{da}"{s}/>'
                   for w, da in reversed(segs))

def arms(back_fill, front_fill):
    out = [f'<g fill="none" stroke="{back_fill}" stroke-linecap="round">']
    out += [arm(ANT_L, ANTENNA), arm(ANT_R, ANTENNA)]
    out += [arm(d, BACK_ARM) for d in BACK_ARMS]
    out.append('</g>')
    out.append(f'<g fill="none" stroke="{front_fill}" stroke-linecap="round">')
    out += [arm(d, ARM) for d in FRONT_ARMS]
    out.append('</g>')
    out.append('<g fill="#fff" opacity=".3">' +
               "".join(f'<circle cx="{x}" cy="{y}" r="{r}"/>' for x, y, r in SUCKERS) + '</g>')
    return "".join(out)

def face(mantle, shine, tube, glass, iris, accent, brand):
    return (f'<path fill="{mantle}" d="{MANTLE}"/><path fill="{shine}" d="{SHINE}"/>'
            f'<path fill="{tube}" d="{TUBE}"/><path fill="{glass}" d="{GLASS}"/>'
            f'<ellipse cx="98" cy="117" rx="19" ry="21" fill="#fff"/>'
            f'<ellipse cx="142" cy="117" rx="19" ry="21" fill="#fff"/>'
            f'<circle cx="102" cy="121" r="9.5" fill="{iris}"/><circle cx="146" cy="121" r="9.5" fill="{iris}"/>'
            f'<circle cx="97.5" cy="113" r="3.8" fill="#fff"/><circle cx="141.5" cy="113" r="3.8" fill="#fff"/>'
            f'<circle cx="106" cy="127" r="2" fill="{brand}" opacity=".9"/><circle cx="150" cy="127" r="2" fill="{brand}" opacity=".9"/>'
            f'<path d="{SMILE}" fill="none" stroke="{accent}" stroke-width="4.6" stroke-linecap="round"/>'
            f'<ellipse cx="76" cy="146" rx="10" ry="6" fill="{accent}" opacity=".38"/>'
            f'<ellipse cx="164" cy="146" rx="10" ry="6" fill="{accent}" opacity=".38"/>')

def hat(hat_fill, band_fill):
    return (f'<g transform="{HAT_T}"><path fill="{hat_fill}" d="{HAT}"/>'
            f'<path fill="none" stroke="{band_fill}" stroke-width="6" stroke-linecap="round" d="{BAND}"/>'
            f'<path fill="#fff" d="{SKULL}"/>'
            f'<g fill="#241145"><circle cx="115" cy="39" r="3.2"/><circle cx="125" cy="39" r="3.2"/></g></g>')

GRADS = '''<linearGradient id="gMantle" x1="40" y1="54" x2="200" y2="186" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#A78BFA"/><stop offset=".5" stop-color="#8B5CF6"/><stop offset="1" stop-color="#DB2777"/></linearGradient>
<linearGradient id="gArm" x1="0" y1="160" x2="0" y2="238" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#7C3AED"/><stop offset="1" stop-color="#EC4899"/></linearGradient>
<linearGradient id="gArmBack" x1="0" y1="150" x2="0" y2="230" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#5B21B6"/><stop offset="1" stop-color="#9D174D"/></linearGradient>
<linearGradient id="gTube" x1="0" y1="78" x2="0" y2="156" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#2E1065"/><stop offset="1" stop-color="#160828"/></linearGradient>
<linearGradient id="gGlass" x1="0" y1="78" x2="0" y2="130" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<linearGradient id="gShine" x1="0" y1="54" x2="0" y2="110" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff" stop-opacity=".3"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<linearGradient id="gHat" x1="0" y1="14" x2="0" y2="78" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#3C3450"/><stop offset="1" stop-color="#15111F"/></linearGradient>
<linearGradient id="gBand" x1="76" y1="0" x2="164" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#8B5CF6"/><stop offset=".5" stop-color="#A855F7"/><stop offset="1" stop-color="#EC4899"/></linearGradient>'''

BODY = (arms("url(#gArmBack)", "url(#gArm)") +
        face("url(#gMantle)", "url(#gShine)", "url(#gTube)", "url(#gGlass)", "#1B0B33", "#F472B6", "#8B5CF6"))
HEADER = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="240" height="240" role="img">'
NOTE = ('<!-- GÉNÉRÉ. Huit bras : deux dressés en antennes, six en dessous.\n'
        '     Effilement en quatre paliers jusqu\'à une pointe fine, et aucune pointe ne\n'
        '     se referme en boucle : une tige d\'épaisseur presque constante finissant sur\n'
        '     un enroulement serré reformait une masse au bout, dont la forme prêtait à\n'
        '     confusion. Les ventouses achèvent d\'ancrer la lecture « tentacule ». -->')

(OUT / "logo-color.svg").write_text(
    f'{HEADER}<title>Tentacle TV</title>{NOTE}<defs>{GRADS}</defs>{BODY}{hat("url(#gHat)", "url(#gBand)")}</svg>\n')
(OUT / "logo-color-nohat.svg").write_text(
    f'{HEADER}<title>Tentacle TV — sans chapeau</title>{NOTE}<defs>{GRADS}</defs>{BODY}</svg>\n')

# ── Monochrome : détails creusés au masque, bras avant détachés d'un liseré ──
OUTLINE = 8
knock = "".join(arm(d, ARM, OUTLINE, "#000") + arm(d, ARM, 0, "#fff") for d in FRONT_ARMS)
mask = (f'<mask id="mCut"><rect width="240" height="240" fill="#fff"/>'
        f'<g fill="none" stroke-linecap="round">{knock}</g>'
        f'<path d="{TUBE}" fill="#000"/>'
        f'<ellipse cx="98" cy="116" rx="20" ry="22" fill="#fff"/><ellipse cx="142" cy="116" rx="20" ry="22" fill="#fff"/>'
        f'<circle cx="101" cy="120" r="11" fill="#000"/><circle cx="145" cy="120" r="11" fill="#000"/>'
        f'<g transform="{HAT_TM}" fill="none" stroke="#000" stroke-linecap="round">'
        f'<path d="{BRIM}" stroke-width="9"/><path d="{BAND}" stroke-width="10"/></g>'
        f'<path transform="{HAT_TM}" fill="#000" d="{SKULL}"/></mask>')
mono_body = ('<g fill="none" stroke="currentColor" stroke-linecap="round">' +
             arm(ANT_L, ANTENNA) + arm(ANT_R, ANTENNA) +
             "".join(arm(d, BACK_ARM) for d in BACK_ARMS) +
             "".join(arm(d, ARM) for d in FRONT_ARMS) + '</g>' +
             f'<path d="{MANTLE}"/><path d="{HAT}" transform="{HAT_TM}"/>')
(OUT / "logo-mono.svg").write_text(
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="240" height="240" color="#FFFFFF" role="img">'
    f'<title>Tentacle TV — monochrome</title>{NOTE}<defs>{mask}</defs>'
    f'<g mask="url(#mCut)" fill="currentColor">{mono_body}</g></svg>\n')

# ── Icônes d'application : 86 % de large, fond plein (exigence Play) ─────────
SCALE = 1024 * 0.86 / 240
OFF = (1024 - 240 * SCALE) / 2
PLACE = f'transform="translate({OFF:.1f} {OFF:.1f}) scale({SCALE:.4f})"'
(OUT / "app-icon-color.svg").write_text(
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024" role="img">'
    f'<title>Tentacle TV — icône d\'application</title>{NOTE}<defs>{GRADS}'
    f'<linearGradient id="bg" x1="0" y1="0" x2="1024" y2="1024" gradientUnits="userSpaceOnUse">'
    f'<stop offset="0" stop-color="#241145"/><stop offset=".55" stop-color="#12081F"/><stop offset="1" stop-color="#000000"/></linearGradient>'
    f'<radialGradient id="halo" cx="50%" cy="44%" r="62%"><stop offset="0" stop-color="#8B5CF6" stop-opacity=".46"/>'
    f'<stop offset=".62" stop-color="#8B5CF6" stop-opacity=".10"/><stop offset="1" stop-color="#8B5CF6" stop-opacity="0"/></radialGradient></defs>'
    f'<rect width="1024" height="1024" fill="url(#bg)"/><rect width="1024" height="1024" fill="url(#halo)"/>'
    f'<g {PLACE}>{BODY}{hat("url(#gHat)", "url(#gBand)")}</g></svg>\n')
(OUT / "app-icon-mono.svg").write_text(
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024" role="img">'
    f'<title>Tentacle TV — icône d\'application (mono)</title>{NOTE}<defs>{mask}'
    f'<linearGradient id="bgm" x1="0" y1="0" x2="1024" y2="1024" gradientUnits="userSpaceOnUse">'
    f'<stop offset="0" stop-color="#8B5CF6"/><stop offset=".52" stop-color="#A855F7"/><stop offset="1" stop-color="#DB2777"/></linearGradient>'
    f'<radialGradient id="glow" cx="30%" cy="22%" r="78%"><stop offset="0" stop-color="#fff" stop-opacity=".22"/>'
    f'<stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>'
    f'<rect width="1024" height="1024" fill="url(#bgm)"/><rect width="1024" height="1024" fill="url(#glow)"/>'
    f'<g {PLACE} color="#FFFFFF"><g mask="url(#mCut)" fill="currentColor">{mono_body}</g></g></svg>\n')
print("5 SVG générés")
