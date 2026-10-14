#!/usr/bin/env python3
"""La troupe des avatars : chaque personnage de `characters/` est dessiné en
calques d'encre puis « imprimé » en risographie (`riso.py`), et écrit pour le
client web :

    apps/web/public/avatars/<id>.webp          512 px — envoyé à Jellyfin
    apps/web/public/avatars/thumbs/<id>.webp   192 px — la grille de la galerie

puis recopié À L'OCTET PRÈS pour l'app mobile, qui les embarque :

    apps/mobile/assets/avatars/<id>.webp, thumbs/<id>.webp
    apps/mobile/src/avatars/avatarAssets.generated.ts   les `require` statiques, par identifiant

    python3 brand/avatars/generate.py                       # toute la troupe
    python3 brand/avatars/generate.py lanterne bulle        # quelques-uns
    python3 brand/avatars/generate.py --preview <dossier>   # PNG ronds + planche, rien dans le dépôt

Exige numpy, Pillow (avec WebP) et `rsvg-convert` (brew install librsvg).
Rendu déterministe : le hasard (grain, tremblé, décalage des passages) est
tiré du nom du personnage. La liste et l'ordre de la galerie vivent dans
`packages/shared/src/avatars/avatarCatalog.ts` ; un test du web et un du
mobile vérifient que chaque personnage du catalogue a ses deux images.
"""
import importlib
import pathlib
import shutil
import sys

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import riso  # noqa: E402
from PIL import Image  # noqa: E402

ROOT = HERE.parent.parent
PUBLIC = ROOT / "apps" / "web" / "public" / "avatars"
MOBILE_ASSETS = ROOT / "apps" / "mobile" / "assets" / "avatars"
MOBILE_MODULE = ROOT / "apps" / "mobile" / "src" / "avatars" / "avatarAssets.generated.ts"
FULL_SIZE, THUMB_SIZE = 512, 192
FULL_QUALITY, THUMB_QUALITY = 72, 80


def character_ids():
    return sorted(p.stem for p in (HERE / "characters").glob("*.py") if not p.stem.startswith("_"))


def render(character_id):
    module = importlib.import_module(f"characters.{character_id}")
    options = getattr(module, "OPTIONS", {})
    return riso.print_layers(character_id, module.draw(), paper=options.get("paper", riso.PAPER),
                             wobble=options.get("wobble", 1.0), grain=options.get("grain", 1.0),
                             misreg=options.get("misreg", 1.0))


def write_public(character_id, printed):
    (PUBLIC / "thumbs").mkdir(parents=True, exist_ok=True)
    image = Image.fromarray((printed * 255).astype("uint8"), "RGB")
    image.resize((FULL_SIZE, FULL_SIZE), Image.LANCZOS).save(
        PUBLIC / f"{character_id}.webp", quality=FULL_QUALITY, method=6)
    image.resize((THUMB_SIZE, THUMB_SIZE), Image.LANCZOS).save(
        PUBLIC / "thumbs" / f"{character_id}.webp", quality=THUMB_QUALITY, method=6)


def copy_to_mobile(character_id):
    """Les MÊMES fichiers que le web : Metro ne sait embarquer que ce qui est sous l'app."""
    (MOBILE_ASSETS / "thumbs").mkdir(parents=True, exist_ok=True)
    for relative in (f"{character_id}.webp", f"thumbs/{character_id}.webp"):
        shutil.copyfile(PUBLIC / relative, MOBILE_ASSETS / relative)


def write_mobile_module(ids):
    """Le module des `require` : Metro n'embarque une image que nommée en toutes lettres."""
    def table(name, folder, comment):
        rows = "\n".join(f'  {i}: require("../../assets/avatars/{folder}{i}.webp"),' for i in ids)
        return f"/** {comment} */\nexport const {name}: Readonly<Record<string, number>> = {{\n{rows}\n}};\n"
    MOBILE_MODULE.parent.mkdir(parents=True, exist_ok=True)
    MOBILE_MODULE.write_text(
        "/**\n"
        " * GÉNÉRÉ par `brand/avatars/generate.py` — ne pas retoucher à la main.\n"
        " *\n"
        " * Les images de la troupe embarquées dans l'app, copies à l'octet près de\n"
        " * `apps/web/public/avatars/` : un `require` statique par personnage, seul\n"
        " * moyen pour Metro de les mettre dans le paquet.\n"
        " */\n\n"
        + table("AVATAR_THUMBS", "thumbs/", "La vignette de la grille (192 px).")
        + "\n"
        + table("AVATAR_IMAGES", "", "L'image entière (512 px) : celle qu'on envoie à Jellyfin.")
    )


def contact_sheet(images, path, cols=6, cell=256, pad=16):
    rows = (len(images) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * (cell + pad) + pad, rows * (cell + pad) + pad), (14, 12, 22))
    for i, image in enumerate(images):
        r, c = divmod(i, cols)
        sheet.paste(image.resize((cell, cell), Image.LANCZOS), (pad + c * (cell + pad), pad + r * (cell + pad)))
    sheet.save(path)


def main(argv):
    preview = None
    if "--preview" in argv:
        i = argv.index("--preview")
        preview = pathlib.Path(argv[i + 1])
        argv = argv[:i] + argv[i + 2:]
    wanted = argv or character_ids()
    unknown = sorted(set(wanted) - set(character_ids()))
    if unknown:
        raise SystemExit(f"personnages inconnus : {', '.join(unknown)}")
    previews = []
    for character_id in wanted:
        printed = render(character_id)
        if preview:
            preview.mkdir(parents=True, exist_ok=True)
            previews.append(riso.save(printed, str(preview / f"{character_id}.png"), circle_preview=True))
        else:
            write_public(character_id, printed)
            copy_to_mobile(character_id)
        print("ok", character_id)
    if preview and len(previews) > 1:
        contact_sheet(previews, preview / "_sheet.png")
    if not preview:
        write_mobile_module(character_ids())


if __name__ == "__main__":
    main(sys.argv[1:])
