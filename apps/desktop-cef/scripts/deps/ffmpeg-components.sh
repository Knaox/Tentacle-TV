# Composants FFmpeg du paquet (sourcé par paquet-deps.sh). Tout le reste est désactivé.
# Critère : ce qu'une bibliothèque Jellyfin lit en lecture directe (remux Blu-ray, DVD, rips
# anciens, musique), ce que le front envoie à mpv (sous-titres externes, HLS de transcodage)
# et les filtres audio d'Electron (fondu `volume:eval=frame`, `asetnsamples`, niveau `astats`,
# préchauffage `av://lavfi:anullsrc`). Un ajout ici coûte quelques dizaines de Ko.
_join() { local IFS=,; echo "$*"; }

_video=(h264 hevc av1 libdav1d vp8 vp9 mpeg1video mpeg2video mpeg4 h263 msmpeg4v3 vc1 wmv3
  theora prores rawvideo mjpeg png webp)
_audio=(aac aac_latm ac3 eac3 truehd mlp dca flac opus vorbis mp3 mp3float mp2 mp2float alac ape
  wavpack tta wmav2 wmapro wmalossless dsd_lsbf dsd_msbf dsd_lsbf_planar dsd_msbf_planar
  pcm_s16le pcm_s16be pcm_s24le pcm_s24be pcm_s32le pcm_s32be pcm_f32le pcm_f32be pcm_f64le
  pcm_u8 pcm_alaw pcm_mulaw pcm_bluray pcm_dvd)
_subs=(ass ssa subrip srt text webvtt movtext dvdsub dvbsub pgssub ccaption)
_demux=(matroska mov mpegts mpegps hls flac mp3 aac ac3 eac3 truehd mlp dts dtshd ogg wav w64
  aiff caf ape wv tta asf avi dsf iff srt ass webvtt sup vobsub image2 image_jpeg_pipe
  image_png_pipe image_webp_pipe h264 hevc)
_parse=(h264 hevc av1 vp8 vp9 vp3 mpegvideo mpeg4video vc1 h263 aac aac_latm ac3 mlp dca flac
  opus vorbis mpegaudio dvdsub dvbsub dvd_nav png mjpeg webp)
_proto=(file http https tcp tls crypto data httpproxy pipe subfile)
_bsf=(extract_extradata h264_mp4toannexb hevc_mp4toannexb vp9_superframe_split av1_frame_split
  null)
_hw=(h264_videotoolbox hevc_videotoolbox vp9_videotoolbox av1_videotoolbox mpeg1_videotoolbox
  mpeg2_videotoolbox mpeg4_videotoolbox h263_videotoolbox prores_videotoolbox)
_filt=(buffer buffersink abuffer abuffersink format aformat null anull scale aresample setpts
  asetpts yadif bwdif volume astats asetnsamples anullsrc afade acrossfade atempo equalizer
  superequalizer firequalizer dynaudnorm loudnorm alimiter acompressor pan channelmap amix
  highpass lowpass bass treble)

FFMPEG_COMPONENTS=(
  --enable-decoder="$(_join "${_video[@]}" "${_audio[@]}" "${_subs[@]}")"
  --enable-demuxer="$(_join "${_demux[@]}")"
  --enable-parser="$(_join "${_parse[@]}")"
  --enable-protocol="$(_join "${_proto[@]}")"
  --enable-bsf="$(_join "${_bsf[@]}")"
  --enable-hwaccel="$(_join "${_hw[@]}")"
  --enable-filter="$(_join "${_filt[@]}")"
  --enable-indev=lavfi
)
