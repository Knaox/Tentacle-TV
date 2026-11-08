#!/usr/bin/env bash
# Recette du lot « app CEF » sur UN .app : rejouable, sortie en tableau, code de retour = nombre
# de cas en échec (0 = tout vert). Chaque passe qui affiche une fenêtre prend le verrou d'écran
# du lot (lib-ecran.sh, ou celui des bancs qu'elle appelle) et le rend aussitôt après.
#
#   scripts/recette.sh [--app <Tentacle.app>] [phase…]
#   phases (défaut : toutes, dans cet ordre) :
#     banc        banc local vivant (Tentacle 1.42.0 :3471, Jellyfin :8471)
#     fake-edr    --fake-video=edr:4 sous la page (compositeur seul, sans mpv) : >1 ×3, repos 1,00
#     video       HDR10 > 1, DV > 1, SDR = 1,00 — fenêtré ET plein écran, page au-dessus, plein
#                 écran prouvé (SDL, NSWindow, serveur de fenêtres, couche à la taille), puis le
#                 scénario du pont (11 cas) par titre et la robustesse (pont)
#     saisie      touches natives (--debug-input, premier plan) : Entrée sur /login (profil neuf),
#                 navigator.language = langue du système, F11 et ⌃⌘F, ⌘Q en pleine lecture → code 0
#     octave      musique sous CEF + bascule musique → vidéo → musique
#     socle       banc du socle (120 Hz réel, IME, popups, plein écran natif, repos)
# Toujours muet : --mute + TENTACLE_MUTE=1 (le son actif par défaut est pour Damien, pas pour nous).
# Journaux : $TENTACLE_CEF_CACHE/build/recette/passe-<MMJJ-HHMM>/ (tableau.tsv + un journal par passe).
# RECETTE_FOREGROUND=1 : lancer l'app au premier plan (sans --background).
# RECETTE_TITRES="hdr10 dv sdr" : titres de la phase video (défaut : les trois) ; RECETTE_PONT=0 :
# sans le scénario du pont ni la robustesse (EDR et plein écran seulement).
set -uo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cache="${TENTACLE_CEF_CACHE:-$HOME/.cache/tentacle-cef}"
bundle="$cache/build/integration/Tentacle.app"
phases=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --app) bundle="${2%/}"; shift 2 ;;
    -h|--help) sed -n 2,21p "$0"; exit 0 ;;
    *) phases+=("$1"); shift ;;
  esac
done
[[ ${#phases[@]} -eq 0 ]] && phases=(banc fake-edr video saisie octave socle)
app="$bundle/Contents/MacOS/Tentacle"
[[ -x "$app" ]] || { echo "pas d'exécutable : $app"; exit 2; }
probe="${EDR_PROBE:-$cache/build/video-hdr/edr-probe/edr-probe}"
[[ -x "$probe" ]] || { echo "sonde EDR absente : $probe"; exit 2; }
port=9317
lock="$cache/locks/ecran"
out="$cache/build/recette/passe-$(date +%m%d-%H%M)"
mkdir -p "$out"
table="$out/tableau.tsv"
: > "$table"
export TENTACLE_MUTE=1 PONT_CDP_PORT=$port TENTACLE_APP="$bundle" TENTACLE_BANC_PORT=$port
export EDR_PROBE="$probe"
source "$root/scripts/lib-ecran.sh"

# Sonde de fenêtre (externe, Swift) : recompilée si la source a changé.
winstate="$cache/build/recette-tools/win-state"
if [[ ! -x "$winstate" || "$root/tools/edr-probe/win-state.swift" -nt "$winstate" ]]; then
  mkdir -p "$(dirname "$winstate")"
  swiftc -O -o "$winstate" "$root/tools/edr-probe/win-state.swift" || { echo "win-state ne compile pas"; exit 2; }
fi
export WIN_STATE="$winstate"

# D'où vient ce .app : la source de son dossier de build (CMakeCache), et son commit.
src="$(sed -n 's/^CMAKE_HOME_DIRECTORY:INTERNAL=//p' "$(dirname "$bundle")/CMakeCache.txt" 2>/dev/null)"
sha="$( [[ -n "$src" ]] && git -C "$src" rev-parse --short=8 HEAD 2>/dev/null || echo "?")"
{
  echo "recette $(date '+%d/%m %H:%M') — app $bundle"
  echo "source ${src:-?} — commit $sha — $(sw_vers -productVersion) — $(uptime | sed 's/.*load averages*: //')"
} | tee "$out/entete.txt"

row() { printf '%s\t%s\t%s\t%s\n' "$1" "$2" "$3" "${4//$'\t'/ }" >> "$table"; }
# Lit les verdicts d'un journal : « ✅ / ❌ » (pont, octave, recette-video), « OK / ÉCHEC » (socle).
collect() {  # $1 = phase, $2 = journal, $3 = code de retour de la passe
  local phase="$1" file="$2" status="${3:-0}" n=0 ko=0 line r rest name detail
  while IFS= read -r line; do
    case "$line" in
      *✅*) r=OK; rest="${line#*✅ }" ;;
      *❌*) r=KO; rest="${line#*❌ }" ;;
      "OK "*) r=OK; rest="${line#OK }" ;;
      "ÉCHEC"*) r=KO; rest="${line#ÉCHEC }" ;;
      *) continue ;;
    esac
    rest="${rest#"${rest%%[![:space:]]*}"}"
    name="${rest%% — *}"; detail="${rest#* — }"; [[ "$detail" == "$rest" ]] && detail=""
    row "$phase" "$name" "$r" "$detail"; n=$((n + 1)); [[ $r == KO ]] && ko=$((ko + 1))
  done < "$file"
  if (( n == 0 )); then row "$phase" "exécution" KO "aucun cas lu — $file"
  elif (( status != 0 && ko == 0 )); then row "$phase" "code de retour" KO "$status sans cas en échec — $file"; fi
}

app_pid=""; have_lock=0
cleanup() {
  [[ -n "$app_pid" ]] && kill "$app_pid" 2>/dev/null
  # « qui » d'abord : sinon rmdir échoue et la phase suivante attend son propre verrou.
  (( have_lock )) && { rm -f "$lock/qui"; rmdir "$lock" 2>/dev/null; }
  app_pid=""; have_lock=0
}
trap cleanup EXIT
quit_app() {  # fermeture propre (shell.quit), sinon SIGTERM
  [[ -z "$app_pid" ]] && return
  node "$root/tools/cdp-eval.mjs" $port "__shell.invoke('shell.quit')" >/dev/null 2>&1
  for _ in $(seq 40); do kill -0 "$app_pid" 2>/dev/null || break; sleep 0.25; done
  if kill -0 "$app_pid" 2>/dev/null; then row "$1" "fermeture propre" KO "shell.quit sans effet (pid $app_pid)"; kill "$app_pid"
  else row "$1" "fermeture propre" OK "shell.quit, plus de processus"; fi
  app_pid=""
}
wait_devtools() { for _ in $(seq 100); do kill -0 "$app_pid" 2>/dev/null || return 1; curl -sf "http://127.0.0.1:$port/json" >/dev/null && return 0; sleep 0.3; done; return 1; }
wait_load() { while (( $(uptime | sed 's/.*load averages*: //' | awk '{printf "%d", $1}') >= 20 )); do echo "charge ≥ 20, j'attends…"; sleep 30; done; }

phase_banc() {
  local s1 s2
  s1=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3471/)
  s2=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8471/health)
  [[ $s1 == 200 ]] && row banc "Tentacle 1.42.0 :3471" OK "HTTP $s1" || row banc "Tentacle 1.42.0 :3471" KO "HTTP $s1 — bench/server/banc.sh up"
  [[ $s2 == 200 ]] && row banc "Jellyfin :8471" OK "HTTP $s2" || row banc "Jellyfin :8471" KO "HTTP $s2 — bench/server/banc.sh up"
  # La robustesse a besoin d'un film indexé SANS fichier ; une analyse de bibliothèque le retire.
  local dis; dis="$(node "$root/bench/hdr/banc-disparu.mjs" 2>&1 | tail -1)"
  [[ "$dis" == *✅* ]] && row banc "« Banc Disparu » indexé sans fichier" OK "${dis#✅ }" || row banc "« Banc Disparu » indexé sans fichier" KO "$dis"
}

phase_fake_edr() {
  local f="$out/fake-edr.txt" st=0 l v
  "$root/scripts/banc-socle-edr.sh" > "$f" 2>&1 || st=$?
  # « <cas> : summary min=… max=… » — A, B et C : marge > 1 (B : vidéo masquée par une page
  # opaque, macOS accorde quand même la marge, constat du socle) ; repos : 1,00.
  while IFS= read -r l; do
    v="$(sed -n 's/.*max=\([0-9.]*\).*/\1/p' <<< "$l")"; [[ -z "$v" ]] && continue
    case "$l" in
      A-*|B-*|C-*) awk -v v="$v" 'BEGIN{exit !(v>1.05)}' && r=OK || r=KO; row fake-edr "${l%% :*} > 1" $r "$l" ;;
      *) awk -v v="$v" 'BEGIN{exit !(v<=1.001)}' && r=OK || r=KO; row fake-edr "${l%% :*} = 1,00" $r "$l" ;;
    esac
  done < "$f"
  grep -q max= "$f" || row fake-edr "exécution" KO "code $st — $f"
}

phase_video() {
  local bg="--background" st login
  [[ -n "${RECETTE_FOREGROUND:-}" ]] && bg=""
  take_screen_lock "$lock"; have_lock=1
  echo "recette $(date +%H:%M) video" > "$lock/qui" 2>/dev/null
  "$app" --url=http://127.0.0.1:3471/ --devtools-port=$port --profile="$cache/profiles/recette" \
    --fake-video=off --mute $bg > "$out/app-video.log" 2>&1 &
  app_pid=$!
  export RECETTE_APP_PID=$app_pid
  if ! wait_devtools; then row video "lancement" KO "pas de DevTools sur $port — $out/app-video.log"; cleanup; return; fi
  sleep 6
  login="$(node "$root/web/shim/dev/login.mjs" admin 2>&1)"
  [[ "$login" == *"/login"* ]] && row video "connexion (formulaire)" KO "$login" || row video "connexion (formulaire)" OK "$login"
  local t k slug
  for t in "Banc HDR10 Pistes (2026)|hdr|hdr10" "Banc Dolby Vision Pistes (2026)|hdr|dv" "Banc Pistes SDR (2026)|sdr|sdr"; do
    IFS='|' read -r title k slug <<< "$t"
    [[ " ${RECETTE_TITRES:-hdr10 dv sdr} " == *" $slug "* ]] || continue
    st=0; node "$root/bench/hdr/recette-video.mjs" "$title" "$k" > "$out/edr-$slug.txt" 2>&1 || st=$?
    collect "edr-$slug" "$out/edr-$slug.txt" $st
    [[ "${RECETTE_PONT:-1}" == 0 ]] && continue
    st=0; node "$root/web/shim/dev/scenario-video.mjs" "$title" > "$out/pont-$slug.txt" 2>&1 || st=$?
    collect "pont-$slug" "$out/pont-$slug.txt" $st
  done
  if [[ "${RECETTE_PONT:-1}" != 0 ]]; then
    st=0; node "$root/web/shim/dev/scenario-robustesse.mjs" > "$out/robustesse.txt" 2>&1 || st=$?
    collect robustesse "$out/robustesse.txt" $st
  fi
  quit_app video
  rm -f "$lock/qui"; cleanup
}

phase_saisie() {
  local st=0 code prof="$out/profil-saisie"
  take_screen_lock "$lock"; have_lock=1
  echo "recette $(date +%H:%M) saisie" > "$lock/qui" 2>/dev/null
  # Premier plan : SDL3 jette les touches d'une fenêtre inactive. Profil neuf : vraie page /login.
  rm -rf "$prof"
  "$app" --url=http://127.0.0.1:3471/login --devtools-port=$port --profile="$prof" \
    --debug-input --fake-video=off --mute > "$out/app-saisie.log" 2>&1 &
  app_pid=$!
  if ! wait_devtools; then row saisie "lancement" KO "pas de DevTools sur $port — $out/app-saisie.log"; cleanup; return; fi
  sleep 4
  node "$root/tests/saisie/connexion.mjs" $port user > "$out/saisie-connexion.txt" 2>&1 || st=$?
  collect saisie "$out/saisie-connexion.txt" $st
  st=0
  RECETTE_APP_PID=$app_pid RECETTE_LANGUES="$(defaults read -g AppleLanguages | tr -d ' ()"\n' | sed 's/,$//')" \
    node "$root/bench/hdr/recette-saisie.mjs" > "$out/saisie.txt" 2>&1 || st=$?
  collect saisie "$out/saisie.txt" $st
  # ⌘Q a été envoyé en pleine lecture : l'app doit sortir d'elle-même, avec le code 0.
  for _ in $(seq 60); do kill -0 "$app_pid" 2>/dev/null || break; sleep 0.25; done
  if kill -0 "$app_pid" 2>/dev/null; then
    row saisie "⌘Q en pleine lecture : l'app se ferme" KO "toujours là après 15 s (pid $app_pid)"; cleanup
  else
    wait "$app_pid"; code=$?
    (( code == 0 )) && row saisie "⌘Q en pleine lecture : code de sortie 0" OK "code $code" \
                    || row saisie "⌘Q en pleine lecture : code de sortie 0" KO "code $code — $out/app-saisie.log"
    app_pid=""
  fi
  rm -f "$lock/qui"; cleanup
}

phase_octave() {
  local st=0
  node "$root/web/shim/octave-cef.mjs" > "$out/octave.txt" 2>&1 || st=$?
  collect octave "$out/octave.txt" $st
}

phase_socle() {
  local st=0
  wait_load  # la cadence (120 Hz) est une mesure : pas sous forte charge
  TENTACLE_BANC_OUT="$out/socle" "$root/scripts/banc-socle.sh" > "$out/socle.txt" 2>&1 || st=$?
  collect socle "$out/socle.txt" $st
  local repos; repos="$(grep '^REPOS' "$out/socle.txt")"
  [[ -n "$repos" ]] && row socle "repos (page statique, 10 s)" INFO "${repos#REPOS : }"
}

for p in "${phases[@]}"; do
  echo "== $p ($(date +%H:%M:%S))"
  case "$p" in
    banc) phase_banc ;;
    fake-edr) phase_fake_edr ;;
    video) phase_video ;;
    saisie) phase_saisie ;;
    octave) phase_octave ;;
    socle) phase_socle ;;
    *) echo "phase inconnue : $p"; exit 2 ;;
  esac
done

ok=$(awk -F'\t' '$3=="OK"' "$table" | wc -l | tr -d ' ')
ko=$(awk -F'\t' '$3=="KO"' "$table" | wc -l | tr -d ' ')
{
  echo
  printf '%-12s  %-48s  %-4s  %s\n' PHASE CAS VERDICT DÉTAIL
  awk -F'\t' '{ d = $4; if (length(d) > 110) d = substr(d, 1, 107) "…"; printf "%-12s  %-48s  %-4s  %s\n", $1, substr($2, 1, 48), $3, d }' "$table"
  echo
  echo "TOTAL : $ok OK, $ko KO — commit $sha — journaux $out"
} | tee "$out/tableau.txt"
exit $(( ko > 100 ? 100 : ko ))
