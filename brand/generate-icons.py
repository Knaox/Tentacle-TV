"""
Rasterise tous les dérivés binaires depuis `brand/*.svg`.

    python3 brand/generate-icons.py                        # aperçu, n'écrit rien
    python3 brand/generate-icons.py --write                # écrit
    python3 brand/generate-icons.py --write desktop-electron   # une part seulement

Le filtre — toute mot qui n'est pas `--write` — retient les cibles dont le
chemin le contient. Il ne sert pas qu'au confort : deux versions de librsvg ne
rendent pas au bit près, et régénérer les 84 cibles pour en corriger cinq
remplacerait le reste par un bruit binaire indiscernable d'un vrai changement.

Chaque cible est régénérée **à ses dimensions actuelles**, relevées sur le
fichier en place : les formats attendus par les stores ne se devinent pas, et une
icône à la mauvaise taille est un rejet. Une cible absente est signalée, jamais
créée à l'aveugle.

Exige `rsvg-convert` (brew install librsvg) et `magick`. L'ICNS est écrit
ici même : `iconutil` n'existe que sur macOS, et son absence faisait sauter
l'icône du Dock EN SILENCE quand le script tournait sous Linux.
"""
import pathlib, shutil, struct, subprocess, sys

ROOT = pathlib.Path(__file__).parent.parent
BRAND = pathlib.Path(__file__).parent
WRITE = "--write" in sys.argv
FILTER = [a for a in sys.argv[1:] if not a.startswith("--")]

# Motif de chemin → SVG source. Le premier motif qui correspond gagne, donc les
# règles les plus précises viennent d'abord.
RULES = [
    # ── Desktop (Electron) ───────────────────────────────────────────────────
    ("apps/desktop-electron/msix/Assets/Wide310x150Logo.png", "banner-wide.svg"),
    ("apps/desktop-electron/msix/Assets/SplashScreen.png", "banner-wide.svg"),
    # Windows et Linux posent l'image TELLE QUELLE : sans coins, l'application
    # est un carré dans la barre des tâches. macOS ne masque de lui-même que
    # depuis Tahoe — sur les versions d'avant, le carré restait carré.
    ("apps/desktop-electron/msix/Assets/*.png", "app-icon-rounded.svg"),
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
    ("apps/tv/ios/*/Images.xcassets/*.brandassets/*.imagestack/Back.imagestacklayer/Content.imageset/*.png", "tvos-back.svg"),
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

def need(tool):
    if not shutil.which(tool):
        raise SystemExit(f"outil manquant : {tool}")

def dimensions(path):
    out = subprocess.run(["magick", "identify", "-format", "%w %h", str(path)],
                         capture_output=True, text=True, check=True).stdout.split()
    return int(out[0]), int(out[1])

def render(svg, target, w, h):
    """Rasterise en PNG, puis convertit si la cible attend un autre format."""
    tmp = target.with_suffix(".tmp.png")
    subprocess.run(["rsvg-convert", "-w", str(w), "-h", str(h), "-o", str(tmp), str(svg)], check=True)
    if target.suffix == ".webp":
        subprocess.run(["magick", str(tmp), "-quality", "92", str(target)], check=True)
        tmp.unlink()
    else:
        tmp.replace(target)

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
            tmp = BRAND / f"icns-{size}.png"
            render(svg, tmp, size, size)
            pngs[size] = tmp.read_bytes()
            tmp.unlink()
        png = pngs[size]
        blocks.append(kind.encode("ascii") + struct.pack(">I", len(png) + 8) + png)
    body = b"".join(blocks)
    target.write_bytes(b"icns" + struct.pack(">I", len(body) + 8) + body)

def main():
    need("rsvg-convert"); need("magick")
    done, seen = [], set()
    for pattern, source in RULES:
        svg = BRAND / source
        if not svg.exists():
            raise SystemExit(f"source absente : {source} — lancer d'abord generate-svg.py")
        for target in sorted(ROOT.glob(pattern)):
            if target in seen:
                continue
            rel = str(target.relative_to(ROOT))
            if FILTER and not any(f in rel for f in FILTER):
                continue
            seen.add(target)
            w, h = dimensions(target)
            done.append((target.relative_to(ROOT), source, w, h))
            if WRITE:
                render(svg, target, w, h)

    for rel, source, w, h in done:
        print(f"  {w:>5}×{h:<5} ← {source:<26} {rel}")
    print(f"\n{len(done)} cibles" + (f" (filtre : {' '.join(FILTER)})" if FILTER else "") + ("" if WRITE else " — aperçu, rien écrit (ajouter --write)"))

    # ── macOS et Windows attendent des conteneurs multi-résolutions ─────────
    icns = ROOT / "apps/desktop-electron/icons/icon.icns"
    ico = ROOT / "apps/desktop-electron/icons/icon.ico"
    if WRITE and icns.exists():
        build_icns(BRAND / "app-icon-macos.svg", icns)
        print(f"  icns reconstruit : {icns.relative_to(ROOT)}")
    if WRITE and ico.exists():
        pngs = []
        for size in (16, 24, 32, 48, 64, 128, 256):
            out = BRAND / f"ico-{size}.png"
            render(BRAND / "app-icon-rounded.svg", out, size, size)
            pngs.append(str(out))
        subprocess.run(["magick"] + pngs + [str(ico)], check=True)
        for f in pngs:
            pathlib.Path(f).unlink()
        print(f"  ico reconstruit : {ico.relative_to(ROOT)}")

main()
