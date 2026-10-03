#!/bin/bash
# Extrait le code d'un commit (défaut : 84f3cedd0, la référence du lot) dans le
# cache de la machine, node_modules du dossier principal prêtés, et l'imprime :
#   TRACE_WT="$(apps/tv/harness/player-trace/reference.sh)" TRACE_MODE=record …
set -euo pipefail
shopt -s nullglob
REV="${1:-84f3cedd0}"
REPO="$(cd "$(dirname "$0")/../../../.." && pwd)"
MAIN="$(git -C "$REPO" worktree list --porcelain | sed -n 's/^worktree //p' | head -1)"
SHA="$(git -C "$REPO" rev-parse --verify "$REV^{commit}")"
DIR="${PLAYER_TRACE_CACHE:-$HOME/Library/Caches/tentacle-player-trace}/${SHA:0:12}"
if [ ! -f "$DIR/.ready" ]; then
  rm -rf "$DIR"; mkdir -p "$DIR"
  git -C "$REPO" archive "$SHA" apps/tv packages package.json tsconfig.base.json | tar -x -C "$DIR"
  ln -s "$MAIN/node_modules" "$DIR/node_modules"
  for d in "$MAIN"/apps/tv "$MAIN"/packages/*; do
    rel="${d#"$MAIN"/}"
    [ -d "$d/node_modules" ] && [ -d "$DIR/$rel" ] || continue
    mkdir -p "$DIR/$rel/node_modules"
    for e in "$d"/node_modules/*; do
      name="$(basename "$e")"
      if [ "$name" = "@tentacle-tv" ]; then
        mkdir -p "$DIR/$rel/node_modules/@tentacle-tv"
        for l in "$e"/*; do ln -s "$(readlink "$l")" "$DIR/$rel/node_modules/@tentacle-tv/$(basename "$l")"; done
      else
        ln -s "$e" "$DIR/$rel/node_modules/$name"
      fi
    done
  done
  echo "$SHA" > "$DIR/.ready"
fi
echo "$DIR"
