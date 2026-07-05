//
//  TVStreamMap.m  (tvOS / Apple TV) — sélection & mapping des flux du remux « façon
//  Infuse » : validation des paramètres vidéo (extradata), choix de la piste audio,
//  création des flux de sortie (tags hvc1/dvh1, couleur DV, copie vs transcode EAC3).
//  Extrait VERBATIM de TVRemuxEngine.m (budget 300 lignes, refactor 1:1) — les sorties
//  locales (indices, infos master, contexte audio) passent par la struct TVMapOut
//  (TVCommon.h). #importé par TVLocalRemux.m → même unité de traduction.
//

#import "TVCommon.h"

// Paramètres vidéo INUTILISABLES pour le muxer MP4 : extradata absente OU « dégénérée »
// (hvcC/avcC-stub sans AUCUN VPS/SPS/PPS — vu sur des MKV muxés depuis du broadcast : le
// CodecPrivate fait ~23 o, numOfArrays=0, les params ne vivent QUE in-band). movenc écrirait
// une box de config VIDE → flux invalide (AVPlayer -19601) alors que le fichier « joue »
// partout ailleurs (les décodeurs parsent l'in-band ; nous n'avons PAS de décodeur vidéo).
static int TVVideoParamsMissing(const AVCodecParameters *p) {
  if (!p->extradata || p->extradata_size <= 0) return 1;
  if (p->codec_id == AV_CODEC_ID_HEVC) {
    if (p->extradata[0] == 1)                    // hvcC : header fixe 22 o + numOfArrays
      return p->extradata_size < 23 || p->extradata[22] == 0;
    return p->extradata_size < 32;               // annexb : VPS+SPS+PPS jamais < 32 o
  }
  if (p->codec_id == AV_CODEC_ID_H264) {
    if (p->extradata[0] == 1)                    // avcC : numOfSPS = extradata[5] & 0x1F
      return p->extradata_size < 7 || (p->extradata[5] & 0x1f) == 0;
    return p->extradata_size < 16;
  }
  return 0;
}

// Mappe les flux d'entrée → sortie (vidéo + UNE piste audio). Remplit `smap` (index
// entrée → sortie, -1 = ignoré) et `m`. Retourne < 0 si aucun flux mappé ou échec.
static int TVMapStreams(AVFormatContext *ic, AVFormatContext *oc, int *smap, TVMapOut *m) {
  int oi = 0, audioTaken = 0;
  // Valider l'index audio voulu (MediaStream.Index JS) : s'il NE pointe PAS un flux AUDIO
  // (ex. 0 = vidéo, ou état initial audioIndex=0 avant chargement), retomber sur le 1ᵉʳ flux
  // audio → JAMAIS de silence (régression AAC sinon).
  int wantAud = gWantAudioIdx;
  if (wantAud < 0 || wantAud >= (int)ic->nb_streams ||
      ic->streams[wantAud]->codecpar->codec_type != AVMEDIA_TYPE_AUDIO) {
    wantAud = -1;
    for (unsigned k = 0; k < ic->nb_streams; k++)
      if (ic->streams[k]->codecpar->codec_type == AVMEDIA_TYPE_AUDIO) { wantAud = (int)k; break; }
  }
  TVLOG("remux: audio want=%d → stream %d", gWantAudioIdx, wantAud);
  for (unsigned i = 0; i < ic->nb_streams; i++) {
    smap[i] = -1;
    AVCodecParameters *p = ic->streams[i]->codecpar;
    if (p->codec_type == AVMEDIA_TYPE_VIDEO) {
    } else if (p->codec_type == AVMEDIA_TYPE_AUDIO && !audioTaken && (int)i == wantAud) {
      audioTaken = 1;   // piste validée (sélectionnée ou 1ʳᵉ) ; codecs non gérés → transcode EAC3
    } else continue;
    AVStream *os = avformat_new_stream(oc, NULL);
    if (!os) return -1;
    if (avcodec_parameters_copy(os->codecpar, p) < 0) return -1;
    if (p->codec_type == AVMEDIA_TYPE_VIDEO) {
      m->vInIdx = (int)i; m->vOutIdx = oi;   // pour l'extraction d'extradata in-band (header différé)
      m->v_w = p->width; m->v_h = p->height;
      gTVFps = av_q2d(ic->streams[i]->avg_frame_rate);
      if (gTVFps <= 0) gTVFps = av_q2d(ic->streams[i]->r_frame_rate);
      if (p->codec_id == AV_CODEC_ID_HEVC) {
        // tvOS/AVPlayer exige hvc1 (paramètres DANS la box) — JAMAIS hev1. DV profil 5 → dvh1.
        int dvp = -1, compat = -1, level = 0;
        const AVPacketSideData *sd = av_packet_side_data_get(
          p->coded_side_data, p->nb_coded_side_data, AV_PKT_DATA_DOVI_CONF);
        if (sd && sd->size >= sizeof(AVDOVIDecoderConfigurationRecord)) {
          const AVDOVIDecoderConfigurationRecord *dovi = (const AVDOVIDecoderConfigurationRecord *)sd->data;
          dvp = dovi->dv_profile; compat = dovi->dv_bl_signal_compatibility_id; level = dovi->dv_level;
        }
        // P8.1 (cross-compat HDR10) → sample entry hvc1 (standard Apple, base HDR10) ; le DV est
        // déclaré via SUPPLEMENTAL-CODECS du master. DV profil 5 (BL seul, non rétro-compat) → dvh1.
        os->codecpar->codec_tag = (dvp == 5) ? MKTAG('d','v','h','1') : MKTAG('h','v','c','1');
        // Le MKV DV ne porte souvent PAS l'élément Colour → color_trc=non spécifié → AVFoundation
        // croit que c'est SDR (pas de badge). On force la dynamique d'après le DV.
        if (dvp >= 0 && os->codecpar->color_trc == AVCOL_TRC_UNSPECIFIED) {
          if (compat == 2) {  // base SDR
            os->codecpar->color_primaries = AVCOL_PRI_BT709;
            os->codecpar->color_trc = AVCOL_TRC_BT709;
            os->codecpar->color_space = AVCOL_SPC_BT709;
          } else {            // HDR10 (1) / HLG (4) / DV5 (0) → BT.2020
            os->codecpar->color_primaries = AVCOL_PRI_BT2020;
            os->codecpar->color_trc = (compat == 4) ? AVCOL_TRC_ARIB_STD_B67 : AVCOL_TRC_SMPTE2084;
            os->codecpar->color_space = AVCOL_SPC_BT2020_NCL;
          }
        }
        m->v_dvp = dvp; m->v_blcompat = compat; m->v_dvlevel = level;
        // gTVDynRange vient de JS (Jellyfin), pas de la détection couleur native (peu fiable).
        TVLOG("remux: video hevc dv_profile=%d compat=%d dvlevel=%d hevclevel=%d → tag=%s trc=%d gTVDyn=%d fps=%.3f",
              dvp, compat, level, p->level, (dvp == 5) ? "dvh1" : "hvc1", os->codecpar->color_trc, gTVDynRange, gTVFps);
      } else {
        os->codecpar->codec_tag = 0;   // H.264 → avc1
      }
    } else {
      os->codecpar->codec_tag = 0;     // audio → tag auto
      enum AVCodecID aid = p->codec_id;
      if (aid == AV_CODEC_ID_AAC || aid == AV_CODEC_ID_AC3 || aid == AV_CODEC_ID_EAC3 || aid == AV_CODEC_ID_ALAC) {
        m->a_codec = (aid == AV_CODEC_ID_EAC3) ? "ec-3" : (aid == AV_CODEC_ID_AC3) ? "ac-3"
                   : (aid == AV_CODEC_ID_AAC)  ? "mp4a.40.2" : "alac";   // décodable AVPlayer → COPIE
      } else {
        // DTS-HD MA / TrueHD / FLAC : AVPlayer ne décode pas → TRANSCODE EAC3 on-device.
        if (TVAudioSetup(p, os, &m->adec, &m->aenc, &m->aswr, &m->afifo) < 0) return -1;
        m->aXcode = 1; m->aOutIdx = oi; m->a_codec = "ec-3";
        m->aInTb = ic->streams[i]->time_base;   // time_base source → ancrage PTS audio (A/V sync)
      }
    }
    smap[i] = oi++;
  }
  m->oi = oi;
  TVLOG("remux: mapped %d output streams", oi);
  return oi == 0 ? -1 : 0;
}
