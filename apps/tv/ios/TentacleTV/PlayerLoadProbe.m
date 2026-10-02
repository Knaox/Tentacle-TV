#import <AVFoundation/AVFoundation.h>
#import <React/RCTBridgeModule.h>
#import <UIKit/UIKit.h>
#import <objc/runtime.h>

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
 *
 * Le lecteur est celui de la vue de react-native-video (`RCTVideo`, son champ
 * `_player`) : sa couche (`AVPlayerLayer`) n'est posée qu'une fois l'élément
 * prêt — mesuré, rien à lire pendant toute l'ouverture. La couche reste le
 * repli si le champ change de nom ; sans l'un ni l'autre, `nil`.
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

/** Le lecteur d'une vue `RCTVideo` (Swift : `var _player: AVPlayer?`), lu par le runtime. */
static AVPlayer *TentacleFindVideoPlayer(UIView *view, NSUInteger depth)
{
  if (view == nil || depth > 64) return nil;
  if ([NSStringFromClass(object_getClass(view)) containsString:@"RCTVideo"]) {
    Ivar ivar = class_getInstanceVariable(object_getClass(view), "_player");
    id value = ivar != NULL ? object_getIvar(view, ivar) : nil;
    if ([value isKindOfClass:[AVPlayer class]] && ((AVPlayer *)value).currentItem != nil) return (AVPlayer *)value;
  }
  for (UIView *subview in view.subviews) {
    AVPlayer *found = TentacleFindVideoPlayer(subview, depth + 1);
    if (found != nil) return found;
  }
  return nil;
}

static AVPlayer *TentacleCurrentPlayer(void)
{
  for (UIScene *scene in UIApplication.sharedApplication.connectedScenes) {
    if (![scene isKindOfClass:[UIWindowScene class]]) continue;
    for (UIWindow *window in ((UIWindowScene *)scene).windows) {
      AVPlayer *player = TentacleFindVideoPlayer(window, 0);
      if (player != nil) return player;
      AVPlayerLayer *layer = TentacleFindPlayerLayer(window.layer, 0);
      if (layer != nil) return layer.player;
    }
  }
  return nil;
}

RCT_EXPORT_METHOD(loadState:(RCTPromiseResolveBlock)resolve rejecter:(__unused RCTPromiseRejectBlock)reject)
{
  AVPlayer *player = TentacleCurrentPlayer();
  AVPlayerItem *item = player.currentItem;
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
  // De quoi lire un incident dans les journaux : où en est AVPlayer, et pourquoi il attend.
  NSString *waiting = player.reasonForWaitingToPlay ?: @"";
  resolve(@{
    @"loadedEnd" : @(loadedEnd),
    @"bytes" : @(bytes),
    @"requests" : @(requests),
    @"ready" : @(item.status == AVPlayerItemStatusReadyToPlay),
    @"failed" : @(item.status == AVPlayerItemStatusFailed),
    @"rate" : @(player.rate),
    @"control" : @(player.timeControlStatus),
    @"waiting" : waiting,
    @"keepUp" : @(item.isPlaybackLikelyToKeepUp),
    @"full" : @(item.isPlaybackBufferFull),
  });
}

@end
