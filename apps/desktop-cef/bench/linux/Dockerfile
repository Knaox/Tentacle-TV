# Banc Linux de Tentacle CEF (axe linux) : Fedora 44 arm64 sous colima — construit l'app par
# le lanceur (scripts/dev.mjs) et la lance sous mutter, kwin, sway (sans écran) et Xvfb.
# Base : l'image du banc plein écran d'Electron (compositeurs, Mesa llvmpipe/lavapipe, outils
# de fenêtre), à défaut fedora:44 et les mêmes paquets.
ARG BASE=banc-fs:f44
FROM ${BASE}
RUN dnf -y install --setopt=install_weak_deps=False \
      mutter kwin-wayland sway xorg-x11-server-Xvfb xorg-x11-server-Xwayland openbox \
      grim ImageMagick gdb-minimal dbus-daemon dbus-tools procps-ng curl jq nodejs \
      mesa-dri-drivers mesa-vulkan-drivers ffmpeg-free \
      nss atk at-spi2-atk at-spi2-core cups-libs libdrm mesa-libgbm libXcomposite libXdamage \
      libXrandr libxkbcommon gtk3 alsa-lib pango libxshmfence \
      gcc-c++ cmake ninja-build meson pkgconf-pkg-config patch bzip2 git which \
      SDL3-devel json-devel wayland-devel wayland-protocols-devel libxkbcommon-devel \
      libglvnd-devel libX11-devel dbus-devel libcurl-devel libsodium-devel \
      ffmpeg-free-devel libplacebo-devel libass-devel vulkan-loader-devel vulkan-headers \
      pipewire-devel pulseaudio-libs-devel alsa-lib-devel libva-devel libdrm-devel \
      mpv-libs-devel \
    && dnf clean all
