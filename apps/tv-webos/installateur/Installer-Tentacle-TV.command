#!/usr/bin/env bash
# Le même lanceur, sous l'extension que le Finder de macOS sait ouvrir d'un
# double-clic. Aucune logique ici : elle est dans `installer.sh`, une seule fois.
exec "$(dirname "$0")/installer.sh"
