#!/bin/zsh
# Recrée dans un worktree de l'app les node_modules PAR PAQUET du dépôt principal :
# liens @tentacle-tv RELATIFS (vers les paquets du worktree), le reste lié aux copies
# du principal. Ne touche pas au principal. Usage : link-worktree.sh <principal> <worktree>
set -eu
MAIN="$1"; WT="$2"
for dir in "$MAIN"/apps/*/node_modules(N) "$MAIN"/packages/*/node_modules(N); do
  rel="${dir#$MAIN/}"; dest="$WT/$rel"
  [ -d "${dest:h}" ] || continue
  mkdir -p "$dest"
  for entry in "$dir"/*(N) "$dir"/@*/*(N); do
    name="${entry#$dir/}"
    [[ "$name" == @*/* || "$name" != @* ]] || continue
    target="$dest/$name"
    [ -e "$target" -o -L "$target" ] && continue
    mkdir -p "${target:h}"
    if [ -L "$entry" ]; then ln -s "$(readlink "$entry")" "$target"
    else ln -s "$entry" "$target"; fi
  done
done
echo "liens posés"
