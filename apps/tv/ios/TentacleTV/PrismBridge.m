// Déclaration ObjC du module Swift `PrismBridge` (ancienne architecture RN).
// Les sélecteurs doivent correspondre EXACTEMENT aux méthodes `@objc` Swift.
#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(PrismBridge, RCTEventEmitter)

RCT_EXTERN_METHOD(start:(NSDictionary *)config
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(stop:(nonnull NSNumber *)gen)

RCT_EXTERN_METHOD(fallbackMuxed:(nonnull NSNumber *)gen
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
