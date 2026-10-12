"""
Le nom écrit en COURBES : un texte de la marque, composé en Inter (la police
des clients, `apps/web/src/theme/fonts.css`), rendu en `<path>`.

Pourquoi des courbes et pas un `<text>` : le SVG reste autonome. Un `<text>`
dépendrait des polices installées sur la machine qui rasterise (librsvg,
resvg), et le même fichier rendrait un autre nom sous macOS et sous Windows.

La composition (approche, crénage) est faite par HarfBuzz, le dessin des
glyphes par fontTools, sur l'instance de la police variable à la graisse
demandée. Inter vient du paquet `@fontsource-variable/inter` déjà installé
pour le web (WOFF2, d'où `brotli`).

    pip install fonttools brotli uharfbuzz
"""
import io, pathlib

ROOT = pathlib.Path(__file__).parent.parent
FONT = ROOT / "node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2"


class Unavailable(Exception):
    """La police ou les modules manquent : l'appelant garde ses SVG en place."""


def _instance(weight):
    try:
        from fontTools.ttLib import TTFont
        from fontTools.varLib.instancer import instantiateVariableFont
    except ImportError as e:
        raise Unavailable(f"module manquant ({e.name}) : pip install fonttools brotli uharfbuzz")
    if not FONT.exists():
        raise Unavailable(f"police absente : {FONT.relative_to(ROOT)} — lancer pnpm install")
    font = TTFont(FONT)
    font = instantiateVariableFont(font, {"wght": weight})
    font.flavor = None
    buf = io.BytesIO()
    font.save(buf)
    return font, buf.getvalue()


def outline(text, weight=700, tracking=0.0):
    """
    Le texte en un seul `d` de chemin, en unités de la police (em = `upm`),
    ligne de base à y = 0, axe y vers le BAS (repère SVG). Rend (d, largeur,
    upm, hauteur de capitale). `tracking` : approche ajoutée, en part d'em.
    """
    font, blob = _instance(weight)
    try:
        import uharfbuzz as hb
    except ImportError:
        raise Unavailable("module manquant (uharfbuzz) : pip install fonttools brotli uharfbuzz")
    from fontTools.pens.svgPathPen import SVGPathPen
    from fontTools.pens.transformPen import TransformPen

    upm = font["head"].unitsPerEm
    hb_font = hb.Font(hb.Face(blob))
    buf = hb.Buffer()
    buf.add_str(text)
    buf.guess_segment_properties()
    hb.shape(hb_font, buf, {"kern": True, "liga": True})

    glyphs, order = font.getGlyphSet(), font.getGlyphOrder()
    pen = SVGPathPen(glyphs)
    x = 0.0
    extra = tracking * upm
    infos, positions = buf.glyph_infos, buf.glyph_positions
    for i, (info, pos) in enumerate(zip(infos, positions)):
        name = order[info.codepoint]
        # Retournement vertical : la police monte, le SVG descend.
        glyphs[name].draw(TransformPen(pen, (1, 0, 0, -1, x + pos.x_offset, -pos.y_offset)))
        x += pos.x_advance + (extra if i < len(infos) - 1 else 0)
    cap = font["OS/2"].sCapHeight
    return pen.getCommands(), x, upm, cap
