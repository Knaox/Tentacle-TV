#!/usr/bin/env bash
# Sort les symboles de débogage dans <dossier>/<nom>.dSYM (dsymutil) puis retire les symboles
# des binaires : l'utilisateur ne télécharge pas les symboles, les rapports de plantage se
# symbolisent avec les .dSYM gardés à côté du build.
# Usage : strip-symbols.sh <dossier des .dSYM> <binaire…>
#   exécutables : strip complet (rien n'est cherché par dlsym dans l'exécutable) ;
#   dylibs      : strip -x (garde les symboles exportés, retire les locaux).
set -euo pipefail
sym="$1"; shift
mkdir -p "$sym"
for f in "$@"; do
  name="$(basename "$f")"
  # .dSYM seulement s'il y a une table de débogage (objets -g) ; les dylibs de Homebrew n'en ont pas.
  # (grep -c et non -q : avec pipefail, -q coupe nm et le tube échoue.)
  if (( $(nm -ap "$f" 2>/dev/null | grep -c ' OSO ') > 0 )); then dsymutil "$f" -o "$sym/$name.dSYM"; fi
  if otool -hv "$f" | grep -q EXECUTE; then
    strip "$f"
  else
    strip -x "$f"
  fi
done
