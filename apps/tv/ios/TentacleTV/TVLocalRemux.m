//
//  TVLocalRemux.m  (tvOS / Apple TV) — lecteur « façon Infuse »
//  Démux FFmpeg du fichier brut Jellyfin → MP4 fragmenté DV → serveur local
//  GCDWebServer → AVPlayer Direct Play. MVP lecture linéaire.
//  (Version instrumentée NSLog pour diagnostic.)
//

#import <React/RCTBridgeModule.h>
#import <GCDWebServer/GCDWebServer.h>
#import <GCDWebServer/GCDWebServerStreamedResponse.h>
#import <GCDWebServer/GCDWebServerRequest.h>
#import <GCDWebServer/GCDWebServerFileResponse.h>
#import <libavformat/avformat.h>
#import <libavutil/avutil.h>
#import <libavcodec/avcodec.h>
#import <libavutil/dovi_meta.h>
#import <os/log.h>

#define TVLOG(fmt, ...) os_log_error(OS_LOG_DEFAULT, "[TVLR] " fmt, ##__VA_ARGS__)
#define TVLR_REORDER 8   // profondeur de réordonnancement B-frames couverte (HEVC grand public ≤ 4-8)

// Route les logs internes de FFmpeg vers Console.app (raison exacte des échecs).
static void TVAvLog(void *avcl, int level, const char *fmt, va_list vl) {
  if (level > AV_LOG_WARNING) return;
  char line[512];
  vsnprintf(line, sizeof(line), fmt, vl);
  os_log_error(OS_LOG_DEFAULT, "[TVLR-ff] %{public}s", line);
}

@interface TVLocalRemux : NSObject <RCTBridgeModule>
@end

static GCDWebServer *gServer;
static NSString     *gOutPath;
static long long     gTotalEstimate;
static volatile int  gDone;
static volatile int  gError;
static volatile int  gReady;   // 1 dès que la playlist liste un 1ᵉʳ segment
static volatile int  gGen;     // génération de session : un nouveau start() annule le remux précédent
static dispatch_queue_t gRemuxQueue;
static NSString     *gCurrentSource;
static NSString     *gCurrentUrl;
// Plage dynamique + fps détectés par le remux, lus par TVDisplayCriteria pour engager le
// badge HDR/DV via AVDisplayCriteria (API privée, comme Kodi). 0=SDR, 3=HDR10, 4=Dolby Vision.
int    gTVDynRange = 0;
double gTVFps = 0;

static long long TVFileSize(NSString *path) {
  NSDictionary *a = [[NSFileManager defaultManager] attributesOfItemAtPath:path error:nil];
  return a ? (long long)[a fileSize] : 0;
}

static const char *TVErr(int ret) {
  static char buf[256]; av_strerror(ret, buf, sizeof(buf)); return buf;
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
  TVLOG("remux: size estimate=%lld", gTotalEstimate);

  // dst = RÉPERTOIRE HLS. On produit une playlist EVENT (croissante + seekable) + des
  // segments fMP4 COMPLETS → AVPlayer lit l'index (aucun scan du fichier), démarre sur le
  // 1ᵉʳ segment. Le segment d'init fMP4 porte hvcC+dvcC → DV/HDR natif + badge.
  char playlist[2048]; snprintf(playlist, sizeof(playlist), "%s/index.m3u8", dst);
  avformat_alloc_output_context2(&oc, NULL, "hls", playlist);
  if (!oc) { ret = -1; TVLOG("alloc_output(hls) FAIL"); goto end; }
  oc->strict_std_compliance = FF_COMPLIANCE_UNOFFICIAL;

  smap = av_malloc_array(ic->nb_streams, sizeof(int));
  if (!smap) { ret = -1; goto end; }
  int oi = 0, audioTaken = 0;
  for (unsigned i = 0; i < ic->nb_streams; i++) {
    smap[i] = -1;
    AVCodecParameters *p = ic->streams[i]->codecpar;
    if (p->codec_type == AVMEDIA_TYPE_VIDEO) {
    } else if (p->codec_type == AVMEDIA_TYPE_AUDIO && !audioTaken) {
      enum AVCodecID id = p->codec_id;
      if (id != AV_CODEC_ID_AAC && id != AV_CODEC_ID_AC3 && id != AV_CODEC_ID_EAC3 && id != AV_CODEC_ID_ALAC) continue;
      audioTaken = 1;
    } else continue;
    AVStream *os = avformat_new_stream(oc, NULL);
    if (!os) { ret = -1; goto end; }
    if ((ret = avcodec_parameters_copy(os->codecpar, p)) < 0) goto end;
    if (p->codec_type == AVMEDIA_TYPE_VIDEO) {
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
      if (p->codec_type == AVMEDIA_TYPE_AUDIO)
        a_codec = (p->codec_id == AV_CODEC_ID_EAC3) ? "ec-3"
                : (p->codec_id == AV_CODEC_ID_AC3)  ? "ac-3"
                : (p->codec_id == AV_CODEC_ID_AAC)  ? "mp4a.40.2"
                : (p->codec_id == AV_CODEC_ID_ALAC) ? "alac" : NULL;
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

  char segpat[2048]; snprintf(segpat, sizeof(segpat), "%s/seg%%05d.m4s", dst);
  AVDictionary *opts = NULL;
  av_dict_set(&opts, "hls_segment_type", "fmp4", 0);                 // segments fMP4 (portent dvcC/colr)
  av_dict_set(&opts, "hls_fmp4_init_filename", "init.mp4", 0);
  av_dict_set(&opts, "hls_segment_filename", segpat, 0);
  av_dict_set(&opts, "hls_time", "2", 0);                            // ~2 s/segment → démarrage rapide
  av_dict_set_int(&opts, "hls_list_size", 0, 0);                     // garder TOUS les segments (seekable)
  av_dict_set(&opts, "hls_playlist_type", "event", 0);              // playlist croissante + seekable
  av_dict_set(&opts, "hls_flags", "independent_segments+temp_file", 0);  // segment écrit puis renommé (atomique)
  av_dict_set(&opts, "avoid_negative_ts", "make_zero", 0);
  // PAS d'avio_open : le muxer hls ouvre lui-même playlist + segments.
  if ((ret = avformat_write_header(oc, &opts)) < 0) { TVLOG("write_header FAIL %d %{public}s", ret, TVErr(ret)); av_dict_free(&opts); goto end; }
  av_dict_free(&opts);
  { AVCodecParameters *vp = oc->streams[0]->codecpar;
    uint32_t tg = vp->codec_tag;
    int has_dovi = !!av_packet_side_data_get(vp->coded_side_data, vp->nb_coded_side_data, AV_PKT_DATA_DOVI_CONF);
    int has_mdcv = !!av_packet_side_data_get(vp->coded_side_data, vp->nb_coded_side_data, AV_PKT_DATA_MASTERING_DISPLAY_METADATA);
    int has_clli = !!av_packet_side_data_get(vp->coded_side_data, vp->nb_coded_side_data, AV_PKT_DATA_CONTENT_LIGHT_LEVEL);
    TVLOG("remux: header written. video[0] tag=%c%c%c%c extradata=%d color(pri/trc/spc)=%d/%d/%d dovi=%d mdcv=%d clli=%d",
          tg & 0xff, (tg >> 8) & 0xff, (tg >> 16) & 0xff, (tg >> 24) & 0xff,
          vp->extradata_size, vp->color_primaries, vp->color_trc, vp->color_space,
          has_dovi, has_mdcv, has_clli); }

  // Master playlist : déclare CODECS (dvh1 pour le Dolby Vision) + VIDEO-RANGE. C'est CE
  // signal que tvOS lit pour engager le DV/HDR (badge officiel) ; une media-playlist seule
  // ne signale rien. La media-playlist (index.m3u8) reste pointée en variant.
  {
    enum AVColorTransferCharacteristic trc = oc->streams[0]->codecpar->color_trc;
    const char *vrange = (trc == AVCOL_TRC_SMPTE2084) ? "PQ"
                       : (trc == AVCOL_TRC_ARIB_STD_B67) ? "HLG" : "SDR";
    // niveau HEVC : codecpar->level vaut souvent -99 (inconnu) → lire general_level_idc dans le
    // hvcC (octet 12), repli 153 (= niveau 5.1, standard 4K). Un "L-99" rendrait le CODECS invalide.
    AVCodecParameters *vpar = oc->streams[0]->codecpar;
    int hlevel = (vpar->level > 0) ? vpar->level
               : ((vpar->extradata && vpar->extradata_size > 12) ? vpar->extradata[12] : 153);
    char codecs[160]; int co = 0;
    if (v_dvp == 5) co += snprintf(codecs + co, sizeof(codecs) - co, "dvh1.05.%02d", v_dvlevel ? v_dvlevel : 6);
    else            co += snprintf(codecs + co, sizeof(codecs) - co, "hvc1.2.4.L%d.B0", hlevel);
    if (a_codec)    co += snprintf(codecs + co, sizeof(codecs) - co, ",%s", a_codec);
    // DV profil 8.1 (cross-compat) : base hvc1 dans CODECS + DV dans SUPPLEMENTAL-CODECS (spec
    // Apple/Dolby/WWDC24). Le BRAND doit matcher VIDEO-RANGE : PQ→db1p, HLG→db4h, SDR→db2g.
    char suppl[80]; suppl[0] = '\0';
    if (v_dvp == 8) {
      const char *dvbrand = (v_blcompat == 4) ? "db4h" : (v_blcompat == 2) ? "db2g" : "db1p";
      snprintf(suppl, sizeof(suppl), "SUPPLEMENTAL-CODECS=\"dvh1.08.%02d/%s\",", v_dvlevel ? v_dvlevel : 6, dvbrand);
    }
    long long band = (ic->duration > 0) ? (gTotalEstimate * 8 * AV_TIME_BASE / ic->duration) : 40000000;
    char master[640];
    int mn = snprintf(master, sizeof(master),
      "#EXTM3U\n#EXT-X-VERSION:7\n"
      "#EXT-X-STREAM-INF:BANDWIDTH=%lld,CODECS=\"%s\",%sVIDEO-RANGE=%s,RESOLUTION=%dx%d\nindex.m3u8\n",
      band, codecs, suppl, vrange, v_w, v_h);
    char masterPath[2048]; snprintf(masterPath, sizeof(masterPath), "%s/master.m3u8", dst);
    FILE *mf = fopen(masterPath, "w");
    if (mf) { fwrite(master, 1, (size_t)mn, mf); fclose(mf); }
    TVLOG("remux: master.m3u8 (%d o, band=%lld dur=%lld):\n%{public}s", mn, band, (long long)ic->duration, master);
  }

  pkt = av_packet_alloc();
  if (!pkt) { ret = -1; goto end; }
  plPath = [NSString stringWithFormat:@"%s/index.m3u8", dst];
  long long npkt = 0; int dbg = 0;
  while (!gError && gGen == gen && av_read_frame(ic, pkt) >= 0) {
    int si = pkt->stream_index;
    int oidx = (si >= 0 && si < (int)ic->nb_streams) ? smap[si] : -1;
    if (oidx < 0) { av_packet_unref(pkt); continue; }
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
    int w = av_interleaved_write_frame(oc, pkt);   // prend l'ownership du paquet
    if (w < 0) { TVLOG("write_frame FAIL %d %{public}s", w, TVErr(w)); continue; }
    // Prêt dès que la playlist liste un segment complet → AVPlayer peut démarrer.
    if (!gReady && gGen == gen) {
      NSString *pl = [NSString stringWithContentsOfFile:plPath encoding:NSUTF8StringEncoding error:nil];
      if (pl && [pl rangeOfString:@".m4s"].location != NSNotFound) { gReady = 1; TVLOG("remux: ready (playlist has 1st segment)"); }
    }
    if ((++npkt % 2000) == 0) TVLOG("remux: %lld packets", npkt);
  }
  av_write_trailer(oc);   // #EXT-X-ENDLIST → playlist VOD complète (seek total)
  TVLOG("remux: done, %lld packets, err=%d", npkt, gError);

end:
  if (pkt)  av_packet_free(&pkt);
  if (smap) av_free(smap);
  if (last_dts) av_free(last_dts);
  if (ptsbuf) av_free(ptsbuf);
  if (primed) av_free(primed);
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

@implementation TVLocalRemux
RCT_EXPORT_MODULE();
+ (BOOL)requiresMainQueueSetup { return NO; }

RCT_EXPORT_METHOD(start:(NSString *)sourceUrl
                  dynamicRange:(NSInteger)dynRange
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  TVLOG("start: entry dyn=%ld", (long)dynRange);
  static dispatch_once_t once;
  dispatch_once(&once, ^{ TVLOG("init network"); av_log_set_callback(TVAvLog); avformat_network_init(); gRemuxQueue = dispatch_queue_create("tv.localremux", DISPATCH_QUEUE_SERIAL); });

  dispatch_async(dispatch_get_main_queue(), ^{
   @try {
    TVLOG("start: main block");
    if (!sourceUrl.length) { reject(@"args", @"empty sourceUrl", nil); return; }
    gTVDynRange = (int)dynRange;   // plage dynamique AUTORITAIRE (JS/Jellyfin) pour le badge

    // Dossier FIXE + serveur UNIQUE (port stable). Le dossier est vidé/réécrit par chaque
    // nouvelle session (dans TVDoRemux, après que la file série a fait quitter la précédente).
    if (!gOutPath) gOutPath = [NSTemporaryDirectory() stringByAppendingPathComponent:@"tvhls"];
    [[NSFileManager defaultManager] createDirectoryAtPath:gOutPath withIntermediateDirectories:YES attributes:nil error:nil];
    if (!gServer) {
      NSString *dir = gOutPath;
      gServer = [[GCDWebServer alloc] init];
      // Sert les fichiers HLS (index.m3u8 + init.mp4 + seg*.m4s) : segments COMPLETS → Range natif.
      [gServer addDefaultHandlerForMethod:@"GET" requestClass:[GCDWebServerRequest class]
                             processBlock:^GCDWebServerResponse *(GCDWebServerRequest *req) {
        NSString *name = req.path.lastPathComponent;          // basename only (anti-traversal)
        NSString *file = [dir stringByAppendingPathComponent:name];
        if (![[NSFileManager defaultManager] fileExistsAtPath:file]) {
          TVLOG("handler 404: %{public}s", name.UTF8String);
          return [GCDWebServerResponse responseWithStatusCode:404];
        }
        NSString *ext = name.pathExtension.lowercaseString;
        NSString *ct = [ext isEqualToString:@"m3u8"] ? @"application/vnd.apple.mpegurl" : @"video/mp4";
        GCDWebServerFileResponse *resp = req.hasByteRange
          ? [GCDWebServerFileResponse responseWithFile:file byteRange:req.byteRange]
          : [GCDWebServerFileResponse responseWithFile:file];
        resp.contentType = ct;
        [resp setValue:@"bytes" forAdditionalHeader:@"Accept-Ranges"];
        return resp;
      }];
    }
    if (!gServer.isRunning) {
      NSError *err = nil;
      BOOL ok = [gServer startWithOptions:@{ GCDWebServerOption_BindToLocalhost: @YES, GCDWebServerOption_Port: @0 } error:&err];
      TVLOG("server start ok=%d port=%lu", ok, (unsigned long)gServer.port);
      if (!ok) { reject(@"server", @"GCDWebServer start failed", err); return; }
    }
    // On joue la MEDIA playlist directement (le master playlist est rejeté « unsupported url »
    // par AVPlayer/react-native-video). Le badge HDR/DV est engagé à la main via TVDisplayCriteria.
    NSString *url = [NSString stringWithFormat:@"http://127.0.0.1:%lu/index.m3u8", (unsigned long)gServer.port];
    gCurrentUrl = url;

    // MÊME source + pas d'erreur + une session existe déjà → NE PAS relancer le remux, juste
    // attendre ses fichiers. Sinon nouvelle session (annule le remux précédent via gGen).
    int myGen;
    if ([sourceUrl isEqualToString:gCurrentSource] && !gError && gGen > 0) {
      myGen = gGen;
      TVLOG("start: same source → wait files (gen=%d)", myGen);
    } else {
      gCurrentSource = sourceUrl;
      myGen = ++gGen;
      gDone = 0; gError = 0; gReady = 0; gTotalEstimate = 0; gTVFps = 0;
      const char *src = strdup(sourceUrl.UTF8String);
      const char *dst = strdup(gOutPath.UTF8String);
      dispatch_async(gRemuxQueue, ^{ TVDoRemux(src, dst, myGen); free((void *)src); free((void *)dst); });
      TVLOG("start: new session gen=%d", myGen);
    }

    // Résoudre SEULEMENT quand master.m3u8 ET un 1ᵉʳ segment existent (anti-404), pour CETTE session.
    NSString *masterPath = [gOutPath stringByAppendingPathComponent:@"master.m3u8"];
    dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
      int guard = 0;
      while (gGen == myGen && !gError && !(gReady && TVFileSize(masterPath) > 0) && guard++ < 1000) usleep(10000);
      TVLOG("start: gen=%d (cur=%d) ready=%d err=%d master=%lld after %dms", myGen, gGen, gReady, gError, TVFileSize(masterPath), guard * 10);
      if (gGen != myGen) { reject(@"superseded", @"newer session started", nil); return; }
      if (TVFileSize(masterPath) <= 0) { reject(@"remux", @"no master playlist", nil); return; }
      resolve(url);
    });
   } @catch (NSException *ex) {
    TVLOG("start EXCEPTION %s", ex.reason.UTF8String);
    reject(@"exception", ex.reason ?: @"TVLocalRemux start exception", nil);
   }
  });
}

RCT_EXPORT_METHOD(stop) { if (gServer.isRunning) [gServer stop]; }

@end
