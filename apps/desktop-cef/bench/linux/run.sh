#!/usr/bin/env bash
# Banc Linux de Tentacle CEF (axe linux) — Fedora 44 arm64 dans la VM colima, ressources de la
# VM inchangées. Le code vient du dépôt (lecture seule) ; CEF, libmpv, le build et le profil
# vivent dans le volume Docker `tentacle-cef-linux-cache` (gardé d'un passage à l'autre).
#
#   bench/linux/run.sh image                    construit l'image (une fois ; ~400 Mo de paquets)
#   bench/linux/run.sh deps                     prérequis, CEF linuxarm64, libmpv du fork (lourd :
#                                               sous le verrou deps-build du lot)
#   bench/linux/run.sh build                    `node scripts/dev.mjs build` dans le conteneur
#   bench/linux/run.sh up <compositeur> [opts]  lance l'app (mutter | kwin | sway | x11) et la
#                                               laisse tourner ; DevTools sur 127.0.0.1:9427
#   bench/linux/run.sh shot <fichier.png>       capture de l'écran du compositeur (sway, x11)
#   bench/linux/run.sh log                      journal de l'app
#   bench/linux/run.sh down                     arrête le conteneur
#
# Les autres axes y compilent leur code Linux : `bench/linux/run.sh build` (après un git merge
# de leur branche) ; le binaire est /cache/build/cef-linux/app/tentacle dans le conteneur.
# Le front : apps/web/dist du dépôt, construit sur le Mac (TENTACLE_SHELL=electron
# TENTACLE_DEBUG=1 pnpm --filter @tentacle-tv/web build) — le conteneur ne construit pas le web.
# Réseau de l'hôte de la VM (--network host) : le banc (127.0.0.1:3471) est joignable, et le
# port DevTools revient au Mac par le relais de colima.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo="$(cd "$here/../../../.." && pwd)"
image=tentacle-cef-linux:f44
name=tentacle-cef-linux
volume=tentacle-cef-linux-cache

die() { echo "banc linux : $*" >&2; exit 1; }
docker info >/dev/null 2>&1 || die "Docker injoignable (colima arrêtée ?)"

container_env=(-e TENTACLE_CEF_CACHE=/cache -e TENTACLE_BUILD=cef-linux -e TENTACLE_JOBS=3
               -e TENTACLE_ALLOW_TETHERING="${TENTACLE_ALLOW_TETHERING:-0}")

case "${1:-}" in
  image)
    base=banc-fs:f44
    docker image inspect "$base" >/dev/null 2>&1 || base=fedora:44
    docker build -t "$image" --build-arg BASE="$base" "$here" ;;
  deps|build)
    docker run --rm --pull=never --name "$name-$1-$$" "${container_env[@]}" \
      -v "$repo:/repo:ro" -v "$volume:/cache" "$image" \
      node /repo/apps/desktop-cef/scripts/dev.mjs "$1" ;;
  up)
    comp="${2:?compositeur : mutter | kwin | sway | x11}"; shift 2
    docker rm -f "$name" >/dev/null 2>&1 || true
    # BANC_ENV="A=1 B=2" : variables de plus pour l'app (diagnostics : TENTACLE_PUMP_TRACE=1…).
    for kv in ${BANC_ENV:-}; do container_env+=(-e "$kv"); done
    # SYS_NICE : sway (Fedora) porte la capacité de fichier cap_sys_nice, refusée sans elle ;
    # SYS_PTRACE : gdb sur l'app (diagnostic du banc).
    docker run -d --pull=never --name "$name" --network host --shm-size=1g --cap-add=SYS_NICE --cap-add=SYS_PTRACE \
      "${container_env[@]}" \
      -e TENTACLE_URL="${TENTACLE_URL:-http://127.0.0.1:3471}" \
      -v "$repo:/repo:ro" -v "$volume:/cache" "$image" sleep infinity >/dev/null
    docker exec -d "$name" dbus-run-session -- bash /repo/apps/desktop-cef/bench/linux/inside.sh "$comp" "$@"
    echo "banc linux : $comp lancé — journal : bench/linux/run.sh log ; DevTools 127.0.0.1:9427" ;;
  shot)
    out="${2:?fichier .png}"
    docker exec "$name" bash -c 'cat /tmp/banc/compositor; echo' | grep -q . || die "aucun compositeur"
    docker exec "$name" bash /repo/apps/desktop-cef/bench/linux/inside.sh --shot /tmp/banc/shot.png
    docker cp "$name:/tmp/banc/shot.png" "$out" >/dev/null && echo "$out" ;;
  log) docker exec "$name" cat /tmp/banc/app.log ;;
  down) docker rm -f "$name" >/dev/null 2>&1 || true ;;
  *) sed -n 2,19p "$0"; exit 2 ;;
esac
