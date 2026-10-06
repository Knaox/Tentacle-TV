#!/bin/sh
# Vérification Linux + Podman + GPU de la pile complète — PRÉPARÉE, PAS ENCORE
# VALIDÉE sur un vrai matériel (docs/server/gpu.md, section Podman).
#
#   sh linux-podman-gpu.sh intel|amd|nvidia
#
# À lancer sur la machine Linux, dans un dossier vide. Il dit l'état de l'hôte
# (Podman avec ou sans root, /dev/dri, groupe render, CDI NVIDIA), monte la
# pile avec les lignes GPU de la doc, puis donne la check-list à suivre à la
# main. Variables : COMPOSE_URL (une autre pile que celle de main),
# TENTACLE_VERSION (l'image à éprouver).
set -eu
GPU="${1:-intel}"
COMPOSE_URL="${COMPOSE_URL:-https://raw.githubusercontent.com/Knaox/Tentacle-TV/main/stacks/tentacle-full/compose.yaml}"

say() { printf '\n== %s\n' "$*"; }

say "Podman sans root ?"
ROOTLESS="$(podman info --format '{{.Host.Security.Rootless}}')"
echo "$ROOTLESS"

say "podman compose disponible ?"
podman compose version

case "$GPU" in
  intel|amd)
    say "Le périphérique de rendu"
    ls -l /dev/dri
    say "Le groupe render"
    RENDER_GID="$(getent group render | cut -d: -f3)"
    echo "gid $RENDER_GID"
    id -nG | tr ' ' '\n' | grep -qx render && echo "votre compte est dans render" || echo "ATTENTION : votre compte n'est pas dans render"
    command -v vainfo >/dev/null && vainfo || echo "vainfo absent (paquet libva-utils) : codecs non vérifiés"
    ;;
  nvidia)
    say "NVIDIA : spécification CDI"
    command -v nvidia-ctk >/dev/null || { echo "nvidia-container-toolkit absent"; exit 1; }
    nvidia-ctk cdi list | grep -q 'nvidia.com/gpu' || echo "pas de spécification CDI : sudo nvidia-ctk cdi generate --output=/etc/cdi/nvidia.yaml"
    ;;
  *)
    echo "usage : sh linux-podman-gpu.sh intel|amd|nvidia"; exit 2
    ;;
esac

say "La pile complète, avec les lignes GPU de la doc"
curl -fsSLo compose.yaml "$COMPOSE_URL"
[ -n "${TENTACLE_VERSION:-}" ] && echo "TENTACLE_VERSION=$TENTACLE_VERSION" > .env
{
  echo "services:"
  echo "  jellyfin:"
  if [ "$GPU" = nvidia ]; then
    echo '    devices: ["nvidia.com/gpu=all"]'
  elif [ "$ROOTLESS" = true ]; then
    echo '    devices: ["/dev/dri:/dev/dri"]'
    echo '    userns_mode: keep-id'
    echo '    group_add: ["keep-groups"]'
  else
    echo '    devices: ["/dev/dri:/dev/dri"]'
    echo "    group_add: [\"$RENDER_GID\"]"
  fi
} > compose.override.yaml
cat compose.override.yaml
podman compose up -d
sleep 10
podman compose logs tentacle 2>&1 | grep "code d'installation" || echo "(code pas encore annoncé : podman compose logs tentacle)"
if [ "$GPU" != nvidia ]; then
  say "Le périphérique vu depuis Jellyfin"
  podman compose exec jellyfin sh -c 'id; ls -l /dev/dri'
fi

say "À faire à la main"
cat <<'TXT'
1. Mener l'assistant (le code ci-dessus) jusqu'au bout, avec le compte Knaoxtest.
2. Jellyfin › Tableau de bord › Lecture › Transcodage : VA-API (AMD), QSV ou VA-API (Intel), NVENC (NVIDIA).
3. Lire un film qui exige un transcodage (débit bas forcé dans le lecteur).
4. Sur l'hôte, intel_gpu_top / radeontop / nvidia-smi montrent l'activité ; Jellyfin › Tableau de bord
   › Activité dit le transcodage matériel.
5. Noter le résultat dans docs/server/gpu.md (et sa traduction) : distribution, Podman, GPU, montage
   (avec ou sans root), ce qui a marché. Si /dev/dri est vu mais refusé sans root, c'est la limite
   connue de keep-groups : le dire, sans passer le périphérique en 666.
TXT
