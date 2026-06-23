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
