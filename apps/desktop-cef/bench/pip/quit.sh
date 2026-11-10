#!/usr/bin/env bash
# Quitter pendant le PiP : l'app part d'elle-même, sans plantage, sans navigateur oublié.
set -u
here="$(cd "$(dirname "$0")" && pwd)"
run="$HOME/.cache/tentacle-cef/pip-run"
"$run/restart.sh" >/dev/null; sleep 5
pid=$(cat "$run/app.pid")
PONT_CDP_PORT=9426 node "$here/quit.mjs" "$@" || exit 1
for i in $(seq 1 60); do kill -0 "$pid" 2>/dev/null || break; sleep 0.25; done
if kill -0 "$pid" 2>/dev/null; then echo "❌ l'app ne s'est pas fermée en 15 s"; exit 1; fi
log="$run/app.log"
if grep -q "navigateur du PiP encore là\|Check failed\|SIGSEGV\|Object reference incorrectly held" "$log"; then
  echo "❌ fermeture sale :"; grep "navigateur du PiP encore là\|Check failed\|SIGSEGV\|incorrectly held" "$log"; exit 1
fi
echo "✅ quitter pendant le PiP : l'app s'est fermée proprement (pid $pid)"
