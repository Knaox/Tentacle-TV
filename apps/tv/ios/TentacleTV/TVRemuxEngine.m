//
//  TVRemuxEngine.m  (tvOS / Apple TV) — moteur de remux FFmpeg du lecteur « façon
//  Infuse » : open input, seek de reprise, reconstruction DTS, boucle de paquets,
//  flush, cleanup. Le mapping des flux vit dans TVStreamMap.m, le pacing/purge dans
//  TVWindow.m (TVPaceAndPurge), le setup HLS/master dans TVHLSPlaylist.m — unity
//  build, refactor 1:1 (budget 300 lignes). Les DÉFINITIONS des globals de session
//  vivent ICI (un seul endroit ; le reste est `extern` dans TVCommon.h).
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
// Origine ABSOLUE de la timeline playlist. Provisoirement le startSec demandé (posé par start()),
// AFFINÉE au fil des premiers paquets muxés (TVNoteFirstDts) : `avoid_negative_ts=make_zero`
// rebase la sortie sur le PREMIER DTS muxé (keyframe ≤ T − amorce B-frames), pas sur T.
// Consommée par : offset JS (start() la résout), fenêtre withinAvail, purge, pacing.
volatile double gSessionStartSec = 0;   // gDiskBytes est défini dans TVWindow.m
volatile double   gTVMinFirstDts = DBL_MAX;  // min des 1ᵉʳˢ DTS écrits par flux (cf. TVNoteFirstDts)
volatile uint32_t gTVFirstSeenMask = 0;      // bit par flux de sortie : 1ᵉʳ paquet déjà noté

static void TVDoRemux(const char *src, const char *dst, int gen) {
  AVFormatContext *ic = NULL, *oc = NULL;
  int *smap = NULL;
  int64_t *last_dts = NULL;
  int64_t *ptsbuf = NULL;   // fenêtre PTS triée par flux vidéo (reconstruction DTS)
  int *primed = NULL;
  AVPacket *pkt = NULL;
  NSString *plPath = nil;   // déclaré ici (ARC) pour ne pas bloquer les goto end
  // Mapping des flux (TVStreamMap.m) : indices, infos DV du master, contexte transcode audio.
  TVMapOut m = { .vInIdx = -1, .vOutIdx = -1, .v_dvp = -1, .v_blcompat = -1,
                 .aOutIdx = -1, .aInTb = (AVRational){1, 48000} };
  // aNextPts = AV_NOPTS_VALUE → ANCRÉ sur la 1ʳᵉ frame audio décodée (timeline source, synchro
  // labiale) ; aTrim = échantillons à rogner (compensation de chevauchement, TVAudioTranscode).
  int64_t aNextPts = AV_NOPTS_VALUE, aTrim = 0;
  // Hygiène des timestamps du chemin COPIE (TVTimestamps.m) : vTs observe la vidéo,
  // aTs porte le clamp/drop de l'audio copié (l'audio transcodé a sa propre compensation).
  TVTsTrack vTs = TV_TS_INIT, aTs = TV_TS_INIT;
  // Extradata vidéo ABSENTE (HEVC/H.264 in-band : TS, MKV sans CodecPrivate…) : sans elle le
  // muxer écrit un hvcC/avcC VIDE → flux invalide (AVPlayer -19601, « façon CLI » ffmpeg qui
  // insère extract_extradata automatiquement). On DIFFÈRE le header et on extrait les
  // VPS/SPS/PPS du 1ᵉʳ paquet vidéo via le BSF extract_extradata (inclus dans le build).
  AVBSFContext *xbsf = NULL;
  int hdrWritten = 0, xTried = 0;
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
  // linéaire (le gate gWrittenSec≥prebuf attendra la production comme avant). NB : la sortie est
  // rebasée à 0 par `avoid_negative_ts=make_zero` (TVHLSPlaylist) — l'origine RÉELLE (keyframe ≤ T,
  // amorce B-frames comprise) est capturée par TVNoteFirstDts → gSessionStartSec exact → l'offset
  // absolu est restitué côté JS (AVPlayerSurface) sans mentir d'un GOP.
  if (gWantStartSec > 0) {
    int64_t seek_ts = (int64_t)gWantStartSec * AV_TIME_BASE;
    int sret = avformat_seek_file(ic, -1, INT64_MIN, seek_ts, seek_ts, AVSEEK_FLAG_BACKWARD);
    TVLOG("remux: seek input to %ds → %d %{public}s", gWantStartSec, sret, sret < 0 ? TVErr(sret) : "ok");
  }

  if ((ret = TVHLSOpenOutput(&oc, dst)) < 0) goto end;

  smap = av_malloc_array(ic->nb_streams, sizeof(int));
  if (!smap) { ret = -1; goto end; }
  if ((ret = TVMapStreams(ic, oc, smap, &m)) < 0) goto end;
  last_dts = av_malloc_array(m.oi, sizeof(int64_t));
  ptsbuf   = av_malloc_array((size_t)m.oi * (TVLR_REORDER + 1), sizeof(int64_t));
  primed   = av_calloc(m.oi, sizeof(int));
  if (!last_dts || !ptsbuf || !primed) { ret = -1; goto end; }
  for (int k = 0; k < m.oi; k++) last_dts[k] = INT64_MIN;

  // Extradata vidéo absente/dégénérée (HEVC/H.264) → header DIFFÉRÉ : l'écrire maintenant
  // graverait un hvcC/avcC vide (flux invalide). On extrait les VPS/SPS/PPS in-band du 1ᵉʳ
  // paquet vidéo via `<codec>_mp4toannexb,extract_extradata` : mp4toannexb convertit les
  // paquets length-prefixed (MKV/MP4) en annexb — extract_extradata NE lit QUE l'annexb
  // (« No start code is found » sinon) et passe-through les flux déjà annexb (TS).
  if (m.vOutIdx >= 0 &&
      (oc->streams[m.vOutIdx]->codecpar->codec_id == AV_CODEC_ID_HEVC ||
       oc->streams[m.vOutIdx]->codecpar->codec_id == AV_CODEC_ID_H264) &&
      TVVideoParamsMissing(oc->streams[m.vOutIdx]->codecpar)) {
    const char *chain = (oc->streams[m.vOutIdx]->codecpar->codec_id == AV_CODEC_ID_HEVC)
      ? "hevc_mp4toannexb,extract_extradata" : "h264_mp4toannexb,extract_extradata";
    if (av_bsf_list_parse_str(chain, &xbsf) >= 0 && xbsf) {
      avcodec_parameters_copy(xbsf->par_in, ic->streams[m.vInIdx]->codecpar);
      xbsf->time_base_in = ic->streams[m.vInIdx]->time_base;
      if (av_bsf_init(xbsf) < 0) { av_bsf_free(&xbsf); xbsf = NULL; }
    }
    TVLOG("remux: video extradata absente/dégénérée (%d o) → header différé, extraction in-band (bsf=%d)",
          oc->streams[m.vOutIdx]->codecpar->extradata_size, xbsf ? 1 : 0);
    if (!xbsf) { ret = -1; goto end; }   // BSF indispo → échec PROPRE (repli JS transcode)
  } else {
    if ((ret = TVHLSWriteHeader(oc, dst)) < 0) goto end;
    TVHLSWriteMaster(oc, ic, dst, m.v_dvp, m.v_blcompat, m.v_dvlevel, m.v_w, m.v_h, m.a_codec);
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
    if (xbsf && oidx == m.vOutIdx) {
      if (av_bsf_send_packet(xbsf, pkt) < 0) { av_packet_unref(pkt); continue; }
      if (av_bsf_receive_packet(xbsf, pkt) < 0) continue;   // EAGAIN improbable (BSF 1-in/1-out)
      if (!hdrWritten) {
        size_t xsz = 0;
        uint8_t *xd = av_packet_get_side_data(pkt, AV_PKT_DATA_NEW_EXTRADATA, &xsz);
        if (xd && xsz > 0) {
          AVCodecParameters *vp = oc->streams[m.vOutIdx]->codecpar;
          av_freep(&vp->extradata);
          vp->extradata = av_mallocz(xsz + AV_INPUT_BUFFER_PADDING_SIZE);
          if (vp->extradata) { memcpy(vp->extradata, xd, xsz); vp->extradata_size = (int)xsz; }
        }
        if (oc->streams[m.vOutIdx]->codecpar->extradata_size > 0) {
          TVLOG("remux: extradata in-band extraite (%d o) → header", oc->streams[m.vOutIdx]->codecpar->extradata_size);
          if ((ret = TVHLSWriteHeader(oc, dst)) < 0) goto end;
          TVHLSWriteMaster(oc, ic, dst, m.v_dvp, m.v_blcompat, m.v_dvlevel, m.v_w, m.v_h, m.a_codec);
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
    if (m.aXcode && oidx == m.aOutIdx) {    // piste audio transcodée (DTS/TrueHD/FLAC → EAC3)
      TVAudioTranscode(oc, m.adec, m.aenc, m.aswr, m.afifo, m.aOutIdx, &aNextPts, m.aInTb, &aTrim, pkt);
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
      TVVideoTsLog(&vTs, p, dur, os->time_base, oidx);   // observation seule (anomalies source)
    } else {
      // Hygiène du chemin copie (TVTimestamps.m) : trous/reculs source loggés, clamp
      // monotone historique appliqué ; retour non nul = paquet à dropper (recul majeur).
      if (TVCopyTsRepair(&aTs, pkt, os->time_base, oidx)) { av_packet_unref(pkt); continue; }
    }
    int64_t wpts = pkt->pts; AVRational wtb = os->time_base;   // capturés AVANT que write_frame consomme pkt
    TVNoteFirstDts(oidx, pkt->dts, os->time_base);   // origine réelle de la timeline (make_zero rebase sur ce DTS)
    int w = av_interleaved_write_frame(oc, pkt);   // prend l'ownership du paquet
    if (w < 0) { TVLOG("write_frame FAIL %d %{public}s", w, TVErr(w)); continue; }
    // Prêt dès que la playlist liste un segment complet → AVPlayer peut démarrer.
    if (!gReady && gGen == gen) {
      NSString *pl = [NSString stringWithContentsOfFile:plPath encoding:NSUTF8StringEncoding error:nil];
      if (pl && [pl rangeOfString:@".m4s"].location != NSNotFound) { gReady = 1; TVLOG("remux: ready (playlist has 1st segment)"); }
    }
    // Pacing fenêtré + purge derrière la tête (TVWindow.m) : bride à ~300 s devant la lecture
    // et sous le plafond disque — un film 4K ne remplit plus le stockage.
    TVPaceAndPurge(dst, gen, wpts, wtb, npkt);
    if ((++npkt % 2000) == 0) TVLOG("remux: %lld pkts (writtenSec=%.0f pos=%.0f disk=%lldMo)", npkt, gWrittenSec, gTVPlayPos, gDiskBytes / (1024 * 1024));
  }
  if (m.aXcode && hdrWritten)   // flush décodeur+encodeur audio
    TVAudioTranscode(oc, m.adec, m.aenc, m.aswr, m.afifo, m.aOutIdx, &aNextPts, m.aInTb, &aTrim, NULL);
  if (hdrWritten) av_write_trailer(oc);   // #EXT-X-ENDLIST → playlist VOD complète (seek total)
  else if (ret >= 0) ret = -1;            // fini sans jamais pouvoir écrire le header → échec propre
  TVLOG("remux: done, %lld packets, err=%d (ts: aClamp=%lld aGap=%lld aDrop=%lld vGap=%lld)",
        npkt, gError, aTs.nClamp, aTs.nGap, aTs.nDrop, vTs.nGap);

end:
  if (xbsf) av_bsf_free(&xbsf);
  if (pkt)  av_packet_free(&pkt);
  if (smap) av_free(smap);
  if (last_dts) av_free(last_dts);
  if (ptsbuf) av_free(ptsbuf);
  if (primed) av_free(primed);
  if (m.adec)  avcodec_free_context(&m.adec);
  if (m.aenc)  avcodec_free_context(&m.aenc);
  if (m.aswr)  swr_free(&m.aswr);
  if (m.afifo) av_audio_fifo_free(m.afifo);
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
