#import <AVFoundation/AVFoundation.h>
#import <React/RCTBridgeModule.h>
#import <UIKit/UIKit.h>

/**
 * Ce qu'AVPlayer a CHARGÉ — la seule façon, pour le JS, de voir des données
 * arriver pendant qu'il attend : ni l'ouverture ni un arrêt n'émettent de
 * progression (react-native-video ne publie sa mémoire qu'en lecture), et
 * AVPlayer attend une trentaine de secondes de vidéo avant de démarrer.
 * Mesuré (2026-10-02, transcodage simulé à ×0,6) : 80 s d'ouverture sans un
 * signal, segments pourtant reçus un à un.
 *
 * La reprise du lecteur (`usePlaybackRecovery`, `useStartupWait`) y lit un
 * signe de vie d'un transcodage lent : les octets reçus, la mémoire chargée
 * qui avance. Lecture seule, sur le fil principal ; `nil` sans lecteur monté.
 * La couche est celle de react-native-video (`AVPlayerLayer`, sous-couche de
 * sa vue) : on la cherche dans les fenêtres, le lecteur n'en monte qu'une.
 */
@interface TentaclePlayerProbe : NSObject <RCTBridgeModule>
@end

@implementation TentaclePlayerProbe

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (dispatch_queue_t)methodQueue
{
  return dispatch_get_main_queue();
}

static AVPlayerLayer *TentacleFindPlayerLayer(CALayer *layer, NSUInteger depth)
{
  if (layer == nil || depth > 64) return nil;
  if ([layer isKindOfClass:[AVPlayerLayer class]]) {
    AVPlayerLayer *playerLayer = (AVPlayerLayer *)layer;
    if (playerLayer.player.currentItem != nil) return playerLayer;
  }
  for (CALayer *sublayer in layer.sublayers) {
    AVPlayerLayer *found = TentacleFindPlayerLayer(sublayer, depth + 1);
    if (found != nil) return found;
  }
  return nil;
}

static AVPlayerLayer *TentacleCurrentPlayerLayer(void)
{
  for (UIScene *scene in UIApplication.sharedApplication.connectedScenes) {
    if (![scene isKindOfClass:[UIWindowScene class]]) continue;
    for (UIWindow *window in ((UIWindowScene *)scene).windows) {
      AVPlayerLayer *found = TentacleFindPlayerLayer(window.layer, 0);
      if (found != nil) return found;
    }
  }
  return nil;
}

RCT_EXPORT_METHOD(loadState:(RCTPromiseResolveBlock)resolve rejecter:(__unused RCTPromiseRejectBlock)reject)
{
  AVPlayerLayer *playerLayer = TentacleCurrentPlayerLayer();
  AVPlayerItem *item = playerLayer.player.currentItem;
  if (item == nil) {
    resolve([NSNull null]);
    return;
  }
  // La fin la plus lointaine de ce qui est chargé (timeline de l'élément).
  double loadedEnd = 0;
  for (NSValue *value in item.loadedTimeRanges) {
    CMTimeRange range = value.CMTimeRangeValue;
    double end = CMTimeGetSeconds(CMTimeRangeGetEnd(range));
    if (isfinite(end) && end > loadedEnd) loadedEnd = end;
  }
  // Les octets reçus et les requêtes de média, tous évènements du journal confondus.
  long long bytes = 0;
  NSInteger requests = 0;
  for (AVPlayerItemAccessLogEvent *event in item.accessLog.events) {
    if (event.numberOfBytesTransferred > 0) bytes += event.numberOfBytesTransferred;
    if (event.numberOfMediaRequests > 0) requests += event.numberOfMediaRequests;
  }
  resolve(@{
    @"loadedEnd" : @(loadedEnd),
    @"bytes" : @(bytes),
    @"requests" : @(requests),
    @"ready" : @(item.status == AVPlayerItemStatusReadyToPlay),
  });
}

@end
