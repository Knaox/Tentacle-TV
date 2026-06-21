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
    UIWindow *window = TVKeyWindow();
    if (!window) return;
    AVPlayerLayer *layer = TVFindPlayerLayer(window.layer);
    AVAsset *asset = layer.player.currentItem.asset;
    if (!asset) return;
    window.avDisplayManager.preferredDisplayCriteria = asset.preferredDisplayCriteria;
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
