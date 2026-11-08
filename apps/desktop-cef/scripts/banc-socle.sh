#!/usr/bin/env bash
# Lance le banc du socle : app (--debug-input, DevTools 9301 par défaut), tests, fermeture propre.
# Prend le verrou d'écran le temps du banc (plein écran, redimensionnement, cadence).
# Usage : scripts/banc-socle.sh [cas…]     (journal : $TENTACLE_BANC_OUT/banc.log, défaut build/socle)
# TENTACLE_APP=<chemin du .app> : app à éprouver (défaut : build/socle). Toujours muet (--mute).
set -euo pipefail
# Bancs : jamais de son (`ao=null` + `mute=yes`), voir src/player/sound_policy.h.
export TENTACLE_MUTE=1
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cache="${TENTACLE_CEF_CACHE:-$HOME/.cache/tentacle-cef}"
bundle="${TENTACLE_APP:-$cache/build/socle/Tentacle.app}"
app="$bundle/Contents/MacOS/Tentacle"
out="${TENTACLE_BANC_OUT:-$cache/build/socle}"; mkdir -p "$out"
lock="$cache/locks/ecran"
port="${TENTACLE_BANC_PORT:-9301}"  # DevTools (recette : 9317)
source "$(dirname "${BASH_SOURCE[0]}")/lib-ecran.sh"
take_screen_lock "$lock"
pid=""
# Le cas copiercoller passe par le presse-papiers du système : on rend le texte qui y était
# (texte seulement — une image copiée ne serait pas rendue).
clip_saved="$(pbpaste 2>/dev/null || true)"
cleanup() {
  [[ -n "$pid" ]] && kill "$pid" 2>/dev/null || true
  printf '%s' "$clip_saved" | pbcopy
  rmdir "$lock" 2>/dev/null || true
}
trap cleanup EXIT
TENTACLE_INPUT_LOG=1 "$app" --debug-input --mute --devtools-port=$port ${TENTACLE_BANC_ARGS:-} > "$out/banc.log" 2>&1 &
pid=$!
for _ in $(seq 50); do curl -sf http://127.0.0.1:$port/json >/dev/null && break; sleep 0.2; done
sleep 2
status=0
node "$root/tests/socle/banc.mjs" $port "$@" || status=$?
quit_app() {
  node "$root/tools/cdp-eval.mjs" $port "__shell.invoke('shell.quit')" >/dev/null 2>&1 || true
  for _ in $(seq 30); do kill -0 "$pid" 2>/dev/null || break; sleep 0.2; done
  if kill -0 "$pid" 2>/dev/null; then echo "ÉCHEC fermeture propre (shell.quit)"; status=1; else echo "OK  fermeture propre (shell.quit) — plus aucun processus"; pid=""; fi
}
quit_app

# Repos : page statique, aucune animation. Coût = temps CPU cumulé de TOUS les processus
# de l'app (navigateur + GPU + rendu…) sur 10 s, et images peintes/présentées.
if [[ $# -eq 0 || " $* " == *" repos "* ]]; then
  "$app" --mute --devtools-port=$port --url="file://$bundle/Contents/Resources/page.html?static=1" >> "$out/banc.log" 2>&1 &
  pid=$!
  for _ in $(seq 50); do curl -sf http://127.0.0.1:$port/json >/dev/null && break; sleep 0.2; done
  sleep 4
  cpu() { ps -A -o time=,command= | grep -F "$bundle/" | grep -v grep |
          awk '{split($1,t,":"); s+=t[1]*60+t[2]} END {printf "%.2f", s}'; }
  f0=$(node "$root/tools/cdp-eval.mjs" $port "__shell.invoke('shell.stats').then(s=>s.viewFrames+'/'+s.presentedFrames)" | tr -d '"')
  c0=$(cpu); sleep 10; c1=$(cpu)
  f1=$(node "$root/tools/cdp-eval.mjs" $port "__shell.invoke('shell.stats').then(s=>s.viewFrames+'/'+s.presentedFrames)" | tr -d '"')
  echo "REPOS : images peintes/présentées ${f0} → ${f1} en 10 s ; CPU cumulé $(echo "$c1 - $c0" | bc) s sur 10 s (tous processus)"
  quit_app
fi
exit $status
