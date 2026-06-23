//
//  TVCommon.h  (tvOS / Apple TV) — en-tête commun du lecteur « façon Infuse »
//  Imports FFmpeg/os.log/GCDWebServer partagés, macros, helpers et déclarations
//  extern des globals de session. INCLUS UNE SEULE FOIS (unity build) : les .m du
//  module sont #importés dans TVLocalRemux.m → une seule unité de traduction.
//

#ifndef TVCOMMON_H
#define TVCOMMON_H

#import <React/RCTBridgeModule.h>
#import <GCDWebServer/GCDWebServer.h>
#import <GCDWebServer/GCDWebServerStreamedResponse.h>
#import <GCDWebServer/GCDWebServerRequest.h>
#import <GCDWebServer/GCDWebServerFileResponse.h>
#import <libavformat/avformat.h>
#import <libavutil/avutil.h>
#import <libavcodec/avcodec.h>
#import <libavutil/dovi_meta.h>
#import <libswresample/swresample.h>
#import <libavutil/audio_fifo.h>
#import <libavutil/channel_layout.h>
#import <libavutil/samplefmt.h>
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

static long long TVFileSize(NSString *path) {
  NSDictionary *a = [[NSFileManager defaultManager] attributesOfItemAtPath:path error:nil];
  return a ? (long long)[a fileSize] : 0;
}

static const char *TVErr(int ret) {
  static char buf[256]; av_strerror(ret, buf, sizeof(buf)); return buf;
}

// ===== Globals de session (DÉFINIS dans TVRemuxEngine.m, un seul endroit) =====
extern GCDWebServer *gServer;
extern NSString     *gOutPath;
extern long long     gTotalEstimate;
extern volatile int  gDone;
extern volatile int  gError;
extern volatile int  gReady;   // 1 dès que la playlist liste un 1ᵉʳ segment
extern volatile int  gGen;     // génération de session : un nouveau start() annule le remux précédent
extern volatile double gTVPlayPos;  // position de lecture (s) reçue de JS → bride la lecture anticipée
extern dispatch_queue_t gRemuxQueue;
extern NSString     *gCurrentSource;
extern NSString     *gCurrentUrl;
// Plage dynamique + fps détectés par le remux, lus par TVDisplayCriteria pour engager le
// badge HDR/DV via AVDisplayCriteria (API privée, comme Kodi). 0=SDR, 3=HDR10, 4=Dolby Vision.
extern int    gTVDynRange;
extern double gTVFps;
extern volatile int gWantAudioIdx;  // index de piste audio (MediaStream.Index JS) à mapper ; -1 = 1ʳᵉ dispo
extern volatile int    gWantStartSec; // position de reprise (s) demandée par JS
extern volatile double gWrittenSec;   // position max ÉCRITE par le remux (s) → gate de reprise

#endif /* TVCOMMON_H */
