//
//  HDRCapabilities.m
//  TentacleTV (tvOS / Apple TV)
//
//  Expose les capacités de DÉCODAGE matériel de l'Apple TV (= modèle de la box,
//  indépendant de l'écran connecté) au JS, pour gater le DeviceProfile Jellyfin.
//  Calqué sur Swiftfin `PlaybackCapabilities` (client Jellyfin tvOS officiel) :
//  on interroge VideoToolbox plutôt que de coder en dur un tableau de modèles.
//
//    - HEVC décodable         ⇒ HDR10 / HLG gérés (tvOS adapte la sortie).
//    - Dolby Vision HEVC      ⇒ Dolby Vision (Apple TV 4K uniquement).
//
//  `eligibleForHDR` (AVPlayer.eligibleForHDRPlayback) reflète l'ÉCRAN HDR
//  actuellement connecté — renvoyé à titre diagnostique, non utilisé pour gater.
//

#import <React/RCTBridgeModule.h>
#import <AVFoundation/AVFoundation.h>
#import <VideoToolbox/VideoToolbox.h>
#import <CoreMedia/CoreMedia.h>

@interface HDRCapabilities : NSObject <RCTBridgeModule>
@end

@implementation HDRCapabilities

RCT_EXPORT_MODULE();

// Lecture de propriétés statiques uniquement → pas besoin de la main queue.
+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

RCT_EXPORT_METHOD(getCapabilities:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  BOOL hevc = VTIsHardwareDecodeSupported(kCMVideoCodecType_HEVC);
  BOOL dovi = VTIsHardwareDecodeSupported(kCMVideoCodecType_DolbyVisionHEVC);

  resolve(@{
    @"hevc": @(hevc),
    @"hdr10": @(hevc),
    @"hlg": @(hevc),
    @"dolbyVision": @(dovi),
    @"eligibleForHDR": @(AVPlayer.eligibleForHDRPlayback),
  });
}

@end
