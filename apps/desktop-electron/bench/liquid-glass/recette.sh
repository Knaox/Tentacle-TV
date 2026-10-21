#!/bin/bash
# ════════════════════════════════════════════════════════════════════════
# Recette d'une fusion annoncée sur `dev` : met CE worktree à jour (fusion de
# `dev` dans la branche du banc — elle ne porte que bench/, aucun conflit),
# réinstalle si le lockfile a bougé, reconstruit le bureau (build de débogage),
# relance le backend jetable s'il a changé, rejoue la matrice, compare au
# rendu d'avant.
#
#   BANC_STATE=<état> BANC_REF=<dossier de la référence> recette.sh [cellule…]
# ════════════════════════════════════════════════════════════════════════
set -euo pipefail
: "${BANC_STATE:?BANC_STATE requis}"
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../../../.." && pwd)"
cd "$ROOT"

BEFORE=$(git rev-parse HEAD)
git merge --no-edit -q dev
AFTER=$(git rev-parse HEAD)
DEV=$(git rev-parse --short dev)
echo "[recette] dev = $DEV (worktree $(git rev-parse --short "$BEFORE") → $(git rev-parse --short "$AFTER"))"

if ! git diff --quiet "$BEFORE" "$AFTER" -- pnpm-lock.yaml; then
  echo "[recette] lockfile changé : pnpm install"
  pnpm install --frozen-lockfile >/dev/null
fi
pnpm --filter @tentacle-tv/desktop-electron build:web:debug >/dev/null
pnpm --filter @tentacle-tv/desktop-electron build:ts >/dev/null

if ! git diff --quiet "$BEFORE" "$AFTER" -- apps/backend packages/shared || ! curl -fsS http://127.0.0.1:3107/api/health >/dev/null 2>&1; then
  if [ -f "$BANC_STATE/backend.pid" ] && kill -0 "$(cat "$BANC_STATE/backend.pid")" 2>/dev/null; then
    kill "$(cat "$BANC_STATE/backend.pid")"
  fi
  nohup bash "$HERE/backend.sh" "$BANC_STATE" > "$BANC_STATE/backend.log" 2>&1 &
  for _ in $(seq 1 60); do curl -fsS http://127.0.0.1:3107/api/health >/dev/null 2>&1 && break; sleep 2; done
fi

cd "$HERE"
LABEL="recette-$DEV"
node matrix.mjs "$@" --label "$LABEL" | tail -1
RUN=$(ls -dt "${BANC_OUT:-$HOME/Pictures/tentacle-banc-liquid-glass}"/*-"$LABEL" | head -1)
if [ -n "${BANC_REF:-}" ]; then
  echo "[recette] coupé face au rendu d'avant :"
  node compare.mjs "$BANC_REF:allume" "$RUN:coupe" fiche accueil-defile || true
  echo "[recette] non supporté face au rendu d'avant :"
  node compare.mjs "$BANC_REF:allume" "$RUN:env-off" fiche || true
fi
echo "$RUN/resume.md"
