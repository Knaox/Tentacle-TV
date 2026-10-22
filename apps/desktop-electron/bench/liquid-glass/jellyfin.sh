#!/bin/bash
# ════════════════════════════════════════════════════════════════════════
# Banc Liquid Glass — un Jellyfin 10.11 JETABLE (jamais le Jellyfin réel :
# dev et prod le partagent). Conteneur `lg-banc-jf` sur 127.0.0.1:18307.
#
#   jellyfin.sh <dossier-d'état>
#
# Pose : douze films aux affiches et fonds COLORÉS (dégradés — ce que le verre
# réfracte), dont « Banc HDR10 » (HEVC Main10 PQ BT.2020, la lecture HDR) et
# « Banc SDR » (H.264 BT.709) ; une série « Écume » (2 saisons × 3 épisodes,
# panneau des épisodes du lecteur). Comptes : `admin` (l'administrateur) et
# `Knaoxtest` (le compte de test du banc, NON admin). Mots de passe générés,
# écrits dans <état>/jf/ (0600), jamais imprimés.
# Arrêt : docker rm -f lg-banc-jf && docker volume rm lg-banc-jf-{config,cache,media}
# ════════════════════════════════════════════════════════════════════════
set -euo pipefail
STATE="$(mkdir -p "$1" && cd "$1" && pwd)"
JF=http://127.0.0.1:18307
umask 077
mkdir -p "$STATE/jf" "$STATE/media/films" "$STATE/media/series" "$STATE/clips"
ff() { ffmpeg -loglevel error -y "$@"; }

# Deux clips, partagés par liens durs : Jellyfin n'y voit que des fichiers.
CLIPS="$STATE/clips"
[ -f "$CLIPS/sdr.mkv" ] || ff -f lavfi -i "testsrc2=size=1920x1080:rate=24" -f lavfi -i "sine=frequency=440:sample_rate=48000" -t 40 \
  -c:v libx264 -preset veryfast -pix_fmt yuv420p -color_primaries bt709 -color_trc bt709 -colorspace bt709 -c:a aac -b:a 128k "$CLIPS/sdr.mkv"
if [ ! -f "$CLIPS/hdr10.mkv" ]; then
  ff -f lavfi -i "testsrc2=size=3840x2160:rate=24" -f lavfi -i "sine=frequency=660:sample_rate=48000" -t 40 \
    -c:v libx265 -preset ultrafast -pix_fmt yuv420p10le -profile:v main10 \
    -x265-params "colorprim=bt2020:transfer=smpte2084:colormatrix=bt2020nc:hdr10=1:master-display=G(13250,34500)B(7500,3000)R(34000,16000)WP(15635,16450)L(10000000,50):max-cll=1000,400:log-level=error" \
    -c:a aac -b:a 128k "$CLIPS/hdr10-raw.mkv"
  # Sans ce second passage, les balises du conteneur restent `unknown`.
  ff -i "$CLIPS/hdr10-raw.mkv" -c copy -color_primaries bt2020 -color_trc smpte2084 -colorspace bt2020nc "$CLIPS/hdr10.mkv"
  rm -f "$CLIPS/hdr10-raw.mkv"
fi

# Un clip PRESQUE BLANC (neige surexposée) : le ton des glyphes du lecteur doit
# basculer en sombre au-dessus (liquidGlass.sample).
[ -f "$CLIPS/snow.mkv" ] || ff -f lavfi -i "color=c=0xF3F3EF:s=1920x1080:r=24,noise=alls=12:allf=t+u,gblur=sigma=1.2" \
  -f lavfi -i "sine=frequency=330:sample_rate=48000" -t 40 \
  -c:v libx264 -preset veryfast -pix_fmt yuv420p -color_primaries bt709 -color_trc bt709 -colorspace bt709 -c:a aac -b:a 128k "$CLIPS/snow.mkv"

image() { # fichier largeur hauteur graine couleurs…
  local f=$1 w=$2 h=$3 seed=$4; shift 4
  local cs="" i=0; for c in "$@"; do cs="$cs:c$i=$c"; i=$((i+1)); done
  ff -f lavfi -i "gradients=s=${w}x${h}:n=$#${cs}:seed=${seed}:type=radial" -frames:v 1 -q:v 3 "$f"
}
# Affiches DÉTAILLÉES (arêtes nettes, motifs fins, chiffres) : sans elles on ne
# juge pas la réfraction au biseau du verre. Générées ici, donc sans droits.
detail() { # fichier largeur hauteur motif
  local f=$1 w=$2 h=$3 src
  case $4 in
    mandel) src="mandelbrot=s=${w}x${h}:maxiter=300:start_x=-0.743643887:start_y=0.131825904:start_scale=0.02" ;;
    life)   src="life=s=$((w/6))x$((h/6)):mold=10:r=1:ratio=0.3:death_color=#1e1b4b:life_color=#f472b6,scale=${w}x${h}:flags=neighbor" ;;
    zone)   src="zoneplate=s=${w}x${h}:kx2=200:ky2=200:k0=0" ;;
    sierp)  src="sierpinski=s=${w}x${h}:type=carpet,format=rgb24,colorchannelmixer=rr=0.9:gg=0.4:bb=1" ;;
    bars)   src="smptehdbars=s=${w}x${h},drawgrid=w=40:h=40:t=2:c=white@0.9" ;;
    digits) src="testsrc2=s=${w}x${h}" ;;
  esac
  ff -f lavfi -i "$src" -frames:v 1 -q:v 2 "$f"
}
film() { # dossier titre année clip graine c0 c1 c2 genre [motif]
  local d="$STATE/media/films/$1"; mkdir -p "$d"
  ln -f "$CLIPS/$4.mkv" "$d/$1.mkv"
  if [ -n "${10:-}" ]; then
    detail "$d/poster.jpg" 600 900 "${10}"
    detail "$d/backdrop.jpg" 1920 1080 "${10}"
  else
    image "$d/poster.jpg" 600 900 "$5" "$6" "$7" "$8"
    image "$d/backdrop.jpg" 1920 1080 "$(( $5 + 7 ))" "$8" "$6" "$7"
  fi
  printf '<movie><title>%s</title><year>%s</year><plot>Titre factice du banc Liquid Glass : un fond coloré pour juger la réfraction du verre, la lisibilité des textes et le contraste des contrôles.</plot><genre>%s</genre><rating>7.4</rating><runtime>1</runtime><lockdata>true</lockdata></movie>\n' \
    "$2" "$3" "$9" > "$d/movie.nfo"
}
film "Banc HDR10 (2024)"     "Banc HDR10"     2024 hdr10 11 0x6d28d9 0xdb2777 0x0ea5e9 "Science-fiction"
film "Banc SDR (2023)"       "Banc SDR"       2023 sdr   12 0xf59e0b 0xef4444 0x7c3aed "Aventure"
film "Rivage Violet (2021)"  "Rivage Violet"  2021 sdr   13 0x8b5cf6 0x1e1b4b 0xf472b6 "Drame" mandel
film "Nuit Corail (2020)"    "Nuit Corail"    2020 sdr   14 0xfb7185 0x0f172a 0xfde68a "Thriller" life
film "Givre (2019)"          "Givre"          2019 sdr   15 0xe0f2fe 0x38bdf8 0x1e3a8a "Drame" zone
film "Soleil Bas (2018)"     "Soleil Bas"     2018 sdr   16 0xfacc15 0xea580c 0x7f1d1d "Western"
film "Prairie (2017)"        "Prairie"        2017 sdr   17 0x22c55e 0xa3e635 0x14532d "Famille" sierp
film "Abysse (2016)"         "Abysse"         2016 sdr   18 0x0f766e 0x020617 0x2dd4bf "Science-fiction"
film "Papier Blanc (2015)"   "Papier Blanc"   2015 sdr   19 0xffffff 0xf5f5f4 0xd6d3d1 "Comédie"
film "Encre (2014)"          "Encre"          2014 sdr   20 0x000000 0x18181b 0x3f3f46 "Policier" digits
film "Néon (2013)"           "Néon"           2013 sdr   21 0xd946ef 0x06b6d4 0x111827 "Action" bars
film "Ambre (2012)"          "Ambre"          2012 sdr   22 0xb45309 0xfbbf24 0x451a03 "Historique"
film "Banc Neige (2025)"    "Banc Neige"     2025 snow  23 0xffffff 0xf8fafc 0xe2e8f0 "Documentaire"

S="$STATE/media/series/Écume (2022)"; mkdir -p "$S"
image "$S/poster.jpg" 600 900 30 0x0284c7 0x7dd3fc 0x0c4a6e
image "$S/backdrop.jpg" 1920 1080 31 0x0c4a6e 0x0284c7 0xa5f3fc
printf '<tvshow><title>Écume</title><year>2022</year><plot>Série factice du banc : deux saisons, trois épisodes chacune, pour le panneau des épisodes du lecteur.</plot><genre>Drame</genre><lockdata>true</lockdata></tvshow>\n' > "$S/tvshow.nfo"
for s in 1 2; do
  mkdir -p "$S/Season $s"
  for e in 1 2 3; do
    n=$(printf 'Écume S%02dE%02d' "$s" "$e"); ln -f "$CLIPS/sdr.mkv" "$S/Season $s/$n.mkv"
    printf '<episodedetails><title>Épisode %s</title><season>%s</season><episode>%s</episode><plot>Épisode factice du banc.</plot><lockdata>true</lockdata></episodedetails>\n' "$e" "$s" "$e" > "$S/Season $s/$n.nfo"
  done
done

if ! docker inspect lg-banc-jf >/dev/null 2>&1; then
  docker run -d --name lg-banc-jf -p 127.0.0.1:18307:8096 \
    -v lg-banc-jf-config:/config -v lg-banc-jf-cache:/cache -v lg-banc-jf-media:/media \
    jellyfin/jellyfin:10.11 >/dev/null
fi
docker exec lg-banc-jf mkdir -p /media/films /media/series
docker cp "$STATE/media/films/." lg-banc-jf:/media/films/
docker cp "$STATE/media/series/." lg-banc-jf:/media/series/
for _ in $(seq 1 90); do curl -fsS "$JF/System/Info/Public" 2>/dev/null | grep -q '"Id"' && break; sleep 2; done

json() { python3 -c "import sys,json;print(json.load(sys.stdin)$1)"; }
post() { curl -fsS -o /dev/null -X POST "$JF$1" -H 'Content-Type: application/json' "${@:2}"; }
secret() { [ -f "$STATE/jf/$1" ] || python3 -c "import secrets;print(secrets.token_urlsafe(18))" > "$STATE/jf/$1"; cat "$STATE/jf/$1"; }
ADMIN_PW=$(secret admin-password); TEST_PW=$(secret knaoxtest-password)
login() { curl -fsS -X POST "$JF/Users/AuthenticateByName" -H 'Content-Type: application/json' \
  -H "X-Emby-Authorization: MediaBrowser Client=\"lg-banc\", Device=\"lg-banc\", DeviceId=\"lg-banc-$1\", Version=\"1\"" \
  -d "{\"Username\":\"$1\",\"Pw\":\"$2\"}" | json '["AccessToken"]'; }

if curl -fsS "$JF/System/Info/Public" | grep -q '"StartupWizardCompleted":false'; then
  post /Startup/Configuration -d '{"UICulture":"fr","MetadataCountryCode":"FR","PreferredMetadataLanguage":"fr"}'
  curl -fsS -o /dev/null "$JF/Startup/User"
  post /Startup/User -d "{\"Name\":\"admin\",\"Password\":\"$ADMIN_PW\"}"
  post /Startup/Complete
fi
ADMIN=$(login admin "$ADMIN_PW")
if [ ! -s "$STATE/jf/api-key" ]; then
  curl -fsS -o /dev/null -X POST "$JF/Auth/Keys?app=tentacle-lg-banc" -H "X-Emby-Token: $ADMIN"
  curl -fsS "$JF/Auth/Keys" -H "X-Emby-Token: $ADMIN" | json '["Items"][0]["AccessToken"]' > "$STATE/jf/api-key"
fi
KEY=$(cat "$STATE/jf/api-key")
lib() { # nom type chemin
  # Comparaison sur le JSON DÉCODÉ : un nom accentué peut arriver échappé.
  curl -fsS "$JF/Library/VirtualFolders?api_key=$KEY" | python3 -c "import sys,json;sys.exit(0 if sys.argv[1] in [v['Name'] for v in json.load(sys.stdin)] else 1)" "$1" && return 0
  post "/Library/VirtualFolders?name=$(python3 -c "import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1]))" "$1")&collectionType=$2&refreshLibrary=true&api_key=$KEY" \
    -d "{\"LibraryOptions\":{\"PathInfos\":[{\"Path\":\"$3\"}],\"EnableInternetProviders\":false,\"MetadataSavers\":[],\"EnableTrickplayImageExtraction\":false}}"
}
lib Films movies /media/films
lib Séries tvshows /media/series
if ! curl -fsS "$JF/Users?api_key=$KEY" | grep -q '"Name":"Knaoxtest"'; then
  curl -fsS -o /dev/null -X POST "$JF/Users/New?api_key=$KEY" -H 'Content-Type: application/json' -d "{\"Name\":\"Knaoxtest\",\"Password\":\"$TEST_PW\"}"
fi
post "/Library/Refresh?api_key=$KEY"
# Les images posées APRÈS un premier passage : Jellyfin garde sa copie tant
# qu'on ne lui demande pas de les remplacer.
for id in $(curl -fsS "$JF/Items?Recursive=true&IncludeItemTypes=Movie,Series&api_key=$KEY" | python3 -c "import sys,json;print(' '.join(i['Id'] for i in json.load(sys.stdin)['Items']))"); do
  post "/Items/$id/Refresh?metadataRefreshMode=Default&imageRefreshMode=FullRefresh&replaceAllImages=true&api_key=$KEY"
done
for _ in $(seq 1 60); do
  n=$(curl -fsS "$JF/Items?Recursive=true&IncludeItemTypes=Movie,Episode&api_key=$KEY" | json '["TotalRecordCount"]')
  [ "$n" -ge 19 ] && break; sleep 2
done
echo "[banc] Jellyfin jetable prêt : $JF — $n titres (état : $STATE/jf)"
