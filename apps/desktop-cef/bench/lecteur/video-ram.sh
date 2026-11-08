#!/usr/bin/env bash
# Vidéo fenêtrée seule (HDR10 puis DV), harnais de ram (`bench/mesures/fenetre.py`,
# `scenario.mjs`, `synthese.py`), pour comparer des chaînes de lecture : une passe par app,
# ordre tournant, UN bloc de verrou d'écran par passe (~2 min ; rendu entre deux).
#   bench/lecteur/video-ram.sh <dossier> <tours> "<étiquette>|<Tentacle.app ou electron>|<env…>" …
#   env : `CLÉ=valeur` séparées par des espaces, posées pour l'app (ex. TENTACLE_MPV_EXTRA=…).
set -uo pipefail
M="$(cd "$(dirname "${BASH_SOURCE[0]}")/../mesures" && pwd)"
CACHE="$HOME/.cache/tentacle-cef"
LOCK="$CACHE/locks/ecran"
export OUT="$1"; TOURS="$2"; shift 2
mkdir -p "$OUT"
# Bancs : jamais de son (`ao=null` + `mute=yes`), voir src/player/sound_policy.h.
export TENTACLE_MUTE=1
locked() { ioreg -n Root -d1 -a | plutil -extract IOConsoleUsers.0.CGSSessionScreenIsLocked raw - 2>/dev/null | grep -q true; }
scen() { node "$M/scenario.mjs" "$PORT" "$@" 2>&1 | tail -1; }
measure() {  # <scénario> <durée>
  python3 "$M/fenetre.py" --pid "$PID" --duree "$2" --edr --etiquette "$TAG/$1/$RUN" >> "$OUT/resultats.jsonl"
  echo "[$(date +%H:%M:%S)] $TAG#$RUN $1 : $(tail -1 "$OUT/resultats.jsonl" | cut -c1-160)"
}

pass() {  # <étiquette> <app> <env> — une passe, sous le verrou
  TAG="$1"
  until mkdir "$LOCK" 2>/dev/null; do sleep 10; done
  echo "lecteur $(date +%H:%M) video-ram $TAG" > "$LOCK/qui"
  while locked; do echo "écran verrouillé, j'attends"; sleep 30; done
  if [[ "$2" == electron ]]; then
    PORT=9305
    CFFIXED_USER_HOME="$CACHE/profiles/electron-mesure/home" HOME="$CACHE/profiles/electron-mesure/home" \
      TENTACLE_LIQUID_GLASS=off "$CACHE/electron-copie/Tentacle TV.app/Contents/MacOS/Tentacle TV" \
      --use-mock-keychain --remote-debugging-port=$PORT > "$OUT/$TAG-$RUN.log" 2>&1 &
  else
    PORT=9313
    # shellcheck disable=SC2086
    env $3 "$2/Contents/MacOS/Tentacle" --mute --url=http://127.0.0.1:3471 --devtools-port=$PORT \
      --profile="$CACHE/profiles/lecteur" > "$OUT/$TAG-$RUN.log" 2>&1 &
  fi
  PID=$!
  for i in $(seq 60); do curl -s "http://127.0.0.1:$PORT/json/list" | grep -q '"page"' && break; sleep 0.5; done
  sleep 6
  echo "[$(date +%H:%M:%S)] $TAG#$RUN accueil : $(scen accueil)"
  sleep 5
  echo "hdr10 : $(scen video "Banc HDR10 Pistes (2026)")"; sleep 3; measure hdr10 30
  echo "état : $(scen etat)"; echo "sortie : $(scen sortie)"; sleep 8
  echo "dv : $(scen video "Banc Dolby Vision Pistes (2026)")"; sleep 3; measure dv 30
  echo "état : $(scen etat)"
  kill "$PID" 2>/dev/null; for i in 1 2 3 4 5 6 7 8; do kill -0 "$PID" 2>/dev/null || break; sleep 0.5; done
  kill -9 "$PID" 2>/dev/null
  rm -f "$LOCK/qui"; rmdir "$LOCK"
  sleep 15  # le verrou est libre : une autre session peut le prendre
}

for RUN in $(seq "$TOURS"); do
  n=$#
  for ((k = 0; k < n; k++)); do
    i=$(( (k + RUN - 1) % n + 1 ))
    IFS='|' read -r tag app envs <<< "${!i}"
    pass "$tag" "$app" "$envs"
  done
done
python3 "$M/synthese.py" "$OUT/resultats.jsonl" | tee "$OUT/synthese.md"
