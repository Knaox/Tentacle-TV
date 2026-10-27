#!/bin/bash
# ════════════════════════════════════════════════════════════════════════
# Banc lg8 (lisibilité) — neuf clips FIXES posés dans le Jellyfin jetable du
# banc (`jellyfin.sh` d'abord) : chaque film « Lisibilité <nom> » est une seule
# image tenue 60 s. Image fixe = la capture « avec » et « sans » les textes ne
# diffèrent QUE par eux (le contraste se mesure par différence, cf. legibility.mjs).
#
#   lg8/clips.sh <dossier-d'état>
#
# Les cas : blanc pur, noir pur, gris 50 %, jaune vif, rouge, bleu, pastel clair
# façon dessin animé (le cas de la capture de Damien), bruit très contrasté,
# dégradé noir → blanc (de gauche à droite : chaque contrôle tombe sur un autre fond).
# ════════════════════════════════════════════════════════════════════════
set -euo pipefail
STATE="$(cd "$1" && pwd)"
JF=http://127.0.0.1:18307
KEY=$(cat "$STATE/jf/api-key")
OUT="$STATE/media-lg8"
mkdir -p "$OUT/frames"
ff() { ffmpeg -loglevel error -y "$@"; }
S=1920x1080

frame() { # nom source-lavfi
  [ -f "$OUT/frames/$1.png" ] || ff -f lavfi -i "$2" -frames:v 1 "$OUT/frames/$1.png"
}
frame blanc  "color=c=0xFFFFFF:s=$S"
frame noir   "color=c=0x000000:s=$S"
frame gris   "color=c=0x808080:s=$S"
frame jaune  "color=c=0xFFE600:s=$S"
frame rouge  "color=c=0xE0201B:s=$S"
frame bleu   "color=c=0x1E5BFF:s=$S"
# Pastel : un salon de dessin animé — mur crème, baie vitrée gris-bleu, canapé
# vert d'eau, table claire, traits noirs. Le bas de l'image (là où vivent les
# contrôles) reste très clair, comme sur la capture de Damien.
frame pastel "color=c=0xF1E3B5:s=$S,\
drawbox=x=420:y=110:w=1500:h=620:c=0xC9DCE2:t=fill,drawbox=x=420:y=110:w=1500:h=620:c=black:t=6,\
drawbox=x=1150:y=110:w=20:h=620:c=0x6B7F86:t=fill,\
drawbox=x=60:y=600:w=900:h=480:c=0xCFE7CB:t=fill,drawbox=x=60:y=600:w=900:h=480:c=black:t=5,\
drawbox=x=980:y=840:w=900:h=240:c=0xF6F3EA:t=fill,drawbox=x=980:y=840:w=900:h=240:c=black:t=5,\
drawbox=x=520:y=880:w=180:h=200:c=0xF3B6D8:t=fill,drawbox=x=520:y=880:w=180:h=200:c=black:t=4,\
drawbox=x=300:y=500:w=160:h=580:c=0xFFE48A:t=fill,drawbox=x=300:y=500:w=160:h=580:c=black:t=4"
# Bruit noir/blanc en blocs de 8 px : le pire cas pour un texte sans voile.
frame bruit  "nullsrc=s=240x135,geq=lum='255*gt(random(1)\,0.5)':cb=128:cr=128,format=rgb24,scale=$S:flags=neighbor"
frame degrade "nullsrc=s=$S,geq=lum='255*X/W':cb=128:cr=128,format=rgb24"

declare -a NAMES=(blanc noir gris jaune rouge bleu pastel bruit degrade)
declare -a TITLES=("Blanc" "Noir" "Gris" "Jaune" "Rouge" "Bleu" "Pastel" "Bruit" "Dégradé")
for i in "${!NAMES[@]}"; do
  n=${NAMES[$i]}; t="Lisibilité ${TITLES[$i]}"; d="$OUT/films/$t (2026)"
  mkdir -p "$d"
  [ -f "$d/$t.mkv" ] || ff -loop 1 -framerate 24 -i "$OUT/frames/$n.png" -f lavfi -i "anullsrc=r=48000:cl=stereo" -t 60 \
    -c:v libx264 -preset veryfast -tune stillimage -pix_fmt yuv420p -color_range tv \
    -color_primaries bt709 -color_trc bt709 -colorspace bt709 -c:a aac -b:a 64k "$d/$t.mkv"
  [ -f "$d/poster.jpg" ] || ff -i "$OUT/frames/$n.png" -vf "scale=600:900:force_original_aspect_ratio=increase,crop=600:900" -q:v 3 "$d/poster.jpg"
  printf '<movie><title>%s</title><year>2026</year><plot>Clip fixe du banc de lisibilité lg8.</plot><genre>Documentaire</genre><runtime>1</runtime><lockdata>true</lockdata></movie>\n' "$t" > "$d/movie.nfo"
done
docker exec lg-banc-jf mkdir -p /media/films
docker cp "$OUT/films/." lg-banc-jf:/media/films/
curl -fsS -o /dev/null -X POST "$JF/Library/Refresh?api_key=$KEY"
for _ in $(seq 1 60); do
  n=$(curl -fsS "$JF/Items?Recursive=true&IncludeItemTypes=Movie&SearchTerm=Lisibilit&api_key=$KEY" | python3 -c "import sys,json;print(json.load(sys.stdin)['TotalRecordCount'])")
  [ "$n" -ge 9 ] && break; sleep 2
done
echo "[lg8] clips de lisibilité : $n / 9 dans le Jellyfin jetable"
