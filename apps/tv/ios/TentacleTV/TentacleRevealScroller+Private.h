//
//  TentacleRevealScroller+Private.h
//  TentacleTV (tvOS / Apple TV)
//
//  L'état du défilement d'une page, partagé par ses deux fichiers : la page,
//  tvOS et les rafales (`TentacleRevealScroller.m`) ; le mouvement que la page
//  joue elle-même — le ressort, la mise en page qui bouge
//  (`TentacleRevealMotion.m`).
//

#import "TentacleFocusSection.h"

#import <React/RCTUIManagerObserverCoordinator.h>

@class RCTScrollView;

NS_ASSUME_NONNULL_BEGIN

@interface TentacleRevealScroller () {
 @package
  __weak RCTScrollView *_host;
  CADisplayLink *_Nullable _link;
  /// Le segment du ressort en cours : cible, écart et vitesse au départ, ressort.
  CGFloat _target, _x0, _v0, _response, _damping;
  CFTimeInterval _t0;
  /// La dernière position posée : une autre (tvOS, un scrollTo du JS) arrête le ressort.
  CGFloat _lastSet;
  /// La section montrée — celle qui a le focus — et, avant un montage, laquelle
  /// c'était et où était son haut.
  __weak TentacleFocusSection *_Nullable _shown;
  __weak TentacleFocusSection *_Nullable _shownBefore;
  CGFloat _shownTopBefore;
  /// Une rafale (flèche maintenue, glisser) : tvOS garde la main jusqu'à
  /// `_burstUntil` ; la dernière cible qu'on lui a rendue, et quand.
  CFTimeInterval _burstUntil;
  CGFloat _burstTarget;
  CFTimeInterval _burstTargetAt;
  /// La dernière position posée par un autre que nous ; la dernière proposition
  /// de défilement de tvOS.
  CFTimeInterval _foreignAt;
  CFTimeInterval _proposedAt;
}

/// Où la page doit être pour montrer `section`, depuis `base` (là où elle va).
- (CGFloat)targetFor:(TentacleFocusSection *)section from:(CGFloat)base;
- (CGFloat)clamp:(CGFloat)y;

@end

@interface TentacleRevealScroller (Motion) <RCTUIManagerObserver>

/// La page va à `target` sur le ressort — elle s'y pose, « Réduire les animations ».
- (void)moveTo:(CGFloat)target;
- (void)stop;
/// Pose la position, notée avant (`scrollViewDidScroll:` doit y reconnaître la nôtre).
- (void)setOffset:(CGFloat)y;

@end

NS_ASSUME_NONNULL_END
