#!/usr/bin/env bash
# Tentacle CEF de l'axe navigateur sur le banc : profil à part (jamais celui d'Electron), muet,
# en arrière-plan, DevTools 9425, liens externes journalisés sans être ouverts.
#   tests/recette/app.sh start [options de l'app…]   lance (build web non refait) et attend DevTools
#   tests/recette/app.sh stop                         ferme proprement (shell.quit), sinon tue NOTRE pid
#   tests/recette/app.sh pid                          pid du processus principal
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
repo="$(cd "$root/../.." && pwd)"
cache="${TENTACLE_CEF_CACHE:-$HOME/.cache/tentacle-cef}"
port="${RECETTE_PORT:-9425}"
build="${TENTACLE_BUILD:-cef-navigateur}"
log="$cache/build/$build-run.log"
exe="$cache/build/$build/Tentacle.app/Contents/MacOS/Tentacle"

pid() { pgrep -f "^$exe" | head -1 || true; }

case "${1:-}" in
  start)
    shift
    [[ -z "$(pid)" ]] || { echo "déjà lancée : $(pid)"; exit 0; }
    export TENTACLE_ELECTRON_PROFILE="$cache/profiles/parite-navigateur"
    export TENTACLE_URL="${TENTACLE_URL:-http://127.0.0.1:3471}" TENTACLE_BUILD="$build"
    export TENTACLE_OPEN_EXTERNAL=log TENTACLE_DEBUG_DIALOGS=1
    mkdir -p "$TENTACLE_ELECTRON_PROFILE"
    (cd "$repo" && nohup pnpm dev:cef -- --skip-web --mute --background --devtools-port="$port" "$@" \
      >"$log" 2>&1 &)
    for _ in $(seq 1 90); do
      curl -s -m 1 "http://127.0.0.1:$port/json/version" >/dev/null && { echo "pid $(pid)"; exit 0; }
      sleep 1
    done
    echo "DevTools muet sur $port — journal : $log" >&2; exit 1 ;;
  stop)
    p="$(pid)"; [[ -n "$p" ]] || exit 0
    node "$root/tests/recette/probe.mjs" "$port" "__shell.invoke('shell.quit')" --timeout=3000 >/dev/null 2>&1 || true
    for _ in $(seq 1 20); do kill -0 "$p" 2>/dev/null || exit 0; sleep 0.5; done
    kill "$p" ;;
  pid) pid ;;
  *) echo "usage : app.sh start|stop|pid" >&2; exit 2 ;;
esac
