//
//  TVDisplayCriteria.m
//  TentacleTV (tvOS / Apple TV)
//
//  react-native-video rend la vidéo via AVPlayerLayer, qui — contrairement à
//  AVPlayerViewController — NE déclenche PAS automatiquement la commutation de
//  plage dynamique HDMI sur tvOS. Résultat : le HDR/Dolby Vision n'est jamais
//  émis et le téléviseur n'affiche aucun badge.
//
//  Ce module pilote MANUELLEMENT la bascule, comme préconisé par Apple
//  (AVDisplayManager) : au démarrage de la lecture on applique
//  `asset.preferredDisplayCriteria` à `window.avDisplayManager`, ce qui fait
//  commuter la sortie de l'Apple TV en HDR/DV selon le contenu réel.
//

#import <React/RCTBridgeModule.h>
#import <AVKit/AVKit.h>
#import <AVFoundation/AVFoundation.h>
#import <CoreMedia/CoreMedia.h>
#import <UIKit/UIKit.h>
#import <os/log.h>

// API PRIVÉE (comme Kodi/MrMC) : construire un AVDisplayCriteria depuis fps + plage dynamique
// pour engager le mode HDMI HDR/DV (badge) SANS dépendre d'un master playlist (rejeté
// « unsupported url » par AVPlayer/react-native-video). videoDynamicRange : SDR=1, HDR10=3, DV=4.
@interface AVDisplayCriteria ()
- (instancetype)initWithRefreshRate:(float)refreshRate videoDynamicRange:(int)videoDynamicRange;
@end

extern int    gTVDynRange;   // 0=SDR, 3=HDR10, 4=Dolby Vision (posé par TVLocalRemux)
extern double gTVFps;

// Sortie vidéo attachée à l'item courant (engage) → capture fiable de la frame
// affichée (copyPixelBufferForItemTime) même quand le snapshot UIKit rend noir
// (AVPlayerLayer est composé hors-process). Utilisée par captureFrame (pause).
static AVPlayerItemVideoOutput *gVidOut = nil;
static __weak AVPlayerItem     *gVidOutItem = nil;

@interface TVDisplayCriteria : NSObject <RCTBridgeModule>
@end

@implementation TVDisplayCriteria

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup { return YES; }

static AVPlayerLayer *TVFindPlayerLayer(CALayer *layer) {
  if ([layer isKindOfClass:AVPlayerLayer.class]) return (AVPlayerLayer *)layer;
  for (CALayer *sub in layer.sublayers) {
    AVPlayerLayer *found = TVFindPlayerLayer(sub);
    if (found) return found;
  }
  return nil;
}

static UIWindow *TVKeyWindow(void) {
  for (UIScene *scene in UIApplication.sharedApplication.connectedScenes) {
    if ([scene isKindOfClass:UIWindowScene.class]) {
      for (UIWindow *w in ((UIWindowScene *)scene).windows) {
        if (w.isKeyWindow) return w;
      }
    }
  }
  return UIApplication.sharedApplication.keyWindow;
}

// Applique la plage dynamique du contenu en cours → bascule HDMI HDR/DV.
RCT_EXPORT_METHOD(engage)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    NSMutableString *diag = [NSMutableString string];
    UIWindow *window = TVKeyWindow();
    AVDisplayManager *mgr = window.avDisplayManager;
    AVPlayerLayer *layer = TVFindPlayerLayer(window.layer);
    AVPlayerItem *item = layer.player.currentItem;
    int dyn = gTVDynRange;                                       // 1=SDR, 3=DV, 4=HDR10 (tvOS18)
    float fps = (gTVFps > 1.0 && gTVFps < 130.0) ? (float)gTVFps : 23.976f;

    // CMFormatDescription de la piste vidéo en cours (pour l'API publique).
    CMVideoFormatDescriptionRef fmt = NULL;
    for (AVPlayerItemTrack *t in item.tracks) {
      AVAssetTrack *at = t.assetTrack;
      if (at && [at.mediaType isEqualToString:AVMediaTypeVideo] && at.formatDescriptions.count) {
        fmt = (__bridge CMVideoFormatDescriptionRef)at.formatDescriptions.firstObject; break;
      }
    }
    BOOL canPublic  = [AVDisplayCriteria instancesRespondToSelector:@selector(initWithRefreshRate:formatDescription:)];
    BOOL canPrivate = [AVDisplayCriteria instancesRespondToSelector:@selector(initWithRefreshRate:videoDynamicRange:)];
    [diag appendFormat:@"engage win=%d mgr=%d dyn=%d fps=%.3f fmt=%d canPublic=%d canPrivate=%d",
          window != nil, mgr != nil, dyn, fps, fmt != NULL, canPublic, canPrivate];

    AVDisplayCriteria *crit = nil;
    // 1) API PUBLIQUE (tvOS 17+, App-Store-safe) : dérive le critère du format réel de la piste.
    if (mgr && fmt && canPublic) {
      crit = [[AVDisplayCriteria alloc] initWithRefreshRate:fps formatDescription:fmt];
      [diag appendFormat:@" → PUBLIC crit=%d", crit != nil];
    }
    // 2) REPLI API PRIVÉE (sideload/TestFlight) si le format ne porte pas la plage (ex. DV non
    //    reconnu via formatDescription, cf. KSPlayer #633) : videoDynamicRange explicite.
    if (!crit && mgr && dyn > 0 && canPrivate) {
      crit = [[AVDisplayCriteria alloc] initWithRefreshRate:fps videoDynamicRange:dyn];
      [diag appendFormat:@" → PRIVATE crit=%d (%@)", crit != nil, dyn == 3 ? @"DolbyVision" : (dyn == 4 ? @"HDR10/HLG" : @"SDR")];
    }
    // 3) Dernier recours : critère de l'asset.
    if (!crit && mgr) {
      crit = item.asset.preferredDisplayCriteria;
      [diag appendFormat:@" → ASSET crit=%d", crit != nil];
    }
    if (mgr) mgr.preferredDisplayCriteria = crit;
    // Sortie vidéo pour la capture de frame (pause) : attachée UNE fois par item.
    if (item && gVidOutItem != item) {
      gVidOut = [[AVPlayerItemVideoOutput alloc] initWithPixelBufferAttributes:
                 @{(id)kCVPixelBufferPixelFormatTypeKey: @(kCVPixelFormatType_32BGRA)}];
      [item addOutput:gVidOut];
      gVidOutItem = item;
    }
    os_log_error(OS_LOG_DEFAULT, "[TVDC] %{public}s", diag.UTF8String);
    [diag writeToFile:[NSTemporaryDirectory() stringByAppendingPathComponent:@"tvdc.log"]
           atomically:YES encoding:NSUTF8StringEncoding error:nil];   // récupérable via devicectl
  });
}

// Frame 8x8 → tout noir ? (échec de snapshot AVPlayerLayer : rendu hors-process)
static BOOL TVImageLooksBlack(UIImage *img) {
  if (!img) return YES;
  uint8_t px[8 * 8 * 4] = {0};
  CGColorSpaceRef cs = CGColorSpaceCreateDeviceRGB();
  CGContextRef ctx = CGBitmapContextCreate(px, 8, 8, 8, 8 * 4, cs,
                                           kCGImageAlphaPremultipliedLast | kCGBitmapByteOrder32Big);
  CGColorSpaceRelease(cs);
  if (!ctx) return YES;
  CGContextDrawImage(ctx, CGRectMake(0, 0, 8, 8), img.CGImage);
  CGContextRelease(ctx);
  for (int i = 0; i < 8 * 8 * 4; i += 4)
    if (px[i] > 10 || px[i + 1] > 10 || px[i + 2] > 10) return NO;
  return YES;
}

static UIView *TVFindVideoHostView(UIView *v) {
  for (CALayer *sub in v.layer.sublayers)
    if ([sub isKindOfClass:AVPlayerLayer.class]) return v;
  for (UIView *s in v.subviews) {
    UIView *found = TVFindVideoHostView(s);
    if (found) return found;
  }
  return nil;
}

// Capture la frame vidéo AFFICHÉE (pause longue remux : « garder la dernière image » au lieu
// de la vignette trickplay). 1) snapshot UIKit de la vue hôte (couleurs = rendu écran, sans
// l'OSD qui est un sibling) ; 2) si noir → AVPlayerItemVideoOutput (pixel buffer réel).
// Résout { uri } (JPEG dans tmp, nom versionné anti-cache RN) ou nil (le JS garde le trickplay).
RCT_EXPORT_METHOD(captureFrame:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    UIWindow *window = TVKeyWindow();
    AVPlayerLayer *layer = TVFindPlayerLayer(window.layer);
    AVPlayerItem *item = layer.player.currentItem;
    if (!layer || !item) { resolve(nil); return; }

    UIImage *img = nil;
    UIView *host = TVFindVideoHostView(window);
    if (host && host.bounds.size.width > 1) {
      UIGraphicsImageRendererFormat *fmt = [UIGraphicsImageRendererFormat preferredFormat];
      fmt.scale = 1.0;   // 1x suffit (image de continuité plein écran)
      UIGraphicsImageRenderer *r = [[UIGraphicsImageRenderer alloc] initWithBounds:host.bounds format:fmt];
      img = [r imageWithActions:^(UIGraphicsImageRendererContext *c) {
        [host drawViewHierarchyInRect:host.bounds afterScreenUpdates:NO];
      }];
    }
    if (TVImageLooksBlack(img) && gVidOut && gVidOutItem == item) {
      CVPixelBufferRef pb = [gVidOut copyPixelBufferForItemTime:item.currentTime itemTimeForDisplay:nil];
      if (pb) {
        static CIContext *cictx = nil;
        if (!cictx) cictx = [CIContext contextWithOptions:nil];
        CIImage *ci = [CIImage imageWithCVPixelBuffer:pb];
        CGImageRef cg = [cictx createCGImage:ci fromRect:ci.extent];
        if (cg) { img = [UIImage imageWithCGImage:cg]; CGImageRelease(cg); }
        CVPixelBufferRelease(pb);
      }
    }
    if (TVImageLooksBlack(img)) { resolve(nil); return; }

    static int counter = 0;
    NSString *prev = [NSTemporaryDirectory() stringByAppendingFormat:@"tvpauseframe-%d.jpg", counter];
    [[NSFileManager defaultManager] removeItemAtPath:prev error:nil];
    counter++;
    NSString *path = [NSTemporaryDirectory() stringByAppendingFormat:@"tvpauseframe-%d.jpg", counter];
    NSData *jpg = UIImageJPEGRepresentation(img, 0.85);
    if (!jpg || ![jpg writeToFile:path atomically:YES]) { resolve(nil); return; }
    resolve(@{ @"uri": [NSString stringWithFormat:@"file://%@", path] });
  });
}

// Réinitialise (retour au mode d'affichage par défaut de l'UI).
RCT_EXPORT_METHOD(reset)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    UIWindow *window = TVKeyWindow();
    if (window) window.avDisplayManager.preferredDisplayCriteria = nil;
  });
}

@end
