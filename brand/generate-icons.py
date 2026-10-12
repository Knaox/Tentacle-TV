"""
Rasterise tous les dérivés binaires depuis `brand/*.svg`.

    python3 brand/generate-icons.py                        # aperçu, n'écrit rien
    python3 brand/generate-icons.py --write                # écrit
    python3 brand/generate-icons.py --write desktop-electron   # une part seulement

Le filtre — toute mot qui n'est pas `--write` — retient les cibles dont le
chemin le contient. Il ne sert pas qu'au confort : deux moteurs de rendu ne
rendent pas au bit près, et régénérer toutes les cibles pour en corriger cinq
remplacerait le reste par un bruit binaire indiscernable d'un vrai changement.

Deux familles de cibles :
- les cibles RELEVÉES (`RULES`) sont régénérées **à leurs dimensions
  actuelles**, lues sur le fichier en place : les formats des stores ne se
  devinent pas. Une cible absente est signalée, jamais créée à l'aveugle ;
- les visuels des paquets MSIX (`windows.py`) sont CRÉÉS d'après leur table :
  Windows fixe leurs noms et leurs tailles. Ce qu'un de ces dossiers contient
  en plus de la table est supprimé (un visuel orphelin serait indexé dans
  `resources.pri`).

Exige Pillow, et un moteur SVG : `rsvg-convert` (brew install librsvg) ou, à
défaut, `resvg-py` (pip install resvg-py — le chemin de Windows, où librsvg
ne s'installe pas). Les PNG sortent du moteur tels quels : alpha droit, rendus
à la taille exacte, jamais réduits d'une autre taille. L'ICNS et l'ICO sont
écrits ici même : `iconutil` n'existe que sur macOS, et son absence faisait
sauter l'icône du Dock EN SILENCE quand le script tournait sous Linux.
"""
import io, pathlib, shutil, struct, subprocess, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import windows, store

try:
    from PIL import Image
except ImportError:
    raise SystemExit("Pillow manquant : pip install pillow")

ROOT = pathlib.Path(__file__).parent.parent
BRAND = pathlib.Path(__file__).parent
WRITE = "--write" in sys.argv
FILTER = [a for a in sys.argv[1:] if not a.startswith("--")]
# La console de Windows n'est pas en UTF-8 : sans ceci, la flèche du relevé
# lève une erreur d'encodage.
sys.stdout.reconfigure(encoding="utf-8")

# Motif de chemin → SVG source. Le premier motif qui correspond gagne, donc les
# règles les plus précises viennent d'abord. Les paquets MSIX n'y sont pas :
# voir `windows.py`.
RULES = [
    # ── Desktop (Electron) ───────────────────────────────────────────────────
    # Windows et Linux posent l'image TELLE QUELLE : sans coins, l'application
    # est un carré dans la barre des tâches. macOS ne masque de lui-même que
    # depuis Tahoe — sur les versions d'avant, le carré restait carré.
    ("apps/desktop-electron/icons/*.png", "app-icon-rounded.svg"),
    # ── Mobile ───────────────────────────────────────────────────────────────
    ("apps/mobile/assets/adaptive-icon.png", "app-icon-foreground.svg"),
    ("apps/mobile/assets/splash-icon.png", "logo-plain.svg"),
    ("apps/mobile/assets/icon.png", "app-icon-color.svg"),
    ("apps/mobile/android/app/src/main/res/mipmap-*/ic_launcher_foreground.webp", "app-icon-foreground.svg"),
    ("apps/mobile/android/app/src/main/res/mipmap-*/ic_launcher*.webp", "app-icon-color.svg"),
    ("apps/mobile/android/app/src/main/res/drawable-*/splashscreen_logo.png", "logo-plain.svg"),
    ("apps/mobile/ios/*/Images.xcassets/AppIcon.appiconset/*.png", "app-icon-color.svg"),
    ("apps/mobile/ios/*/Images.xcassets/SplashScreenLegacy.imageset/*.png", "logo-plain.svg"),
    # ── Android TV ───────────────────────────────────────────────────────────
    ("apps/tv/android/app/src/main/res/mipmap-*/ic_launcher*.png", "app-icon-color.svg"),
    ("apps/tv/android/app/src/main/res/drawable-*/tv_banner.png", "banner-16x9.svg"),
    ("apps/tv/store-assets/tv-banner-*.png", "banner-16x9.svg"),
    ("apps/tv/store-assets/icon-*.png", "app-icon-color.svg"),
    # ── tvOS : l'icône est faite de COUCHES (effet de parallaxe) ─────────────
    # De l'arrière vers l'avant : le fond, la lumière, le poulpe, les bras
    # avant (voir brand/tvos.py).
    ("apps/tv/ios/*/Images.xcassets/*.brandassets/*.imagestack/Back.imagestacklayer/Content.imageset/*.png", "tvos-back.svg"),
    ("apps/tv/ios/*/Images.xcassets/*.brandassets/*.imagestack/Light.imagestacklayer/Content.imageset/*.png", "tvos-light.svg"),
    ("apps/tv/ios/*/Images.xcassets/*.brandassets/*.imagestack/Middle.imagestacklayer/Content.imageset/*.png", "tvos-body.svg"),
    ("apps/tv/ios/*/Images.xcassets/*.brandassets/*.imagestack/Front.imagestacklayer/Content.imageset/*.png", "tvos-front.svg"),
    ("apps/tv/ios/*/Images.xcassets/*.brandassets/Top Shelf Image Wide.imageset/*.png", "banner-topshelf-wide.svg"),
    ("apps/tv/ios/*/Images.xcassets/*.brandassets/Top Shelf Image.imageset/*.png", "banner-topshelf.svg"),
    ("apps/tv/ios/*/Images.xcassets/LaunchLogo.imageset/*.png", "launch-logo.svg"),
    # ── webOS : VOLONTAIREMENT ABSENT ────────────────────────────────────────
    # `apps/tv-webos/scripts/icons.mjs` produit ces images, et lui seul le peut :
    # il rend un maître de 5200 px avant de réduire en Lanczos (un rendu direct à
    # 80 px ne préserve pas le crâne), pose un fond opaque dont le dégradé vaut
    # exactement `iconColor` sur les quatre bords (sinon un liseré apparaît à la
    # jointure de la tuile), et refuse un splash qui serait un écran noir. Le
    # 400×400 du Seller Lounge sort dans `store-assets/` et non dans l'IPK.
    #     pnpm --filter @tentacle-tv/tv-webos icons
    # ── Fiches store ─────────────────────────────────────────────────────────
    # Microsoft Store : visuel 1:1 de la fiche produit. Fond plein, aucune
    # transparence — la fiche le compose sur ses propres surfaces claires.
    ("store-assets/windows/*.png", "app-icon-color.svg"),
    ("store-assets/store-poster-*.png", "poster-2x3.svg"),
    # `webos-icon-400.png` appartient au script webOS — cf. plus haut.
    ("store-assets/store-logo-*.png", "app-icon-color.svg"),
]


def svg_bytes(svg, w, h):
    """PNG w×h d'un SVG (texte), par librsvg si présent, sinon par resvg."""
    if shutil.which("rsvg-convert"):
        return subprocess.run(["rsvg-convert", "-w", str(w), "-h", str(h)], input=svg.encode("utf-8"),
                              capture_output=True, check=True).stdout
    try:
        import resvg_py
    except ImportError:
        raise SystemExit("aucun moteur SVG : brew install librsvg, ou pip install resvg-py")
    return bytes(resvg_py.svg_to_bytes(svg_string=svg, width=w, height=h))


def read_svg(source):
    path = BRAND / source
    if not path.exists():
        raise SystemExit(f"source absente : {source} — lancer d'abord generate-svg.py")
    return path.read_text(encoding="utf-8")


def render(svg, target, w, h):
    """Écrit la cible ; le PNG du moteur part tel quel, le WEBP est réencodé."""
    png = svg_bytes(svg, w, h)
    if target.suffix == ".webp":
        Image.open(io.BytesIO(png)).save(target, "WEBP", quality=92)
    else:
        target.write_bytes(png)


_BBOX = {}


def measured_bbox(source):
    """L'encombrement du dessin, en unités de son viewBox, mesuré sur un rendu."""
    if source not in _BBOX:
        svg = read_svg(source)
        im = Image.open(io.BytesIO(svg_bytes(svg, 960, 960)))
        x0, y0, x1, y1 = im.getchannel("A").getbbox()
        unit = 240 / 960  # les logos sont dessinés dans un carré de 240
        _BBOX[source] = (x0 * unit, y0 * unit, x1 * unit, y1 * unit)
    return _BBOX[source]

# Le tableau d'`iconutil`, à l'identique : un type ICNS par entrée d'iconset.
# Deux types peuvent porter la même taille (`ic08` = 256, `ic13` = 128@2x) —
# macOS les distingue par la densité, et le fichier porte alors deux fois les
# mêmes octets. C'est ce que produit iconutil.
ICNS_TYPES = (("icp4", 16), ("icp5", 32), ("ic07", 128), ("ic08", 256),
              ("ic09", 512), ("ic10", 1024), ("ic11", 32), ("ic12", 64),
              ("ic13", 256), ("ic14", 512))


def build_icns(svg, target):
    """
    Écrit l'ICNS sans `iconutil` : depuis les types `icp4`/`ic07`+, un bloc ICNS
    n'est rien d'autre qu'un PNG précédé de son type et de sa longueur. Le
    conteneur se réduit à un en-tête `icns` et à la somme des blocs.
    """
    pngs, blocks = {}, []
    for kind, size in ICNS_TYPES:
        if size not in pngs:
            pngs[size] = svg_bytes(svg, size, size)
        png = pngs[size]
        blocks.append(kind.encode("ascii") + struct.pack(">I", len(png) + 8) + png)
    body = b"".join(blocks)
    target.write_bytes(b"icns" + struct.pack(">I", len(body) + 8) + body)


def ico_entry(png, size):
    """
    Une image d'ICO : PNG à 256 (Vista et plus), DIB 32 bits en dessous — ce que
    `LoadImageW` et l'Explorateur lisent partout. Le DIB porte l'alpha DROIT
    (BGRA de bas en haut), puis un masque ET vide : l'alpha suffit.
    """
    if size >= 256:
        return png
    im = Image.open(io.BytesIO(png)).convert("RGBA")
    r, g, b, a = im.split()
    rows = Image.merge("RGBA", (b, g, r, a)).tobytes()
    stride = size * 4
    pixels = b"".join(rows[y * stride:(y + 1) * stride] for y in reversed(range(size)))
    mask = b"\0" * (((size + 31) // 32) * 4 * size)
    header = struct.pack("<IiiHHIIiiII", 40, size, size * 2, 1, 32, 0, len(pixels) + len(mask), 0, 0, 0, 0)
    return header + pixels + mask


def build_ico(frames, target):
    """`frames` : (taille, svg) — chaque taille rendue pour elle-même."""
    entries = [(size, ico_entry(svg_bytes(svg, size, size), size)) for size, svg in frames]
    offset = 6 + 16 * len(entries)
    head, body = struct.pack("<HHH", 0, 1, len(entries)), b""
    for size, data in entries:
        dim = 0 if size >= 256 else size
        head += struct.pack("<BBBBHHII", dim, dim, 0, 0, 1, 32, len(data), offset + len(body))
        body += data
    target.write_bytes(head + body)


def selected(target):
    """La cible passe le filtre de chemin — sans filtre, toutes passent."""
    rel = str(target.relative_to(ROOT)).replace("\\", "/")
    return not FILTER or any(f in rel for f in FILTER)


def windows_targets():
    """(cible, svg recadré, largeur, hauteur, source) des paquets MSIX et de l'hôte."""
    out = []
    for folder, (logo, nohat) in windows.PACKAGES.items():
        for name, w, h, source, fill in windows.assets(logo, nohat):
            out.append((ROOT / folder / name, source, w, h, fill))
    for rel, w, h, source, fill in windows.SERVER_HOST_ASSETS:
        out.append((ROOT / rel, source, w, h, fill))
    return out


def main():
    done, seen = [], set()
    for pattern, source in RULES:
        svg = None
        for target in sorted(ROOT.glob(pattern)):
            if target in seen or not selected(target):
                continue
            seen.add(target)
            w, h = Image.open(target).size
            done.append((target.relative_to(ROOT), source, w, h))
            if WRITE:
                svg = svg or read_svg(source)
                render(svg, target, w, h)

    wanted = set()
    for target, source, w, h, fill in windows_targets():
        wanted.add(target)
        if not selected(target):
            continue
        done.append((target.relative_to(ROOT), source, w, h))
        if WRITE:
            target.parent.mkdir(parents=True, exist_ok=True)
            render(windows.framed(read_svg(source), measured_bbox(source), w, h, fill), target, w, h)
    # La fiche Microsoft Store du serveur (`store.py`) : CRÉÉS d'après la
    # table, aplatis sur le fond — le Store les veut opaques, sans alpha.
    for name, source, w, h in store.TARGETS:
        target = ROOT / store.OUT_DIR / name
        if not selected(target):
            continue
        done.append((target.relative_to(ROOT), source, w, h))
        if WRITE:
            target.parent.mkdir(parents=True, exist_ok=True)
            rgba = Image.open(io.BytesIO(svg_bytes(read_svg(source), w, h))).convert("RGBA")
            flat = Image.new("RGB", (w, h), store.OPAQUE)
            flat.paste(rgba, mask=rgba.getchannel("A"))
            flat.save(target, "PNG", optimize=True)
    stale = [f for folder in windows.PACKAGES for f in sorted((ROOT / folder).glob("*"))
             if f not in wanted and selected(f)]

    for rel, source, w, h in done:
        print(f"  {w:>5}×{h:<5} ← {source:<26} {rel}")
    for f in stale:
        print(f"  orphelin {'supprimé' if WRITE else 'à supprimer'} : {f.relative_to(ROOT)}")
        if WRITE:
            f.unlink()
    print(f"\n{len(done)} cibles" + (f" (filtre : {' '.join(FILTER)})" if FILTER else "") + ("" if WRITE else " — aperçu, rien écrit (ajouter --write)"))

    # ── macOS et Windows attendent des conteneurs multi-résolutions ─────────
    # Eux aussi suivent le filtre : sans lui, régénérer les seules images de
    # l'Apple TV réécrivait l'icône du bureau (un bruit binaire de plus).
    icns = ROOT / "apps/desktop-electron/icons/icon.icns"
    if WRITE and icns.exists() and selected(icns):
        build_icns(read_svg("app-icon-macos.svg"), icns)
        print(f"  icns reconstruit : {icns.relative_to(ROOT)}")
    # L'icône de l'exécutable du bureau : le carré à coins continus.
    ico = ROOT / "apps/desktop-electron/icons/icon.ico"
    if WRITE and ico.exists() and selected(ico):
        rounded = read_svg("app-icon-rounded.svg")
        build_ico([(s, rounded) for s in (16, 24, 32, 48, 64, 128, 256)], ico)
        print(f"  ico reconstruit : {ico.relative_to(ROOT)}")
    # La zone de notification de Tentacle Server (`appLayout.ts`) : son logo,
    # sur transparent, sans chapeau aux petites tailles.
    tray, sizes = windows.TRAY
    tray = ROOT / tray
    if WRITE and selected(tray):
        logo, nohat = windows.PACKAGES["apps/server-windows/msix/Assets"]
        frames = []
        for s in sizes:
            source = nohat if s <= windows.NOHAT_BELOW else logo
            frames.append((s, windows.framed(read_svg(source), measured_bbox(source), s, s, windows.FILL_ICON)))
        build_ico(frames, tray)
        print(f"  ico reconstruit : {tray.relative_to(ROOT)}")


main()
