//
//  TVHLSPlaylist.m  (tvOS / Apple TV) — setup du muxer HLS (fMP4) + génération du
//  master.m3u8 (CODECS/SUPPLEMENTAL-CODECS/VIDEO-RANGE pour engager le badge DV/HDR).
//  Extrait VERBATIM de TVDoRemux (refactor 1:1, unity build). Seule transformation :
//  les `goto end` inline deviennent `return -1` ici (un goto ne franchit pas une
//  frontière de fonction) ; TVRemuxEngine fait le `goto end` sur l'échec retourné.
//  #importé par TVLocalRemux.m → même unité de traduction.
//

#import "TVCommon.h"

// dst = RÉPERTOIRE HLS. On produit une playlist EVENT (croissante + seekable) + des
// segments fMP4 COMPLETS → AVPlayer lit l'index (aucun scan du fichier), démarre sur le
// 1ᵉʳ segment. Le segment d'init fMP4 porte hvcC+dvcC → DV/HDR natif + badge.
static int TVHLSOpenOutput(AVFormatContext **poc, const char *dst) {
  char playlist[2048]; snprintf(playlist, sizeof(playlist), "%s/index.m3u8", dst);
  avformat_alloc_output_context2(poc, NULL, "hls", playlist);
  if (!*poc) { TVLOG("alloc_output(hls) FAIL"); return -1; }
  (*poc)->strict_std_compliance = FF_COMPLIANCE_UNOFFICIAL;
  return 0;
}

static int TVHLSWriteHeader(AVFormatContext *oc, const char *dst) {
  int ret = 0;
  char segpat[2048]; snprintf(segpat, sizeof(segpat), "%s/seg%%05d.m4s", dst);
  AVDictionary *opts = NULL;
  av_dict_set(&opts, "hls_segment_type", "fmp4", 0);                 // segments fMP4 (portent dvcC/colr)
  av_dict_set(&opts, "hls_fmp4_init_filename", "init.mp4", 0);
  av_dict_set(&opts, "hls_segment_filename", segpat, 0);
  av_dict_set(&opts, "hls_time", "2", 0);                            // ~2 s/segment → démarrage rapide
  av_dict_set_int(&opts, "hls_list_size", 0, 0);                     // garder TOUS les segments (seekable)
  av_dict_set(&opts, "hls_playlist_type", "event", 0);              // playlist croissante + seekable
  av_dict_set(&opts, "hls_flags", "independent_segments+temp_file", 0);  // segment écrit puis renommé (atomique)
  // make_zero TOUJOURS → segments 0-based (rebase le 1ᵉʳ PTS écrit à 0, absorbe le DTS amorcé négatif de
  // la reconstruction B-frames vidéo). CRUCIAL : AVPlayer mesure currentTime relativement au DÉBUT de la
  // playlist HLS (PAS le tfdt absolu) → segments, gWrittenSec, gTVPlayPos et currentTime sont TOUS
  // 0-based et ALIGNÉS (sinon le pacing comparait absolu/relatif → le remux s'arrêtait trop tôt → famine
  // AVPlayer / MEDIA_PLAYBACK_STALL). La position ABSOLUE (reprise/scrubber/sous-titres) est restaurée par
  // un offset confiné dans AVPlayerSurface. L'av_seek_frame reste (la sortie est rebasée à 0).
  av_dict_set(&opts, "avoid_negative_ts", "make_zero", 0);
  // PAS d'avio_open : le muxer hls ouvre lui-même playlist + segments.
  if ((ret = avformat_write_header(oc, &opts)) < 0) { TVLOG("write_header FAIL %d %{public}s", ret, TVErr(ret)); av_dict_free(&opts); return ret; }
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
  return 0;
}

// Master playlist : déclare CODECS (dvh1 pour le Dolby Vision) + VIDEO-RANGE. C'est CE
// signal que tvOS lit pour engager le DV/HDR (badge officiel) ; une media-playlist seule
// ne signale rien. La media-playlist (index.m3u8) reste pointée en variant.
static void TVHLSWriteMaster(AVFormatContext *oc, AVFormatContext *ic, const char *dst,
                             int v_dvp, int v_blcompat, int v_dvlevel, int v_w, int v_h,
                             const char *a_codec) {
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
}

// ===== Vraie pause permanente : réécriture du manifeste servi pendant la pause (cf. prototype TVCommon.h) =====
NSString *TVBuildPausedManifest(NSString *eventPath, NSString *dir) {
  NSString *src = [NSString stringWithContentsOfFile:eventPath encoding:NSUTF8StringEncoding error:nil];
  if (!src.length) return nil;   // illisible / demi-écrit → laisser servir le fichier brut

  // Diagnostic throttlé : UNE ligne par changement de (session, mode) — pas par poll AVPlayer.
  { static int lastGen = -1, lastMode = -1;
    if (gGen != lastGen || gSnapshotMode != lastMode) {
      lastGen = gGen; lastMode = gSnapshotMode;
      TVLOG("pause-manifest: gen=%d mode=%d (%lu o)", gGen, gSnapshotMode, (unsigned long)src.length);
    } }

  // Variante A — keepalive : EVENT inchangé + un commentaire qui CHANGE à chaque requête. AVPlayer voit un
  // manifeste « jamais inchangé » → ne déclare pas le flux corrompu (pari sur la régression tvOS 18.x).
  if (gSnapshotMode == 0) {
    static volatile int ka = 0; int n = ++ka;   // race bénigne : seul le CHANGEMENT compte, pas la valeur
    return [src stringByAppendingFormat:@"#tnt-keepalive:%d\n", n];
  }

  // Variante B — snapshot VOD : EVENT → VOD + ENDLIST, en rognant en tête les segments DÉJÀ purgés avant la
  // pause (FFmpeg les liste encore). La purge ne retire que le front contiguë → le reste est un VOD valide.
  NSArray<NSString *> *lines = [src componentsSeparatedByString:@"\n"];
  NSUInteger firstSeg = NSNotFound;
  long long baseSeq = 0;
  for (NSUInteger i = 0; i < lines.count; i++) {
    if ([lines[i] hasPrefix:@"#EXT-X-MEDIA-SEQUENCE:"]) baseSeq = [[lines[i] substringFromIndex:[@"#EXT-X-MEDIA-SEQUENCE:" length]] longLongValue];
    if ([lines[i] hasPrefix:@"#EXTINF"]) { firstSeg = i; break; }
  }
  if (firstSeg == NSNotFound) return nil;   // pas encore de segment listé → servir le brut

  NSFileManager *fm = [NSFileManager defaultManager];
  NSMutableArray<NSString *> *segs = [NSMutableArray array];
  long long dropped = 0; BOOL trimming = YES;
  for (NSUInteger i = firstSeg; i + 1 < lines.count; i++) {
    if (![lines[i] hasPrefix:@"#EXTINF"]) continue;
    NSString *name = [lines[i + 1] stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
    BOOL exists = name.length && [fm fileExistsAtPath:[dir stringByAppendingPathComponent:name]];
    if (trimming && !exists) { dropped++; i++; continue; }   // segment purgé en tête → sauter la paire
    trimming = NO;
    [segs addObject:lines[i]]; [segs addObject:lines[i + 1]]; i++;
  }
  if (segs.count == 0) return nil;

  NSMutableArray<NSString *> *out = [NSMutableArray array];
  for (NSUInteger i = 0; i < firstSeg; i++) {   // en-tête : retyper VOD + recaler MEDIA-SEQUENCE selon le rognage
    if ([lines[i] hasPrefix:@"#EXT-X-PLAYLIST-TYPE"]) { [out addObject:@"#EXT-X-PLAYLIST-TYPE:VOD"]; continue; }
    if ([lines[i] hasPrefix:@"#EXT-X-MEDIA-SEQUENCE:"]) { [out addObject:[NSString stringWithFormat:@"#EXT-X-MEDIA-SEQUENCE:%lld", baseSeq + dropped]]; continue; }
    [out addObject:lines[i]];
  }
  [out addObjectsFromArray:segs];
  [out addObject:@"#EXT-X-ENDLIST"];
  { static long long lastDropLog = -1;   // log du snapshot VOD au 1ᵉʳ build / changement de rognage
    if (dropped != lastDropLog) {
      lastDropLog = dropped;
      TVLOG("pause-manifest: snapshot VOD segs=%lu dropped=%lld seq=%lld",
            (unsigned long)(segs.count / 2), dropped, baseSeq + dropped);
    } }
  return [[out componentsJoinedByString:@"\n"] stringByAppendingString:@"\n"];
}
