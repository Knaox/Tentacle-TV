"""
La planche de comparaison d'Octave : le logo actuel et les trois propositions,
côte à côte, sur clair et sur sombre, en grand, à 48 px et à 16 px.

Les petites tailles sont de VRAIS rendus (rsvg-convert à 48 et 16 px), posés
à l'échelle 1 puis agrandis au plus proche voisin : on juge les pixels que
l'écran montrera, pas un vectoriel réduit. Sous 24 px, chaque logo est servi
sans chapeau (règle de `brand/README.md`) : la ligne 16 px le montre ainsi.

La planche est un document de travail : elle s'écrit là où on la demande
(`--sheet chemin.png`), jamais dans le dépôt.
"""
import base64
import pathlib
import subprocess
import tempfile

LIGHT, DARK = "#F7F5FB", "#0D0B13"
COL_W, LABEL_W, PAD = 290, 150, 16
FONT = 'font-family="Inter, Helvetica Neue, Arial, sans-serif"'


def raster(svg_text, px, tmp):
    """Le rendu réel du logo à `px` pixels, en PNG base64."""
    src = pathlib.Path(tmp) / "in.svg"
    dst = pathlib.Path(tmp) / "out.png"
    src.write_text(svg_text, encoding="utf-8")
    subprocess.run(["rsvg-convert", "-w", str(px), "-h", str(px), str(src), "-o", str(dst)], check=True)
    return base64.b64encode(dst.read_bytes()).decode()


def inline(svg_text, x, y, size):
    """Un logo vectoriel posé tel quel, à `size` de côté."""
    body = svg_text.split("?>")[-1]
    body = body.replace('width="240" height="240"', f'x="{x}" y="{y}" width="{size}" height="{size}"', 1)
    return body.replace("<!--", "<!-- ").strip()


def pixels(b64, x, y, size, zoom):
    """Le rendu à l'échelle 1, puis agrandi au plus proche voisin à côté."""
    img = '<image x="{x}" y="{y}" width="{w}" height="{w}" style="image-rendering:pixelated" ' \
          'image-rendering="optimizeSpeed" href="data:image/png;base64,{b}"/>'
    return (img.format(x=x, y=y, w=size, b=b64)
            + img.format(x=x + size + 14, y=y, w=size * zoom, b=b64))


def write(out_png, current, logos, chosen, titles):
    """
    `current` et chaque entrée de `logos` (clé → déclinaisons) portent :
    `light` et `dark` = (avec chapeau, sans chapeau) pour fond clair et fond
    sombre, `mono` = (blanc, encre). Rend le chemin de la planche écrite.
    """
    columns = [("Tentacle", "logo actuel", current)]
    for key, art in logos.items():
        columns.append((titles[key], "retenu" if key == chosen else "proposition", art))
    rows = [("Grand, fond clair", 240, LIGHT), ("Grand, fond sombre", 240, DARK),
            ("48 px, clair", 48 * 4, LIGHT), ("48 px, sombre", 48 * 4, DARK),
            ("16 px, clair", 16 * 8, LIGHT), ("16 px, sombre", 16 * 8, DARK),
            ("Mono, 48 px", 64, LIGHT)]
    width = LABEL_W + COL_W * len(columns)
    height = 72 + sum(h + 2 * PAD for _, h, _ in rows)
    parts = [f'<rect width="{width}" height="{height}" fill="#FFFFFF"/>']
    with tempfile.TemporaryDirectory() as tmp:
        for i, (label, sub, _) in enumerate(columns):
            x = LABEL_W + i * COL_W + PAD
            parts.append(f'<text x="{x}" y="32" {FONT} font-size="17" font-weight="600" fill="#241040">{label}</text>')
            parts.append(f'<text x="{x}" y="54" {FONT} font-size="13" fill="#6B5B8A">{sub}</text>')
        y = 72
        for title, h, bg in rows:
            band = h + 2 * PAD
            parts.append(f'<rect x="0" y="{y}" width="{width}" height="{band}" fill="{bg}"/>')
            ink = "#241040" if bg == LIGHT else "#E9E3F5"
            parts.append(f'<text x="{PAD}" y="{y + band / 2 + 5}" {FONT} font-size="14" fill="{ink}">{title}</text>')
            for i, (_, _, art) in enumerate(columns):
                x = LABEL_W + i * COL_W + PAD
                hat, nohat = art["dark" if bg == DARK else "light"]
                if h == 240:
                    parts.append(inline(hat, x, y + PAD, 240))
                elif title.startswith("48"):
                    parts.append(pixels(raster(hat, 48, tmp), x, y + PAD, 48, 4))
                elif title.startswith("16"):
                    parts.append(pixels(raster(nohat, 16, tmp), x, y + PAD, 16, 8))
                else:
                    white, ink_logo = art["mono"]
                    parts.append(f'<rect x="{x}" y="{y + PAD - 4}" width="64" height="72" rx="10" fill="{DARK}"/>')
                    parts.append(pixels(raster(white, 48, tmp), x + 8, y + PAD + 8, 48, 1).split("/>")[0] + "/>")
                    parts.append(pixels(raster(ink_logo, 48, tmp), x + 84, y + PAD + 8, 48, 1).split("/>")[0] + "/>")
            y += band
        svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" '
               f'width="{width}" height="{height}">' + "".join(parts) + "</svg>")
        src = pathlib.Path(tmp) / "sheet.svg"
        src.write_text(svg, encoding="utf-8")
        out_png = pathlib.Path(out_png)
        out_png.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(["rsvg-convert", "-z", "2", str(src), "-o", str(out_png)], check=True)
    return out_png
