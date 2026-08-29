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
#         bash apps/desktop-electron/scripts/build-mpv-linux.sh --audit <dossier>
#           (ne compile rien : rejoue seulement l'audit des NEEDED sur une
#            chaîne déjà collectée — le même que celui de fin de compilation)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

FFMPEG_TAG="n7.1.1"        # libavcodec 61/62
VULKAN_HEADERS_TAG="v1.4.309"   # Ubuntu 24.04 s'arrête à 1.3.275, FFmpeg exige 1.3.277
NVCODEC_TAG="n13.0.19.0"        # en-têtes NVDEC/NVENC (MIT), sans lesquels pas de nvdec
PLACEBO_TAG="v7.351.0"     # exigée par mpv 0.41 (>= 7.349)
MPV_TAG="v0.41.0"          # première à savoir parler couleur à Wayland
# ⚠️ mpv 0.41 exige wayland-client >= 1.21 et Ubuntu 22.04 s'arrête à 1.20.0 —
# on bâtit donc wayland dans le prefix, comme libplacebo. La version retenue est
# le MINIMUM exigé, pas la plus récente : c'est elle qui décide de ce que l'on
# demandera au wayland du POSTE à l'exécution (la bibliothèque n'est pas
# embarquée, cf. la liste `SYSTEME`), et viser plus haut n'y gagnerait rien.
WAYLAND_TAG="1.21.0"
# Les protocoles, eux, doivent être RÉCENTS : `wp-color-management-v1` — le HDR
# de Wayland — n'existe qu'à partir de 1.41. Ce ne sont que des fichiers XML,
# rien ne s'exécute, il n'y a aucune contrainte de compatibilité à l'exécution.
WAYLAND_PROTOCOLS_TAG="1.44"

ICI="$(cd "$(dirname "$0")" && pwd)"
SORTIE="$ICI/../lib/mpv-linux"
AUDIT_SEUL=0
while [ $# -gt 0 ]; do
  case "$1" in
    --sortie) SORTIE="$2"; shift 2 ;;
    --audit) AUDIT_SEUL=1; SORTIE="$2"; shift 2 ;;
    *) echo "argument inconnu : $1" >&2; exit 2 ;;
  esac
done
SORTIE="$(mkdir -p "$SORTIE" && cd "$SORTIE" && pwd)"

# ── Audit de chargeabilité — indépendant de la machine qui compile. ──────────
#
# ⚠️ L'ancienne vérification (`ldd | grep "not found"`) tournait dans le
# conteneur de compilation, où TOUT se résout : elle passait toujours, y compris
# quand la chaîne était inchargeable ailleurs. Mesuré sur Fedora 44 : onze
# bibliothèques réclamaient `libbz2.so.1.0`, un SONAME que seuls Debian/Ubuntu
# fournissent (Fedora et Arch n'exposent que `libbz2.so.1`) — `dlopen` échouait
# net, donc aucune vidéo, sur toute installation hors Debian.
#
# Ici on lit les NEEDED au `readelf` : chacun doit être un fichier de la chaîne
# (le rpath `$ORIGIN` le trouvera), ou un SONAME de la liste blanche ci-dessous
# — épelés et VERSIONNÉS, identiques sur Debian, Ubuntu, Fedora, Arch et
# openSUSE. Tout le reste est une erreur de collecte, et fait échouer le build.
UNIVERSELS=" libc.so.6 libm.so.6 libmvec.so.1 libpthread.so.0 libdl.so.2 librt.so.1 libresolv.so.2 ld-linux-x86-64.so.2 libgcc_s.so.1 libstdc++.so.6 libgomp.so.1 libatomic.so.1 libnuma.so.1 libvulkan.so.1 libX11.so.6 libX11-xcb.so.1 libxcb.so.1 libxcb-randr.so.0 libxcb-shape.so.0 libxcb-shm.so.0 libxcb-xfixes.so.0 libxcb-present.so.0 libxcb-xkb.so.1 libxcb-dri2.so.0 libxcb-dri3.so.0 libxcb-sync.so.1 libXext.so.6 libXfixes.so.3 libXrandr.so.2 libXss.so.1 libXpresent.so.1 libXinerama.so.1 libxkbcommon.so.0 libxkbcommon-x11.so.0 libdrm.so.2 libgbm.so.1 libEGL.so.1 libGL.so.1 libGLX.so.0 libGLdispatch.so.0 libGLESv2.so.2 libwayland-client.so.0 libwayland-cursor.so.0 libwayland-egl.so.1 libasound.so.2 libpulse.so.0 libpulse-simple.so.0 libpipewire-0.3.so.0 libdbus-1.so.3 libsystemd.so.0 libudev.so.1 libglib-2.0.so.0 libgnutls.so.30 libz.so.1 liblzma.so.5 libzstd.so.1 libpcre2-8.so.0 "

auditer() {
  echo "==> Audit des NEEDED de $SORTIE (readelf)"
  local manques="" f besoin
  for f in "$SORTIE"/*.so*; do
    [ -L "$f" ] && continue
    while read -r besoin; do
      [ -z "$besoin" ] && continue
      [ -e "$SORTIE/$besoin" ] && continue
      case "$UNIVERSELS" in *" $besoin "*) continue ;; esac
      manques="$manques  $(basename "$f") → $besoin"$'\n'
    done < <(readelf -d "$f" 2>/dev/null | sed -n 's/.*(NEEDED).*\[\(.*\)\].*/\1/p')
  done
  if [ -n "$manques" ]; then
    echo "⚠️  NEEDED hors chaîne et hors liste blanche — la chaîne ne se chargera pas partout :"
    printf '%s' "$manques"
    exit 1
  fi
  echo "==> Audit propre : chaque NEEDED est dans la chaîne ou dans la liste blanche."
}

if [ "$AUDIT_SEUL" = 1 ]; then
  auditer
  exit 0
fi

# Hors du dépôt : les chemins du projet peuvent contenir des espaces, ce que ni
# FFmpeg ni meson ne supportent partout.
TRAVAIL="/tmp/tentacle-mpv-lgpl-linux"
PREFIX="$TRAVAIL/prefix"
# `include` compris : la copie des en-têtes Vulkan est le premier écrivain du
# prefix, et `cp -r` ne crée pas le dossier cible. Un /tmp vierge le montrait.
mkdir -p "$TRAVAIL" "$PREFIX/include"
# `share/pkgconfig` : c'est là que wayland-protocols dépose son fichier .pc.
export PKG_CONFIG_PATH="$PREFIX/lib/pkgconfig:$PREFIX/lib/x86_64-linux-gnu/pkgconfig:$PREFIX/share/pkgconfig:${PKG_CONFIG_PATH:-}"
export LD_LIBRARY_PATH="$PREFIX/lib:${LD_LIBRARY_PATH:-}"
export CPATH="$PREFIX/include:${CPATH:-}"
# `wayland-scanner` est bâti ici : sans ce PATH, meson prend celui d'apt, plus
# ancien que les protocoles qu'on lui donne à lire.
export PATH="$PREFIX/bin:$PATH"

echo "==> Chaîne mpv pour Linux — prefix=$PREFIX, sortie=$SORTIE"

# 1. Outils et dépendances. Tout ce qui est ici est LGPL, BSD ou MIT.
if command -v apt-get >/dev/null; then
  SUDO=""; [ "$(id -u)" -eq 0 ] || SUDO="sudo"
  $SUDO apt-get update -qq
  $SUDO apt-get install -y -qq --no-install-recommends \
    build-essential git meson ninja-build nasm pkg-config python3 patchelf ca-certificates \
    libvulkan-dev glslang-tools glslang-dev liblcms2-dev libunwind-dev \
    libdav1d-dev libass-dev libfreetype-dev libfontconfig-dev libfribidi-dev libharfbuzz-dev \
    libwayland-dev wayland-protocols libxkbcommon-dev libx11-dev libxext-dev libxrandr-dev \
    libxpresent-dev libxss-dev libxinerama-dev libdrm-dev libgbm-dev libegl-dev libgl-dev \
    libasound2-dev libpulse-dev libpipewire-0.3-dev \
    libva-dev libvdpau-dev libzimg-dev libgnutls28-dev \
    libopus-dev libvorbis-dev libogg-dev libmp3lame-dev libsoxr-dev \
    python3-pip libffi-dev libexpat1-dev
fi

# ⚠️ meson d'apt est TROP VIEUX là où l'on bâtit.
#
# libplacebo exige meson >= 0.63 ; ubuntu-22.04 n'en empaquette que 0.61.2, et
# c'est délibérément là que la CI bâtit — la glibc est compatible vers l'avant
# et jamais vers l'arrière, une chaîne bâtie sur plus récent ne tournerait pas
# sur Ubuntu 22.04 (voir l'en-tête du job Linux de desktop.yml). On complète
# donc par pip, et SEULEMENT quand la version en place ne suffit pas : sur une
# machine de développement récente, le meson du système fait très bien l'affaire.
MESON_MIN="0.63"
meson_suffisant() {
  command -v meson >/dev/null 2>&1 || return 1
  [ "$(printf '%s\n%s\n' "$MESON_MIN" "$(meson --version)" | sort -V | head -1)" = "$MESON_MIN" ]
}
if ! meson_suffisant; then
  echo "==> meson $(command -v meson >/dev/null 2>&1 && meson --version || echo absent) < $MESON_MIN — installation par pip"
  python3 -m pip install --quiet --upgrade meson
  # pip pose l'exécutable dans ~/.local/bin, qui n'est pas toujours dans le PATH
  # d'un runner ni d'un shell non interactif.
  export PATH="$HOME/.local/bin:$PATH"
  meson_suffisant || { echo "meson >= $MESON_MIN introuvable après installation" >&2; exit 1; }
  echo "==> meson $(meson --version)"
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

# 2bis. Wayland — parce que la distribution où l'on bâtit est trop ancienne.
#
# ⚠️ Ce qui est bâti ici ne PART PAS dans le paquet : `libwayland-client.so.0` et
# ses sœurs figurent dans la liste `SYSTEME` (plus bas), et restent donc celles
# du poste à l'exécution. Ce qu'on gagne, c'est de pouvoir COMPILER contre
# 1.21 — la version qu'exige mpv 0.41 — sur une machine qui n'a que 1.20.
#
# La contrepartie, dite franchement : le mpv livré réclamera un wayland >= 1.21
# à l'exécution. Toutes les distributions de 2023 et après l'ont ; Ubuntu 22.04
# non, et la lecture y retombera sur X11. C'est le prix du HDR Wayland, qui
# n'existe pas avant mpv 0.41.
if [ ! -f "$PREFIX/lib/pkgconfig/wayland-client.pc" ]; then
  echo "==> wayland $WAYLAND_TAG"
  cloner https://gitlab.freedesktop.org/wayland/wayland.git "$WAYLAND_TAG" "$TRAVAIL/wayland"
  meson setup "$TRAVAIL/wayland/build" "$TRAVAIL/wayland" \
    --prefix="$PREFIX" --libdir=lib --buildtype=release \
    -Ddocumentation=false -Dtests=false -Ddtd_validation=false
  ninja -C "$TRAVAIL/wayland/build" install
fi
if [ ! -f "$PREFIX/share/pkgconfig/wayland-protocols.pc" ]; then
  echo "==> wayland-protocols $WAYLAND_PROTOCOLS_TAG"
  cloner https://gitlab.freedesktop.org/wayland/wayland-protocols.git \
    "$WAYLAND_PROTOCOLS_TAG" "$TRAVAIL/wayland-protocols"
  meson setup "$TRAVAIL/wayland-protocols/build" "$TRAVAIL/wayland-protocols" \
    --prefix="$PREFIX" --buildtype=release -Dtests=false
  ninja -C "$TRAVAIL/wayland-protocols/build" install
fi

# 3. libplacebo — le moteur de rendu de `gpu-next`, et donc tout le HDR.
if [ ! -f "$PREFIX/lib/libplacebo.so" ] && [ ! -f "$PREFIX/lib/x86_64-linux-gnu/libplacebo.so" ]; then
  echo "==> libplacebo $PLACEBO_TAG"
  cloner https://code.videolan.org/videolan/libplacebo.git "$PLACEBO_TAG" "$TRAVAIL/placebo"
  git -C "$TRAVAIL/placebo" submodule update --init --recursive --depth 1
  # ⚠️ glslang, PAS shaderc — et c'est mesuré au pixel, sur le même clip et la
  # même machine (Fedora 44, NVIDIA 610, KWin Wayland) :
  #
  #     libplacebo bâtie avec libshaderc 2023.8   rouge.mp4 → (127,0,255) VIOLET
  #     libplacebo bâtie avec glslang 15.1        rouge.mp4 → (255,24,0)  rouge
  #
  # Le libshaderc d'Ubuntu 24.04 est figé en 2023 ; les nuanceurs qu'il compile
  # sortent des couleurs fausses avec cette libplacebo. Rien dans le journal de
  # mpv ne le signale — la swapchain choisie est la même — d'où la mesure.
  # Corollaire : un rendu aux couleurs suspectes se vérifie sur un aplat connu
  # AVANT de soupçonner le HDR ou l'espace colorimétrique.
  meson setup "$TRAVAIL/placebo/build" "$TRAVAIL/placebo" \
    --prefix="$PREFIX" --libdir=lib --buildtype=release \
    -Dvulkan=enabled -Dshaderc=disabled -Dglslang=enabled -Dlcms=enabled -Dopengl=enabled -Ddemos=false
  ninja -C "$TRAVAIL/placebo/build" install
fi

# 4. FFmpeg — LGPL. Pas de `--enable-gpl`, pas de x264/x265, pas de nonfree.
#
# ⚠️ STATIQUE, et c'est mesuré : Electron embarque le FFmpeg de Chromium
# (`libffmpeg.so`, 858 symboles `av*` exportés, non versionnés). Une libmpv qui
# référence dynamiquement `av_*` les lie à la portée GLOBALE du processus —
# donc à Chromium — et meurt : « libavcodec: build version 61.19.101
# incompatible with runtime version 62.33.100 ». RTLD_DEEPBIND a été essayé et
# écarté : il sépare les allocateurs (celui de Chromium interpose malloc), et
# tout ce qui alloue d'un côté pour libérer de l'autre finit en SIGSEGV —
# pw_free_strv, pa_xfree, piles lues au core dump. Le lien STATIQUE, symboles
# cachés au lien de mpv (--exclude-libs), supprime le problème à la racine :
# plus aucune référence dynamique `av*`. Licence inchangée : la libmpv Linux
# est déjà GPL (voir l'en-tête), la recette est publique.
#
# ⚠️ TLS : `--enable-gnutls`, en DYNAMIQUE sur la gnutls du système. Sans
# backend TLS, FFmpeg n'a pas de protocole https : un flux Jellyfin meurt en
# « No protocol handler found » — end-file(4), MPV_ERROR_LOADING_FAILED
# (mesuré ; le seul test réel d'avant ce correctif était un fichier LOCAL).
# GnuTLS et pas OpenSSL : son SONAME `libgnutls.so.30` est identique sur
# Debian, Ubuntu, Fedora, Arch et openSUSE (libssl diverge : .so.3 / .so.1.1),
# et la gnutls du SYSTÈME est la seule à connaître le magasin de certificats
# de SA distribution — embarquée, elle chercherait les CA aux chemins d'Ubuntu.
if [ ! -f "$PREFIX/lib/libavcodec.a" ]; then
  echo "==> FFmpeg $FFMPEG_TAG (LGPL, statique)"
  cloner https://github.com/FFmpeg/FFmpeg.git "$FFMPEG_TAG" "$TRAVAIL/ffmpeg"
  cd "$TRAVAIL/ffmpeg"
  ./configure \
    --prefix="$PREFIX" --libdir="$PREFIX/lib" \
    --disable-shared --enable-static --enable-pic \
    --disable-programs --disable-doc --disable-debug \
    --disable-gpl --disable-nonfree \
    --extra-cflags="-I$PREFIX/include" --extra-ldflags="-L$PREFIX/lib" \
    --enable-libdav1d --enable-libopus --enable-libvorbis --enable-libsoxr \
    --enable-gnutls \
    --enable-vaapi --enable-vdpau --enable-vulkan --enable-nvdec
  make -j"$(nproc)"
  make install
  # Un prefix qui garde des libav*.so d'une passe précédente ferait relier mpv
  # en dynamique : le linker préfère toujours le .so au .a.
  rm -f "$PREFIX"/lib/libav*.so* "$PREFIX"/lib/libsw*.so*
  # En statique, les dépendances de FFmpeg (dav1d, opus, va…) doivent apparaître
  # sur la ligne de lien de mpv — elles vivent dans `Libs.private`, que meson ne
  # lit pas sans `prefer_static` global (essayé : il statifie AUSSI libass,
  # fontconfig et glib, dont les .a d'Ubuntu ne sont pas PIC — lien impossible).
  # On fusionne donc Libs.private dans Libs, pour FFmpeg seulement.
  for pc in "$PREFIX"/lib/pkgconfig/libav*.pc "$PREFIX"/lib/pkgconfig/libsw*.pc; do
    priv="$(sed -n 's/^Libs.private: //p' "$pc")"
    [ -n "$priv" ] && sed -i "s|^Libs: \(.*\)|Libs: \1 $priv|" "$pc"
  done
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
  # `--exclude-libs,ALL` : les symboles des .a (dont les 4000 `av_*`) restent
  # INTERNES à libmpv — ni exportés, ni interposables par le libffmpeg de
  # Chromium (voir le bloc FFmpeg ci-dessus). Les dépendances de FFmpeg, elles,
  # arrivent par les .pc retouchés à l'installation de FFmpeg.
  LDFLAGS="-Wl,--exclude-libs,ALL" meson setup "$TRAVAIL/mpv/build" "$TRAVAIL/mpv" \
    --prefix="$PREFIX" --libdir=lib --buildtype=release \
    -Dgpl=true -Dlibmpv=true -Dcplayer=false \
    -Dvulkan=enabled -Dwayland=enabled -Dx11=enabled -Degl=enabled \
    -Dlua=disabled -Djavascript=disabled \
    -Drubberband=disabled -Dvapoursynth=disabled -Duchardet=disabled \
    -Dlibbluray=disabled -Dlibarchive=disabled -Dsixel=disabled -Dcaca=disabled \
    -Ddvdnav=disabled -Dcdda=disabled -Ddvbin=disabled -Dopenal=disabled \
    -Dpipewire=disabled
  # ⚠️ `pipewire=disabled` n'est pas une préférence : l'ABI de SPA est faite de
  # macros inline figées à la compilation, et un ao_pipewire bâti sur les
  # en-têtes 1.0.5 d'Ubuntu 24.04 MEURT dans la boucle de données de la 1.6.8 de
  # Fedora 44 (SIGSEGV dans libspa-audioconvert, pile lue au core dump — deux
  # autres visages du même crash avant lui). Le son passe par libpulse, qui
  # parle un PROTOCOLE versionné sur un socket : pipewire-pulse le sert
  # partout, et `alsa` reste le repli des postes sans serveur de son.
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
#   - le son (ALSA, PulseAudio, PipeWire) parle de même à un démon local ;
#   - `libglib-2.0` est un singleton de fait : Electron la charge déjà (GTK), et
#     deux glib actives dans un même processus finissent en abort. Celle du
#     système sert les deux — son SONAME est identique partout.
#   - le TLS (`libgnutls.so.30`) : le magasin de certificats appartient à la
#     distribution — une gnutls embarquée chercherait les CA aux chemins de
#     celle qui a compilé (voir le bloc FFmpeg).
#
# ⚠️ Et une règle d'admission : ne reste au système qu'un SONAME IDENTIQUE sur
# toutes les distributions. `libbz2` l'a payée : Debian/Ubuntu exposent
# `libbz2.so.1.0`, Fedora/Arch seulement `libbz2.so.1` — la chaîne compilée ici
# était inchargeable partout hors Debian. Elle est donc EMBARQUÉE, comme toute
# bibliothèque au SONAME divergent.
#
# ⚠️ Chaque motif est ancré sur `\.so` : la version non ancrée laissait `libm`
# avaler `libmp3lame`/`libmpg123`/`libmd` et `libz` avaler `libzimg` — quatre
# bibliothèques restées au système par accident, absentes de bien des machines.
echo "==> Collecte vers $SORTIE"
rm -rf "$SORTIE"; mkdir -p "$SORTIE"
SYSTEME='^(libc|libm|libmvec|libdl|libpthread|librt|libresolv|libgcc_s|libstdc\+\+|ld-linux[A-Za-z0-9_-]*|libvulkan|libX[A-Za-z0-9_-]*|libxcb[a-z0-9_-]*|libwayland-[a-z]+|libxkbcommon[a-z0-9_-]*|libdrm|libgbm|libEGL|libGL|libGLX|libGLdispatch|libGLESv2|libasound|libpulse[a-z-]*|libpipewire-0\.3|libspa-[a-z0-9.-]*|libdbus-1|libsystemd|libudev|libcap|libselinux|libffi|libglib-2\.0|libgnutls|libz|liblzma|libzstd|libpcre2?[0-9a-z-]*|libgomp|libatomic|libnuma)\.so'

copier_recursif() {
  local fichier="$1"
  local base; base="$(basename "$fichier")"
  [ -e "$SORTIE/$base" ] && return 0
  cp -L "$fichier" "$SORTIE/$base"
  # ⚠️ Les NEEDED DIRECTS seulement (readelf), et non la sortie brute de `ldd` :
  # `ldd` liste la fermeture transitive ENTIÈRE, dépendances privées des
  # bibliothèques laissées au système comprises — libgcrypt, libgpg-error,
  # libpulsecommon-16.1 (privée d'Ubuntu !) embarquées alors que rien dans la
  # chaîne ne les référence. `ldd` ne sert plus qu'à résoudre un SONAME en
  # chemin, dans le conteneur de compilation où tout se résout.
  local besoins table nom dep
  besoins="$(readelf -d "$fichier" 2>/dev/null | sed -n 's/.*(NEEDED).*\[\(.*\)\].*/\1/p')"
  table="$(ldd "$fichier" 2>/dev/null || true)"
  for nom in $besoins; do
    echo "$nom" | grep -Eq "$SYSTEME" && continue
    dep="$(printf '%s\n' "$table" | awk -v n="$nom" '$1 == n && $2 == "=>" { print $3; exit }')"
    [ -n "$dep" ] && [ -e "$dep" ] && copier_recursif "$dep"
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
auditer
