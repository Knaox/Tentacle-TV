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
#import <libavformat/avformat.h>
#import <libavutil/avutil.h>
#import <libavcodec/avcodec.h>
#import <os/log.h>

#define TVLOG(fmt, ...) os_log_error(OS_LOG_DEFAULT, "[TVLR] " fmt, ##__VA_ARGS__)

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
static dispatch_queue_t gRemuxQueue;
static NSString     *gCurrentSource;
static NSString     *gCurrentUrl;

static long long TVFileSize(NSString *path) {
  NSDictionary *a = [[NSFileManager defaultManager] attributesOfItemAtPath:path error:nil];
  return a ? (long long)[a fileSize] : 0;
}

static const char *TVErr(int ret) {
  static char buf[256]; av_strerror(ret, buf, sizeof(buf)); return buf;
}

static void TVDoRemux(const char *src, const char *dst) {
  AVFormatContext *ic = NULL, *oc = NULL;
  int *smap = NULL;
  int64_t *last_dts = NULL;
  AVPacket *pkt = NULL;
  int ret = 0;
  TVLOG("remux: entry");
  if (!src || !dst) { gError = 1; gDone = 1; return; }

  if ((ret = avformat_open_input(&ic, src, NULL, NULL)) < 0) { TVLOG("open_input FAIL %d %s", ret, TVErr(ret)); goto end; }
  TVLOG("remux: opened, %u streams", ic->nb_streams);
  if ((ret = avformat_find_stream_info(ic, NULL)) < 0) { TVLOG("find_stream_info FAIL %d", ret); goto end; }
  gTotalEstimate = (ic->pb ? avio_size(ic->pb) : 0);
  if (gTotalEstimate < 0) gTotalEstimate = 0;
  TVLOG("remux: size estimate=%lld", gTotalEstimate);

  avformat_alloc_output_context2(&oc, NULL, "mp4", dst);
  if (!oc) { ret = -1; TVLOG("alloc_output FAIL"); goto end; }
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
    os->codecpar->codec_tag = 0;
    smap[i] = oi++;
  }
  TVLOG("remux: mapped %d output streams", oi);
  if (oi == 0) { ret = -1; goto end; }
  last_dts = av_malloc_array(oi, sizeof(int64_t));
  for (int k = 0; k < oi; k++) last_dts[k] = INT64_MIN;

  AVDictionary *opts = NULL;
  av_dict_set(&opts, "movflags", "frag_keyframe+empty_moov+delay_moov+default_base_moof", 0);
  if ((ret = avio_open(&oc->pb, dst, AVIO_FLAG_WRITE)) < 0) { TVLOG("avio_open FAIL %d", ret); av_dict_free(&opts); goto end; }
  if ((ret = avformat_write_header(oc, &opts)) < 0) { TVLOG("write_header FAIL %d %{public}s", ret, TVErr(ret)); av_dict_free(&opts); goto end; }
  av_dict_free(&opts);
  TVLOG("remux: header written, copying packets…");

  pkt = av_packet_alloc();
  if (!pkt) { ret = -1; goto end; }
  long long npkt = 0;
  while (!gError && av_read_frame(ic, pkt) >= 0) {
    int si = pkt->stream_index;
    int oidx = (si >= 0 && si < (int)ic->nb_streams) ? smap[si] : -1;
    if (oidx < 0) { av_packet_unref(pkt); continue; }
    AVStream *is = ic->streams[si];
    AVStream *os = oc->streams[oidx];
    pkt->stream_index = oidx;
    av_packet_rescale_ts(pkt, is->time_base, os->time_base);
    pkt->pos = -1;
    // DTS non monotones (matroska/HEVC) → correction façon ffmpeg CLI.
    if (pkt->dts != AV_NOPTS_VALUE && last_dts[oidx] != INT64_MIN && pkt->dts <= last_dts[oidx]) {
      int64_t next = last_dts[oidx] + 1;
      if (pkt->pts != AV_NOPTS_VALUE && pkt->pts < next) pkt->pts = next;
      pkt->dts = next;
    }
    if (pkt->dts != AV_NOPTS_VALUE) last_dts[oidx] = pkt->dts;
    int w = av_interleaved_write_frame(oc, pkt);   // prend l'ownership du paquet
    if (w < 0) { TVLOG("write_frame FAIL %d %{public}s", w, TVErr(w)); continue; }
    if ((++npkt % 2000) == 0) TVLOG("remux: %lld packets", npkt);
  }
  if (oc->pb) av_write_trailer(oc);
  TVLOG("remux: done, %lld packets, err=%d", npkt, gError);

end:
  if (pkt)  av_packet_free(&pkt);
  if (smap) av_free(smap);
  if (last_dts) av_free(last_dts);
  if (oc && oc->pb) avio_closep(&oc->pb);
  if (oc)   avformat_free_context(oc);
  if (ic)   avformat_close_input(&ic);
  if (ret < 0) gError = 1;
  gDone = 1;
}

@implementation TVLocalRemux
RCT_EXPORT_MODULE();
+ (BOOL)requiresMainQueueSetup { return NO; }

RCT_EXPORT_METHOD(start:(NSString *)sourceUrl
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  TVLOG("start: entry");
  static dispatch_once_t once;
  dispatch_once(&once, ^{ TVLOG("init network"); av_log_set_callback(TVAvLog); avformat_network_init(); gRemuxQueue = dispatch_queue_create("tv.localremux", DISPATCH_QUEUE_SERIAL); });

  dispatch_async(dispatch_get_main_queue(), ^{
   @try {
    TVLOG("start: main block");
    if (!sourceUrl.length) { reject(@"args", @"empty sourceUrl", nil); return; }

    // Idempotent : même source déjà en cours → réutiliser (évite la course).
    if (gServer.isRunning && [sourceUrl isEqualToString:gCurrentSource]) {
      TVLOG("start: reuse existing session");
      resolve(gCurrentUrl); return;
    }
    gCurrentSource = sourceUrl;

    if (gServer.isRunning) [gServer stop];
    gDone = 0; gError = 0; gTotalEstimate = 0;
    gOutPath = [NSTemporaryDirectory() stringByAppendingPathComponent:@"tvremux.mp4"];
    [[NSFileManager defaultManager] removeItemAtPath:gOutPath error:nil];

    NSString *outPath = gOutPath;
    gServer = [[GCDWebServer alloc] init];
    [gServer addHandlerForMethod:@"GET" path:@"/play" requestClass:[GCDWebServerRequest class]
                    processBlock:^GCDWebServerResponse *(GCDWebServerRequest *req) {
      TVLOG("handler: %{public}s", (req.headers[@"Range"] ?: @"(no range)").UTF8String);
      int guard = 0;
      while (gTotalEstimate <= 0 && !gDone && guard++ < 300) usleep(30000);
      long long total = gTotalEstimate > 0 ? gTotalEstimate : TVFileSize(outPath);
      if (total <= 0) total = 1LL << 40;
      long long start = 0, end = total - 1; BOOL partial = NO;
      NSString *range = [req.headers objectForKey:@"Range"];
      if ([range hasPrefix:@"bytes="]) {
        partial = YES;
        NSArray *parts = [[range substringFromIndex:6] componentsSeparatedByString:@"-"];
        if (parts.count >= 1 && [parts[0] length]) start = [parts[0] longLongValue];
        if (parts.count >= 2 && [parts[1] length]) end = [parts[1] longLongValue];
      }
      if (end >= total) end = total - 1;
      long long length = (end >= start) ? (end - start + 1) : 0;
      __block long long offset = start; __block long long remaining = length;
      GCDWebServerStreamedResponse *resp = [GCDWebServerStreamedResponse responseWithContentType:@"video/mp4"
        asyncStreamBlock:^(GCDWebServerBodyReaderCompletionBlock completionBlock) {
          if (remaining <= 0) { completionBlock([NSData data], nil); return; }
          long long fsize; int g = 0;
          while ((fsize = TVFileSize(outPath)) <= offset && !gDone && !gError && g++ < 4000) usleep(30000);
          if (gError) { completionBlock(nil, [NSError errorWithDomain:@"tvremux" code:1 userInfo:nil]); return; }
          if (fsize <= offset) { completionBlock([NSData data], nil); return; }
          long long chunk = MIN(MIN(remaining, fsize - offset), 256 * 1024);
          NSFileHandle *fh = [NSFileHandle fileHandleForReadingAtPath:outPath];
          @try { [fh seekToFileOffset:(unsigned long long)offset]; } @catch (__unused id e) {}
          NSData *data = [fh readDataOfLength:(NSUInteger)chunk]; [fh closeFile];
          offset += data.length; remaining -= data.length;
          completionBlock(data, nil);
        }];
      resp.contentLength = (NSUInteger)length;
      [resp setValue:@"bytes" forAdditionalHeader:@"Accept-Ranges"];
      if (partial) { resp.statusCode = 206; [resp setValue:[NSString stringWithFormat:@"bytes %lld-%lld/%lld", start, end, total] forAdditionalHeader:@"Content-Range"]; }
      return resp;
    }];

    NSError *err = nil;
    BOOL ok = [gServer startWithOptions:@{ GCDWebServerOption_BindToLocalhost: @YES, GCDWebServerOption_Port: @0 } error:&err];
    TVLOG("server start ok=%d port=%lu err=%s", ok, (unsigned long)gServer.port, err ? err.localizedDescription.UTF8String : "nil");
    if (!ok) { reject(@"server", @"GCDWebServer start failed", err); return; }

    NSString *url = [NSString stringWithFormat:@"http://127.0.0.1:%lu/play", (unsigned long)gServer.port];
    gCurrentUrl = url;
    const char *src = strdup(sourceUrl.UTF8String);
    const char *dst = strdup(gOutPath.UTF8String);
    dispatch_async(gRemuxQueue, ^{ TVDoRemux(src, dst); free((void *)src); free((void *)dst); });
    TVLOG("start: resolving %s", url.UTF8String);
    resolve(url);
   } @catch (NSException *ex) {
    TVLOG("start EXCEPTION %s", ex.reason.UTF8String);
    reject(@"exception", ex.reason ?: @"TVLocalRemux start exception", nil);
   }
  });
}

RCT_EXPORT_METHOD(stop) { if (gServer.isRunning) [gServer stop]; }

@end
