"""
Le module TypeScript du logo d'Octave, consommé par le mode musique du web
(et du bureau, qui sert la même page). Comme `tentacleArmPaths.generated.ts`,
il ne s'écrit jamais à la main : `brand/octave.py` le régénère.

Il porte les SVG COMPLETS (couleur, sans chapeau, monochromes) — à servir en
image (`octaveLogoDataUri`) : chaque document garde ses propres identifiants
de dégradés et de masque, aucune collision avec un autre logo de la page — et
les contours de la note, pour qui voudrait la composer lui-même.
"""
import json

TARGET = "apps/web/src/components/ui/octaveLogo.generated.ts"

# Nom de fichier → nom de la constante exportée.
EXPORTS = {
    "logo-octave.svg": ("OCTAVE_LOGO_SVG", "Le logo couleur, avec son tricorne, pour fond CLAIR (vitre sombre)."),
    "logo-octave-nohat.svg": ("OCTAVE_LOGO_NOHAT_SVG", "Le logo couleur sans chapeau : À SERVIR SOUS 24 PX."),
    "logo-octave-on-dark.svg": ("OCTAVE_LOGO_ON_DARK_SVG", "Le logo couleur pour fond SOMBRE : la note y a sa vitre claire."),
    "logo-octave-on-dark-nohat.svg": ("OCTAVE_LOGO_ON_DARK_NOHAT_SVG", "Le logo couleur pour fond sombre, sans chapeau (sous 24 px)."),
    "logo-octave-mono-dark.svg": ("OCTAVE_LOGO_MONO_ON_DARK_SVG", "Monochrome blanc, pour un fond sombre (`currentColor`)."),
    "logo-octave-mono-light.svg": ("OCTAVE_LOGO_MONO_ON_LIGHT_SVG", "Monochrome encre, pour un fond clair (`currentColor`)."),
    "logo-octave-mono-dark-nohat.svg": ("OCTAVE_LOGO_MONO_ON_DARK_NOHAT_SVG", "Monochrome blanc sans chapeau (sous 24 px)."),
    "logo-octave-mono-light-nohat.svg": ("OCTAVE_LOGO_MONO_ON_LIGHT_NOHAT_SVG", "Monochrome encre sans chapeau (sous 24 px)."),
}


def module(files, note, pieces):
    """
    `files` : nom → SVG (les déclinaisons retenues) ; `note` : la note dessinée ;
    `pieces` : nom → fragment répété d'une variante à l'autre (les contours des
    bras, l'essentiel du poids). Chaque fragment s'écrit UNE fois et les SVG le
    reprennent en gabarit (le module pèse le tiers de la somme des SVG).
    """
    out = ["// GÉNÉRÉ par brand/octave.py — ne pas éditer à la main.",
           "//",
           "// Le logo d'Octave : la mascotte de Tentacle qui tient une note de musique",
           "// à la place de l'écran. Repère 240 × 240, le même que `brand/*.svg`.",
           ""]
    for name, text in pieces.items():
        out.append(f"const {name} =\n  {json.dumps(text)};")
    out.append("")
    for name, (const, doc) in EXPORTS.items():
        svg = files[name].replace("\n", "")
        if "`" in svg or "${" in svg or "\\" in svg:
            raise SystemExit(f"{name} : caractère interdit dans un gabarit TS")
        for piece, text in pieces.items():
            svg = svg.replace(text, "${" + piece + "}")
        out.append(f"/** {doc} */")
        out.append(f"export const {const} =\n  `{svg}`;")
        out.append("")
    out.append("/** Les variantes, par fond et par taille : la porte unique des composants. */")
    out.append("export type OctaveLogoVariant = \"color\" | \"mono\";")
    out.append("")
    out.append("/** Le SVG à servir : sans chapeau sous 24 px, vitre et encre selon le fond. */")
    out.append("export function octaveLogoSvg(variant: OctaveLogoVariant, size: number, onDark = true): string {")
    out.append("  const small = size < 24;")
    out.append("  if (variant === \"color\" && onDark) return small ? OCTAVE_LOGO_ON_DARK_NOHAT_SVG : OCTAVE_LOGO_ON_DARK_SVG;")
    out.append("  if (variant === \"color\") return small ? OCTAVE_LOGO_NOHAT_SVG : OCTAVE_LOGO_SVG;")
    out.append("  if (onDark) return small ? OCTAVE_LOGO_MONO_ON_DARK_NOHAT_SVG : OCTAVE_LOGO_MONO_ON_DARK_SVG;")
    out.append("  return small ? OCTAVE_LOGO_MONO_ON_LIGHT_NOHAT_SVG : OCTAVE_LOGO_MONO_ON_LIGHT_SVG;")
    out.append("}")
    out.append("")
    out.append("/** Le même SVG en `data:` URI, pour un `<img src>` (aucun identifiant partagé avec la page). */")
    out.append("export function octaveLogoDataUri(variant: OctaveLogoVariant, size: number, onDark = true): string {")
    out.append("  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(octaveLogoSvg(variant, size, onDark))}`;")
    out.append("}")
    out.append("")
    out.append("/** Les contours de la note (têtes, hampes, barre), de l'arrière vers l'avant, à remplir. */")
    out.append("export const OCTAVE_NOTE_PATHS: readonly string[] = [")
    out += [f"  {json.dumps(d)}," for d in note["parts"]]
    out.append("];")
    out.append("")
    out.append("/** Les éclats roses des têtes de note (dégradé `gP` du logo). */")
    out.append("export const OCTAVE_NOTE_GLINTS: readonly { cx: number; cy: number; r: number }[] = [")
    out += [f"  {{ cx: {x:.1f}, cy: {y:.1f}, r: {r} }}," for x, y, r in note.get("glints", [])]
    out.append("];")
    return "\n".join(out) + "\n"
