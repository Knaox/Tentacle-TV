#!/usr/bin/env bash
# Bascules de pistes sans rechargement : l'app (MUETTE) avec la trace du pont et le journal
# de mpv, puis `pistes.mjs` sur chaque titre. Tue l'app par son PID.
#   bench/lecteur/pistes.sh [bascules=10] [titre…]   (défaut : HDR10 puis Dolby Vision)
# LECTEUR_SON=sonde : la VRAIE sortie CoreAudio (échantillons à zéro, `sound_policy.h`) au
# lieu de `--mute` — c'est la sortie de Damien, et la bascule audio y rouvre le périphérique.
set -uo pipefail
if [[ "${LECTEUR_SON:-muet}" == sonde ]]; then export TENTACLE_SOUND_PROBE=1; MUTE=(); else export TENTACLE_MUTE=1; MUTE=(--mute); fi
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
CACHE="${TENTACLE_CEF_CACHE:-$HOME/.cache/tentacle-cef}"
BUILD="${LECTEUR_BUILD:-$CACHE/build/lecteur}"
ROUNDS="${1:-10}"; shift || true
TITLES=("$@"); [[ ${#TITLES[@]} -eq 0 ]] && TITLES=("Banc HDR10 Pistes" "Banc Dolby Vision Pistes")
OUT="$BUILD/runs/pistes-$(date +%H%M%S)"; mkdir -p "$OUT"
export PONT_CDP_PORT=9313
# LECTEUR_DEBIT=<octets/s> : mpv lit à travers le proxy lent (`proxy-lent.mjs`, port 8499),
# comme un serveur distant. Les médias du banc font ~21 ko/s : 53000 ≈ 2,5× leur débit, le
# rapport d'un remux 4K (40 Mbit/s) sur une liaison à 100 Mbit/s.
PROXY_PID=""
# LECTEUR_VARIANTES=1 : le proxy sert les variantes réalistes (`variantes.sh`) à la place des
# fichiers du banc (répliques de 29 s → 2,5 s).
VARIANTES=()
[[ "${LECTEUR_VARIANTES:-0}" == 1 ]] && while IFS= read -r l; do VARIANTES+=("$l"); done < <("$HERE/variantes.sh")
if [[ -n "${LECTEUR_DEBIT:-}" ]]; then
  node "$HERE/proxy-lent.mjs" 8499 "$LECTEUR_DEBIT" ${VARIANTES[@]+"${VARIANTES[@]}"} > "$OUT/proxy.log" 2>&1 &
  PROXY_PID=$!
  export TENTACLE_MPV_EXTRA="http-proxy=http://127.0.0.1:8499"
fi

TENTACLE_PONT_TRACE=1 TENTACLE_MPV_LOGFILE="$OUT/mpv.log" TENTACLE_MPV_LOGLEVEL="${LECTEUR_MPV_LOG:-v,cplayer=debug,demux=debug}" \
  "$BUILD/Tentacle.app/Contents/MacOS/Tentacle" ${MUTE[@]+"${MUTE[@]}"} --url=http://127.0.0.1:3471 --devtools-port=$PONT_CDP_PORT \
  --profile="$CACHE/profiles/lecteur" --background > "$OUT/app.log" 2>&1 &
APP_PID=$!
trap 'kill "$APP_PID" 2>/dev/null; [[ -n "$PROXY_PID" ]] && kill "$PROXY_PID" 2>/dev/null; echo "sorties : $OUT"' EXIT
for _ in $(seq 50); do curl -sf "http://127.0.0.1:$PONT_CDP_PORT/json" >/dev/null && break; sleep 0.3; done
sleep 4
grep "\[pont\] son" "$OUT/app.log"
[[ "$(node "$ROOT/web/shim/dev/cdp-eval.mjs" location.pathname)" == '"/login"' ]] && node "$ROOT/web/shim/dev/login.mjs" admin
status=0
for t in "${TITLES[@]}"; do
  node "$HERE/pistes.mjs" "$t" "$ROUNDS" | tee -a "$OUT/banc.txt" || status=1
done
echo "== commandes de la page vers mpv :"
grep "\[pont-trace\]" "$OUT/app.log" | awk '{ $2 = ""; print }' | sort | uniq -c | sort -rn | head -20
exit "$status"
