"""
Le logo d'Octave, le mode musique de Tentacle : la MÊME mascotte, sans
chapeau, qui montre sur son écran le glyphe d'Octave à la place du play.
Rien ici ne redessine le poulpe : ses pièces (bras, tête, visage, écran,
dégradés) sont LUES dans `generate-svg.py`, exécuté vers un dossier jetable —
le logo d'origine et ses fichiers ne sont jamais réécrits par ce script.

    python3 brand/octave.py            # brand/octave/ + le module TS du web
    python3 brand/octave.py /tmp/out   # aperçu ailleurs, sans le module TS

Le glyphe (la croche dont le crochet est un bras) vit dans `octave_glyph.py`,
le module TypeScript dans `octave_ts.py`.

Le dessin d'avant (2026-10, une double-croche géante à la place de l'écran,
tricorne à tête de mort, monochrome aux orbites creusées) est retiré : « en
mode Halloween », la note « trop grosse », pas « natif » (Damien, 25/10).
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
    Le dessin, de l'arrière vers l'avant — l'ordre de `BODY` du logo de
    Tentacle, le play remplacé par la note, et jamais de chapeau : la vitre
    sombre dans son cadre au dégradé se lit sur fond clair comme sur fond
    sombre (le logo de Tentacle n'a qu'une version couleur), une seule suffit.
    """
    back = "".join(f'<path d="{d}"/>' for d in A["BACK_DS"])
    return (f'<g fill="url(#gA)">{back}</g>'
            f'<path d="{A["HEAD"]}" fill="url(#gHd)"/><path d="{A["SHINE"]}" fill="url(#gS)"/>'
            + A["screen_rect"](fill="url(#gT)")
            + A["screen_rect"](extra=f' stroke="url(#gV)" stroke-width="{A["S"]["frame"]}"')
            + octave_glyph.placed(NOTE_SIZE, NOTE_CENTER, "url(#gPn)")
            + face() + A["FRONT_G"])


def logo_svg():
    return (octave_glyph.HEAD_TAG.format(extra="") + f"<title>Octave</title>{NOTE}"
            f'<defs>{A["GRADS"]}{NOTE_GRAD}</defs>{logo_art()}</svg>\n')


def variants():
    """
    Les déclinaisons. La mascotte en couleur à partir de 24 px ; en dessous, et
    pour TOUT monochrome, le glyphe : la mascotte réduite à une masse lisait
    « tête de mort » (orbites creusées), elle ne se décline plus en une couleur.
    """
    return {
        "logo-octave.svg": logo_svg(),
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
