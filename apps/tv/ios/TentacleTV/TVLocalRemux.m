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
#import "TVWindow.m"        // fenêtrage disque (TVPurgeBehind/TVPaceAndPurge) — DOIT précéder TVRemuxEngine.m
#import "TVStreamMap.m"     // mapping des flux (TVMapStreams) — utilise TVAudioSetup, précède le moteur
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
        // PAUSE PERMANENTE : pendant la pause, réécrire index.m3u8 (snapshot VOD+ENDLIST ou keepalive EVENT) →
        // AVPlayer ne déclare plus le flux corrompu (-11866) et reste figé au frame. no-store : le remount de
        // reprise re-fetch bien l'EVENT croissant (sinon AVPlayer rejouerait le snapshot caché).
        if (gPaused && [name isEqualToString:@"index.m3u8"]) {
          NSString *m = TVBuildPausedManifest(file, [dir stringByAppendingPathComponent:sub]);
          if (m) {
            GCDWebServerDataResponse *dr = [GCDWebServerDataResponse responseWithData:[m dataUsingEncoding:NSUTF8StringEncoding] contentType:@"application/vnd.apple.mpegurl"];
            [dr setValue:@"no-store" forAdditionalHeader:@"Cache-Control"];
            return dr;
          }
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
    // Réutiliser la session courante si même source + même audio + la position demandée est DANS la
    // fenêtre DISPONIBLE [max(début session, tête−BEHIND) … écrit]. Sinon (seek lointain devant le
    // produit, ou arrière dans une zone purgée) → NOUVELLE session re-remuxée depuis startSec
    // (av_seek_frame, cf. TVRemuxEngine) : c'est ça qui rend les gros sauts ET la reprise rapides.
    // gTVPlayPos/gWrittenSec sont 0-based (relatifs au début de session, cf. make_zero) ; gSessionStartSec
    // et startSec sont ABSOLUS → on convertit la fenêtre dispo en ABSOLU avant de comparer.
    double playAbs = gSessionStartSec + gTVPlayPos;                 // tête de lecture absolue
    double availFrom = playAbs - TVLR_BEHIND_SEC;
    if (availFrom < gSessionStartSec) availFrom = gSessionStartSec; // jamais avant le début de session
    double availTo = gSessionStartSec + gWrittenSec;                // dernier instant produit (absolu)
    // Reprise après pause longue (mode VOD) : on FORCE une nouvelle session à P (offset=P, relatif 0 = point de
    // pause exact) au lieu de réutiliser l'ancienne (relatif 0 = début de session → offset faux). One-shot.
    int resumePending = gResumePending; gResumePending = 0;
    BOOL withinAvail = startSec >= availFrom - 2.0 && startSec <= availTo + 1.0;
    if (!resumePending && [sourceUrl isEqualToString:gCurrentSource] && (int)audioIndex == gWantAudioIdx && !gError && gGen > 0 && withinAvail) {
      myGen = gGen;
      TVLOG("start: same source+audio, pos %.0f dans la fenêtre [%.0f..%.0f] → wait files (gen=%d)", startSec, availFrom, availTo, myGen);
    } else {
      gCurrentSource = sourceUrl;
      gWantAudioIdx = (int)audioIndex;   // re-remux si la piste audio change (clé de session)
      gWantStartSec = (int)startSec;     // reprise/seek : av_seek_frame positionne l'entrée sur la keyframe ≤ T
      gSessionStartSec = startSec;       // origine PROVISOIRE (T demandé) — affinée au 1ᵉʳ paquet muxé
                                         // (TVNoteFirstDts : keyframe ≤ T − amorce B-frames) → offset JS exact
      gTVMinFirstDts = DBL_MAX; gTVFirstSeenMask = 0;   // reset de la capture d'origine (par session)
      myGen = ++gGen;
      gDone = 0; gError = 0; gReady = 0; gTotalEstimate = 0; gTVFps = 0; gWrittenSec = 0; gDiskBytes = 0;
      // 0-based (make_zero) : la tête démarre à RELATIF 0 (= absolu startSec via av_seek_frame). NE PAS
      // mettre startSec (absolu) ici → le pacing ET la purge raisonnent en relatif (gTVPlayPos), sinon la
      // purge calculerait un headIdx énorme et effacerait le DÉBUT de session avant la lecture (→ 404).
      // gTVPlayPos ≤ 1 tant que la lecture n'a pas démarré → le remux produit librement (pré-buffer).
      gTVPlayPos = 0;
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
    // Session de REPRISE/seek (gResumePending) : cushion réduit → la reprise après pause et les gros
    // sauts résolvent en ~2-3 s au lieu de 8+. La production continue librement derrière (gTVPlayPos ≤ 1)
    // et automaticallyWaitsToMinimizeStalling amortit côté AVPlayer.
    double prebufNeed = resumePending ? (double)TVLR_RESUME_PREBUFFER_SEC : (double)TVLR_PREBUFFER_SEC;
    dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
      int guard = 0;
      // Attend : playlist prête ET un PRÉ-BUFFER produit (gWrittenSec 0-based ≥ prebufNeed) →
      // AVPlayer démarre avec un cushion (vidéo+audio bufferisés) au lieu d'un seul segment → fini le
      // « son avant la vidéo » + stall de démarrage. Avec av_seek_frame, la production COMMENCE à T
      // (rebasée à 0), donc ~PREBUFFER s après T sont prêtes très vite. Borné ~30 s. (Ce gate
      // remplace l'ancien `gWrittenSec ≥ gWantStartSec`, faux en 0-based : il ne se relâchait jamais.)
      while (gGen == myGen && !gError && !(gReady && TVFileSize(masterPath) > 0 && gWrittenSec >= prebufNeed) && guard++ < 3000) usleep(10000);
      TVLOG("start: gen=%d (cur=%d) ready=%d err=%d master=%lld start=%.3f after %dms", myGen, gGen, gReady, gError, TVFileSize(masterPath), gSessionStartSec, guard * 10);
      if (gGen != myGen) { reject(@"superseded", @"newer session started", nil); return; }
      if (TVFileSize(masterPath) <= 0) { reject(@"remux", @"no master playlist", nil); return; }
      // startSec = origine RÉELLE de la timeline playlist (1ᵉʳ DTS muxé, exact à ~1 frame) : le JS
      // s'en sert comme offset absolu⇄relatif (AVPlayerSurface) — fini le skew d'un GOP après un
      // seek/reprise. gen = jeton pour cancel() (le démontage n'annule que SA session).
      resolve(@{ @"url": url, @"startSec": @(gSessionStartSec), @"gen": @(myGen) });
    });
   } @catch (NSException *ex) {
    TVLOG("start EXCEPTION %s", ex.reason.UTF8String);
    reject(@"exception", ex.reason ?: @"TVLocalRemux start exception", nil);
   }
  });
}

RCT_EXPORT_METHOD(stop) { if (gServer.isRunning) [gServer stop]; }

// ANNULATION de session (démontage du player) : sans elle, le producteur restait GARÉ dans la
// boucle de pacing (thread bloqué) et jusqu'à 1,6 Go de segments traînaient sur disque jusqu'au
// prochain start(). Gen-gardée : un `navigation.replace` (épisode suivant) peut lancer le start()
// du NOUVEL écran AVANT le cleanup de démontage de l'ancien — on n'annule que SA session.
RCT_EXPORT_METHOD(cancel:(NSInteger)gen) {
  if ((int)gen != gGen) { TVLOG("cancel: gen=%ld périmé (cur=%d) → no-op", (long)gen, gGen); return; }
  TVLOG("cancel: gen=%ld", (long)gen);
  gGen++;                    // la boucle moteur/pacing teste gGen → le producteur sort en ≤ 200 ms
  gCurrentSource = nil;      // jamais de réutilisation withinAvail d'une session annulée (dossier purgé)
  gPaused = 0; gResumePending = 0;
  NSString *base = gOutPath;
  if (base && gRemuxQueue) dispatch_async(gRemuxQueue, ^{   // file SÉRIE → s'exécute APRÈS la sortie du producteur
    NSFileManager *fm = [NSFileManager defaultManager];
    for (NSString *d in ([fm contentsOfDirectoryAtPath:base error:nil] ?: @[]))
      [fm removeItemAtPath:[base stringByAppendingPathComponent:d] error:nil];
    gDiskBytes = 0;
    TVLOG("cancel: sessions purgées");
  });
}

// État de production de la session courante, pollé ~1 Hz par le JS : borne la fenêtre de seek
// natif à ce qui est ÉCRIT (writtenSec), donne l'origine exacte (sessionStartSec) et l'état de
// complétion (done+ENDLIST) pour le détecteur de fin. Méthode séparée : le chemin chaud
// setPosition (chaque progress) reste intact.
RCT_EXPORT_METHOD(sessionInfo:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
{
  resolve(@{ @"writtenSec": @(gWrittenSec), @"sessionStartSec": @(gSessionStartSec),
             @"done": @(gDone ? YES : NO), @"error": @(gError ? YES : NO), @"gen": @(gGen) });
}

// Position de lecture (s) poussée par JS (onProgress) → le remux ne va pas trop loin devant.
RCT_EXPORT_METHOD(setPosition:(double)seconds) { gTVPlayPos = seconds; }

// Pause permanente : JS pousse l'état de pause → le handler réécrit le manifeste servi (anti -11866).
RCT_EXPORT_METHOD(setPaused:(BOOL)paused) { gPaused = paused ? 1 : 0; TVLOG("setPaused %d", (int)paused); }
// Reprise après pause longue (mode VOD) : arme une nouvelle session à P au prochain start() (one-shot).
RCT_EXPORT_METHOD(prepareResume) { gResumePending = 1; }
// Spike : bascule la stratégie de manifeste de pause. 0 = keepalive EVENT (A) · 1 = VOD+ENDLIST (B).
RCT_EXPORT_METHOD(setSnapshotMode:(NSInteger)mode) { gSnapshotMode = (int)mode; TVLOG("setSnapshotMode %ld", (long)mode); }

@end
