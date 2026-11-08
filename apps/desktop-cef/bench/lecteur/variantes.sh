#!/usr/bin/env bash
# Variantes RÉALISTES des titres « Pistes » du banc, pour le proxy lent : mêmes flux (vidéo,
# audio fra/eng, sous-titres fra/eng, même ordre), mais des répliques de 2,5 s toutes les 3 s
# et des clusters de 2 s. Les originaux ont deux répliques de ~29 s : avec un sous-titre actif,
# le préroulage de mpv recule jusqu'au début de la réplique en cours, d'où une relecture de
# jusqu'à 29 s à chaque bascule — un cas d'école, pas un film.
# Sortie (stdout) : une ligne `<id Jellyfin>=<fichier>` par titre, pour `proxy-lent.mjs`.
#   bench/lecteur/variantes.sh
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
CACHE="${TENTACLE_CEF_CACHE:-$HOME/.cache/tentacle-cef}"
M="$CACHE/build/lecteur/media"; mkdir -p "$M"

python3 -I - "$M" <<'EOF'
import sys
for lang, txt in (("fr", "Réplique FR"), ("en", "EN line")):
    with open(f"{sys.argv[1]}/{lang}.srt", "w") as f:
        for i in range(20):
            a, b = 1 + i * 3, 1 + i * 3 + 2.5
            ts = lambda s: f"00:{int(s)//60:02d}:{int(s)%60:02d},{int(round((s%1)*1000)):03d}"
            f.write(f"{i+1}\n{ts(a)} --> {ts(b)}\n{txt} {i+1}\n\n")
EOF
for t in "Banc HDR10 Pistes" "Banc Dolby Vision Pistes"; do
  src=$(ls "$CACHE/media/films/$t (2026)/"*.mkv)
  out="$M/$t.mkv"
  [[ -f "$out" ]] || ffmpeg -v error -y -i "$src" -i "$M/fr.srt" -i "$M/en.srt" \
    -map 0:0 -map 0:1 -map 0:2 -map 1:0 -map 2:0 -c copy \
    -metadata:s:3 language=fra -metadata:s:4 language=eng -cluster_time_limit 2000 "$out"
  id=$(cd "$ROOT" && node --input-type=module -e "
    import { findItem } from './web/shim/dev/drive.mjs';
    console.log((await findItem(process.argv[1])).item.Id);" "$t")
  echo "$id=$out"
done
