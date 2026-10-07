#!/bin/bash
# Isole MPVKit : chaque tranche du xcframework devient UN objet relogeable
# (`ld -r`) qui n'exporte que l'API publique de mpv (`mpv_*`). FFmpeg, dav1d,
# libass, libplacebo… y deviennent des symboles PRIVÉS.
#
# POURQUOI (mesuré le 2026-10-07) : l'app embarque AUSSI le pod `libdav1d`
# 1.2.0 (expo-image → libavif), et le xcframework n'était qu'une archive de
# tous les `.a` : à l'édition de liens, les symboles dav1d du pod (passé en
# premier) l'emportaient en partie sur le dav1d 1.5.2 de MPVKit. FFmpeg se
# retrouvait avec deux dav1d mêlés (ABI 6 et 7) et mpv plantait, pointeur de
# fonction nul, dès l'ouverture d'un AV1. Isolé, chacun garde le sien.
#
#   MPVKit-isolate.sh <MPVKit.xcframework>     (modifié sur place)
#
# Joué par CocoaPods juste après le téléchargement (`prepare_command` de
# MPVKit.podspec, qui en lit le texte) : la Release publiée reste celle de
# mpvkit.yml, la transformation est versionnée ici. Idempotent.
#
# Les « communs » (variables non initialisées, `dav1d_masks`…) ne sont pas
# rendus privés par `ld -r` et le `-d` de ld64 n'existe plus (ld-prime) : on
# les DÉFINIT dans un petit objet assembleur, à la même taille et au même
# alignement, avant de fusionner.
set -euo pipefail

XCF="${1:?usage : MPVKit-isolate.sh <MPVKit.xcframework>}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

platform_of() {   # nom de tranche → plateforme ld et SDK
  case "$1" in
    ios-*-simulator) echo "ios-simulator iphonesimulator" ;;
    ios-*) echo "ios iphoneos" ;;
    *) echo "inconnue" ;;
  esac
}

for slice in "$XCF"/*/; do
  slice="${slice%/}"
  name="$(basename "$slice")"
  bin="$slice/MPVKit.framework/MPVKit"
  [ -f "$bin" ] || continue
  # Ce pod ne sert que l'iPhone (podspec : ios) : les tranches tvOS restent
  # telles quelles — et aucun SDK tvOS n'est exigé du runner de la CI.
  case "$name" in ios-*) ;; *) echo "$name : ignorée (hors iOS)"; continue ;; esac
  read -r plat sdk <<<"$(platform_of "$name")"
  [ "$plat" != "inconnue" ] || { echo "tranche inconnue : $name" >&2; exit 1; }
  archs=$(lipo -archs "$bin")
  outs=()
  for arch in $archs; do
    d="$WORK/$name-$arch"; mkdir -p "$d"
    if [ "$(echo "$archs" | wc -w)" -gt 1 ]; then lipo -thin "$arch" "$bin" -o "$d/in.a"; else cp "$bin" "$d/in.a"; fi
    # L'API publique : les fonctions mpv_ externes (les privées, mpv_version…, restent dedans).
    nm -m "$d/in.a" 2>/dev/null | grep -E '\(__TEXT,__text\) external _mpv_' | grep -v 'private external' \
      | awk '{print $NF}' | sort -u > "$d/exports.txt"
    [ -s "$d/exports.txt" ] || { echo "$name/$arch : aucune fonction mpv_ exportée" >&2; exit 1; }
    U=(); while read -r s; do U+=(-u "$s"); done < "$d/exports.txt"
    # 1er passage : relever les communs ; 2e : les définir, puis tout fusionner.
    ld -r -arch "$arch" -platform_version "$plat" 13.0 17.0 "${U[@]}" "$d/in.a" -o "$d/probe.o" 2>/dev/null
    nm -m "$d/probe.o" | { grep '(common)' || true; } | awk '{a=$4; sub(/2\^/,"",a); sub(/\)/,"",a);
      print "\t.globl " $NF "\n\t.zerofill __DATA,__common," $NF ",0x" $1 "," a}' > "$d/commons.s"
    case "$plat" in
      *-simulator) target="$arch-apple-${plat%-simulator}13.0-simulator" ;;
      *) target="$arch-apple-${plat}13.0" ;;
    esac
    xcrun -sdk "$sdk" clang -c -target "$target" "$d/commons.s" -o "$d/commons.o"
    ld -r -arch "$arch" -platform_version "$plat" 13.0 17.0 "${U[@]}" "$d/commons.o" "$d/in.a" \
      -exported_symbols_list "$d/exports.txt" -o "$d/mpvkit.o" 2>&1 | grep -v 'not 4-byte aligned\|built for newer' || true
    leaked=$(nm -g --defined-only "$d/mpvkit.o" | awk '{print $3}' | grep -vc '^_mpv_' || true)
    commons=$(nm -m "$d/mpvkit.o" | grep -c '(common)' || true)
    [ "$leaked" = "0" ] && [ "$commons" = "0" ] || { echo "$name/$arch : $leaked symbole(s) hors mpv_ exporté(s), $commons commun(s)" >&2; exit 1; }
    libtool -static -o "$d/out.a" "$d/mpvkit.o" 2>/dev/null
    outs+=("$d/out.a")
    echo "$name/$arch : $(wc -l < "$d/exports.txt" | tr -d ' ') fonctions mpv_ exportées, le reste privé"
  done
  if [ "${#outs[@]}" -gt 1 ]; then lipo -create "${outs[@]}" -o "$bin"; else cp "${outs[0]}" "$bin"; fi
done
