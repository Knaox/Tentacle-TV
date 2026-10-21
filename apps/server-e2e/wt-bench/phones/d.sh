#!/bin/zsh
# d.sh <appareil> <commande> [args] : raccourci de drive.ts (Metro du banc sur WT_METRO_PORT, 8731 par défaut).
cd "$(dirname "$0")/../.."
WT_METRO_PORT=${WT_METRO_PORT:-8731} npx tsx wt-bench/phones/drive.ts "$@" 2>&1 | grep -v -E "DEP0205|trace-deprecation"
