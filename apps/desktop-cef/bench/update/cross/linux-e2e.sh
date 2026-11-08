#!/usr/bin/env bash
# Parcours Linux de bout en bout, DANS le conteneur (lancé par bench/update/cross-test.sh) : le
# vrai moteur et la vraie implémentation Linux sur de fausses AppImages (ELF marqués « AI\x02 »),
# flux signé servi sur 127.0.0.1, échange renameat2, relance surveillée, retours arrière.
#   $1 = dossier des binaires construits (tentacle-e2e-app-*, tentacle-e2e-feed)
set -uo pipefail
bin="$1"
work=/tmp/maj-e2e
port=8476
fails=0
ok() { echo "  ✓ $1"; }
ko() { echo "  ✗ ÉCHEC : $1"; fails=$((fails + 1)); }
check() { if eval "$2"; then ok "$1"; else ko "$1"; fi; }

# Attend qu'une ligne apparaisse dans le journal (10 s par défaut).
seen() { grep -q -- "$1" "$work/log" 2>/dev/null; }
wait_for() {
  local i
  for ((i = 0; i < ${2:-50}; i++)); do seen "$1" && return 0; sleep 0.2; done
  return 1
}
# Plus aucune fausse app ni guetteur en vie (les nôtres : leur ligne de commande vise
# l'AppImage du banc ; ni pgrep ni ps dans l'image : /proc directement).
alive() {
  local f
  for f in /proc/[0-9]*/cmdline; do
    { tr '\0' ' ' <"$f"; } 2>/dev/null | grep -q "maj-e2e/ins[t]" && return 0
  done
  return 1
}
settled() {
  local i
  for ((i = 0; i < ${1:-75}; i++)); do alive || return 0; sleep 0.2; done
  return 1
}

appimage() {  # version[-défaut] → fichier servi, marqué AppImage de type 2
  cp "$bin/tentacle-e2e-app-$1" "$work/srv/$1.AppImage"
  printf 'AI\002' | dd of="$work/srv/$1.AppImage" bs=1 seek=8 conv=notrunc status=none
}
feed() {  # version severity fichier
  pub=$("$bin/tentacle-e2e-feed" --secret="$work/test-key" --out="$work/srv/stable.json" --version="$1" \
        --severity="$2" --platform="$platform" --url="http://127.0.0.1:$port/$3.AppImage" --file="$work/srv/$3.AppImage")
}
install_base() {  # remet l'appareil à zéro : 1.0.0 installée, aucun état
  rm -rf "$work/inst" "$work/state" "$work/log"
  mkdir -p "$work/inst" "$work/state"
  cp "$work/srv/1.0.0.AppImage" "$work/inst/Tentacle.AppImage"
}
launch() {  # lance l'app installée (en arrière-plan), avec les arguments du parcours
  APPIMAGE="$work/inst/Tentacle.AppImage" "$work/inst/Tentacle.AppImage" \
    --feed="http://127.0.0.1:$port/stable.json" --key="$pub" --state="$work/state" --log="$work/log" "$@" &
}
installed_is() { cmp -s "$work/inst/Tentacle.AppImage" "$work/srv/$1.AppImage"; }
probation() { grep -Eq "\"$1\" *: *$2" "$work/state/probation.json" 2>/dev/null; }

rm -rf "$work" && mkdir -p "$work/srv"
if [[ "$(uname -m)" == aarch64 ]]; then platform=linux-arm64-appimage; else platform=linux-x86_64-appimage; fi
for v in 1.0.0 1.0.1 1.1.0 1.1.0-fault1 1.0.1-fault2; do appimage "$v"; done
python3 -m http.server "$port" --bind 127.0.0.1 --directory "$work/srv" >/dev/null 2>&1 &
server=$!
trap 'kill $server 2>/dev/null' EXIT
for _ in $(seq 50); do (exec 3<>"/dev/tcp/127.0.0.1/$port") 2>/dev/null && break; sleep 0.1; done
echo "   ($(uname -sr), $(uname -m), clé de plateforme $platform)"

echo "-- majeure : notification, « Redémarrer », échange atomique, relance, bonne santé"
install_base
feed 1.1.0 major 1.1.0
launch --restart --healthy-ms=1000 --exit-after=6000
check "1.0.0 : prête et notifiée (toast)" 'wait_for "1.0.0 phase ready prompt toast"'
check "« Redémarrer » accepté" 'wait_for "1.0.0 restart ok"'
check "relancée en 1.1.0 par le guetteur" 'wait_for "1.1.0 start" 40'
check "1.1.0 en bonne santé" 'wait_for "1.1.0 healthy"'
check "fin des processus" 'settled'
check "l'AppImage installée est la 1.1.0" 'installed_is 1.1.0'
check "période d'essai réussie" 'probation healthy true'
check "ancienne copie effacée" '[[ ! -e "$work/inst/.Tentacle.AppImage.previous" ]]'

echo "-- majeure relancée puis fermée proprement avant sa bonne santé : gardée"
install_base
feed 1.1.0 major 1.1.0
launch --restart --healthy-ms=8000 --exit-after=3000
check "relancée en 1.1.0" 'wait_for "1.1.0 start" 40'
check "fermée proprement avant la bonne santé" 'wait_for "1.1.0 exit" 40'
check "fin des processus" 'settled'
check "gardée : l'AppImage installée est la 1.1.0" 'installed_is 1.1.0'

echo "-- mineure : aucune notification, posée en silence à la fermeture, sans relance"
install_base
feed 1.0.1 minor 1.0.1
launch --quit-when-ready --exit-after=8000
check "1.0.0 : prête" 'wait_for "1.0.0 phase ready"'
check "fermeture" 'wait_for "1.0.0 exit"'
check "AUCUNE notification" '! grep -Eq "prompt (toast|blocking)" "$work/log"'
check "fin des processus, aucune relance" 'settled && sleep 1 && ! seen "1.0.1 start"'
check "l'AppImage installée est la 1.0.1" 'installed_is 1.0.1'
launch --healthy-ms=500 --exit-after=2000
check "lancée à la main : 1.0.1 en bonne santé" 'wait_for "1.0.1 healthy"'
check "ancienne copie effacée" 'settled && [[ ! -e "$work/inst/.Tentacle.AppImage.previous" ]]'

echo "-- critique : bloquante une fois prête, jamais masquable"
install_base
feed 1.1.0 critical 1.1.0
launch --exit-after=4000
check "1.0.0 : prête et bloquante" 'wait_for "1.0.0 phase ready prompt blocking"'
check "jamais muette" '! grep -Eq "1.0.0 phase (downloading|verifying|staging|ready) prompt none" "$work/log"'
check "fin des processus" 'settled'

echo "-- relance qui meurt avant le moteur : le guetteur revient en arrière"
install_base
appimage_crash=1.1.0-fault1
feed 1.1.0 major "$appimage_crash"
launch --restart --healthy-ms=1000 --exit-after=6000
check "« Redémarrer » accepté" 'wait_for "1.0.0 restart ok"'
check "la 1.1.0 démarre et meurt (code 3)" 'wait_for "1.1.0 start" 40'
check "1.0.0 relancée" 'wait_for "1.0.0 rolledBack 1.1.0" 40'
check "fin des processus" 'settled'
check "l'AppImage installée est de nouveau la 1.0.0" 'installed_is 1.0.0'
check "1.1.0 notée mauvaise (state.json)" 'grep -q "\"1.1.0\"" "$work/state/state.json"'
check "plus jamais reproposée" '! grep -q "1.0.0 restart ok" <(sed -n "/1.0.0 rolledBack/,\$p" "$work/log")'

echo "-- mineure posée en silence qui ne tient pas : retour arrière au 3e lancement"
install_base
feed 1.0.1 minor 1.0.1-fault2
launch --quit-when-ready --exit-after=8000
check "posée à la fermeture" 'wait_for "1.0.0 exit" && settled && installed_is 1.0.1-fault2'
for n in 1 2; do launch --exit-after=3000; wait $!; done
check "deux lancements ratés (code 3) sans retour arrière" 'probation launches 2 && installed_is 1.0.1-fault2'
launch --exit-after=3000
check "3e lancement : retour arrière lancé" 'wait_for "1.0.1 rollback launched"'
check "1.0.0 relancée, retour annoncé" 'wait_for "1.0.0 rolledBack 1.0.1" 40'
check "fin des processus" 'settled'
check "l'AppImage installée est de nouveau la 1.0.0" 'installed_is 1.0.0'

echo "linux-e2e : $fails échec(s)"
exit $((fails > 0))
