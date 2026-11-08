#!/usr/bin/env bash
# Élague la copie du framework CEF du paquet (jamais la distribution dans deps/cef) de ce
# que CEF classe « optionnel » (README.txt, REDISTRIBUTION) et que Tentacle n'utilise pas.
# Usage : trim-cef.sh <…/Chromium Embedded Framework.framework/Versions/A> <racine CEF>
set -euo pipefail
fw="$1"; cef_root="$2"
res="$fw/Resources"

# Locales : le front de Tentacle n'existe qu'en français et en anglais. Chromium retombe
# sur « en » (en-US) pour toute autre langue du système. Les variantes _FEMININE/_MASCULINE/
# _NEUTER (accord grammatical, 18 octets chacune) suivent leur langue.
for d in "$res"/*.lproj; do
  case "$(basename "$d")" in
    en.lproj|fr.lproj|en_FEMININE.lproj|en_MASCULINE.lproj|en_NEUTER.lproj|\
    fr_FEMININE.lproj|fr_MASCULINE.lproj|fr_NEUTER.lproj) ;;
    *) rm -rf "$d" ;;
  esac
done

# SwANGLE : rendu logiciel de secours (canvas 2D, CSS 3D, WebGL) quand le GPU est désactivé
# ou indisponible. Le proto rend par le GPU (OSR à IOSurface, ANGLE sur Metal) ; sans ces
# fichiers, une panne GPU retombe sur le compositeur logiciel de Chromium, sans WebGL.
# libvulkan.dylib n'est que le chargeur Vulkan de SwiftShader (rien d'autre sur macOS).
rm -f "$fw/Libraries/libvk_swiftshader.dylib" "$fw/Libraries/vk_swiftshader_icd.json" \
  "$fw/Libraries/libvulkan.dylib"

# resources.pak : front-end DevTools et sons d'accueil de Chrome, choisis par nom
# (include/cef_pack_resources.h) ; détail et garde-fous dans trim-pak.py.
python3 -I "$(dirname "$0")/trim-pak.py" "$res/resources.pak" "$cef_root/include/cef_pack_resources.h"
