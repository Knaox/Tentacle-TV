#!/usr/bin/env bash
# Lanceur macOS et Linux. Il se place à côté du script, trouve Node.js — ou en
# installe une copie PORTABLE s'il manque —, lance l'installateur, et garde la
# fenêtre ouverte à la fin : sans quoi un double-clic depuis le Finder referme
# le terminal avant qu'on ait pu lire quoi que ce soit, message d'erreur compris.
#
# La copie portable vit dans ~/.tentacle-tv/node : aucun droit administrateur,
# rien d'installé dans le système, et elle sert aux exécutions suivantes. Elle
# vient de nodejs.org et son empreinte SHA-256 est vérifiée avant usage.
set -u
cd "$(dirname "$0")" || exit 1

NODE_LINE="latest-v22.x"
NODE_HOME="$HOME/.tentacle-tv/node"

close_window() {
  printf '\n  Appuyez sur Entrée pour fermer. '
  read -r _ || true
}

portable_node() {
  local os arch archive base sums file
  case "$(uname -s)" in
    Darwin) os=darwin ;;
    Linux) os=linux ;;
    *) return 1 ;;
  esac
  case "$(uname -m)" in
    x86_64 | amd64) arch=x64 ;;
    arm64 | aarch64) arch=arm64 ;;
    *) return 1 ;;
  esac
  base="https://nodejs.org/dist/$NODE_LINE"
  printf '\n  Node.js est absent : installation d'"'"'une copie portable (une seule fois)…\n'
  sums="$(curl -fsSL "$base/SHASUMS256.txt")" || return 1
  file="$(printf '%s\n' "$sums" | awk -v s="-$os-$arch.tar.gz" '$2 ~ s"$" {print $2; exit}')"
  [ -n "$file" ] || return 1
  archive="$(mktemp -d)/$file"
  curl -fsSL -o "$archive" "$base/$file" || return 1
  local expected actual
  expected="$(printf '%s\n' "$sums" | awk -v f="$file" '$2 == f {print $1}')"
  if command -v sha256sum >/dev/null 2>&1; then
    actual="$(sha256sum "$archive" | awk '{print $1}')"
  else
    actual="$(shasum -a 256 "$archive" | awk '{print $1}')"
  fi
  if [ "$expected" != "$actual" ]; then
    printf '  Empreinte SHA-256 inattendue pour %s : téléchargement refusé.\n' "$file"
    return 1
  fi
  rm -rf "$NODE_HOME"
  mkdir -p "$NODE_HOME"
  tar -xzf "$archive" -C "$NODE_HOME" --strip-components=1 || return 1
  printf '  ✓ Node.js portable installé dans %s\n' "$NODE_HOME"
}

if ! command -v node >/dev/null 2>&1; then
  if [ -x "$NODE_HOME/bin/node" ] || portable_node; then
    # npm, livré avec la copie portable, doit être trouvé par l'installateur.
    export PATH="$NODE_HOME/bin:$PATH"
  else
    cat <<'MESSAGE'

  Node.js n'a pas pu être installé automatiquement.

  Installez la version « LTS » depuis https://nodejs.org, puis relancez
  ce script. Rien d'autre n'est requis.

MESSAGE
    close_window
    exit 1
  fi
fi

node installer.mjs
issue=$?

close_window
exit $issue
