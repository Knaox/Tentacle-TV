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
    int dyn = gTVDynRange;                                       // 0=SDR, 3=HDR10, 4=DV
    float fps = (gTVFps > 1.0 && gTVFps < 130.0) ? (float)gTVFps : 23.976f;  // fps de repli (films)
    BOOL canPrivate = [AVDisplayCriteria instancesRespondToSelector:@selector(initWithRefreshRate:videoDynamicRange:)];
    AVDisplayManager *mgr = window.avDisplayManager;
    [diag appendFormat:@"engage win=%d mgr=%d dyn=%d fps=%.3f rawfps=%.3f canPrivate=%d",
          window != nil, mgr != nil, dyn, fps, gTVFps, canPrivate];
    if (mgr && dyn > 0 && canPrivate) {
      AVDisplayCriteria *crit = [[AVDisplayCriteria alloc] initWithRefreshRate:fps videoDynamicRange:dyn];
      [diag appendFormat:@" → MANUAL crit=%d (%@)", crit != nil, dyn == 3 ? @"DolbyVision" : (dyn == 4 ? @"HDR10/HLG" : @"SDR")];
      mgr.preferredDisplayCriteria = crit;
    } else if (mgr) {
      AVPlayerLayer *layer = TVFindPlayerLayer(window.layer);
      AVDisplayCriteria *crit = layer.player.currentItem.asset.preferredDisplayCriteria;
      [diag appendFormat:@" → ASSET crit=%d", crit != nil];
      mgr.preferredDisplayCriteria = crit;
    }
    os_log_error(OS_LOG_DEFAULT, "[TVDC] %{public}s", diag.UTF8String);
    [diag writeToFile:[NSTemporaryDirectory() stringByAppendingPathComponent:@"tvdc.log"]
           atomically:YES encoding:NSUTF8StringEncoding error:nil];   // récupérable via devicectl
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
