#!/usr/bin/env bash
# Télécharge la distribution CEF épinglée dans $TENTACLE_CEF_CACHE/deps/cef/<version>.
# Idempotent : ne refait rien si le dossier contient déjà include/cef_version.h.
# Usage : scripts/deps/fetch-cef.sh   (imprime le chemin de CEF sur la dernière ligne)
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=cef-version.env
source "$here/cef-version.env"

cache="${TENTACLE_CEF_CACHE:-$HOME/.cache/tentacle-cef}"
dest="$cache/deps/cef/$CEF_VERSION"
if [[ -f "$dest/include/cef_version.h" ]]; then
  echo "CEF déjà présent : $dest" >&2
  echo "$dest"
  exit 0
fi

# Garde-fou du lot : pas de gros téléchargement en partage de connexion.
if route -n get default 2>/dev/null | grep -q 'gateway: 172.20.10.1'; then
  echo "Partage de connexion détecté : téléchargement de CEF (~135 Mo) refusé." >&2
  exit 2
fi

name="cef_binary_${CEF_VERSION}_${CEF_PLATFORM}_minimal"
url="https://cef-builds.spotifycdn.com/${name//+/%2B}.tar.bz2"
dl="$cache/deps/cef/.dl"
mkdir -p "$dl"
archive="$dl/$name.tar.bz2"

if [[ ! -f "$archive" ]] || [[ "$(shasum -a 1 "$archive" | cut -d' ' -f1)" != "$CEF_SHA1" ]]; then
  echo "Téléchargement de $url" >&2
  curl -fL --retry 3 -o "$archive.part" "$url"
  mv "$archive.part" "$archive"
fi
actual="$(shasum -a 1 "$archive" | cut -d' ' -f1)"
if [[ "$actual" != "$CEF_SHA1" ]]; then
  echo "SHA1 inattendu : $actual (attendu $CEF_SHA1)" >&2
  exit 1
fi

# Extraction dans un dossier temporaire puis renommage atomique.
tmp="$dl/extract.$$"
rm -rf "$tmp" && mkdir -p "$tmp"
tar -xjf "$archive" -C "$tmp"
mkdir -p "$(dirname "$dest")"
mv "$tmp/$name" "$dest"
rm -rf "$tmp" "$archive"
echo "CEF prêt : $dest" >&2
echo "$dest"
