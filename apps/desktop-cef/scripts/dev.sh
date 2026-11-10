#!/usr/bin/env bash
# Commandes de développement : `pnpm dev:cef` à la racine du monorepo, et les scripts du
# package.json (pnpm --filter @tentacle-tv/desktop-cef dev | dev:server | build | banc).
#
#   scripts/dev.sh run [opts…]         build web (coquille de bureau) + build natif, puis
#                                      l'app sur le PROFIL D'ELECTRON (voir « Profil »)
#   scripts/dev.sh run-server [opts…]  mode des bancs : page servie par $TENTACLE_URL (défaut :
#                                      le banc), profil à part $cache/profiles/dev, données
#                                      natives à part $cache/profiles/dev-data
#   scripts/dev.sh build               le build natif seul (Release)
#   scripts/dev.sh banc [up|status]    banc local (colima + Tentacle 1.42.0 + Jellyfin)
#
# Options de `run` : --skip-web (garde apps/web/dist tel quel), --mute (son coupé, comme
# TENTACLE_MUTE=1) ; toute autre option va à l'app (--size=1440x900, --devtools-port=9300…).
# Variables : TENTACLE_ELECTRON_PROFILE (autre profil d'Electron), TENTACLE_URL (adresse du
# serveur posée dans le front s'il n'en a aucune), TENTACLE_BUILD (dossier de build).
#
# Dossier de build : `tv` (ou `tv-<worktree>`) — jamais `dev`, qu'occupe le dépôt d'origine
# du prototype : CMake refuse qu'un même dossier serve deux sources.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
repo="$(cd "$root/../.." && pwd)"
cache="${TENTACLE_CEF_CACHE:-$HOME/.cache/tentacle-cef}"
banc_url="http://127.0.0.1:3471"
case "$root" in
  */.claude/worktrees/*) build_name="tv-$(basename "$(dirname "$(dirname "$root")")")" ;;
  *) build_name="tv" ;;
esac
build_name="${TENTACLE_BUILD:-$build_name}"
app="$cache/build/$build_name/Tentacle.app"

die() { echo "dev : $*" >&2; exit 1; }

build() {
  "$root/scripts/build.sh" "$build_name"
  [[ -x "$app/Contents/MacOS/Tentacle" ]] || die "paquet absent après le build : $app"
}

# Le build web d'Electron en développement (desktop-electron : build:web:debug) : même
# dossier apps/web/dist, mêmes drapeaux — les deux coquilles servent le même front.
build_web() {
  [[ -f "$repo/pnpm-workspace.yaml" ]] || die "monorepo introuvable au-dessus de $root"
  (cd "$repo" && TENTACLE_SHELL=electron TENTACLE_DEBUG=1 pnpm --filter @tentacle-tv/web build)
}

# Son : ouvert, sauf --mute ou TENTACLE_MUTE. TENTACLE_ALLOW_SOUND est l'interrupteur du
# lecteur (muet par défaut) ; --mute et TENTACLE_MUTE sont transmis tels quels.
sound_env() {
  if [[ -n "$1" ]]; then
    export TENTACLE_MUTE=1
    unset TENTACLE_ALLOW_SOUND
  else
    export TENTACLE_ALLOW_SOUND=1
  fi
}

# --- Profil ------------------------------------------------------------------------------
# Le profil d'Electron est le dossier que `pnpm dev:electron` donne à userData
# (apps/desktop-electron/src/main/dataPaths.ts : Application Support/<identifiant de l'ex-app
# Tauri> sous macOS, $XDG_DATA_HOME ou ~/.local/share sous Linux). L'identifiant est RELU dans
# ce fichier : s'il change là-bas, il change ici. L'app du Mac App Store, elle, vit dans son
# conteneur (bac à sable) : à viser explicitement par TENTACLE_ELECTRON_PROFILE.
electron_profile() {
  if [[ -n "${TENTACLE_ELECTRON_PROFILE:-}" ]]; then
    echo "${TENTACLE_ELECTRON_PROFILE%/}"
    return
  fi
  local id xdg
  id="$(sed -n 's/^export const TAURI_IDENTIFIER = "\(.*\)";$/\1/p' \
    "$repo/apps/desktop-electron/src/main/dataPaths.ts")"
  [[ -n "$id" ]] || die "identifiant du profil introuvable dans apps/desktop-electron/src/main/dataPaths.ts"
  case "$(uname -s)" in
    Darwin) echo "$HOME/Library/Application Support/$id" ;;
    Linux)
      xdg="${XDG_DATA_HOME:-}"
      [[ "$xdg" == /* ]] || xdg="$HOME/.local/share"
      echo "$xdg/$id" ;;
    *) die "système non pris en charge par le lanceur : $(uname -s)" ;;
  esac
}

# PARTAGÉ avec Electron : ce que le front range sous son origine tentacle://app —
# `Local Storage` (jeton, adresse du serveur, réglages) et `IndexedDB` (cache d'Octave,
# pochettes gardées). Des liens depuis le profil CEF : ce que l'un écrit, l'autre le relit.
# PAS partagé : le reste du profil Chromium. CEF (Chromium 156, profil sous Default/,
# trousseau factice) n'a ni la disposition, ni la clé des cookies, ni la version de Chromium
# d'Electron ; y mêler ses cookies, son cache ou son historique abîmerait ceux d'Electron.
shared_storage=("Local Storage" "IndexedDB")

# La racine du profil CEF (état de Chromium, caches du GPU…) reste hors du dossier
# d'Electron ; une par profil d'Electron visé.
cef_profile_for() {
  if [[ -z "${TENTACLE_ELECTRON_PROFILE:-}" ]]; then
    echo "$cache/profiles/electron"
  else
    echo "$cache/profiles/electron-$(printf '%s' "$1" | cksum | cut -d' ' -f1)"
  fi
}

# Jamais Electron et CEF sur les mêmes bases LevelDB en même temps : le second n'obtient pas
# leur verrou (LOCK) et tourne sur un stockage EN MÉMOIRE — déconnecté, et ce qu'il écrit est
# perdu à la fermeture. On refuse de lancer tant qu'un processus les tient.
guard_profile_free() {
  local profile="$1" holders=() target pid lock
  # Electron pose SingletonLock (requestSingleInstanceLock) : un lien « hôte-pid ».
  if target="$(readlink "$profile/SingletonLock" 2>/dev/null)"; then
    pid="${target##*-}"
    if [[ "${target%-*}" == "$(hostname)" ]] && kill -0 "$pid" 2>/dev/null; then holders+=("$pid"); fi
  fi
  for lock in "$profile/Local Storage/leveldb/LOCK" "$profile"/IndexedDB/*/LOCK; do
    [[ -e "$lock" ]] || continue
    while read -r pid; do
      [[ -n "$pid" ]] && holders+=("$pid")
    done < <(lsof -t -- "$lock" 2>/dev/null || true)
  done
  ((${#holders[@]} == 0)) && return 0
  echo "dev : le profil d'Electron est ouvert par un autre processus :" >&2
  printf '%s\n' "${holders[@]}" | sort -u | while read -r pid; do
    echo "  $(ps -o pid=,comm= -p "$pid" 2>/dev/null || echo "$pid")" >&2
  done
  die "fermer Tentacle TV (Electron) — ou l'autre Tentacle CEF — puis relancer"
}

prepare_profile() {
  local electron="$1" cef="$2" name link
  if [[ ! -d "$electron" ]]; then
    echo "dev : profil d'Electron absent, créé : $electron (pnpm dev:electron le reprendra)"
  fi
  mkdir -p "$cef/Default"
  for name in "${shared_storage[@]}"; do
    mkdir -p "$electron/$name"
    link="$cef/Default/$name"
    if [[ -L "$link" ]]; then
      [[ "$(readlink "$link")" == "$electron/$name" ]] && continue
      rm "$link"
    elif [[ -e "$link" ]]; then
      # Un stockage propre à CEF (lancement d'avant le partage) : mis de côté, jamais effacé.
      mv "$link" "$link.cef-$(date +%Y%m%d-%H%M%S)"
    fi
    ln -s "$electron/$name" "$link"
  done
}

# --- Commandes ---------------------------------------------------------------------------
run() {
  [[ "${1:-}" == "--" ]] && shift   # `pnpm dev -- --mute` : pnpm transmet le « -- »
  local args=() mute="${TENTACLE_MUTE:-}" skip_web="" a electron cef version
  for a in "$@"; do
    case "$a" in
      --skip-web) skip_web=1 ;;
      --mute) mute=1; args+=("$a") ;;
      *) args+=("$a") ;;
    esac
  done
  electron="$(electron_profile)"
  cef="$(cef_profile_for "$electron")"
  guard_profile_free "$electron"   # avant les builds : inutile d'attendre pour rien
  [[ -n "$skip_web" ]] || build_web
  [[ -f "$repo/apps/web/dist/index.html" ]] || die "apps/web/dist absent : relancer sans --skip-web"
  build
  guard_profile_free "$electron"   # et juste avant de l'ouvrir
  prepare_profile "$electron" "$cef"
  version="$(node -p 'require(process.argv[1]).desktop' "$repo/versions.json")"
  [[ -n "${TENTACLE_URL:-}" ]] && args=("--server-url=$TENTACLE_URL" ${args[@]+"${args[@]}"})
  sound_env "$mute"
  echo "dev : tentacle://app ($repo/apps/web/dist) — profil d'Electron $electron — son $([[ -n "$mute" ]] && echo coupé || echo ouvert)"
  # Chromium diffère l'écriture du stockage et ne la termine qu'à une fermeture normale :
  # Ctrl+C tue aussi ses helpers, le service de stockage avec (mesuré : écriture perdue).
  echo "dev : quitter par Cmd+Q ou la fenêtre — Ctrl+C perd ce que le front vient d'écrire"
  # --user-data : le dossier de données des modules natifs (shell/paths.h : octave-art/,
  # tentacle-local.db…) est le profil d'Electron visé, celui dont le front partage le stockage.
  exec "$app/Contents/MacOS/Tentacle" --url=tentacle://app/ --web-root="$repo/apps/web/dist" \
    --profile="$cef" --user-data="$electron" --app-version="$version" ${args[@]+"${args[@]}"}
}

# Le serveur répond-il ? Pour le banc, on dit quoi faire (colima, banc.sh up).
check_server() {
  local url="$1" code
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

run_server() {
  [[ "${1:-}" == "--" ]] && shift
  local url="${TENTACLE_URL:-$banc_url}" args=() mute="${TENTACLE_MUTE:-}" a
  for a in "$@"; do
    [[ "$a" == "--mute" ]] && mute=1
    args+=("$a")
  done
  check_server "$url"
  build
  sound_env "$mute"
  echo "dev : $url — profil $cache/profiles/dev — son $([[ -n "$mute" ]] && echo coupé || echo ouvert)"
  # --user-data à part : sans lui, les modules natifs (shell/paths.h : octave-art/, tentacle-local.db…)
  # écriraient dans le VRAI dossier d'Electron. Les bancs n'y touchent jamais.
  exec "$app/Contents/MacOS/Tentacle" --url="$url" --profile="$cache/profiles/dev" \
    --user-data="$cache/profiles/dev-data" ${args[@]+"${args[@]}"}
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
  run-server) run_server "$@" ;;
  banc) banc "$@" ;;
  *) die "usage : scripts/dev.sh build | run [--skip-web] [options de l'app…] | run-server [options…] | banc [up|status]" ;;
esac
