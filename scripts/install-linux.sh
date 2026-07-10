#!/bin/sh
# ==========================================================================
# Tentacle TV — installeur / actualiseur Linux universel
# --------------------------------------------------------------------------
# Usage :
#   curl -fsSL https://raw.githubusercontent.com/Knaox/Tentacle-TV/main/scripts/install-linux.sh | sh
#
# Détecte la distribution, télécharge le dernier paquet `linux-v*` correspondant
# depuis les GitHub Releases, vérifie le SHA256 (fichier SHA256SUMS de la
# release), puis installe avec le gestionnaire natif (pacman/apt/dnf/zypper) ou
# dépose l'AppImage. POSIX sh — aucune dépendance bash.
#
# Variables d'override (optionnelles) :
#   TENTACLE_FORMAT=pacman|deb|rpm|appimage   force le format
#   TENTACLE_APPIMAGE_DEST=/chemin/App.AppImage  destination de l'AppImage
# ==========================================================================
set -eu

REPO="Knaox/Tentacle-TV"
API="https://api.github.com/repos/$REPO/releases?per_page=100"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

log() { printf '\033[36m▸ %s\033[0m\n' "$*" >&2; }
err() { printf '\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1; }

need curl || err "curl est requis."
need grep || err "grep est requis."

# ── Élévation de privilèges (sauf pour l'AppImage / si déjà root) ──
SUDO=""
if [ "$(id -u)" -ne 0 ]; then
  if need sudo; then SUDO="sudo"; elif need doas; then SUDO="doas"; fi
fi

# ── Détection du format natif ──
detect_format() {
  if need pacman; then echo pacman; return; fi
  if need apt-get || need apt; then echo deb; return; fi
  if need dnf || need yum; then echo rpm; return; fi
  if need zypper; then echo rpm; return; fi
  echo appimage
}
FORMAT="${TENTACLE_FORMAT:-$(detect_format)}"
log "Format détecté : $FORMAT"

case "$FORMAT" in
  pacman)   PAT='\.pkg\.tar\.zst' ;;
  deb)      PAT='\.deb' ;;
  rpm)      PAT='\.rpm' ;;
  appimage) PAT='\.AppImage' ;;
  *) err "Format inconnu : $FORMAT (attendu pacman|deb|rpm|appimage)." ;;
esac

# ── Dernière release linux-v* : 1er asset correspondant (JSON trié newest-first,
#    seules les releases linux-v* portent ces assets). ──
log "Recherche de la dernière version Tentacle TV pour Linux…"
RELEASES="$(curl -fsSL -H 'Accept: application/vnd.github+json' "$API" || true)"
[ -n "$RELEASES" ] || err "API GitHub injoignable (limite de débit ? réessaie plus tard)."

ASSET_URL="$(printf '%s' "$RELEASES" | grep -oE "https://[^\"]+$PAT" | head -1 || true)"
[ -n "$ASSET_URL" ] || err "Aucun paquet $FORMAT trouvé dans les releases GitHub."
ASSET_NAME="$(basename "$ASSET_URL")"
SUMS_URL="$(printf '%s' "$RELEASES" | grep -oE 'https://[^"]+/SHA256SUMS' | head -1 || true)"

log "Téléchargement : $ASSET_NAME"
curl -fL "$ASSET_URL" -o "$TMP/$ASSET_NAME" || err "Téléchargement échoué."

# ── Vérification SHA256 (si la release publie un SHA256SUMS) ──
if [ -n "$SUMS_URL" ] && need sha256sum; then
  curl -fsSL "$SUMS_URL" -o "$TMP/SHA256SUMS" 2>/dev/null || true
  if [ -s "$TMP/SHA256SUMS" ]; then
    EXPECT="$(grep -F "$ASSET_NAME" "$TMP/SHA256SUMS" | awk '{print $1}' | head -1)"
    if [ -n "$EXPECT" ]; then
      ACTUAL="$(sha256sum "$TMP/$ASSET_NAME" | awk '{print $1}')"
      [ "$EXPECT" = "$ACTUAL" ] || err "SHA256 invalide (attendu $EXPECT, obtenu $ACTUAL) — téléchargement corrompu ou altéré."
      log "SHA256 vérifié ✓"
    fi
  fi
fi

# ── Installation ──
log "Installation ($FORMAT)…"
case "$FORMAT" in
  pacman)
    [ -n "$SUDO" ] || [ "$(id -u)" -eq 0 ] || err "pacman requiert les droits root (installe sudo ou lance en root)."
    $SUDO pacman -U --noconfirm "$TMP/$ASSET_NAME"
    ;;
  deb)
    [ -n "$SUDO" ] || [ "$(id -u)" -eq 0 ] || err "dpkg/apt requiert les droits root."
    if need apt-get; then $SUDO apt-get install -y "$TMP/$ASSET_NAME";
    else $SUDO dpkg -i "$TMP/$ASSET_NAME" || $SUDO apt-get -f install -y; fi
    ;;
  rpm)
    [ -n "$SUDO" ] || [ "$(id -u)" -eq 0 ] || err "dnf/rpm requiert les droits root."
    if need dnf; then $SUDO dnf install -y "$TMP/$ASSET_NAME";
    elif need yum; then $SUDO yum install -y "$TMP/$ASSET_NAME";
    else $SUDO zypper --non-interactive install --allow-unsigned-rpm "$TMP/$ASSET_NAME"; fi
    ;;
  appimage)
    DEST="${TENTACLE_APPIMAGE_DEST:-$HOME/.local/bin/TentacleTV.AppImage}"
    mkdir -p "$(dirname "$DEST")"
    install -m 0755 "$TMP/$ASSET_NAME" "$DEST"
    log "AppImage installée : $DEST"
    log "Pré-requis lecture vidéo : mpv gst-plugins-good gst-plugins-bad gst-libav (+ fuse2)."
    log "Ajoute ~/.local/bin au PATH si nécessaire."
    ;;
esac

log "Tentacle TV installé ✓  — lance-le depuis ton menu d'applications ou via « tentacle-tv »."
