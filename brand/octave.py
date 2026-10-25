"""
Le logo d'Octave, le mode musique de Tentacle : la MÊME mascotte, son
tricorne de pirate sur la tête (celui de `tentacle-logo-pirate.svg`, la
marque de toujours), qui montre sur son écran le glyphe d'Octave à la place
du play.
Rien ici ne redessine le poulpe : ses pièces (bras, tête, visage, écran,
dégradés) sont LUES dans `generate-svg.py`, exécuté vers un dossier jetable —
le logo d'origine et ses fichiers ne sont jamais réécrits par ce script.

    python3 brand/octave.py            # brand/octave/ + le module TS du web
    python3 brand/octave.py /tmp/out   # aperçu ailleurs, sans le module TS

Le glyphe (la croche dont le crochet est un bras) vit dans `octave_glyph.py`,
le module TypeScript dans `octave_ts.py`.

Le dessin d'avant (2026-10, une double-croche géante à la place de l'écran,
monochrome aux orbites creusées) est retiré : la note « trop grosse », pas
« natif » (Damien, 25/10). Le chapeau, lui, était parti avec, à tort : sans
lui la mascotte est « chauve, ça rend moche » (Damien, 25/10 au soir) — il
est revenu, à toutes les tailles.
"""
import pathlib
import runpy
import sys
import tempfile

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from geometry import save
import octave_glyph
import octave_ts

BRAND = pathlib.Path(__file__).parent
ROOT = BRAND.parent
OUT = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else BRAND / "octave"
PREVIEW = OUT.resolve() != (BRAND / "octave").resolve()

# La note sur l'écran : le glyphe posé par son centre optique au centre de
# l'écran (58 → 182 × 104 → 196), à 76 de côté de repère — sa tête et son
# crochet occupent l'écran comme le play, sans approcher les spirales des bras
# qui s'enroulent dans les coins du bas.
NOTE_SIZE = 76
NOTE_CENTER = (120, 151)

# Les encres du glyphe monochrome : blanc pour un fond sombre, l'encre de la
# marque pour un fond clair.
MONO_ON_DARK = "#FFFFFF"
MONO_ON_LIGHT = "#241040"

NOTE = "<!-- GÉNÉRÉ par brand/octave.py — ne pas éditer à la main. -->"


def load_art():
    """Les pièces du logo, lues dans `generate-svg.py` exécuté vers un dossier jetable."""
    with tempfile.TemporaryDirectory() as tmp:
        argv = sys.argv
        sys.argv = [str(BRAND / "generate-svg.py"), tmp]
        try:
            return runpy.run_path(str(BRAND / "generate-svg.py"))
        finally:
            sys.argv = argv


A = load_art()

# La note de l'écran prend le dégradé du play (`gP` : #F0ABFC → #EC4899),
# étendu au repère du glyphe : le groupe réduit le repère, le dégradé suit.
NOTE_GRAD = ('<linearGradient id="gPn" x1="0" y1="0" x2="240" y2="240" gradientUnits="userSpaceOnUse">'
             '<stop offset="0" stop-color="#F0ABFC"/><stop offset="1" stop-color="#EC4899"/></linearGradient>')


def face():
    """Le visage, tel quel : yeux, pupilles, reflets, joues, sourire."""
    c = A["COLORS"]
    return ("".join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="#fff"/>' for x, y, r in A["EYE_WHITES"])
            + "".join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{A["INK"]}"/>' for x, y, r in A["EYE_PUPILS"])
            + "".join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="#fff"/>' for x, y, r in A["EYE_GLINTS"])
            + "".join(f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" fill="{c["cheek"]}" opacity="{c["cheekOpacity"]}"/>'
                      for x, y, rx, ry in A["CHEEKS"])
            + f'<path d="{A["SMILE"]}" fill="none" stroke="{A["INK"]}" stroke-width="3.2" stroke-linecap="round"/>')


def logo_art():
    """
    Le dessin, de l'arrière vers l'avant — l'ordre du logo de Tentacle (`BODY`,
    `HAT_G`, `FRONT_G`), le play remplacé par la note, le tricorne tel quel : la vitre
    sombre dans son cadre au dégradé se lit sur fond clair comme sur fond
    sombre (le logo de Tentacle n'a qu'une version couleur), une seule suffit.
    """
    back = "".join(f'<path d="{d}"/>' for d in A["BACK_DS"])
    return (f'<g fill="url(#gA)">{back}</g>'
            f'<path d="{A["HEAD"]}" fill="url(#gHd)"/><path d="{A["SHINE"]}" fill="url(#gS)"/>'
            + A["screen_rect"](fill="url(#gT)")
            + A["screen_rect"](extra=f' stroke="url(#gV)" stroke-width="{A["S"]["frame"]}"')
            + octave_glyph.placed(NOTE_SIZE, NOTE_CENTER, "url(#gPn)")
            + face() + A["HAT_G"] + A["FRONT_G"])


# Le liseré du tricorne en petite taille, dans le repère du chapeau (réduit à
# 0,64 par `HAT_T`) : ~14 unités du logo, un pixel plein à 20 px.
SMALL_HAT_RIM = 22


def small_hat():
    """
    Le tricorne de la petite taille : le MÊME chapeau (calotte, bande, crâne),
    cerné d'un liseré au dégradé du cadre (`gV`) — sous 24 px, la calotte
    sombre seule se fondait dans un fond sombre (le favicon de Tentacle l'ôte
    pour cette raison) ; cernée, elle se lit sur l'encre comme sur la nacre.
    """
    c = A["COLORS"]
    return (f'<g transform="{A["HAT_T"]}">'
            f'<path d="{A["HAT"]}" fill="url(#gH)" stroke="url(#gV)" stroke-width="{SMALL_HAT_RIM}" '
            f'stroke-linejoin="round" paint-order="stroke"/>'
            f'<path d="{A["BAND"]}" fill="none" stroke="url(#gV)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>'
            f'<path d="{A["SKULL"]}" fill="{c["skull"]}"/></g>')


def small_art():
    """
    Le logo SOUS 24 px (pouce de la bascule, 16 → 23 px) : le même dessin et le
    même ordre, sans ce qui ne survit pas à la réduction — ventouses, yeux du
    crâne, reflets des yeux — et le tricorne cerné (`small_hat`).
    """
    back = "".join(f'<path d="{d}"/>' for d in A["BACK_DS"])
    front = "".join(f'<path d="{d}"/>' for d in A["FRONT_DS"])
    c = A["COLORS"]
    eyes = ("".join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="#fff"/>' for x, y, r in A["EYE_WHITES"])
            + "".join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{A["INK"]}"/>' for x, y, r in A["EYE_PUPILS"]))
    return (f'<g fill="url(#gA)">{back}</g>'
            f'<path d="{A["HEAD"]}" fill="url(#gHd)"/>'
            + A["screen_rect"](fill="url(#gT)")
            + A["screen_rect"](extra=f' stroke="url(#gV)" stroke-width="{A["S"]["frame"]}"')
            + octave_glyph.placed(NOTE_SIZE, NOTE_CENTER, "url(#gPn)")
            + eyes
            + f'<path d="{A["SMILE"]}" fill="none" stroke="{A["INK"]}" stroke-width="3.2" stroke-linecap="round"/>'
            + small_hat()
            + f'<g fill="url(#gA)">{front}</g>')


def logo_svg(art=None, title="Octave"):
    return (octave_glyph.HEAD_TAG.format(extra="") + f"<title>{title}</title>{NOTE}"
            f'<defs>{A["GRADS"]}{NOTE_GRAD}</defs>{art if art is not None else logo_art()}</svg>\n')


def variants():
    """
    Les déclinaisons. La mascotte en couleur à partir de 24 px ; en dessous, et
    pour TOUT monochrome, le glyphe : la mascotte réduite à une masse lisait
    « tête de mort » (orbites creusées), elle ne se décline plus en une couleur.
    """
    return {
        "logo-octave.svg": logo_svg(),
        "logo-octave-small.svg": logo_svg(small_art(), "Octave — petite taille"),
        "glyph-octave.svg": octave_glyph.glyph_color_svg(NOTE),
        "glyph-octave-on-dark.svg": octave_glyph.glyph_svg(MONO_ON_DARK, NOTE),
        "glyph-octave-on-light.svg": octave_glyph.glyph_svg(MONO_ON_LIGHT, NOTE),
    }


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    files = variants()
    for name, text in files.items():
        save(OUT / name, text)
    if not PREVIEW:
        target = ROOT / octave_ts.TARGET
        pieces = {f"FRONT_ARM_{i}": d for i, d in enumerate(A["FRONT_DS"])}
        pieces.update({f"BACK_ARM_{i}": d for i, d in enumerate(A["BACK_DS"])})
        save(target, octave_ts.module(files, pieces, octave_glyph.glyph()))
    print(f"{len(files)} SVG Octave"
          + (" (aperçu : module TS non écrit)" if PREVIEW else f" + {octave_ts.TARGET}"))


if __name__ == "__main__":
    main()
