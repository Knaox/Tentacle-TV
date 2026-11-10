#!/usr/bin/env bash
# Configure et construit le proto dans $TENTACLE_CEF_CACHE/build/<axe> (défaut : socle).
# Usage : scripts/build.sh [--dist] [axe] [cible ninja…]      ex. scripts/build.sh pont
#   --dist : paquet de distribution autonome (dylibs embarquées, voir docs/PAQUET.md) ;
#            à donner à la PREMIÈRE configuration du dossier (l'option reste ensuite) ;
#            sur un dossier déjà configuré en dev, build.sh refuse au lieu de construire le dev.
# Respecte la règle du lot : ninja -j4 au plus (TENTACLE_JOBS=<n> pour moins : lot cef-parite, -j3).
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cache="${TENTACLE_CEF_CACHE:-$HOME/.cache/tentacle-cef}"
dist=OFF
if [[ "${1:-}" == "--dist" ]]; then dist=ON; shift; fi
axe="${1:-socle}"; shift || true
build="$cache/build/$axe"

"$root/scripts/deps/fetch-cef.sh" >/dev/null
extra=()
if [[ "$dist" == ON ]]; then
  # Chaîne du paquet (FFmpeg LGPL réduit, libmpv, SDL3… pour macOS 14), construite une
  # fois dans deps/paquet ; SDL3 est prise là aussi (CMAKE_PREFIX_PATH).
  # PAQUET_FFMPEG_TAG=n7.1.1 : la variante deps/paquet-n7.1.1 (voir paquet-deps.sh).
  pp="$cache/deps/paquet${PAQUET_FFMPEG_TAG:+-$PAQUET_FFMPEG_TAG}/prefix"
  [[ -f "$pp/lib/libmpv.2.dylib" ]] || "$root/scripts/deps/paquet-deps.sh"
  extra+=(-DMPV_PREFIX="$pp" -DCMAKE_PREFIX_PATH="$pp")
fi
if [[ -f "$build/build.ninja" && "$dist" == ON ]]; then
  # cmake n'est relancé que sans build.ninja : un dossier configuré en dev (ou sur une autre
  # chaîne) ne basculerait pas, et le dev se construirait en silence. Refuser plutôt que mêler
  # les préfixes (SDL3, libmpv) dans un même cache.
  have=$(sed -n 's/^TENTACLE_DIST:BOOL=//p' "$build/CMakeCache.txt")
  have_pp=$(sed -n 's/^MPV_PREFIX:[A-Z]*=//p' "$build/CMakeCache.txt")
  if [[ "$have" != ON || "$have_pp" != "$pp" ]]; then
    echo "build.sh : $build est configuré TENTACLE_DIST=${have:-OFF}, MPV_PREFIX=${have_pp:-?} ;" >&2
    echo "  --dist y demande ON et $pp. Prendre un autre axe, ou : rm -rf \"$build\"" >&2
    exit 2
  fi
fi
if [[ ! -f "$build/build.ninja" ]]; then
  cmake -G Ninja -S "$root" -B "$build" -DCMAKE_BUILD_TYPE=Release -DTENTACLE_DIST="$dist" \
    ${extra[@]+"${extra[@]}"}
fi
ninja -C "$build" -j"${TENTACLE_JOBS:-4}" "$@"
echo "Paquet : $build/Tentacle.app"
