#!/usr/bin/env bash
# Banc EDR du socle, SANS mpv : couche vidéo factice HDR (--fake-video=edr:4) sous la page,
# marge EDR lue par la sonde EXTERNE de vidéo-HDR (edr-probe, lecture seule).
#   A. page de test (opaque en haut, trou transparent)  → attendu : marge > 1
#   B. même page rendue entièrement opaque (?opaque=1)  → mesuré : marge > 1 aussi (macOS l'accorde
#      dès qu'une couche wantsEDR est dans l'arbre, même masquée : socle 03/11 8,439, recette 04/11 8,74)
#   C. aplat HDR seul, page vide transparente           → attendu : marge > 1
# Exige l'écran DÉVERROUILLÉ (sinon tout vaut 1,00). Verrou d'écran pris le temps du banc.
set -euo pipefail
# Bancs : jamais de son (`ao=null` + `mute=yes`), voir src/player/sound_policy.h.
export TENTACLE_MUTE=1
cache="${TENTACLE_CEF_CACHE:-$HOME/.cache/tentacle-cef}"
bundle="${TENTACLE_APP:-$cache/build/socle/Tentacle.app}"  # app à éprouver
app="$bundle/Contents/MacOS/Tentacle"
out="${TENTACLE_BANC_OUT:-$cache/build/socle}"; mkdir -p "$out"
probe="${EDR_PROBE:-$cache/build/video-hdr/edr-probe/edr-probe}"
page="file://$bundle/Contents/Resources/page.html"
lock="$cache/locks/ecran"
port="${TENTACLE_BANC_PORT:-9301}"  # DevTools (recette : 9317)
source "$(dirname "${BASH_SOURCE[0]}")/lib-ecran.sh"
take_screen_lock "$lock"
pid=""
cleanup() { [[ -n "$pid" ]] && kill "$pid" 2>/dev/null || true; rmdir "$lock" 2>/dev/null || true; }
trap cleanup EXIT
# La marge met jusqu'à ~15 s à redescendre après une couche HDR (rémanence) : attendre 1,00
# avant chaque cas, sinon B (vidéo masquée) et le repos final héritent de la marge du cas d'avant.
settle() { for _ in $(seq 15); do "$probe" --hz 10 --duration 2 | tail -1 | grep -q "max=1.000" && return; done; }
run() {  # $1 = nom, $2 = URL
  settle
  "$app" --fake-video=edr:4 --mute --url="$2" --devtools-port=$port > "$out/edr-$1.log" 2>&1 &
  pid=$!
  sleep 4
  local s; s=$("$probe" --hz 20 --duration 4 | tail -1)
  echo "$1 : $s"
  curl -s "http://127.0.0.1:$port/json" >/dev/null && node "$(dirname "$0")/../tools/cdp-eval.mjs" $port "__shell.invoke('shell.quit')" >/dev/null 2>&1 || true
  for _ in $(seq 30); do kill -0 "$pid" 2>/dev/null || break; sleep 0.2; done
  kill "$pid" 2>/dev/null || true; pid=""
  sleep 1
}
settle; echo "repos : $("$probe" --hz 20 --duration 2 | tail -1)"
run A-page-transparente "$page?static=1"
run B-page-opaque "$page?static=1&opaque=1"
run C-page-vide "about:blank"
settle; echo "repos : $("$probe" --hz 20 --duration 2 | tail -1)"
