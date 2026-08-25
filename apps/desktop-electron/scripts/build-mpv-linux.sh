#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# libmpv + FFmpeg pour Linux, et la chaîne complète qui va avec.
#
# # Pourquoi ne pas prendre celle de la distribution
#
# Deux raisons, la première mesurée. Sur Fedora 44, `mpv-libs` 0.41 du dépôt
# officiel refuse le HEVC — « (no decoders) / Failed to initialize a decoder for
# codec 'hevc' » : les distributions bâtissent FFmpeg sans les codecs brevetés,
# et un client Jellyfin sans HEVC ne lit pas la moitié d'une médiathèque.
# Seconde raison : le HDR demande mpv >= 0.40 et libplacebo >= 7.349, absents de
# toutes les distributions stables — Ubuntu 24.04 livre encore libplacebo 6.
#
# # Les licences, et pourquoi elles ne sont PAS les mêmes que sur macOS
#
# FFmpeg reste **LGPL** : ni x264 ni x265, pas de `--enable-gpl`. Ce sont des
# ENCODEURS ; le décodage H.264, HEVC, AV1 et VP9 est assuré par les décodeurs
# LGPL et par l'accélération matérielle. Aucune perte à la lecture.
#
# ⚠️ **mpv, lui, est bâti en GPL sous Linux — et il n'y a pas le choix.** Son
# backend X11 vient de MPlayer et n'est pas relicenciable ; meson le refuse net :
#
#     ERROR: Feature x11 cannot be enabled: the build is not GPL!
#
# Une libmpv LGPL n'a donc AUCUNE sortie vidéo sous X11. Sur macOS ce n'était pas
# un problème — il n'y a pas de X11 —, ici cela reviendrait à ne rien afficher
# pour tous les utilisateurs restés sur une session X11.
#
# Le prix est nul du côté de la distribution : Linux n'a pas de store à
# satisfaire, MIT et GPL sont compatibles, la recette est ce fichier, et les
# sources de mpv et de FFmpeg sont publiques (mpv.io, ffmpeg.org). C'est
# d'ailleurs ce que fait chaque distribution. La contrainte macOS — le rejet de
# l'App Store, celui qui a fait retirer VLC — ne s'applique qu'à elle.
#
# # Où l'on compile, et pourquoi c'est la plus VIEILLE distribution qui gagne
#
# La glibc est compatible vers l'avant, jamais vers l'arrière : une bibliothèque
# bâtie sur Ubuntu 22.04 tourne sur Arch, l'inverse est faux. La CI compile donc
# sur le plus ancien socle qu'on veuille servir.
#
# Usage : bash apps/desktop-electron/scripts/build-mpv-linux.sh [--sortie <dossier>]
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

FFMPEG_TAG="n7.1.1"        # libavcodec 61/62
VULKAN_HEADERS_TAG="v1.4.309"   # Ubuntu 24.04 s'arrête à 1.3.275, FFmpeg exige 1.3.277
NVCODEC_TAG="n13.0.19.0"        # en-têtes NVDEC/NVENC (MIT), sans lesquels pas de nvdec
PLACEBO_TAG="v7.351.0"     # exigée par mpv 0.41 (>= 7.349)
MPV_TAG="v0.41.0"          # première à savoir parler couleur à Wayland

ICI="$(cd "$(dirname "$0")" && pwd)"
SORTIE="$ICI/../vendor/mpv-linux"
while [ $# -gt 0 ]; do
  case "$1" in
    --sortie) SORTIE="$2"; shift 2 ;;
    *) echo "argument inconnu : $1" >&2; exit 2 ;;
  esac
done
SORTIE="$(mkdir -p "$SORTIE" && cd "$SORTIE" && pwd)"

# Hors du dépôt : les chemins du projet peuvent contenir des espaces, ce que ni
# FFmpeg ni meson ne supportent partout.
TRAVAIL="/tmp/tentacle-mpv-lgpl-linux"
PREFIX="$TRAVAIL/prefix"
mkdir -p "$TRAVAIL"
export PKG_CONFIG_PATH="$PREFIX/lib/pkgconfig:$PREFIX/lib/x86_64-linux-gnu/pkgconfig:${PKG_CONFIG_PATH:-}"
export LD_LIBRARY_PATH="$PREFIX/lib:${LD_LIBRARY_PATH:-}"
export CPATH="$PREFIX/include:${CPATH:-}"

echo "==> Chaîne mpv pour Linux — prefix=$PREFIX, sortie=$SORTIE"

# 1. Outils et dépendances. Tout ce qui est ici est LGPL, BSD ou MIT.
if command -v apt-get >/dev/null; then
  SUDO=""; [ "$(id -u)" -eq 0 ] || SUDO="sudo"
  $SUDO apt-get update -qq
  $SUDO apt-get install -y -qq --no-install-recommends \
    build-essential git meson ninja-build nasm pkg-config python3 patchelf ca-certificates \
    libvulkan-dev glslang-tools libshaderc-dev liblcms2-dev libunwind-dev \
    libdav1d-dev libass-dev libfreetype-dev libfontconfig-dev libfribidi-dev libharfbuzz-dev \
    libwayland-dev wayland-protocols libxkbcommon-dev libx11-dev libxext-dev libxrandr-dev \
    libxpresent-dev libxss-dev libxinerama-dev libdrm-dev libgbm-dev libegl-dev libgl-dev \
    libasound2-dev libpulse-dev libpipewire-0.3-dev \
    libva-dev libvdpau-dev libzimg-dev \
    libopus-dev libvorbis-dev libogg-dev libmp3lame-dev libsoxr-dev
fi

cloner() { # dépôt, tag, dossier
  [ -d "$3" ] || git clone --depth 1 --branch "$2" "$1" "$3"
}

# 2. En-têtes qui manquent aux distributions stables, et rien d'autre.
#
# ⚠️ Des EN-TÊTES, pas des bibliothèques : le chargeur Vulkan et le pilote NVIDIA
# restent ceux de la machine. Ubuntu 24.04 s'arrête aux en-têtes Vulkan 1.3.275
# quand FFmpeg 7.1 en exige 1.3.277 — sans elles, « vulkan requested but not
# found », et l'on perd le décodage Vulkan Video que mpv 0.41 préfère à tout.
if [ ! -f "$PREFIX/include/vulkan/vulkan_core.h" ]; then
  echo "==> En-têtes Vulkan $VULKAN_HEADERS_TAG"
  cloner https://github.com/KhronosGroup/Vulkan-Headers.git "$VULKAN_HEADERS_TAG" "$TRAVAIL/vulkan-headers"
  cp -r "$TRAVAIL/vulkan-headers/include/." "$PREFIX/include/"
fi
if [ ! -f "$PREFIX/lib/pkgconfig/ffnvcodec.pc" ]; then
  echo "==> En-têtes NVDEC $NVCODEC_TAG"
  cloner https://github.com/FFmpeg/nv-codec-headers.git "$NVCODEC_TAG" "$TRAVAIL/nvcodec"
  make -C "$TRAVAIL/nvcodec" PREFIX="$PREFIX" install
fi

# 3. libplacebo — le moteur de rendu de `gpu-next`, et donc tout le HDR.
if [ ! -f "$PREFIX/lib/libplacebo.so" ] && [ ! -f "$PREFIX/lib/x86_64-linux-gnu/libplacebo.so" ]; then
  echo "==> libplacebo $PLACEBO_TAG"
  cloner https://code.videolan.org/videolan/libplacebo.git "$PLACEBO_TAG" "$TRAVAIL/placebo"
  git -C "$TRAVAIL/placebo" submodule update --init --recursive --depth 1
  meson setup "$TRAVAIL/placebo/build" "$TRAVAIL/placebo" \
    --prefix="$PREFIX" --libdir=lib --buildtype=release \
    -Dvulkan=enabled -Dshaderc=enabled -Dlcms=enabled -Dopengl=enabled -Ddemos=false
  ninja -C "$TRAVAIL/placebo/build" install
fi

# 4. FFmpeg — LGPL. Pas de `--enable-gpl`, pas de x264/x265, pas de nonfree.
if [ ! -f "$PREFIX/lib/libavcodec.so" ]; then
  echo "==> FFmpeg $FFMPEG_TAG (LGPL)"
  cloner https://github.com/FFmpeg/FFmpeg.git "$FFMPEG_TAG" "$TRAVAIL/ffmpeg"
  cd "$TRAVAIL/ffmpeg"
  ./configure \
    --prefix="$PREFIX" --libdir="$PREFIX/lib" \
    --enable-shared --disable-static \
    --disable-programs --disable-doc --disable-debug \
    --disable-gpl --disable-nonfree \
    --extra-cflags="-I$PREFIX/include" --extra-ldflags="-L$PREFIX/lib" \
    --enable-libdav1d --enable-libopus --enable-libvorbis --enable-libsoxr \
    --enable-vaapi --enable-vdpau --enable-vulkan --enable-nvdec
  make -j"$(nproc)"
  make install
fi

# 5. mpv — bibliothèque seule, LGPL.
if [ ! -f "$PREFIX/lib/libmpv.so" ]; then
  echo "==> mpv $MPV_TAG (GPL — voir l'en-tête, libmpv seule)"
  cloner https://github.com/mpv-player/mpv.git "$MPV_TAG" "$TRAVAIL/mpv"
  # ⚠️ `-Dgpl=true` : sans lui, pas de sortie X11 (voir l'en-tête). Cela n'ouvre
  # la porte à aucun encodeur — x264 et x265 ne sont pas installés, et FFmpeg est
  # bâti sans `--enable-gpl`.
  #
  # ⚠️ La liste de `disabled` n'est pas de l'économie de principe : chaque
  # fonction laissée active traîne ses dépendances dans le paquet. `libarchive`
  # seule amenait libxml2, qui amène ICU — trente mégaoctets pour lire une vidéo
  # dans une archive, ce qu'un client Jellyfin ne fait jamais. Rubberband est en
  # outre GPL, et serait détectée toute seule.
  meson setup "$TRAVAIL/mpv/build" "$TRAVAIL/mpv" \
    --prefix="$PREFIX" --libdir=lib --buildtype=release \
    -Dgpl=true -Dlibmpv=true -Dcplayer=false \
    -Dvulkan=enabled -Dwayland=enabled -Dx11=enabled -Degl=enabled \
    -Dlua=disabled -Djavascript=disabled \
    -Drubberband=disabled -Dvapoursynth=disabled -Duchardet=disabled \
    -Dlibbluray=disabled -Dlibarchive=disabled -Dsixel=disabled -Dcaca=disabled \
    -Ddvdnav=disabled -Dcdda=disabled -Ddvbin=disabled -Dopenal=disabled -Dsdl2=disabled
  ninja -C "$TRAVAIL/mpv/build" install
fi

# 6. Collecte. On emporte ce qu'on a bâti et ses dépendances NON systèmes.
#
# ⚠️ Trois familles restent au système, et chacune pour une raison :
#   - le chargeur Vulkan (`libvulkan.so.1`) doit être celui de la machine, seul
#     à connaître les pilotes installés ; en embarquer un revient à n'avoir
#     AUCUN pilote ;
#   - les protocoles du bureau (X11, Wayland, xkbcommon) parlent à un serveur
#     dont la version est celle de la machine ;
#   - le son (ALSA, PulseAudio, PipeWire) parle de même à un démon local.
echo "==> Collecte vers $SORTIE"
rm -rf "$SORTIE"; mkdir -p "$SORTIE"
SYSTEME='^(libc|libm|libdl|libpthread|librt|libgcc_s|libstdc\+\+|ld-linux.*|libvulkan|libX.*|libxcb.*|libwayland.*|libxkbcommon|libdrm|libgbm|libEGL.*|libGL.*|libGLX.*|libGLdispatch|libasound|libpulse.*|libpipewire.*|libspa.*|libdbus.*|libsystemd|libudev|libcap|libselinux|libffi|libz|liblzma|libzstd|libbz2|libpcre.*|libgomp|libatomic|libnuma|libmvec)'

copier_recursif() {
  local fichier="$1"
  local base; base="$(basename "$fichier")"
  [ -e "$SORTIE/$base" ] && return 0
  cp -L "$fichier" "$SORTIE/$base"
  ldd "$fichier" 2>/dev/null | awk '/=> \//{print $3}' | while read -r dep; do
    local nom; nom="$(basename "$dep")"
    echo "$nom" | grep -Eq "$SYSTEME" && continue
    copier_recursif "$dep"
  done
}
copier_recursif "$(readlink -f "$PREFIX/lib/libmpv.so")"

# Le nom que `mpvLib.ts` cherche, et le SONAME que le chargeur suivra.
( cd "$SORTIE" && for f in *.so.*; do
    soname="$(patchelf --print-soname "$f" 2>/dev/null || true)"
    [ -n "$soname" ] && [ "$soname" != "$f" ] && ln -sf "$f" "$soname"
  done
  [ -f libmpv.so.2 ] || ln -sf "$(ls libmpv.so.* | head -1)" libmpv.so.2 )

# `$ORIGIN` : chaque bibliothèque trouve ses sœurs dans son propre dossier, où
# que le paquet soit installé. Sans cela, il faudrait poser `LD_LIBRARY_PATH`
# avant de charger — donc avant qu'Electron ne démarre.
for f in "$SORTIE"/*.so*; do
  [ -L "$f" ] && continue
  patchelf --set-rpath '$ORIGIN' "$f" 2>/dev/null || true
done

echo "==> Chaîne prête :"
ls -la "$SORTIE" | head -30
echo "==> Vérification des dépendances non résolues :"
LD_LIBRARY_PATH="$SORTIE" ldd "$SORTIE/libmpv.so.2" | grep -E "not found" && echo "⚠️  dépendances manquantes" || echo "aucune."
