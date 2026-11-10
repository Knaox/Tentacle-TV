#!/usr/bin/env bash
# Contrôle de SYNTAXE du code Linux de Tentacle CEF depuis le Mac (g++ 12, Debian arm64), sans
# CEF Linux ni lien : de quoi relire son code Linux avant le banc complet (bench/linux/run.sh).
#   bench/linux/syntax.sh                      tous les .cpp hors macOS/Windows
#   bench/linux/syntax.sh src/x/y.cpp …        ces fichiers-là
# Image : tentacle-cef-maj-cross:bookworm (banc de la mise à jour, déjà locale). En-têtes absents
# de l'image, posés une fois dans $cache/linux-axe/hdr : Wayland, EGL/GLES (paquets Debian
# épinglés par SHA-256, quelques centaines de Ko), les deux en-têtes Linux de CEF (même
# version que cef-version.env), SDL3 et X11 de Homebrew. Rien n'est installé dans l'image.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(cd "$here/../.." && pwd)"
cache="${TENTACLE_CEF_CACHE:-$HOME/.cache/tentacle-cef}"
hdr="$cache/linux-axe/hdr"
source "$root/scripts/deps/cef-version.env"
cef="$cache/deps/cef/$CEF_VERSION"
image=tentacle-cef-maj-cross:bookworm

die() { echo "syntaxe linux : $*" >&2; exit 1; }
docker info >/dev/null 2>&1 || die "Docker injoignable (colima arrêtée ?)"
docker image inspect "$image" >/dev/null 2>&1 || die "image $image absente : pnpm test:update:cross la construit"
[[ -f "$cef/include/cef_version.h" ]] || die "CEF macOS absent ($cef) : scripts/deps/fetch-cef.sh"

# Paquets Debian : <chemin dans pool/main> <sha256>
debs=(
  "w/wayland/libwayland-dev_1.26.0-1_arm64.deb 1dac47e14695c2aacbad147e31a3e1e9e63112ff8fdbca1a8755653f56b4259e"
  "w/wayland/libwayland-bin_1.21.0-1_arm64.deb 02e9361617b43b130ff032873a910258884160c169e89a1ca45d34d1150a2615"
  "w/wayland-protocols/wayland-protocols_1.49-1_all.deb d945ab1aeb98aac86b14569b0dd706471a842cd0738ae9ae5ccec5db4f632d48"
  "libg/libglvnd/libegl-dev_1.7.0-3+b1_arm64.deb 8c731ba4e515489a399a97a84d9ee9591b30d3bbe7c9db3135db462ce903b0c4"
  "libg/libglvnd/libgles-dev_1.7.0-3+b1_arm64.deb c74bc204d49572daa8e0bc8f47a081d78a52fe7513fae2895a987bb1b7897c75"
  "libg/libglvnd/libgl-dev_1.7.0-3+b1_arm64.deb 70a305bdedd23b9bdd592379763b87efb73e5af3edb18dab1eb5ab4c26dedf29"
)
# En-têtes Linux de CEF au commit de CEF_VERSION : <fichier> <sha256>
cef_headers=(
  "cef_linux.h 8c8e2b7a14c6b1e65708dceae091af3f76c97c8732e4108126e3ae99e97b9353"
  "cef_types_linux.h ff259abd9da434157d48211bda6142a639aeee1b497feceaedb58e60ee386cf7"
)

fetch_pinned() {  # url fichier sha256
  [[ -f "$2" && "$(shasum -a 256 "$2" | cut -d' ' -f1)" == "$3" ]] && return 0
  curl -sfL -o "$2.part" "$1" || die "téléchargement impossible : $1"
  [[ "$(shasum -a 256 "$2.part" | cut -d' ' -f1)" == "$3" ]] || { rm -f "$2.part"; die "empreinte inattendue : $1"; }
  mv "$2.part" "$2"
}

if [[ ! -f "$hdr/.ready" ]]; then
  mkdir -p "$hdr/debs" "$hdr/root" "$hdr/cef-linux/include/internal"
  for d in "${debs[@]}"; do
    read -r path sum <<<"$d"  # jamais `set --` : les arguments du script sont la liste des fichiers
    fetch_pinned "http://deb.debian.org/debian/pool/main/$path" "$hdr/debs/$(basename "$path")" "$sum"
    tmp="$(mktemp -d)"
    (cd "$tmp" && ar x "$hdr/debs/$(basename "$path")" && tar -xf data.tar.* -C "$hdr/root")
    rm -rf "$tmp"
  done
  commit="${CEF_VERSION#*+g}"; commit="${commit%%+*}"
  for h in "${cef_headers[@]}"; do
    read -r name sum <<<"$h"
    fetch_pinned "https://raw.githubusercontent.com/chromiumembedded/cef/$commit/include/internal/$name" \
      "$hdr/cef-linux/include/internal/$name" "$sum"
  done
  for d in SDL3 X11; do
    [[ -d /opt/homebrew/include/$d ]] || die "en-têtes $d absents (brew install sdl3 libx11)"
    rm -rf "${hdr:?}/$d" && cp -RL "/opt/homebrew/include/$d" "$hdr/$d"
  done
  touch "$hdr/.ready"
fi

cd "$root"
if (($# == 0)); then
  set -- $(find src -name '*.cpp' ! -path '*/macos/*' ! -path '*/windows/*' ! -path '*/tests/*' \
           ! -name '*_windows.cpp' ! -name '*_mac*' | sort)
fi
exec docker run --rm --pull=never --cpus=2 -v "$root:/src:ro" -v "$hdr:/hdr:ro" -v "$cef:/cef:ro" \
  -v "$cache/deps/mpv-src/include:/mpv:ro" "$image" bash /src/bench/linux/syntax-inside.sh "$@"
