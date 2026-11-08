#!/usr/bin/env bash
# pnpm test:update:cross — la mise à jour hors macOS, sans machine Linux ni Windows, dans un
# conteneur Debian (Docker de colima ; image construite une fois depuis bench/update/cross/) :
#   Linux   : règle et moteur testés sur un vrai noyau, puis parcours de bout en bout du moteur
#             réel sur de fausses AppImages (bench/update/cross/linux-e2e.sh) ;
#   Windows : compilation et liens mingw-w64 (moteur, implémentation Windows, assistant, tests).
# Limité à 2 cœurs et 2 Go : le banc local (Tentacle, Jellyfin) tourne dans la même VM. Aucune
# fenêtre ; rien n'est poussé ni publié.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cache="${TENTACLE_CEF_CACHE:-$HOME/.cache/tentacle-cef}"
build="$cache/build/maj-cross"
image=tentacle-cef-maj-cross:bookworm

if ! docker info >/dev/null 2>&1; then
  echo "Docker injoignable (colima arrêtée ?) : banc croisé non joué" >&2
  exit 2
fi
if ! docker image inspect "$image" >/dev/null 2>&1; then
  echo "== image $image (une fois, ~600 Mo de paquets Debian)"
  docker build -q -t "$image" "$root/bench/update/cross" >/dev/null
fi
mkdir -p "$build"
exec docker run --rm --pull=never --cpus=2 --memory=2g --name "maj-cross-$$" \
  -v "$root:/src:ro" -v "$build:/build" "$image" bash /src/bench/update/cross/inside.sh
