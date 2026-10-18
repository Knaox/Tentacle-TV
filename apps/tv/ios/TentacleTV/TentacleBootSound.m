//
//  TentacleBootSound.m
//  TentacleTV (tvOS / Apple TV)
//
//  Le « ta-dum » de l'ouverture du démarrage, joué À L'HEURE de l'image.
//  Le fichier (boot-tadum.m4a) est DÉRIVÉ de la synthèse partagée
//  (apps/tv/scripts/render-intro-sound.mjs) ; on ne fait ici que le lire.
//
//  - AVAudioPlayer plutôt qu'un lecteur vidéo : un fichier de 50 Ko, décodé
//    d'avance (`prepare`), lancé par `playAtTime:` — à la milliseconde près.
//  - L'heure demandée est celle des images (CACurrentMediaTime, en ms : celle
//    que l'horloge de l'interface lit sur le CADisplayLink) ; on retire la
//    latence de sortie, et un départ en retard saute le début du fichier
//    (la vague, qui part du silence) au lieu de décaler le « ta ».
//  - Catégorie « ambient » (seulement si personne n'en a choisi une) : le son
//    se MÉLANGE à une musique déjà en cours, il ne la coupe pas. Rendue à la
//    catégorie par défaut au `release`, si elle n'a pas changé entre-temps
//    (un lecteur vidéo pose la sienne).
//

#import <React/RCTBridgeModule.h>
#import <AVFoundation/AVFoundation.h>
#import <QuartzCore/QuartzCore.h>

@interface TentacleBootSound : NSObject <RCTBridgeModule>
@end

@implementation TentacleBootSound {
  AVAudioPlayer *_player;
  BOOL _changedCategory;
}

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

// Une file à elle : ni le fil d'interface ni celui du JavaScript ne décodent le fichier.
- (dispatch_queue_t)methodQueue
{
  static dispatch_queue_t queue;
  static dispatch_once_t once;
  dispatch_once(&once, ^{
    queue = dispatch_queue_create("app.tentacletv.bootsound", DISPATCH_QUEUE_SERIAL);
  });
  return queue;
}

RCT_EXPORT_METHOD(prepare:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
{
  NSURL *url = [[NSBundle mainBundle] URLForResource:@"boot-tadum" withExtension:@"m4a"];
  if (url == nil) {
    resolve(@{ @"ready": @NO });
    return;
  }
  AVAudioSession *session = [AVAudioSession sharedInstance];
  if ([session.category isEqualToString:AVAudioSessionCategorySoloAmbient]) {
    _changedCategory = [session setCategory:AVAudioSessionCategoryAmbient error:nil];
  }
  NSError *error = nil;
  _player = [[AVAudioPlayer alloc] initWithContentsOfURL:url error:&error];
  BOOL ready = _player != nil && [_player prepareToPlay];
  resolve(@{ @"ready": @(ready), @"now": @(CACurrentMediaTime() * 1000.0) });
}

RCT_EXPORT_METHOD(playAt:(double)hostMs)
{
  AVAudioPlayer *player = _player;
  if (player == nil || player.isPlaying) return;
  NSTimeInterval delay = hostMs / 1000.0 - CACurrentMediaTime() - [AVAudioSession sharedInstance].outputLatency;
  if (delay > 0.002) {
    [player playAtTime:player.deviceCurrentTime + delay];
  } else {
    player.currentTime = MIN(-delay, player.duration);
    [player play];
  }
}

RCT_EXPORT_METHOD(fadeOut:(double)ms)
{
  AVAudioPlayer *player = _player;
  if (player == nil) return;
  [player setVolume:0 fadeDuration:ms / 1000.0];
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)((ms + 50) * NSEC_PER_MSEC)), [self methodQueue], ^{
    [player stop];
  });
}

RCT_EXPORT_METHOD(release)
{
  [_player stop];
  _player = nil;
  AVAudioSession *session = [AVAudioSession sharedInstance];
  if (_changedCategory && [session.category isEqualToString:AVAudioSessionCategoryAmbient]) {
    [session setCategory:AVAudioSessionCategorySoloAmbient error:nil];
  }
  _changedCategory = NO;
}

@end
