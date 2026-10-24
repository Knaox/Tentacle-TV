"""
Le logo d'Octave, le mode musique de Tentacle : la MÊME mascotte, qui tient
une note de musique à la place de l'écran. Rien ici ne redessine le poulpe :
ses pièces (bras, tête, visage, chapeau, dégradés) sont LUES dans
`generate-svg.py`, exécuté vers un dossier jetable — le logo d'origine et ses
fichiers ne sont jamais réécrits par ce script.

    python3 brand/octave.py            # brand/octave/ + le module TS du web
    python3 brand/octave.py /tmp/out   # aperçu ailleurs, sans le module TS

Les notes elles-mêmes vivent dans `octave_notes.py` (trois propositions), la
planche de comparaison dans `octave_sheet.py`.
"""
import pathlib
import runpy
import sys
import tempfile

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from geometry import save
import octave_notes
import octave_sheet
import octave_ts

BRAND = pathlib.Path(__file__).parent
ROOT = BRAND.parent
ARGS = sys.argv[1:]
SHEET = None
if "--sheet" in ARGS:
    i = ARGS.index("--sheet")
    SHEET = pathlib.Path(ARGS[i + 1])
    del ARGS[i:i + 2]
OUT = pathlib.Path(ARGS[0]) if ARGS else BRAND / "octave"
PREVIEW = OUT.resolve() != (BRAND / "octave").resolve()

# La proposition retenue (lisibilité à 16 px d'abord) ; les deux autres vont
# dans `propositions/`.
CHOSEN = "double"
TITLES = {"double": "la double-croche enlacée", "screen": "l'écran musical",
          "quaver": "la croche-tentacule"}

# Épaisseur du cadre d'une note : le liseré `gV` qui dépasse de la vitre.
# L'écran avait un cadre de 5 centré sur son bord ; une hampe de 11 n'y
# survivrait pas, d'où un cadre posé AUTOUR de la forme (moitié du trait).
NOTE_FRAME = 9


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


# La vitre de la note pour FOND SOMBRE : la vitre `gT` y disparaîtrait (le
# poulpe tient alors un contour vide, illisible à 16 px). Elle prend le blanc
# lavé de la marque — celui des yeux et du crâne —, qui la détache du fond.
GLASS_ON_DARK = ('<linearGradient id="gN" x1="0" y1="100" x2="0" y2="196" gradientUnits="userSpaceOnUse">'
                 '<stop offset="0" stop-color="#FDF4FF"/><stop offset="1" stop-color="#F5D0FE"/></linearGradient>')


def note_art(key, on_dark=False):
    """La note dessinée : cadre au dégradé, vitre (sombre, ou claire sur fond sombre), éclats roses."""
    note = octave_notes.PROPOSALS[key]()
    parts = note["parts"]
    if key == "screen":
        glyph = "".join(f'<path d="{d}"/>' for d in parts)
        return (A["screen_rect"](fill="url(#gT)")
                + A["screen_rect"](extra=f' stroke="url(#gV)" stroke-width="{A["S"]["frame"]}"')
                + f'<g fill="url(#gP)" stroke="url(#gP)" stroke-width="2.4" stroke-linejoin="round">{glyph}</g>')
    frame = "".join(f'<path d="{d}"/>' for d in parts)
    out = (f'<g fill="url(#gV)" stroke="url(#gV)" stroke-width="{NOTE_FRAME}" '
           f'stroke-linejoin="round">{frame}</g>'
           f'<g fill="url(#{"gN" if on_dark else "gT"})">{frame}</g>')
    out += "".join(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r}" fill="url(#gP)"/>'
                   for x, y, r in note.get("glints", []))
    return out


def face():
    """Le visage, tel quel : yeux, pupilles, reflets, joues, sourire."""
    c = A["COLORS"]
    return ("".join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="#fff"/>' for x, y, r in A["EYE_WHITES"])
            + "".join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{A["INK"]}"/>' for x, y, r in A["EYE_PUPILS"])
            + "".join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="#fff"/>' for x, y, r in A["EYE_GLINTS"])
            + "".join(f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" fill="{c["cheek"]}" opacity="{c["cheekOpacity"]}"/>'
                      for x, y, rx, ry in A["CHEEKS"])
            + f'<path d="{A["SMILE"]}" fill="none" stroke="{A["INK"]}" stroke-width="3.2" stroke-linecap="round"/>')


def color_art(key, with_hat=True, on_dark=False):
    """Le dessin couleur, de l'arrière vers l'avant — l'ordre de `BODY`."""
    back = "".join(f'<path d="{d}"/>' for d in A["BACK_DS"])
    return (f'<g fill="url(#gA)">{back}</g>'
            f'<path d="{A["HEAD"]}" fill="url(#gHd)"/><path d="{A["SHINE"]}" fill="url(#gS)"/>'
            + note_art(key, on_dark) + face()
            + (A["HAT_G"] if with_hat else "") + A["FRONT_G"])


def mono_art(key, with_hat=True):
    """
    Le monochrome, à la manière de `logo-mono.svg` : une seule masse, détails
    creusés au masque. La note est PLEINE, détachée de la tête et des pattes
    par un jour (sinon la barre fusionnerait avec le dôme) ; les bras avant se
    détachent d'elle par leur liseré, comme ils se détachaient du cadre.
    """
    parts = octave_notes.PROPOSALS[key]()["parts"]
    notes = "".join(f'<path d="{d}"/>' for d in parts)
    cut = (f'<g fill="#000" stroke="#000" stroke-width="{NOTE_FRAME + 5}" stroke-linejoin="round">{notes}</g>'
           f'<g fill="#fff" stroke="#fff" stroke-width="{NOTE_FRAME}" stroke-linejoin="round">{notes}</g>')
    if key == "screen":
        fr = A["S"]["frame"] / 2
        cut = (A["screen_rect"](inset=fr, fill="#000")
               + f'<g fill="#fff" stroke="#fff" stroke-width="2.4" stroke-linejoin="round">{notes}</g>')
    hat_cut = (f'<g transform="{A["HAT_TM"]}" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round">'
               f'<path d="{A["BRIM"]}" stroke-width="9"/><path d="{A["BAND"]}" stroke-width="10"/></g>'
               f'<path transform="{A["HAT_TM"]}" fill="#000" d="{A["SKULL"]}"/>') if with_hat else ""
    front = A["FRONT_DS"]
    mask = ('<mask id="mOct" maskUnits="userSpaceOnUse" x="0" y="0" width="240" height="240">'
            '<rect width="240" height="240" fill="#fff"/>' + cut
            + "".join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="#000"/>' for x, y, r in A["EYE_WHITES"])
            + "".join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="#fff"/>' for x, y, r in A["EYE_PUPILS"])
            + f'<path d="{A["SMILE"]}" fill="none" stroke="#000" stroke-width="3.2" stroke-linecap="round"/>'
            + hat_cut + '<g clip-path="url(#cArms)">'
            + "".join(f'<path d="{d}" fill="none" stroke="#000" stroke-width="8" stroke-linejoin="round"/>' for d in front)
            + "</g>" + "".join(f'<path d="{d}" fill="#fff"/>' for d in front) + "</mask>")
    body = ("".join(f'<path d="{d}"/>' for d in A["BACK_DS"]) + f'<path d="{A["HEAD"]}"/>'
            + (A["screen_rect"](fill="currentColor") if key == "screen" else "")
            + f'<g stroke="currentColor" stroke-width="{NOTE_FRAME}" stroke-linejoin="round">{notes}</g>'
            + (f'<path d="{A["HAT"]}" transform="{A["HAT_TM"]}"/>' if with_hat else "")
            + "".join(f'<path d="{d}"/>' for d in front))
    return f'<defs>{A["CLIP_ARMS"]}{mask}</defs><g mask="url(#mOct)" fill="currentColor">{body}</g>'


HEAD_TAG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="240" height="240"{extra} role="img">'
NOTE = "<!-- GÉNÉRÉ par brand/octave.py — ne pas éditer à la main. -->"


def color_svg(key, with_hat=True, on_dark=False):
    title = "Octave" + (" — fond sombre" if on_dark else "") + ("" if with_hat else " — sans chapeau")
    defs = A["GRADS"] + (GLASS_ON_DARK if on_dark else "")
    return (HEAD_TAG.format(extra="") + f"<title>{title}</title>{NOTE}"
            f'<defs>{defs}</defs>{color_art(key, with_hat, on_dark)}</svg>\n')


def mono_svg(key, color, with_hat=True):
    """Monochrome à `currentColor`, couleur par défaut posée sur la racine."""
    title = "Octave — monochrome" + ("" if with_hat else " sans chapeau")
    return (HEAD_TAG.format(extra=f' color="{color}"') + f"<title>{title}</title>{NOTE}"
            f"{mono_art(key, with_hat)}</svg>\n")


# Les déclinaisons : la couleur en deux vitres (sombre pour fond clair, claire
# pour fond sombre — l'écran d'origine, lui, se lisait sur les deux par son
# cadre ; une note n'a pas d'intérieur assez grand pour ça), et le monochrome
# en deux encres : blanc pour fond sombre, encre pour fond clair. Chacune a sa
# version sans chapeau, à servir sous 24 px.
MONO_DARK_BG = "#FFFFFF"
MONO_LIGHT_BG = "#241040"


def variants(key):
    return {
        "logo-octave.svg": color_svg(key),
        "logo-octave-nohat.svg": color_svg(key, False),
        "logo-octave-on-dark.svg": color_svg(key, True, True),
        "logo-octave-on-dark-nohat.svg": color_svg(key, False, True),
        "logo-octave-mono-dark.svg": mono_svg(key, MONO_DARK_BG),
        "logo-octave-mono-light.svg": mono_svg(key, MONO_LIGHT_BG),
        "logo-octave-mono-dark-nohat.svg": mono_svg(key, MONO_DARK_BG, False),
        "logo-octave-mono-light-nohat.svg": mono_svg(key, MONO_LIGHT_BG, False),
    }


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    count = 0
    for name, text in variants(CHOSEN).items():
        save(OUT / name, text)
        count += 1
    props = OUT / "propositions"
    props.mkdir(exist_ok=True)
    for key in octave_notes.PROPOSALS:
        if key == CHOSEN:
            continue
        for name, text in variants(key).items():
            save(props / name.replace("logo-octave", f"logo-octave-{key}"), text)
            count += 1
    sheet = "non demandée (--sheet chemin.png)"
    if SHEET is not None:
        read = lambda name: (BRAND / name).read_text(encoding="utf-8")
        mono = read("logo-mono.svg")
        current = {"light": (read("logo-color.svg"), read("logo-color-nohat.svg")),
                   "dark": (read("logo-color.svg"), read("logo-color-nohat.svg")),
                   "mono": (mono, mono.replace('color="#FFFFFF"', f'color="{MONO_LIGHT_BG}"', 1))}
        logos = {k: {"light": (color_svg(k), color_svg(k, False)),
                     "dark": (color_svg(k, True, True), color_svg(k, False, True)),
                     "mono": (mono_svg(k, MONO_DARK_BG), mono_svg(k, MONO_LIGHT_BG))}
                 for k in octave_notes.PROPOSALS}
        sheet = octave_sheet.write(SHEET, current, logos, CHOSEN, TITLES)
    if not PREVIEW:
        target = ROOT / octave_ts.TARGET
        pieces = {f"FRONT_ARM_{i}": d for i, d in enumerate(A["FRONT_DS"])}
        pieces.update({f"BACK_ARM_{i}": d for i, d in enumerate(A["BACK_DS"])})
        save(target, octave_ts.module(variants(CHOSEN), octave_notes.PROPOSALS[CHOSEN](), pieces))
    print(f"{count} SVG Octave (retenu : {CHOSEN}) — planche : {sheet}"
          + (" (aperçu : module TS non écrit)" if PREVIEW else f" + {octave_ts.TARGET}"))


if __name__ == "__main__":
    main()
