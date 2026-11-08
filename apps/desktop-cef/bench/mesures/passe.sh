#!/usr/bin/env bash
# Une passe de mesure (5 scénarios) sur UNE app, lancée à neuf puis tuée par PID.
# Le verrou d'écran du lot doit être tenu par l'appelant. Résultats (une ligne JSON par
# scénario) ajoutés à $OUT/resultats.jsonl ; état de mpv après chaque fenêtre dans etats.log.
#
#   bench/mesures/passe.sh cef|electron <n°>
#   bench/mesures/passe.sh repos <n°>       # aucune app : bruit de fond du système
#   CEF_APP=…/Tentacle.app CEF_PORT=9311 CEF_PROFILE=… OUT=… LABEL=cef-avant bench/mesures/passe.sh cef <n°>
set -uo pipefail
# Bancs : jamais de son (`ao=null` + `mute=yes`), voir src/player/sound_policy.h.
export TENTACLE_MUTE=1
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CACHE="$HOME/.cache/tentacle-cef"
OUT="${OUT:-$CACHE/build/mesures}"
APPKIND="$1"; RUN="$2"
mkdir -p "$OUT"
log() { echo "[$(date +%H:%M:%S)] $APPKIND#$RUN $*" | tee -a "$OUT/etats.log"; }

# Mesures seulement sous une charge raisonnable.
while (( $(uptime | sed -E 's/.*load averages?: ([0-9]+).*/\1/') >= 20 )); do log "charge trop haute, j'attends"; sleep 20; done
# Session macOS verrouillée : aucune fenêtre n'est réellement à l'écran (EDR 1,00, GPU de mpv
# à zéro, Electron libère sa mémoire de fenêtre occultée) — mesure sans valeur, on attend.
locked() { ioreg -n Root -d1 -a | plutil -extract IOConsoleUsers.0.CGSSessionScreenIsLocked raw - 2>/dev/null | grep -q true; }
while [[ "$APPKIND" != "repos" ]] && locked; do log "écran du Mac verrouillé, j'attends"; sleep 30; done

measure() {  # <scénario> <durée> [--edr]
  python3 "$HERE/fenetre.py" --pid "$PID" --duree "$2" ${3:-} --etiquette "${LABEL:-$APPKIND}/$1/$RUN" >> "$OUT/resultats.jsonl"
  log "$1 : $(tail -1 "$OUT/resultats.jsonl" | cut -c1-200)"
}
scen() { node "$HERE/scenario.mjs" "$PORT" "$@" 2>&1 | tail -1; }

if [[ "$APPKIND" == "repos" ]]; then
  sleep 600 & PID=$!
  measure systeme 20
  kill "$PID"; exit 0
fi

if [[ "$APPKIND" == "cef" ]]; then
  # Build, port, profil et drapeaux en plus réglables (axe ram : avant/après d'un même harnais).
  PORT="${CEF_PORT:-9306}"
  # --mute (règle du lot) : mpv en ao=null + mute=yes, quoi que demande la page. Pas de
  # --background : pour l'EDR et le GPU, la fenêtre doit être devant, comme Electron qui
  # s'active à son lancement (protocole du 03/11).
  "${CEF_APP:-$CACHE/build/integration/Tentacle.app}/Contents/MacOS/Tentacle" --mute \
    --url=http://127.0.0.1:3471 --devtools-port=$PORT \
    --profile="${CEF_PROFILE:-$CACHE/profiles/mesure-cef}" ${CEF_ARGS:-} > "$OUT/cef-$RUN.log" 2>&1 &
  PID=$!
else
  PORT=9305
  # Copie re-signée ad hoc (sans sandbox) : profil sous un faux HOME, jamais celui de Damien.
  CFFIXED_USER_HOME="$CACHE/profiles/electron-mesure/home" HOME="$CACHE/profiles/electron-mesure/home" \
    TENTACLE_LIQUID_GLASS=off "$CACHE/electron-copie/Tentacle TV.app/Contents/MacOS/Tentacle TV" \
    --use-mock-keychain --remote-debugging-port=$PORT > "$OUT/electron-$RUN.log" 2>&1 &
  PID=$!
fi
trap 'kill "$PID" 2>/dev/null; sleep 3; kill -9 "$PID" 2>/dev/null' EXIT
log "lancé pid $PID"
for i in $(seq 60); do curl -s "http://127.0.0.1:$PORT/json/list" | grep -q '"page"' && break; sleep 0.5; done
sleep 6
# Témoin : la fenêtre du dessus doit être celle de l'app mesurée (sinon EDR et GPU faussés).
FEN="$CACHE/build/mesures/fenetres"
[[ -x "$FEN" ]] && log "fenêtre du dessus : $("$FEN" 1 | tr -s ' ') (app : pid $PID)"

log "accueil : $(scen accueil)"
sleep 30
measure accueil 20

log "hdr10 : $(scen video "Banc HDR10 Pistes (2026)")"
sleep 3
measure hdr10 45 --edr
log "état : $(scen etat)"
log "sortie : $(scen sortie)"
sleep 12

log "dv : $(scen video "Banc Dolby Vision Pistes (2026)")"
sleep 3
measure dv 45 --edr
log "état : $(scen etat)"
log "sortie : $(scen sortie)"
sleep 12

log "hdr10-pe : $(scen video "Banc HDR10 Pistes (2026)" fs)"
sleep 2
measure hdr10-plein-ecran 42 --edr
log "état : $(scen etat)"
log "sortie : $(scen sortie fs)"
sleep 8

log "musique : $(scen musique)"
sleep 5
measure musique 50
log "fin de passe"
