#!/usr/bin/env bash
# Commandes de développement, appelées par le package.json racine (pnpm dev | build | banc).
#
#   scripts/dev.sh build            VRAI build Release du paquet (scripts/build.sh), rien d'autre
#   scripts/dev.sh run [opts…]      build, puis lance l'app contre $TENTACLE_URL (défaut : le banc)
#   scripts/dev.sh banc [up|status] banc local (colima + Tentacle 1.42.0 + Jellyfin)
#
# `run` : profil $TENTACLE_CEF_CACHE/profiles/dev, son ouvert ; `--mute` (ou TENTACLE_MUTE=1)
# le coupe. Toute autre option est passée à l'app (--size=1440x900, --devtools-port=9300…).
# Dossier de build : `dev` pour le dépôt principal, `dev-<worktree>` pour un worktree (CMake
# refuse qu'un même dossier serve deux sources).
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cache="${TENTACLE_CEF_CACHE:-$HOME/.cache/tentacle-cef}"
banc_url="http://127.0.0.1:3471"
url="${TENTACLE_URL:-$banc_url}"
case "$root" in
  */.claude/worktrees/*) build_name="dev-$(basename "$root")" ;;
  *) build_name="dev" ;;
esac
build_name="${TENTACLE_BUILD:-$build_name}"
app="$cache/build/$build_name/Tentacle.app"

die() { echo "dev : $*" >&2; exit 1; }

build() {
  "$root/scripts/build.sh" "$build_name"
  [[ -x "$app/Contents/MacOS/Tentacle" ]] || die "paquet absent après le build : $app"
}

# Le serveur répond-il ? Pour le banc, on dit quoi faire (colima, banc.sh up).
check_server() {
  local code
  code="$(curl -s -o /dev/null -m 5 -w '%{http_code}' "$url/" || true)"
  [[ "$code" != "000" ]] && return 0
  if [[ "$url" == "$banc_url" ]]; then
    if ! colima status >/dev/null 2>&1; then
      die "le banc ne répond pas sur $url et colima est arrêté — lancez : colima start && pnpm banc up"
    fi
    die "le banc ne répond pas sur $url (colima tourne) — lancez : pnpm banc up, puis pnpm banc status"
  fi
  die "$url ne répond pas (TENTACLE_URL)"
}

run() {
  [[ "${1:-}" == "--" ]] && shift   # `pnpm dev -- --mute` : pnpm transmet le « -- »
  local args=() mute="${TENTACLE_MUTE:-}"
  for a in "$@"; do
    [[ "$a" == "--mute" ]] && mute=1
    args+=("$a")
  done
  check_server
  build
  # Son : ouvert pour Damien, sauf --mute. TENTACLE_ALLOW_SOUND est l'interrupteur actuel du
  # lecteur (muet par défaut) ; --mute et TENTACLE_MUTE sont transmis tels quels.
  if [[ -n "$mute" ]]; then
    export TENTACLE_MUTE=1
    unset TENTACLE_ALLOW_SOUND
  else
    export TENTACLE_ALLOW_SOUND=1
  fi
  echo "dev : $url — profil $cache/profiles/dev — son $([[ -n "$mute" ]] && echo coupé || echo ouvert)"
  exec "$app/Contents/MacOS/Tentacle" --url="$url" --profile="$cache/profiles/dev" ${args[@]+"${args[@]}"}
}

banc() {
  [[ "${1:-}" == "--" ]] && shift
  local cmd="${1:-status}"
  if ! colima status >/dev/null 2>&1; then
    [[ "$cmd" == "up" ]] || die "colima est arrêté — lancez : colima start && pnpm banc up"
    colima start
  fi
  "$root/bench/server/banc.sh" "$cmd"
}

cmd="${1:-}"; shift || true
case "$cmd" in
  build) build ;;
  run) run "$@" ;;
  banc) banc "$@" ;;
  *) die "usage : scripts/dev.sh build | run [options de l'app…] | banc [up|status]" ;;
esac
