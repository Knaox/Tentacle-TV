#!/usr/bin/env bash
# Banc de la saisie : touches natives contre Chromium/Electron (tests/saisie/banc.mjs), Entrée
# sur la vraie page de connexion du banc (connexion.mjs), puis ⌘Q (l'app doit se fermer).
# La fenêtre doit avoir le focus (SDL3 jette les touches d'une fenêtre inactive) : verrou d'écran.
# Usage : scripts/banc-saisie.sh [build] [cas…|connexion]   (build : dossier de build, défaut saisie)
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cache="${TENTACLE_CEF_CACHE:-$HOME/.cache/tentacle-cef}"
build="${1:-saisie}"; shift || true
app="$cache/build/$build/Tentacle.app/Contents/MacOS/Tentacle"
log="$cache/build/$build/banc-saisie.log"
port=9314
lock="$cache/locks/ecran"
source "$root/scripts/lib-ecran.sh"
take_screen_lock "$lock"
pid=""
clip_saved="$(pbpaste 2>/dev/null || true)"   # ⌘C/⌘X passent par le presse-papiers du système
cleanup() {
  [[ -n "$pid" ]] && kill "$pid" 2>/dev/null || true
  printf '%s' "$clip_saved" | pbcopy
  rmdir "$lock" 2>/dev/null || true
}
trap cleanup EXIT
launch() {  # $1 = URL
  TENTACLE_INPUT_LOG=1 TENTACLE_MUTE=1 "$app" --debug-input --mute --devtools-port=$port --url="$1" \
    --profile="${TENTACLE_BANC_PROFILE:-$cache/profiles/saisie}" >> "$log" 2>&1 &
  pid=$!
  for _ in $(seq 50); do curl -sf http://127.0.0.1:$port/json >/dev/null && break; sleep 0.2; done
  sleep 3
}
: > "$log"
status=0
if [[ "${1:-}" == "connexion" ]]; then  # Entrée sur la page de connexion seulement
  launch "http://127.0.0.1:3471/login"
  node "$root/tests/saisie/connexion.mjs" $port || status=1
  exit $status
fi
launch "file://$root/tests/saisie/page.html"
node "$root/tests/saisie/banc.mjs" $port "$@" || status=1
if [[ $# -eq 0 ]]; then
  node "$root/tools/cdp-eval.mjs" $port "__shell.invoke('shell.quit')" >/dev/null 2>&1 || true
  for _ in $(seq 30); do kill -0 "$pid" 2>/dev/null || break; sleep 0.2; done
  pid=""
  launch "http://127.0.0.1:3471/login"
  node "$root/tests/saisie/connexion.mjs" $port || status=1
  # ⌘Q en dernier : l'app doit se fermer d'elle-même (menu Application, comme Electron).
  node --input-type=module -e "
    import { connect, keyboard, P } from '$root/tests/saisie/lib.mjs';
    const c = await connect($port); await keyboard(c.js).press(P.q, ['cmd']).catch(() => {}); c.close();" || true
  for _ in $(seq 50); do kill -0 "$pid" 2>/dev/null || break; sleep 0.2; done
  if kill -0 "$pid" 2>/dev/null; then echo "ÉCHEC ⌘Q ferme l'app — toujours là"; status=1; else echo "OK  ⌘Q ferme l'app"; pid=""; fi
fi
exit $status
