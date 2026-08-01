# Licences tierces — Tentacle TV Desktop

Tentacle TV (application) est distribué sous licence **MIT**.

## Lecteur vidéo embarqué (mpv + FFmpeg)

L'application desktop embarque **mpv** et **FFmpeg** pour la lecture vidéo.

| Build | Licence des binaires mpv/FFmpeg |
|-------|----------------------------------|
| **Mac App Store** | **LGPL v2.1+** — build sans composants GPL (`-Dgpl=false` pour mpv, FFmpeg sans `--enable-gpl`, **sans** x264/x265). |
| Windows (Microsoft Store) / Linux | mpv/FFmpeg tels que fournis par le système / le plugin (peuvent être GPL). |

### Conformité LGPL (build Mac App Store)

Conformément à la LGPL v2.1+ :

- mpv et FFmpeg sont liés **dynamiquement** (dylibs séparées dans `Tentacle TV.app/Contents/Frameworks/`), ce qui permet à l'utilisateur de **remplacer/relier** ces bibliothèques.
- Le **code source** des versions utilisées est disponible publiquement :
  - mpv — https://mpv.io / https://github.com/mpv-player/mpv (tag du build : voir `scripts/build-mpv-lgpl-macos.sh`)
  - FFmpeg — https://ffmpeg.org / https://github.com/FFmpeg/FFmpeg (tag du build : voir `scripts/build-mpv-lgpl-macos.sh`)
- La recette de compilation LGPL exacte est versionnée : `apps/desktop/scripts/build-mpv-lgpl-macos.sh`.

> Note : x264 et x265 (encodeurs, GPL) ne sont **pas** inclus. Un lecteur ne fait que **décoder** ;
> le décodage H.264/HEVC/AV1/VP9 est assuré par les décodeurs LGPL de FFmpeg + VideoToolbox (Apple).

## Pilote graphique embarqué (MoltenVK) — macOS

Le paquet **Mac App Store** embarque également **MoltenVK**, sous licence
**Apache 2.0**, dans `Tentacle TV.app/Contents/Frameworks/` (`libMoltenVK.dylib`,
déclaré par `MoltenVK_icd.json`).

- Source : https://github.com/KhronosGroup/MoltenVK — version livrée : celle de la
  formule Homebrew `molten-vk` au moment du build (voir
  `apps/desktop/scripts/build-mpv-lgpl-macos.sh`).
- Rôle : mpv rend l'image par `gpu-context=macvk`, c'est-à-dire Vulkan traduit
  vers Metal. `libvulkan.1.dylib` n'est que le chargeur ; sans ce pilote il
  n'énumère aucun périphérique, et l'application n'affiche aucune image dans le
  bac à sable — les chemins système où il le chercherait sinon y sont
  inaccessibles.
- La licence Apache 2.0 exige la conservation de l'avis de copyright et du fichier
  `NOTICE` : tous deux accompagnent la distribution amont référencée ci-dessus.

## Autres dépendances

Les bibliothèques liées par FFmpeg/mpv dans le build LGPL (dav1d, libass, FreeType,
HarfBuzz, FriBidi, fontconfig, etc.) sont sous licences permissives ou LGPL
(BSD/MIT/ISC/LGPL). Aucune dépendance GPL n'est incluse dans le build Mac App Store.
