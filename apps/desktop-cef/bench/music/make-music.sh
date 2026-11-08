#!/usr/bin/env bash
# Fabrique la musique de test d'Octave (aucun téléchargement : ffmpeg seul).
# Rangement à la Jellyfin : <Artiste>/<Album>/NN - Titre.ext + folder.jpg,
# balises complètes, pochettes EMBARQUÉES (le piège `vid=1` de la référence,
# jellium c5ad000 : un titre à pochette s'arrêtait au bout d'~1 s).
# Usage : bench/music/make-music.sh [dossier]   (défaut : $TENTACLE_CEF_CACHE/media/musique)
set -euo pipefail

CACHE="${TENTACLE_CEF_CACHE:-$HOME/.cache/tentacle-cef}"
OUT="${1:-$CACHE/media/musique}"
mkdir -p "$OUT"
FF=(ffmpeg -hide_banner -loglevel error -y)

# Pochette 600×600 : une mire teintée (une teinte par album).
cover() { # <fichier> <teinte en degrés>
  "${FF[@]}" -f lavfi -i "testsrc2=size=600x600:rate=1" -frames:v 1 \
    -vf "hue=h=$2:s=1.4" -q:v 3 "$1"
}

# Un signal discret (−24 dBFS) : une note par titre. Le son du Mac reste coupé
# de toute façon ; le niveau bas est une précaution de plus.
tone() { # <fréquence> <durée s>
  echo "aevalsrc=0.06*sin(2*PI*$1*t)|0.06*sin(2*PI*$1*1.5*t):s=\$RATE:d=$2"
}

# encode <dossier> <n°> <titre> <durée> <fréquence> <codec> <ext> <taux> <bits> <artiste> <album> <année> <genre> <pochette>
encode() {
  local dir="$1" n="$2" title="$3" dur="$4" freq="$5" codec="$6" ext="$7" rate="$8" bits="$9"
  local artist="${10}" album="${11}" year="${12}" genre="${13}" art="${14}"
  local file
  file="$dir/$(printf %02d "$n") - $title.$ext"
  local src
  src="$(tone "$freq" "$dur")"; src="${src//\$RATE/$rate}"
  local enc=()
  case "$codec" in
    flac) enc=(-c:a flac -compression_level 5)
          [ "$bits" = 24 ] && enc+=(-sample_fmt s32 -bits_per_raw_sample 24) || enc+=(-sample_fmt s16) ;;
    mp3)  enc=(-c:a libmp3lame -b:a 320k -id3v2_version 3) ;;
    aac)  enc=(-c:a aac -b:a 256k) ;;
    opus) enc=(-c:a libopus -b:a 160k) ;;
  esac
  local meta=(-metadata "title=$title" -metadata "artist=$artist" -metadata "album_artist=$artist"
              -metadata "album=$album" -metadata "track=$n" -metadata "disc=1"
              -metadata "date=$year" -metadata "genre=$genre")
  # La pochette embarquée (flux image « attached_pic »).
  "${FF[@]}" -f lavfi -i "$src" -i "$art" -map 0:a -map 1:v "${enc[@]}" "${meta[@]}" \
    -c:v mjpeg -disposition:v attached_pic -metadata:s:v "title=Album cover" \
    -metadata:s:v "comment=Cover (front)" "$file" 2>/dev/null \
  || { echo "  (sans pochette embarquée : $file)" >&2
         "${FF[@]}" -f lavfi -i "$src" -map 0:a "${enc[@]}" "${meta[@]}" "$file"; }
}

album() { # <artiste> <album> <année> <genre> <teinte>
  local dir="$OUT/$1/$2"
  mkdir -p "$dir"
  cover "$dir/folder.jpg" "$5"
  echo "$dir"
}

# 1. FLAC 16/44,1 — durées variées, dont un titre très court (fin de piste rapide).
d=$(album "Banc Octave" "Sinus FLAC" 2024 "Test" 0)
encode "$d" 1 "La Quarante" 12 440 flac flac 44100 16 "Banc Octave" "Sinus FLAC" 2024 Test "$d/folder.jpg"
encode "$d" 2 "Quinte Douce" 25 330 flac flac 44100 16 "Banc Octave" "Sinus FLAC" 2024 Test "$d/folder.jpg"
encode "$d" 3 "Éclair" 4 550 flac flac 44100 16 "Banc Octave" "Sinus FLAC" 2024 Test "$d/folder.jpg"
encode "$d" 4 "Longue Traîne" 40 262 flac flac 44100 16 "Banc Octave" "Sinus FLAC" 2024 Test "$d/folder.jpg"

# 2. MP3 320k — pochette ID3 (APIC) : LE cas de la référence c5ad000.
d=$(album "Banc Octave" "Carrés MP3" 2023 "Test" 90)
encode "$d" 1 "Premier Carré" 15 392 mp3 mp3 44100 16 "Banc Octave" "Carrés MP3" 2023 Test "$d/folder.jpg"
encode "$d" 2 "Deuxième Carré" 9 494 mp3 mp3 44100 16 "Banc Octave" "Carrés MP3" 2023 Test "$d/folder.jpg"
encode "$d" 3 "Troisième Carré" 20 294 mp3 mp3 44100 16 "Banc Octave" "Carrés MP3" 2023 Test "$d/folder.jpg"

# 3. AAC (m4a) 48 kHz.
d=$(album "Trio Témoin" "Aac du Matin" 2025 "Ambiance" 180)
encode "$d" 1 "Aube" 18 349 aac m4a 48000 16 "Trio Témoin" "Aac du Matin" 2025 Ambiance "$d/folder.jpg"
encode "$d" 2 "Midi" 11 415 aac m4a 48000 16 "Trio Témoin" "Aac du Matin" 2025 Ambiance "$d/folder.jpg"
encode "$d" 3 "Crépuscule" 22 311 aac m4a 48000 16 "Trio Témoin" "Aac du Matin" 2025 Ambiance "$d/folder.jpg"

# 4. Opus 48 kHz (Ogg).
d=$(album "Trio Témoin" "Opus de Nuit" 2025 "Ambiance" 270)
encode "$d" 1 "Minuit" 14 370 opus opus 48000 16 "Trio Témoin" "Opus de Nuit" 2025 Ambiance "$d/folder.jpg"
encode "$d" 2 "Trois Heures" 8 466 opus opus 48000 16 "Trio Témoin" "Opus de Nuit" 2025 Ambiance "$d/folder.jpg"

# 5. FLAC 24/96 — un changement de format (44,1 → 96) : `gapless-audio=weak` rouvre la sortie.
d=$(album "Haute Définition" "Vingt-Quatre Bits" 2026 "Test" 320)
encode "$d" 1 "Précision" 10 523 flac flac 96000 24 "Haute Définition" "Vingt-Quatre Bits" 2026 Test "$d/folder.jpg"
encode "$d" 2 "Résolution" 16 587 flac flac 96000 24 "Haute Définition" "Vingt-Quatre Bits" 2026 Test "$d/folder.jpg"

# 6. Un titre long (6 min) pour les recherches dans la piste.
d=$(album "Banc Octave" "Grand Format" 2022 "Test" 45)
encode "$d" 1 "Six Minutes" 360 220 flac flac 44100 16 "Banc Octave" "Grand Format" 2022 Test "$d/folder.jpg"

# 7. « Sans Blanc » : UN signal continu coupé en trois titres à l'échantillon près
#    (preuve d'enchaînement sans blanc par sortie PCM : jamais en écoutant).
d=$(album "Banc Octave" "Sans Blanc" 2024 "Test" 135)
cont="$d/.continu.wav"
"${FF[@]}" -f lavfi -i "aevalsrc=0.06*sin(2*PI*440*t)|0.06*sin(2*PI*660*t):s=44100:d=21" -c:a pcm_s16le "$cont"
i=1
for range in "0 7" "7 14" "14 21"; do
  set -- $range
  title=("" "Fil Un" "Fil Deux" "Fil Trois")
  "${FF[@]}" -i "$cont" -i "$d/folder.jpg" -map 0:a -map 1:v \
    -af "atrim=start_sample=$(( $1 * 44100 )):end_sample=$(( $2 * 44100 )),asetpts=N/SR/TB" \
    -c:a flac -sample_fmt s16 -c:v mjpeg -disposition:v attached_pic \
    -metadata "title=${title[$i]}" -metadata "artist=Banc Octave" -metadata "album_artist=Banc Octave" \
    -metadata "album=Sans Blanc" -metadata "track=$i" -metadata "date=2024" -metadata "genre=Test" \
    "$d/$(printf %02d $i) - ${title[$i]}.flac"
  i=$((i + 1))
done
rm -f "$cont"

# Le manifeste lu par les tests (durées mesurées, pas annoncées).
python3 - "$OUT" <<'PY'
import json, os, subprocess, sys
root = sys.argv[1]
tracks = []
for dirpath, _, files in sorted(os.walk(root)):
    for f in sorted(files):
        if f.startswith(".") or f.endswith((".jpg", ".json")):
            continue
        p = os.path.join(dirpath, f)
        j = json.loads(subprocess.check_output(["ffprobe", "-v", "error", "-print_format", "json",
                                                "-show_format", "-show_streams", p]))
        a = next(s for s in j["streams"] if s["codec_type"] == "audio")
        tags = {k.lower(): v for k, v in j["format"].get("tags", {}).items()}
        tags.update({k.lower(): v for k, v in a.get("tags", {}).items()})
        tracks.append({
            "path": os.path.relpath(p, root), "codec": a["codec_name"],
            "sampleRate": int(a["sample_rate"]), "channels": a["channels"],
            "durationS": round(float(j["format"]["duration"]), 3),
            "embeddedCover": any(s.get("disposition", {}).get("attached_pic") for s in j["streams"]),
            "title": tags.get("title"), "album": tags.get("album"), "artist": tags.get("artist"),
            "track": tags.get("track"),
        })
with open(os.path.join(root, "MANIFEST.json"), "w") as fh:
    json.dump({"tracks": tracks}, fh, ensure_ascii=False, indent=1)
print(f"{len(tracks)} titres dans {root}")
PY
