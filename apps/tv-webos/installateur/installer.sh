#!/usr/bin/env bash
# Lanceur macOS et Linux. Il ne fait que trois choses : se placer à côté du
# script, vérifier Node.js, et garder la fenêtre ouverte à la fin — sans quoi un
# double-clic depuis le Finder referme le terminal avant qu'on ait pu lire quoi
# que ce soit, message d'erreur compris.
set -u
cd "$(dirname "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
  cat <<'MESSAGE'

  Node.js est nécessaire, et n'est pas installé sur cet ordinateur.

  Installez la version « LTS » depuis https://nodejs.org, puis relancez
  ce script. Rien d'autre n'est requis.

MESSAGE
  printf '  Appuyez sur Entrée pour fermer. '
  read -r _
  exit 1
fi

node installer.mjs
issue=$?

printf '\n  Appuyez sur Entrée pour fermer. '
read -r _
exit $issue
