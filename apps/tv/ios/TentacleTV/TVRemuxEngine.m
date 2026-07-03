//
//  TVRemuxEngine.m  (tvOS / Apple TV) — moteur de remux FFmpeg du lecteur « façon
//  Infuse » : open input, find_stream_info, mapping vidéo+audio, reconstruction DTS,
//  boucle de paquets, pacing, flush, cleanup. Extrait VERBATIM de TVLocalRemux.m
//  (refactor 1:1, unity build). Les setups HLS / master.m3u8 inline sont remplacés par
//  des appels aux fonctions static de TVHLSPlaylist.m (logique inchangée ; seul le
//  `goto end` reste au point d'appel). Les DÉFINITIONS des globals de session vivent ICI
//  (un seul endroit ; le reste est `extern` dans TVCommon.h).
//  #importé par TVLocalRemux.m → même unité de traduction.
//

#import "TVCommon.h"

GCDWebServer *gServer;
NSString     *gOutPath;
long long     gTotalEstimate;
volatile int  gDone;
volatile int  gError;
volatile int  gReady;   // 1 dès que la playlist liste un 1ᵉʳ segment
volatile int  gGen;     // génération de session : un nouveau start() annule le remux précédent
volatile double gTVPlayPos;  // position de lecture (s) reçue de JS → bride la lecture anticipée
dispatch_queue_t gRemuxQueue;
NSString     *gCurrentSource;
NSString     *gCurrentUrl;
// Plage dynamique + fps détectés par le remux, lus par TVDisplayCriteria pour engager le
// badge HDR/DV via AVDisplayCriteria (API privée, comme Kodi). 0=SDR, 3=HDR10, 4=Dolby Vision.
int    gTVDynRange = 0;
double gTVFps = 0;
volatile int gWantAudioIdx = -1;  // index de piste audio (MediaStream.Index JS) à mapper ; -1 = 1ʳᵉ dispo
volatile int    gWantStartSec = 0; // position de reprise (s) demandée par JS
volatile double gWrittenSec = 0;   // position max ÉCRITE par le remux (s) → gate de reprise
volatile double gSessionStartSec = 0; // temps absolu du 1ᵉʳ segment de la session (av_seek_frame) ; gDiskBytes est défini dans TVWindow.m

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

static void TVDoRemux(const char *src, const char *dst, int gen) {
  AVFormatContext *ic = NULL, *oc = NULL;
  int *smap = NULL;
  int64_t *last_dts = NULL;
  int64_t *ptsbuf = NULL;   // fenêtre PTS triée par flux vidéo (reconstruction DTS)
  int *primed = NULL;
  AVPacket *pkt = NULL;
  NSString *plPath = nil;   // déclaré ici (ARC) pour ne pas bloquer les goto end
  int v_dvp = -1, v_blcompat = -1, v_dvlevel = 0, v_level = 0, v_w = 0, v_h = 0;  // pour le master playlist
  const char *a_codec = NULL;
  AVCodecContext *adec = NULL, *aenc = NULL;   // transcode audio on-device (DTS/TrueHD/FLAC → EAC3)
  SwrContext *aswr = NULL; AVAudioFifo *afifo = NULL;
  int aXcode = 0, aOutIdx = -1;
  // aNextPts = AV_NOPTS_VALUE → sera ANCRÉ sur la 1ʳᵉ frame audio décodée (timeline source) pour
  // garder la synchro labiale ; aInTb = time_base du flux audio source (rescale du PTS d'ancrage).
  int64_t aNextPts = AV_NOPTS_VALUE; AVRational aInTb = (AVRational){1, 48000};
  // Extradata vidéo ABSENTE (HEVC/H.264 in-band : TS, MKV sans CodecPrivate…) : sans elle le
  // muxer écrit un hvcC/avcC VIDE → flux invalide (AVPlayer -19601, « façon CLI » ffmpeg qui
  // insère extract_extradata automatiquement). On DIFFÈRE le header et on extrait les
  // VPS/SPS/PPS du 1ᵉʳ paquet vidéo via le BSF extract_extradata (inclus dans le build).
  AVBSFContext *xbsf = NULL;
  int vInIdx = -1, vOutIdx = -1, hdrWritten = 0, xTried = 0;
  int ret = 0;
  TVLOG("remux: entry gen=%d (cur=%d)", gen, gGen);
  if (!src || !dst) { gError = 1; gDone = 1; return; }
  if (gGen != gen) { TVLOG("remux: superseded before start"); return; }   // file série : déjà annulé
  @autoreleasepool {   // vider le dossier (session précédente) — sûr : la file SÉRIE garantit que
                       // le remux précédent a quitté avant celui-ci.
    NSString *d = [NSString stringWithUTF8String:dst];
    NSFileManager *fm = [NSFileManager defaultManager];
    for (NSString *f in ([fm contentsOfDirectoryAtPath:d error:nil] ?: @[]))
      [fm removeItemAtPath:[d stringByAppendingPathComponent:f] error:nil];
  }

  ic = avformat_alloc_context();
  if (!ic) { ret = -1; TVLOG("alloc_context FAIL"); goto end; }
  // Probe borné (vs 6 Mo/3 s) → find_stream_info plus court. PAS d'options HTTP : elles
  // faisaient échouer l'open sur le proxy (-60 ETIMEDOUT au bout de rw_timeout). On garde le
  // comportement réseau par défaut (qui fonctionnait), juste un probe plus court.
  ic->probesize = 2 * 1024 * 1024;
  ic->max_analyze_duration = 2 * AV_TIME_BASE;
  ret = avformat_open_input(&ic, src, NULL, NULL);
  if (ret < 0) { TVLOG("open_input FAIL %d %s", ret, TVErr(ret)); goto end; }
  TVLOG("remux: opened, %u streams", ic->nb_streams);
  if ((ret = avformat_find_stream_info(ic, NULL)) < 0) { TVLOG("find_stream_info FAIL %d", ret); goto end; }
  TVLOG("remux: stream_info done");
  gTotalEstimate = (ic->pb ? avio_size(ic->pb) : 0);
  if (gTotalEstimate < 0) gTotalEstimate = 0;
  TVLOG("remux: size estimate=%lld seekable=%d", gTotalEstimate, ic->pb ? (ic->pb->seekable & AVIO_SEEKABLE_NORMAL) : -1);

  // REPRISE/SEEK RAPIDE : positionner l'ENTRÉE sur la keyframe ≤ T (au lieu de lire linéairement
  // depuis 0, réseau-bound). avformat_seek_file(-1, …) synchronise TOUS les flux ; AVSEEK_FLAG_BACKWARD
  // = keyframe ≤ T (la copie vidéo EXIGE une keyframe). Unité : AV_TIME_BASE (stream_index=-1). La
  // reconstruction DTS (ptsbuf/primed) et l'ancrage audio (aNextPts) se ré-amorcent gratuitement car
  // CETTE session ré-alloue tout. Échec (conteneur sans index/proxy non-seekable) → repli lecture
  // linéaire (le gate gWrittenSec≥gWantStartSec attendra la production de T comme avant). gWantStartSec
  // gate aussi `avoid_negative_ts=disabled` (TVHLSPlaylist) → PTS ABSOLUS préservés (currentTime AVPlayer ≈ T).
  if (gWantStartSec > 0) {
    int64_t seek_ts = (int64_t)gWantStartSec * AV_TIME_BASE;
    int sret = avformat_seek_file(ic, -1, INT64_MIN, seek_ts, seek_ts, AVSEEK_FLAG_BACKWARD);
    TVLOG("remux: seek input to %ds → %d %{public}s", gWantStartSec, sret, sret < 0 ? TVErr(sret) : "ok");
  }

  if ((ret = TVHLSOpenOutput(&oc, dst)) < 0) goto end;

  smap = av_malloc_array(ic->nb_streams, sizeof(int));
  if (!smap) { ret = -1; goto end; }
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
    if (!os) { ret = -1; goto end; }
    if ((ret = avcodec_parameters_copy(os->codecpar, p)) < 0) goto end;
    if (p->codec_type == AVMEDIA_TYPE_VIDEO) {
      vInIdx = (int)i; vOutIdx = oi;   // pour l'extraction d'extradata in-band (header différé)
      v_w = p->width; v_h = p->height; v_level = p->level;
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
        v_dvp = dvp; v_blcompat = compat; v_dvlevel = level;
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
        a_codec = (aid == AV_CODEC_ID_EAC3) ? "ec-3" : (aid == AV_CODEC_ID_AC3) ? "ac-3"
                : (aid == AV_CODEC_ID_AAC)  ? "mp4a.40.2" : "alac";   // décodable AVPlayer → COPIE
      } else {
        // DTS-HD MA / TrueHD / FLAC : AVPlayer ne décode pas → TRANSCODE EAC3 on-device.
        if (TVAudioSetup(p, os, &adec, &aenc, &aswr, &afifo) < 0) { ret = -1; goto end; }
        aXcode = 1; aOutIdx = oi; a_codec = "ec-3";
        aInTb = ic->streams[i]->time_base;   // time_base source → ancrage PTS audio (A/V sync)
      }
    }
    smap[i] = oi++;
  }
  TVLOG("remux: mapped %d output streams", oi);
  if (oi == 0) { ret = -1; goto end; }
  last_dts = av_malloc_array(oi, sizeof(int64_t));
  ptsbuf   = av_malloc_array((size_t)oi * (TVLR_REORDER + 1), sizeof(int64_t));
  primed   = av_calloc(oi, sizeof(int));
  if (!last_dts || !ptsbuf || !primed) { ret = -1; goto end; }
  for (int k = 0; k < oi; k++) last_dts[k] = INT64_MIN;

  // Extradata vidéo absente/dégénérée (HEVC/H.264) → header DIFFÉRÉ : l'écrire maintenant
  // graverait un hvcC/avcC vide (flux invalide). On extrait les VPS/SPS/PPS in-band du 1ᵉʳ
  // paquet vidéo via `<codec>_mp4toannexb,extract_extradata` : mp4toannexb convertit les
  // paquets length-prefixed (MKV/MP4) en annexb — extract_extradata NE lit QUE l'annexb
  // (« No start code is found » sinon) et passe-through les flux déjà annexb (TS).
  if (vOutIdx >= 0 &&
      (oc->streams[vOutIdx]->codecpar->codec_id == AV_CODEC_ID_HEVC ||
       oc->streams[vOutIdx]->codecpar->codec_id == AV_CODEC_ID_H264) &&
      TVVideoParamsMissing(oc->streams[vOutIdx]->codecpar)) {
    const char *chain = (oc->streams[vOutIdx]->codecpar->codec_id == AV_CODEC_ID_HEVC)
      ? "hevc_mp4toannexb,extract_extradata" : "h264_mp4toannexb,extract_extradata";
    if (av_bsf_list_parse_str(chain, &xbsf) >= 0 && xbsf) {
      avcodec_parameters_copy(xbsf->par_in, ic->streams[vInIdx]->codecpar);
      xbsf->time_base_in = ic->streams[vInIdx]->time_base;
      if (av_bsf_init(xbsf) < 0) { av_bsf_free(&xbsf); xbsf = NULL; }
    }
    TVLOG("remux: video extradata absente/dégénérée (%d o) → header différé, extraction in-band (bsf=%d)",
          oc->streams[vOutIdx]->codecpar->extradata_size, xbsf ? 1 : 0);
    if (!xbsf) { ret = -1; goto end; }   // BSF indispo → échec PROPRE (repli JS transcode)
  } else {
    if ((ret = TVHLSWriteHeader(oc, dst)) < 0) goto end;
    TVHLSWriteMaster(oc, ic, dst, v_dvp, v_blcompat, v_dvlevel, v_w, v_h, a_codec);
    hdrWritten = 1;
  }

  pkt = av_packet_alloc();
  if (!pkt) { ret = -1; goto end; }
  plPath = [NSString stringWithFormat:@"%s/index.m3u8", dst];
  long long npkt = 0; int dbg = 0;
  while (!gError && gGen == gen && av_read_frame(ic, pkt) >= 0) {
    int si = pkt->stream_index;
    int oidx = (si >= 0 && si < (int)ic->nb_streams) ? smap[si] : -1;
    if (oidx < 0) { av_packet_unref(pkt); continue; }
    // Params in-band (chaîne BSF active) : convertir CHAQUE paquet vidéo en annexb, toute la
    // session — même chemin que le CLI `-bsf:v <codec>_mp4toannexb,extract_extradata` (validé
    // sur la source réelle). L'extradata émise par extract_extradata est ANNEXB : movenc,
    // voyant une extradata annexb, traite AUSSI les samples en annexb (ff_hevc_annexb2mp4).
    // Écrire les samples MKV length-prefixed TELS QUELS produirait des trun size≈0 (le parseur
    // annexb n'y trouve pas de start codes) → flux invalide (AVPlayer -16041).
    if (xbsf && oidx == vOutIdx) {
      if (av_bsf_send_packet(xbsf, pkt) < 0) { av_packet_unref(pkt); continue; }
      if (av_bsf_receive_packet(xbsf, pkt) < 0) continue;   // EAGAIN improbable (BSF 1-in/1-out)
      if (!hdrWritten) {
        size_t xsz = 0;
        uint8_t *xd = av_packet_get_side_data(pkt, AV_PKT_DATA_NEW_EXTRADATA, &xsz);
        if (xd && xsz > 0) {
          AVCodecParameters *vp = oc->streams[vOutIdx]->codecpar;
          av_freep(&vp->extradata);
          vp->extradata = av_mallocz(xsz + AV_INPUT_BUFFER_PADDING_SIZE);
          if (vp->extradata) { memcpy(vp->extradata, xd, xsz); vp->extradata_size = (int)xsz; }
        }
        if (oc->streams[vOutIdx]->codecpar->extradata_size > 0) {
          TVLOG("remux: extradata in-band extraite (%d o) → header", oc->streams[vOutIdx]->codecpar->extradata_size);
          if ((ret = TVHLSWriteHeader(oc, dst)) < 0) goto end;
          TVHLSWriteMaster(oc, ic, dst, v_dvp, v_blcompat, v_dvlevel, v_w, v_h, a_codec);
          hdrWritten = 1;
          // fallthrough : CE paquet (keyframe annexb porteuse des params) est écrit normalement.
        } else {
          av_packet_unref(pkt);
          // ~5 s de vidéo sans params in-band → ils n'existent pas (ni CodecPrivate ni bitstream) :
          // échec PROPRE ET RAPIDE → le JS replie vite sur PlaybackInfo (transcode serveur).
          if (++xTried > 120) { TVLOG("remux: extradata INTROUVABLE (%d pkts) → abort", xTried); ret = -1; goto end; }
          continue;
        }
      }
    } else if (!hdrWritten) {
      // Header différé (extraction en cours) : rien ne peut s'écrire avant le header → DROP
      // des paquets non-vidéo (<1 s en tête, l'A/V se recale au PTS).
      av_packet_unref(pkt); continue;
    }
    if (aXcode && oidx == aOutIdx) {        // piste audio transcodée (DTS/TrueHD/FLAC → EAC3)
      TVAudioTranscode(oc, adec, aenc, aswr, afifo, aOutIdx, &aNextPts, aInTb, pkt);
      av_packet_unref(pkt); continue;
    }
    AVStream *is = ic->streams[si];
    AVStream *os = oc->streams[oidx];
    pkt->stream_index = oidx;
    av_packet_rescale_ts(pkt, is->time_base, os->time_base);
    pkt->pos = -1;
    if (dbg < 8) { TVLOG("pkt[%d] out=%d type=%d dts=%lld pts=%lld dur=%lld", dbg, oidx,
                         is->codecpar->codec_type, (long long)pkt->dts, (long long)pkt->pts, (long long)pkt->duration); dbg++; }
    // DTS : matroska/HEVC livre souvent dts=pts (affichage) → non monotone, et un
    // clamp brutal réordonne les B-frames (= vidéo noire). On RECONSTRUIT un dts
    // monotone en ordre de décodage via la durée, en gardant le pts (affichage).
    if (is->codecpar->codec_type == AVMEDIA_TYPE_VIDEO) {
      // Pas de décodeur HEVC ⇒ has_b_frames=0 ⇒ FFmpeg ne reconstruit pas le DTS, et
      // matroska livre des PTS réordonnés (B-frames). On reconstruit un DTS monotone
      // ET ≤ PTS via une fenêtre de PTS triée (algo pts_buffer de FFmpeg) : le DTS de
      // la frame courante = le plus petit PTS de la fenêtre des R+1 dernières frames.
      // On ne TOUCHE JAMAIS le PTS (sinon CTS cassé = noir). Amorçage = R frames
      // fantômes sous le 1ᵉʳ PTS (avoid_negative_ts décale le tout à ≥ 0).
      int64_t dur = pkt->duration > 0 ? pkt->duration : 1;
      int64_t p = (pkt->pts != AV_NOPTS_VALUE)
                    ? pkt->pts
                    : (last_dts[oidx] == INT64_MIN ? 0 : last_dts[oidx] + dur);
      int64_t *pb = &ptsbuf[(size_t)oidx * (TVLR_REORDER + 1)];
      if (!primed[oidx]) {
        for (int k = 0; k <= TVLR_REORDER; k++) pb[k] = p - (int64_t)(TVLR_REORDER - k + 1) * dur;
        primed[oidx] = 1;
      }
      pb[0] = p;   // insérer le PTS courant puis re-trier la fenêtre (ascendant)
      for (int k = 0; k < TVLR_REORDER && pb[k] > pb[k + 1]; k++) {
        int64_t t = pb[k]; pb[k] = pb[k + 1]; pb[k + 1] = t;
      }
      pkt->pts = p;
      pkt->dts = pb[0];          // plus petit PTS de la fenêtre = DTS monotone ≤ PTS
      last_dts[oidx] = pb[0];
    } else {
      if (pkt->dts != AV_NOPTS_VALUE && last_dts[oidx] != INT64_MIN && pkt->dts <= last_dts[oidx])
        pkt->dts = last_dts[oidx] + 1;
      if (pkt->dts != AV_NOPTS_VALUE) last_dts[oidx] = pkt->dts;
    }
    int64_t wpts = pkt->pts; AVRational wtb = os->time_base;   // capturés AVANT que write_frame consomme pkt
    int w = av_interleaved_write_frame(oc, pkt);   // prend l'ownership du paquet
    if (w < 0) { TVLOG("write_frame FAIL %d %{public}s", w, TVErr(w)); continue; }
    // Prêt dès que la playlist liste un segment complet → AVPlayer peut démarrer.
    if (!gReady && gGen == gen) {
      NSString *pl = [NSString stringWithContentsOfFile:plPath encoding:NSUTF8StringEncoding error:nil];
      if (pl && [pl rangeOfString:@".m4s"].location != NSNotFound) { gReady = 1; TVLOG("remux: ready (playlist has 1st segment)"); }
    }
    // PHASE 2 FENÊTRÉE : brider la lecture anticipée — rester ~300 s devant la position de lecture
    // (gTVPlayPos, poussée par JS) OU dès que le disque atteint le plafond (TVLR_DISK_CAP) → le
    // remux d'un film 4K ne remplit plus le stockage (fin du « disque plein → CRASH »). En parallèle
    // on PURGE les segments derrière la tête (TVWindow.m). GATE gTVPlayPos>1 : ne pacer QU'APRÈS le
    // démarrage réel — sinon une REPRISE (saut à T) se bloque (le remux séquentiel s'arrête au tampon
    // sans jamais atteindre T → « recommence au début »). Tant que gTVPlayPos=0, le remux file jusqu'à T.
    if (wpts != AV_NOPTS_VALUE) {
      // RELATIF au début de session : wpts est le PTS source ABSOLU (lu AVANT le shift make_zero appliqué
      // par le muxer), gSessionStartSec = startSec absolu → writtenSec 0-based, ALIGNÉ sur gTVPlayPos
      // (relatif = currentTime AVPlayer 0-based) et sur la timeline 0-based des segments. SANS ça,
      // gWrittenSec restait absolu (ex. 494) → gate `≥ PREBUFFER` vrai immédiatement (pas de pré-buffer →
      // stall de démarrage) ET pacing absolu vs relatif (famine).
      double writtenSec = (double)wpts * av_q2d(wtb) - gSessionStartSec;
      if (writtenSec < 0) writtenSec = 0;
      if (writtenSec > gWrittenSec) gWrittenSec = writtenSec;   // durée MAX produite (0-based) → gate pré-buffer + pacing
      if ((npkt % 120) == 0) TVPurgeBehind(dst, gen, gTVPlayPos);
      // Purge AUSSI pendant l'attente : quand la tête avance, gDiskBytes baisse et relâche le gate
      // octets (sinon deadlock — le gate ne se rouvrirait jamais sans purge).
      while (gReady && gTVPlayPos > 1.0 && gGen == gen && !gError &&
             (writtenSec > gTVPlayPos + 300.0 || gDiskBytes > TVLR_DISK_CAP)) {
        TVPurgeBehind(dst, gen, gTVPlayPos);
        usleep(200000);
      }
    }
    if ((++npkt % 2000) == 0) TVLOG("remux: %lld pkts (writtenSec=%.0f pos=%.0f disk=%lldMo)", npkt, gWrittenSec, gTVPlayPos, gDiskBytes / (1024 * 1024));
  }
  if (aXcode && hdrWritten) TVAudioTranscode(oc, adec, aenc, aswr, afifo, aOutIdx, &aNextPts, aInTb, NULL);  // flush décodeur+encodeur audio
  if (hdrWritten) av_write_trailer(oc);   // #EXT-X-ENDLIST → playlist VOD complète (seek total)
  else if (ret >= 0) ret = -1;            // fini sans jamais pouvoir écrire le header → échec propre
  TVLOG("remux: done, %lld packets, err=%d", npkt, gError);

end:
  if (xbsf) av_bsf_free(&xbsf);
  if (pkt)  av_packet_free(&pkt);
  if (smap) av_free(smap);
  if (last_dts) av_free(last_dts);
  if (ptsbuf) av_free(ptsbuf);
  if (primed) av_free(primed);
  if (adec)  avcodec_free_context(&adec);
  if (aenc)  avcodec_free_context(&aenc);
  if (aswr)  swr_free(&aswr);
  if (afifo) av_audio_fifo_free(afifo);
  if (oc && oc->pb) avio_closep(&oc->pb);
  if (oc)   avformat_free_context(oc);
  if (ic)   avformat_close_input(&ic);
  if (gGen == gen) {            // flags GLOBAUX réservés à la session courante
    if (ret < 0) gError = 1;
    gReady = 1;                 // débloque l'attente resolve()/handler même en cas d'échec
    gDone = 1;
  } else {                      // supplantée → ne PAS toucher les flags (dossier réutilisé par la session courante)
    TVLOG("remux: superseded gen=%d → exit", gen);
  }
}
