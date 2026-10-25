"""
Le module TypeScript du logo d'Octave, consommé par le mode musique du web
(et du bureau, qui sert la même page). Comme `tentacleArmPaths.generated.ts`,
il ne s'écrit jamais à la main : `brand/octave.py` le régénère.

Il porte les SVG COMPLETS — à servir en image (`octaveLogoDataUri`) : chaque
document garde ses propres identifiants de dégradés, aucune collision avec un
autre logo de la page — et les contours du glyphe, que `OctaveGlyph.tsx` rend
en ligne, à `currentColor`.
"""
import json

TARGET = "apps/web/src/components/ui/octaveLogo.generated.ts"

# Nom de fichier → nom de la constante exportée.
EXPORTS = {
    "logo-octave.svg": ("OCTAVE_LOGO_SVG", "Le logo couleur : la mascotte et son tricorne, la note sur son écran. Fond clair ou sombre, À PARTIR DE 24 PX."),
    "logo-octave-small.svg": ("OCTAVE_LOGO_SMALL_SVG", "Le logo couleur SOUS 24 PX (pouce de la bascule) : le même, tricorne cerné, sans ventouses."),
    "glyph-octave.svg": ("OCTAVE_GLYPH_SVG", "Le glyphe au dégradé de la marque, la note seule (fond clair ou sombre)."),
    "glyph-octave-on-dark.svg": ("OCTAVE_GLYPH_ON_DARK_SVG", "Le glyphe monochrome blanc, pour un fond sombre (`currentColor`)."),
    "glyph-octave-on-light.svg": ("OCTAVE_GLYPH_ON_LIGHT_SVG", "Le glyphe monochrome encre, pour un fond clair (`currentColor`)."),
}


def module(files, pieces, glyph):
    """
    `files` : nom → SVG (les déclinaisons) ; `pieces` : nom → fragment répété
    d'une déclinaison à l'autre (les contours des bras) ; `glyph` : les contours
    du glyphe (`octave_glyph.py`). Chaque fragment s'écrit UNE fois et les SVG
    le reprennent en gabarit.
    """
    pieces = dict(pieces)
    pieces.update({f"GLYPH_{i}": d for i, d in enumerate(glyph)})
    out = ["// GÉNÉRÉ par brand/octave.py — ne pas éditer à la main.",
           "//",
           "// Le logo d'Octave : la mascotte de Tentacle, son tricorne sur la tête, qui montre la note",
           "// d'Octave sur son écran ; et le glyphe, une croche dont le crochet est un bras.",
           "// Repère 240 × 240, le même que `brand/*.svg`.",
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
    out += [
        "/** Les variantes : la couleur de la marque, ou une seule encre selon le fond. */",
        "export type OctaveLogoVariant = \"color\" | \"mono\";",
        "",
        "/**",
        " * Le SVG à servir. La mascotte en couleur, chapeau compris, à TOUTE taille : sous 24 px,",
        " * sa déclinaison au tricorne cerné, lisible à 16 px. Le monochrome est TOUJOURS le",
        " * glyphe (blanc sur fond sombre, encre sur fond clair) : la mascotte réduite à une",
        " * masse lisait « tête de mort ».",
        " */",
        "export function octaveLogoSvg(variant: OctaveLogoVariant, size: number, onDark = true): string {",
        "  if (variant === \"mono\") return onDark ? OCTAVE_GLYPH_ON_DARK_SVG : OCTAVE_GLYPH_ON_LIGHT_SVG;",
        "  return size < 24 ? OCTAVE_LOGO_SMALL_SVG : OCTAVE_LOGO_SVG;",
        "}",
        "",
        "/** Le même SVG en `data:` URI, pour un `<img src>` (aucun identifiant partagé avec la page). */",
        "export function octaveLogoDataUri(variant: OctaveLogoVariant, size: number, onDark = true): string {",
        "  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(octaveLogoSvg(variant, size, onDark))}`;",
        "}",
        "",
        "/**",
        " * Le GLYPHE d'Octave, pour l'interface (bascule, onglet, navigation ; 16 → 24 px) :",
        " * une croche dont le crochet est un bras de la mascotte. Une seule couleur, à remplir",
        " * en `currentColor`, repère `OCTAVE_GLYPH_VIEWBOX`. Nom d'export STABLE.",
        " */",
        "export const OCTAVE_GLYPH_PATHS: readonly string[] = [" + ", ".join(f"GLYPH_{i}" for i in range(len(glyph))) + "];",
        "",
        "/** Le repère du glyphe (celui de `brand/*.svg`). */",
        'export const OCTAVE_GLYPH_VIEWBOX = "0 0 240 240";',
    ]
    return "\n".join(out) + "\n"
