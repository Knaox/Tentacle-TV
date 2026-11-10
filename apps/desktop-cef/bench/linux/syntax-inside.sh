#!/bin/bash
# Dans le conteneur de bench/linux/syntax.sh : g++ -fsyntax-only sur chaque fichier donné.
# /src = apps/desktop-cef ; /hdr = en-têtes posés par syntax.sh ; /cef = CEF (macOS : en-têtes
# communs) ; /mpv = en-têtes de libmpv.
set -u
R=/hdr/root
gen=/tmp/gen
mkdir -p "$gen"
"$R/usr/bin/wayland-scanner" client-header "$R/usr/share/wayland-protocols/stable/viewporter/viewporter.xml" \
  "$gen/viewporter-client-protocol.h"
# Les modules se référencent par « module/fichier.h » (racine src/) ou par leur propre dossier.
INC="-I/src/src"
for d in /src/src/*/; do INC+=" -I$d"; done
INC+=" -I/hdr/cef-linux -I/cef -I/mpv -I/hdr -I$R/usr/include -I$gen"
FLAGS="-std=gnu++20 -fsyntax-only -Wall -Wextra -Wno-unused-parameter -Wno-missing-field-initializers"
fail=0
for f in "$@"; do
  defs=""
  case "$f" in *video_subsurface_linux.cpp) defs="-DTENTACLE_MPV_WAYLAND_HOST=1" ;; esac
  if out=$(g++ $FLAGS $defs $INC "/src/$f" 2>&1); then
    if [ -n "$out" ]; then echo "== $f (avertissements)"; echo "$out" | head -30; else echo "ok  $f"; fi
  else
    echo "== $f ÉCHEC"
    echo "$out" | grep -E "error|erreur" | head -25
    fail=1
  fi
done
exit $fail
