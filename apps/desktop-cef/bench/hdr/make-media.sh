#!/usr/bin/env bash
# Fabrique les médias vidéo de test (HDR10, Dolby Vision 8.1 et 5, SDR témoin).
# Motif fixe en niveaux de gris, très lumineux, pour que l'EDR soit indiscutable :
#   fond 5 nits | bande gauche 203 nits (blanc de référence) | centre 1000 nits | carré 4000 nits
# Gris pur (Cb = Cr = neutre) : le même flux sert au DV profil 5 (IPT avec P = T = 0 → gris).
# Sortie : ${TENTACLE_CEF_CACHE:-~/.cache/tentacle-cef}/media/video/
set -euo pipefail

CACHE="${TENTACLE_CEF_CACHE:-$HOME/.cache/tentacle-cef}"
OUT="$CACHE/media/video"
WORK="$OUT/work"
mkdir -p "$OUT" "$WORK"

W=1920; H=1080; FPS=24; SECS=60; FRAMES=$((FPS * SECS))

# Codes Y 10 bits « limited » des niveaux PQ (Y = 64 + 876·PQ(nits/10000)).
Y5=281; Y203=573; Y1000=723; Y4000=855
# Zones : bande gauche x<480 ; carré 4000 nits centré 400×400 ; centre 480≤x<1440.
LUM="if(lt(X,480),$Y203,if(gte(X,760)*lt(X,1160)*gte(Y,340)*lt(Y,740),$Y4000,if(lt(X,1440),$Y1000,$Y5)))"

# HDR10 : x265 main10, PQ / BT.2020, master-display (P3-D65, 1000 nits) + MaxCLL/MaxFALL.
X265_HDR="hdr10=1:repeat-headers=1:colorprim=bt2020:transfer=smpte2084:colormatrix=bt2020nc"
X265_HDR+=":range=limited:master-display=G(13250,34500)B(7500,3000)R(34000,16000)WP(15635,16450)L(10000000,1)"
X265_HDR+=":max-cll=4000,700:keyint=48:min-keyint=48:log-level=error"
# Charge du lot : 4 fils au plus (règle « -j4 »).
X265_HDR+=":pools=4:frame-threads=2"

encode_pq_hevc() { # $1 = sortie .hevc, $2 = paramètres x265 supplémentaires
  ffmpeg -hide_banner -loglevel error -y \
    -f lavfi -i "color=c=black:s=${W}x${H}:r=${FPS}:d=${SECS},format=yuv420p10le,geq=lum='$LUM':cb=512:cr=512" \
    -c:v libx265 -preset fast -crf 12 -pix_fmt yuv420p10le \
    -x265-params "$X265_HDR$2" -f hevc "$1"
}

echo "[1/5] HDR10 (HEVC Annex B)"
[ -s "$WORK/hdr10.hevc" ] || encode_pq_hevc "$WORK/hdr10.hevc" ""
# Balises du conteneur en plus de la VUI/SEI du flux (couleur, MaxCLL/MaxFALL, mastering).
MKV_HDR=(--colour-matrix 0:9 --colour-range 0:1 --colour-transfer-characteristics 0:16
  --colour-primaries 0:9 --max-content-light 0:4000 --max-frame-light 0:700
  --max-luminance 0:1000 --min-luminance 0:0.0001
  --chromaticity-coordinates 0:0.680,0.320,0.265,0.690,0.150,0.060 --white-colour-coordinates 0:0.3127,0.3290)
mkvmerge -q -o "$OUT/hdr10-pq-4000nits.mkv" "${MKV_HDR[@]}" --default-duration "0:${FPS}p" "$WORK/hdr10.hevc"

# RPU générés : niveau 1 (min/max/moy en PQ 12 bits) cohérent avec le motif, niveau 6 = HDR10.
make_rpu() { # $1 = profil (8.1 | 5), $2 = sortie
  cat > "$WORK/rpu-$1.json" <<JSON
{
  "cm_version": "V40",
  "profile": "$1",
  "length": $FRAMES,
  "level6": { "max_display_mastering_luminance": 1000, "min_display_mastering_luminance": 1,
              "max_content_light_level": 4000, "max_frame_average_light_level": 700 },
  "default_metadata_blocks": [ { "Level1": { "min_pq": 1015, "max_pq": 3696, "avg_pq": 2700 } } ]
}
JSON
  dovi_tool generate -j "$WORK/rpu-$1.json" -o "$2" >/dev/null
}

echo "[2/5] Dolby Vision profil 8.1 (base HDR10 + RPU)"
make_rpu 8.1 "$WORK/rpu-81.bin"
dovi_tool inject-rpu -i "$WORK/hdr10.hevc" --rpu-in "$WORK/rpu-81.bin" -o "$WORK/dv81.hevc" >/dev/null
mkvmerge -q -o "$OUT/dv-p81-4000nits.mkv" "${MKV_HDR[@]}" --default-duration "0:${FPS}p" "$WORK/dv81.hevc"

echo "[3/5] Dolby Vision profil 5 (base IPT-PQ-c2, sans compatibilité HDR10)"
make_rpu 5 "$WORK/rpu-5.bin"
dovi_tool inject-rpu -i "$WORK/hdr10.hevc" --rpu-in "$WORK/rpu-5.bin" -o "$WORK/dv5.hevc" >/dev/null
mkvmerge -q -o "$OUT/dv-p5-4000nits.mkv" "${MKV_HDR[@]}" --default-duration "0:${FPS}p" "$WORK/dv5.hevc"

echo "[4/5] SDR témoin (BT.709, mêmes zones : blanc 100 % au lieu des hautes lumières)"
LUM8="if(lt(X,480),180,if(gte(X,760)*lt(X,1160)*gte(Y,340)*lt(Y,740),235,if(lt(X,1440),220,30)))"
ffmpeg -hide_banner -loglevel error -y \
  -f lavfi -i "color=c=black:s=${W}x${H}:r=${FPS}:d=${SECS},format=yuv420p,geq=lum='$LUM8':cb=128:cr=128,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv" \
  -threads 4 -c:v libx264 -preset fast -crf 12 -x264-params colorprim=bt709:transfer=bt709:colormatrix=bt709 -color_primaries bt709 -color_trc bt709 -colorspace bt709 \
  -color_range tv "$OUT/sdr-bt709.mkv"

echo "[5/5] Vérification (ffprobe / dovi_tool info)"
for f in hdr10-pq-4000nits dv-p81-4000nits dv-p5-4000nits sdr-bt709; do
  printf '%-20s ' "$f"
  ffprobe -v error -select_streams v:0 -show_entries \
    stream=codec_name,profile,pix_fmt,color_transfer,color_primaries,color_space:stream_side_data=dv_profile,dv_bl_signal_compatibility_id \
    -of compact=p=0:nk=0 "$OUT/$f.mkv" | tr '\n' ' '
  echo
done
ls -l "$OUT"/*.mkv
