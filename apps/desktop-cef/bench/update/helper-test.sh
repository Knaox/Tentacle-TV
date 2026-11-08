#!/usr/bin/env bash
# L'assistant de remplacement (tentacle-update, macOS) éprouvé SANS fenêtre, sur des paquets
# factices dans $TENTACLE_CEF_CACHE/update-test/helper-test : échange atomique sur APFS, pose à
# la fermeture, relance en bonne santé, relance qui meurt → retour arrière, retour demandé par l'app.
set -euo pipefail
cache="${TENTACLE_CEF_CACHE:-$HOME/.cache/tentacle-cef}"
helper="${1:-$cache/build/maj-tests/tentacle-update}"
root="$cache/update-test/helper-test"
fails=0
check() { if eval "$2"; then echo "  ✓ $1"; else echo "  ✗ $1"; fails=$((fails + 1)); fi; }

# Lanceur Mach-O commun aux paquets factices : il exécute Contents/Resources/run.sh (l'assistant
# exige un vrai exécutable de l'architecture du Mac, signé — comme pour la vraie app).
launcher="$root/launcher"
mkdir -p "$root"
cat >"$root/launcher.c" <<'C'
#include <mach-o/dyld.h>
#include <libgen.h>
#include <limits.h>
#include <stdio.h>
#include <unistd.h>
int main(int argc, char** argv) {
  char exe[PATH_MAX], script[PATH_MAX];
  uint32_t n = sizeof exe;
  if (_NSGetExecutablePath(exe, &n) != 0) return 90;
  snprintf(script, sizeof script, "%s/../Resources/run.sh", dirname(exe));
  char* args[8] = {"sh", script, argc > 1 ? argv[1] : NULL, NULL};
  execv("/bin/sh", args);
  return 91;
}
C
clang -O2 -o "$launcher" "$root/launcher.c"

# fake_app <dossier .app> <version> <script> : paquet factice signé ad hoc.
fake_app() {
  mkdir -p "$1/Contents/MacOS" "$1/Contents/Resources"
  cat >"$1/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0"><dict><key>CFBundleExecutable</key><string>Fake</string>
<key>CFBundleIdentifier</key><string>tv.tentacle.banc.fake</string>
<key>CFBundleShortVersionString</key><string>$2</string></dict></plist>
PLIST
  cp "$launcher" "$1/Contents/MacOS/Fake"
  printf '%s\n' "$3" >"$1/Contents/Resources/run.sh"
  echo "$2" >"$1/Contents/Resources/VERSION"
  codesign --force --sign - --timestamp=none "$1" 2>/dev/null
}
# setup <cas> <script de la nouvelle version> : ancienne 1.0.0 en place, nouvelle 2.0.0 préparée.
setup() {
  dir="$root/$1"; rm -rf "$dir"; mkdir -p "$dir/state"
  app="$dir/Fake.app"; staged="$dir/.Fake.app.update/Fake.app"; previous="$dir/.Fake.app.previous"
  fake_app "$app" 1.0.0 "echo old >> \"\$1/launched\""
  fake_app "$staged" 2.0.0 "$2"
}
run_helper() {  # attend la fin d'un faux « processus de l'app » puis agit
  sleep 0.3 & local pid=$!
  "$helper" "$1" --pid "$pid" --app "$app" --state-dir "$dir/state" --version 2.0.0 "${@:2}" 2>>"$dir/state/helper.log"
}
probation() { python3 -c "import json,sys;print(json.load(open(sys.argv[1])).get(sys.argv[2]))" "$dir/state/probation.json" "$1"; }

echo "== pose à la fermeture (sans relance)"
setup fermeture "exit 0"
run_helper apply --staged "$staged"
check "nouvelle version en place" '[[ $(cat "$app/Contents/Resources/VERSION") == 2.0.0 ]]'
check "ancienne copie gardée à côté" '[[ $(cat "$previous/Contents/Resources/VERSION") == 1.0.0 ]]'
check "échange atomique (renamex_np RENAME_SWAP)" 'grep -q "échange atomique" "$dir/state/helper.log"'
check "dossier de préparation effacé" '[[ ! -e "$dir/.Fake.app.update" ]]'
check "période d'essai notée" '[[ $(probation version) == 2.0.0 && $(probation healthy) == False ]]'
echo "== retour arrière demandé par l'app (3 lancements ratés)"
run_helper rollback --previous "$previous"
check "ancienne version remise" '[[ $(cat "$app/Contents/Resources/VERSION") == 1.0.0 && ! -e "$previous" ]]'
check "version abandonnée notée" '[[ $(probation rolledBack) == 2.0.0 ]]'

echo "== redémarrage : la nouvelle version tient"
setup sante "python3 -c \"import json,sys;p=sys.argv[1]+'/probation.json';d=json.load(open(p));d['healthy']=True;json.dump(d,open(p,'w'))\" \"\$1\"; sleep 2"
run_helper apply --staged "$staged" --relaunch -- "$dir/state"
check "relancée puis en bonne santé" 'grep -q "en bonne santé" "$dir/state/helper.log"'
check "nouvelle version en place, ancienne effacée" '[[ $(cat "$app/Contents/Resources/VERSION") == 2.0.0 && ! -e "$previous" ]]'

echo "== redémarrage : la nouvelle version meurt au démarrage"
setup panne "exit 3"
run_helper apply --staged "$staged" --relaunch -- "$dir/state"
sleep 0.5
check "retour arrière automatique" 'grep -q "s.est arrêtée avant d.être prête" "$dir/state/helper.log"'
check "ancienne version remise et relancée" '[[ $(cat "$app/Contents/Resources/VERSION") == 1.0.0 && -s "$dir/state/launched" ]]'
check "copie fautive effacée, version notée" '[[ ! -e "$previous" && $(probation rolledBack) == 2.0.0 ]]'

echo "== redémarrage : la nouvelle version est fermée proprement avant 10 s"
setup fermee "exit 0"
run_helper apply --staged "$staged" --relaunch -- "$dir/state"
check "pas de retour arrière pour une fermeture propre" 'grep -q "fermée proprement" "$dir/state/helper.log" && [[ $(cat "$app/Contents/Resources/VERSION") == 2.0.0 ]]'

echo "== la copie préparée a été modifiée après sa préparation"
setup alteree "exit 0"
echo "ajout" >"$staged/Contents/Resources/intrus"
run_helper apply --staged "$staged" || true
check "refusée au dernier contrôle, l'app reste intacte" 'grep -q "refusée au dernier contrôle : signature" "$dir/state/helper.log" && [[ $(cat "$app/Contents/Resources/VERSION") == 1.0.0 ]]'

echo "== retour arrière sans ancienne copie"
setup orpheline "exit 0"
run_helper apply --staged "$staged"
rm -rf "$previous"
run_helper rollback --previous "$previous" || true
check "abandonné sans boucle : l'essai est clos" '[[ $(probation healthy) == True && $(probation previousPath) == "" ]]'


echo "assistant : $fails échec(s)"
[[ $fails -eq 0 ]]
