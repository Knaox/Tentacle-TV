#!/bin/sh
# ==========================================================================
# Tentacle TV — installeur / actualiseur / désinstalleur Linux universel
# --------------------------------------------------------------------------
# Usage :
#   curl -fsSL https://raw.githubusercontent.com/Knaox/Tentacle-TV/main/scripts/install-linux.sh | sh
#
# Désinstallation :
#   curl -fsSL …/install-linux.sh | sh -s -- --uninstall
#
# Détecte la distribution, télécharge le paquet `desktop-v*` correspondant depuis
# les GitHub Releases, vérifie le SHA256 (fichier SHA256SUMS de la release), puis
# installe avec le gestionnaire natif (pacman/apt/dnf/zypper) — ou dépose
# l'AppImage ET l'intègre au menu des applications, ce qu'aucune AppImage ne fait
# d'elle-même. POSIX sh, aucune dépendance bash.
#
# Le lecteur mpv est EMBARQUÉ dans les quatre paquets : il n'y a rien d'autre à
# installer pour lire une vidéo.
#
# Variables d'override (optionnelles) :
#   TENTACLE_FORMAT=pacman|deb|rpm|appimage      force le format
#                                                (utile sur Fedora Atomic, où
#                                                 l'AppImage est choisie d'office)
#   TENTACLE_APPIMAGE_DEST=/chemin/App.AppImage  destination de l'AppImage
# ==========================================================================
set -eu

REPO="Knaox/Tentacle-TV"
API="https://api.github.com/repos/$REPO/releases?per_page=100"
PAQUET="tentacle-tv"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

APPS="$HOME/.local/share/applications"
ICONES="$HOME/.local/share/icons/hicolor/512x512/apps"
ENTREE="$APPS/$PAQUET.desktop"

log() { printf '\033[36m▸ %s\033[0m\n' "$*" >&2; }
err() { printf '\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1; }

need curl || err "curl est requis."
need grep || err "grep est requis."

# ── Élévation de privilèges (inutile pour l'AppImage, et si déjà root) ──
SUDO=""
if [ "$(id -u)" -ne 0 ]; then
  if need sudo; then SUDO="sudo"; elif need doas; then SUDO="doas"; fi
fi

# ── Systèmes à racine IMMUABLE ──
#
# Fedora Atomic (Silverblue, Kinoite, Bazzite, Bluefin), openSUSE MicroOS/Aeon,
# SteamOS : `/usr` y est en lecture seule, et le gestionnaire de paquets
# classique n'installe rien. Le piège est qu'ils EXPOSENT quand même la
# commande — Bazzite embarque un `dnf` qui répond :
#
#   ERROR: Fedora Atomic images utilize rpm-ostree instead (and is discouraged
#   to use).
#
# La détection tombait donc sur `rpm`, téléchargeait 47 Mo, vérifiait leur
# empreinte, et échouait à la dernière ligne. Ces systèmes se testent AVANT le
# gestionnaire, et ils prennent l'AppImage : elle ne touche pas au système,
# n'exige aucun redémarrage, et se met à jour toute seule depuis l'application.
#
# `/run/ostree-booted` est le témoin canonique d'un démarrage ostree — il
# couvre toutes les variantes Fedora Atomic d'un coup, présentes et à venir.
immutable_root() {
  [ -e /run/ostree-booted ] && return 0        # Fedora Atomic, Bluefin, Bazzite
  need rpm-ostree && return 0                  # même famille, filet de sécurité
  need transactional-update && return 0        # openSUSE MicroOS / Aeon
  need steamos-readonly && return 0            # SteamOS
  return 1
}

# ── Détection du format natif ──
detect_format() {
  if immutable_root; then echo appimage; return; fi
  if need pacman; then echo pacman; return; fi
  if need apt-get || need apt; then echo deb; return; fi
  if need dnf || need yum; then echo rpm; return; fi
  if need zypper; then echo rpm; return; fi
  echo appimage
}
FORMAT="${TENTACLE_FORMAT:-$(detect_format)}"
DEST="${TENTACLE_APPIMAGE_DEST:-$HOME/.local/bin/TentacleTV.AppImage}"

case "$FORMAT" in
  pacman)   PAT='\.pkg\.tar\.zst' ;;
  deb)      PAT='\.deb' ;;
  rpm)      PAT='\.rpm' ;;
  appimage) PAT='\.AppImage' ;;
  *) err "Format inconnu : $FORMAT (attendu pacman|deb|rpm|appimage)." ;;
esac

# ── Désinstallation ──
if [ "${1:-}" = "--uninstall" ]; then
  log "Désinstallation ($FORMAT)…"
  case "$FORMAT" in
    pacman) $SUDO pacman -R --noconfirm "$PAQUET" || true ;;
    deb)    $SUDO apt-get remove -y "$PAQUET" || $SUDO dpkg -r "$PAQUET" || true ;;
    rpm)    if need dnf; then $SUDO dnf remove -y "$PAQUET" || true
            elif need yum; then $SUDO yum remove -y "$PAQUET" || true
            else $SUDO zypper --non-interactive remove "$PAQUET" || true; fi ;;
    appimage) rm -f "$DEST" ;;
  esac
  # L'entrée de menu et l'icône ne sont posées à la main que pour l'AppImage ;
  # les retirer inconditionnellement ne coûte rien et évite un lanceur orphelin.
  rm -f "$ENTREE" "$ICONES/$PAQUET.png"
  need update-desktop-database && update-desktop-database "$APPS" >/dev/null 2>&1 || true
  log "Tentacle TV désinstallé ✓"
  exit 0
fi

log "Format détecté : $FORMAT"
if [ -z "${TENTACLE_FORMAT:-}" ] && [ "$FORMAT" = appimage ] && immutable_root; then
  log "Système à racine immuable : l'AppImage est le bon choix ici — elle ne"
  log "touche pas au système et n'exige aucun redémarrage."
  log "Pour superposer le paquet malgré tout : TENTACLE_FORMAT=rpm … puis"
  log "rpm-ostree install ./<paquet>.rpm (redémarrage requis)."
fi

# ── Dernière release desktop-v* portant ce format ──
#
# L'URL est filtrée sur `/download/desktop-v` : le dépôt publie aussi des
# releases `mobile-v*`, `tv-v*` et `server-v*`, et se contenter de l'extension
# reviendrait à faire confiance à l'ordre du JSON.
log "Recherche de la dernière version Tentacle TV pour Linux…"
RELEASES="$(curl -fsSL -H 'Accept: application/vnd.github+json' "$API" || true)"
[ -n "$RELEASES" ] || err "API GitHub injoignable (limite de débit ? réessaie plus tard)."

ASSET_URL="$(printf '%s' "$RELEASES" | grep -oE "https://[^\"]+/download/desktop-v[^\"]+$PAT" | head -1 || true)"
[ -n "$ASSET_URL" ] || err "Aucun paquet $FORMAT trouvé dans les releases desktop-v*."
ASSET_NAME="$(basename "$ASSET_URL")"
TAG="$(printf '%s' "$ASSET_URL" | sed -n 's#.*/download/\(desktop-v[^/]*\)/.*#\1#p')"
SUMS_URL="$(printf '%s' "$RELEASES" | grep -oE "https://[^\"]+/download/$TAG/SHA256SUMS" | head -1 || true)"

log "Téléchargement : $ASSET_NAME ($TAG)"
curl -fL --progress-bar "$ASSET_URL" -o "$TMP/$ASSET_NAME" || err "Téléchargement échoué."

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

# ── Intégration au bureau, pour l'AppImage seule ──
#
# Les paquets natifs posent leur entrée de menu et leurs icônes eux-mêmes. Une
# AppImage, non : sans ce qui suit elle n'apparaît nulle part, ne s'épingle pas,
# et son icône reste celle d'un exécutable anonyme.
# L'icône la plus grande que l'AppImage embarque RÉELLEMENT.
#
# ⚠️ Deux pièges, tous deux mesurés sur l'AppImage publiée :
#
#  1. la taille n'est pas garantie. Le paquet Tauri s'arrête à `256x256@2` —
#     chercher `512x512` ne trouvait rien du tout, et l'application se
#     retrouvait sans icône ;
#  2. les PNG de la RACINE sont des LIENS SYMBOLIQUES vers
#     `usr/share/icons/…`. Extraits seuls, ils pendent dans le vide : `find`
#     les voit, `cp` échoue. D'où `-type f`, qui ne retient que du réel.
#
# On prend donc le plus GROS fichier régulier de l'arbre d'icônes, et on le
# dépose en 512x512 : la recherche d'icône freedesktop traverse les tailles et
# met à l'échelle, elle ne rejette jamais.
#
# `-exec … {} +` plutôt que `find -printf` : ce dernier est une extension GNU.
# La forme retenue est POSIX, et elle survit aux noms à espaces — l'AppImage en
# porte un (« Tentacle TV.png »), et la taille est en tête de ligne.
plus_grosse_icone() {
  # shellcheck disable=SC2086 — `$2` porte « -maxdepth 1 », deux arguments.
  find "$1" $2 -type f -name '*.png' -exec sh -c \
    'for f; do printf "%s %s\n" "$(wc -c < "$f")" "$f"; done' sh {} + 2>/dev/null \
    | sort -rn | head -1 | cut -d' ' -f2-
}

extraire_icone() {
  ( cd "$TMP" && "$DEST" --appimage-extract 'usr/share/icons/*' >/dev/null 2>&1 || true )
  ICONE="$(plus_grosse_icone "$TMP/squashfs-root" "" || true)"
  [ -n "$ICONE" ] && return 0
  ( cd "$TMP" && "$DEST" --appimage-extract '*.png' >/dev/null 2>&1 || true )
  ICONE="$(plus_grosse_icone "$TMP/squashfs-root" "-maxdepth 1" || true)"
}

# La classe de fenêtre, LUE DANS L'APPIMAGE plutôt que devinée.
#
# C'est elle qui rattache la fenêtre ouverte au lanceur : fausse, le bureau
# affiche deux entrées dans la barre des tâches et « épingler » épingle celle
# qui ne relance rien. Elle a changé avec le moteur — `tentacle-desktop` du
# temps de Tauri, `tentacle-tv` sous Electron — et un script qui la devine se
# trompera forcément d'un côté ou de l'autre.
lire_wmclass() {
  # ⚠️ `usr/share/applications/`, PAS la racine : le `.desktop` posé à la racine
  # de l'AppImage est un LIEN SYMBOLIQUE, exactement comme les icônes. Extrait
  # seul il pend dans le vide, `grep` ne lit rien, et on retombait sur le nom
  # deviné — celui-là même qu'on cherche à ne plus deviner.
  ( cd "$TMP" && "$DEST" --appimage-extract 'usr/share/applications/*' >/dev/null 2>&1 || true )
  WMCLASS="$(find "$TMP/squashfs-root" -type f -name '*.desktop' \
             -exec grep -hm1 '^StartupWMClass=' {} + 2>/dev/null \
             | head -1 | cut -d= -f2- || true)"
  [ -n "$WMCLASS" ] || WMCLASS="$PAQUET"
}

integrer_appimage() {
  mkdir -p "$APPS" "$ICONES"
  ICONE=""; extraire_icone
  if [ -n "$ICONE" ]; then
    cp "$ICONE" "$ICONES/$PAQUET.png"
  else
    log "Icône introuvable dans l'AppImage — l'entrée de menu en sera dépourvue."
  fi
  WMCLASS=""; lire_wmclass
  cat > "$ENTREE" <<EOF
[Desktop Entry]
Name=Tentacle TV
Comment=Client Jellyfin premium — lecteur mpv natif, HDR, hors ligne
Exec=$DEST %U
Icon=$PAQUET
Terminal=false
Type=Application
Categories=AudioVideo;Video;Player;
Keywords=jellyfin;media;video;film;serie;streaming;
StartupWMClass=$WMCLASS
EOF
  chmod 0644 "$ENTREE"
  need update-desktop-database && update-desktop-database "$APPS" >/dev/null 2>&1 || true
  # Sans rafraîchir le cache, l'icône n'apparaît qu'à la session suivante sur
  # les bureaux GTK.
  need gtk-update-icon-cache && \
    gtk-update-icon-cache -f -t "$HOME/.local/share/icons/hicolor" >/dev/null 2>&1 || true
}

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
    mkdir -p "$(dirname "$DEST")"
    install -m 0755 "$TMP/$ASSET_NAME" "$DEST"
    integrer_appimage
    log "AppImage installée : $DEST"
    log "Entrée de menu posée : $ENTREE"
    # Le runtime AppImage monte son image par FUSE. Sans lui, rien ne se lance —
    # et le message d'erreur ne le dit pas clairement.
    need fusermount || need fusermount3 || \
      log "FUSE absent : installe « fuse2 » (Arch) / « libfuse2t64 » (Ubuntu), ou lance avec --appimage-extract-and-run."
    case ":$PATH:" in *":$(dirname "$DEST"):"*) ;; *) log "Ajoute $(dirname "$DEST") à ton PATH pour la lancer au terminal." ;; esac
    ;;
esac

log "Tentacle TV installé ✓ — lance-le depuis ton menu d'applications."
