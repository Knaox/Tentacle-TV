//
//  TVLocalRemux.m  (tvOS / Apple TV) — lecteur « façon Infuse »
//  Démux FFmpeg du fichier brut Jellyfin → MP4 fragmenté DV → serveur local
//  GCDWebServer → AVPlayer Direct Play. MVP lecture linéaire.
//  (Version instrumentée NSLog pour diagnostic.)
//
//  UNITY BUILD : ce fichier est la SEULE unité compilée du module ; il #importe les
//  sous-modules (audio / HLS / moteur) qui ne sont PAS ajoutés au projet Xcode.
//

#import "TVCommon.h"
#import "TVAudioTranscode.m"
#import "TVHLSPlaylist.m"
#import "TVRemuxEngine.m"

@interface TVLocalRemux : NSObject <RCTBridgeModule>
@end

@implementation TVLocalRemux
RCT_EXPORT_MODULE();
+ (BOOL)requiresMainQueueSetup { return NO; }

RCT_EXPORT_METHOD(start:(NSString *)sourceUrl
                  dynamicRange:(NSInteger)dynRange
                  audioIndex:(NSInteger)audioIndex
                  startSec:(double)startSec
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  TVLOG("start: entry dyn=%ld audioIndex=%ld startSec=%.0f", (long)dynRange, (long)audioIndex, startSec);
  static dispatch_once_t once;
  dispatch_once(&once, ^{ TVLOG("init network"); av_log_set_callback(TVAvLog); avformat_network_init(); gRemuxQueue = dispatch_queue_create("tv.localremux", DISPATCH_QUEUE_SERIAL); });

  dispatch_async(dispatch_get_main_queue(), ^{
   @try {
    TVLOG("start: main block");
    if (!sourceUrl.length) { reject(@"args", @"empty sourceUrl", nil); return; }
    gTVDynRange = (int)dynRange;   // plage dynamique AUTORITAIRE (JS/Jellyfin) pour le badge

    // Dossier BASE + serveur UNIQUE (port stable). Chaque session écrit dans un SOUS-dossier
    // `tvhls/g<gGen>/` (isolation → pas de clobbering de l'ancien que le player lit).
    if (!gOutPath) gOutPath = [NSTemporaryDirectory() stringByAppendingPathComponent:@"tvhls"];
    {
      NSFileManager *fm = [NSFileManager defaultManager];
      [fm createDirectoryAtPath:gOutPath withIntermediateDirectories:YES attributes:nil error:nil];
      // 1er start après lancement app (serveur pas encore créé) : vider les sessions résiduelles.
      if (!gServer)
        for (NSString *d in ([fm contentsOfDirectoryAtPath:gOutPath error:nil] ?: @[]))
          [fm removeItemAtPath:[gOutPath stringByAppendingPathComponent:d] error:nil];
    }
    if (!gServer) {
      NSString *dir = gOutPath;
      gServer = [[GCDWebServer alloc] init];
      // Sert les fichiers HLS (index.m3u8 + init.mp4 + seg*.m4s) : segments COMPLETS → Range natif.
      [gServer addDefaultHandlerForMethod:@"GET" requestClass:[GCDWebServerRequest class]
                             processBlock:^GCDWebServerResponse *(GCDWebServerRequest *req) {
        // Path = /g<N>/<fichier> : 1ᵉʳ composant = sous-dossier de session (anti-traversal : g + chiffres).
        NSArray<NSString *> *comps = req.path.pathComponents;   // ["/", "gN", "fichier"]
        NSString *name = req.path.lastPathComponent;
        NSString *sub = comps.count >= 3 ? comps[1] : @"";
        BOOL okSub = sub.length >= 2 && [sub characterAtIndex:0] == 'g';
        for (NSUInteger i = 1; okSub && i < sub.length; i++) { unichar c = [sub characterAtIndex:i]; if (c < '0' || c > '9') okSub = NO; }
        NSString *file = okSub ? [[dir stringByAppendingPathComponent:sub] stringByAppendingPathComponent:name] : nil;
        if (!file || ![[NSFileManager defaultManager] fileExistsAtPath:file]) {
          TVLOG("handler 404: %{public}s", req.path.UTF8String);
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
    // MÊME source + même audio + pas d'erreur + session existante → NE PAS relancer, juste attendre.
    // Sinon nouvelle session : dossier PROPRE (n'écrase pas l'ancien que le player lit) + nettoyage.
    int myGen;
    if ([sourceUrl isEqualToString:gCurrentSource] && (int)audioIndex == gWantAudioIdx && !gError && gGen > 0) {
      myGen = gGen;
      TVLOG("start: same source+audio → wait files (gen=%d)", myGen);
    } else {
      gCurrentSource = sourceUrl;
      gWantAudioIdx = (int)audioIndex;   // re-remux si la piste audio change (clé de session)
      gWantStartSec = (int)startSec;     // reprise : le gate resolve() attendra cette position PRODUITE
      myGen = ++gGen;
      gDone = 0; gError = 0; gReady = 0; gTotalEstimate = 0; gTVFps = 0; gWrittenSec = 0;
      gTVPlayPos = startSec;             // centre le pacing sur la reprise (le remux fonce jusqu'à là)
      // DOSSIER PAR SESSION : tvhls/g<myGen>/ → le nouveau remux NE clobbe PAS les segments que
      // l'ancien lecteur lit encore (fin du -11866). Nettoyage : supprimer les sessions N < myGen-1
      // (garder le courant + le précédent, l'ancien lecteur pouvant lire pendant une bascule).
      NSString *sessionDir = [gOutPath stringByAppendingPathComponent:[NSString stringWithFormat:@"g%d", myGen]];
      NSFileManager *fm = [NSFileManager defaultManager];
      [fm createDirectoryAtPath:sessionDir withIntermediateDirectories:YES attributes:nil error:nil];
      for (NSString *d in ([fm contentsOfDirectoryAtPath:gOutPath error:nil] ?: @[]))
        if ([d hasPrefix:@"g"] && [[d substringFromIndex:1] intValue] < myGen - 1)
          [fm removeItemAtPath:[gOutPath stringByAppendingPathComponent:d] error:nil];
      const char *src = strdup(sourceUrl.UTF8String);
      const char *dst = strdup(sessionDir.UTF8String);
      dispatch_async(gRemuxQueue, ^{ TVDoRemux(src, dst, myGen); free((void *)src); free((void *)dst); });
      TVLOG("start: new session gen=%d dir=g%d", myGen, myGen);
    }

    // URL = /g<myGen>/index.m3u8?a=<audio> : sous-dossier de session + cache-buster langue (AVPlayer ne
    // commute pas le multi-audio HLS → on re-remuxe la piste). Media playlist directe (master rejeté
    // « unsupported url ») ; badge engagé à la main (TVDisplayCriteria).
    NSString *url = [NSString stringWithFormat:@"http://127.0.0.1:%lu/g%d/index.m3u8?a=%d", (unsigned long)gServer.port, myGen, gWantAudioIdx];
    gCurrentUrl = url;

    // Résoudre quand master.m3u8 + 1ᵉʳ segment de CETTE session sont prêts (+ reprise produite).
    NSString *masterPath = [[gOutPath stringByAppendingPathComponent:[NSString stringWithFormat:@"g%d", myGen]] stringByAppendingPathComponent:@"master.m3u8"];
    dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
      int guard = 0;
      // Attend : playlist prête ET la position de reprise PRODUITE (gWrittenSec ≥ gWantStartSec)
      // → le seek du player ne tombe pas sur un segment pas encore écrit (-16156). Borné ~30 s.
      while (gGen == myGen && !gError && !(gReady && TVFileSize(masterPath) > 0 && gWrittenSec >= (double)gWantStartSec) && guard++ < 3000) usleep(10000);
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

// Position de lecture (s) poussée par JS (onProgress) → le remux ne va pas trop loin devant.
RCT_EXPORT_METHOD(setPosition:(double)seconds) { gTVPlayPos = seconds; }

@end
