//
//  TentacleRevealMotion.m
//  TentacleTV (tvOS / Apple TV)
//
//  Le mouvement que la page joue ELLE-MÊME (`TentacleRevealScroller.m` dit
//  quand) :
//  - le ressort d'un pas isolé : même courbe, même durée, quelle que soit la
//    distance ; un focus en plein vol reprend position ET vitesse. Joué image
//    par image (`CADisplayLink`) en posant `contentOffset` : les `onScroll`
//    partent à chaque image, et ce qui les lit (fond de la fiche, héros) suit ;
//  - la mise en page qui bouge AU-DESSUS de la section montrée (une rangée qui
//    arrive, un logo lu) est compensée dans le même montage : plus de recalage
//    après coup. « Réduire les animations » : la page se pose aussitôt.
//

#import "TentacleRevealScroller+Private.h"

#import <React/RCTScrollView.h>
#import <React/RCTUIManager.h>

@implementation TentacleRevealScroller (Motion)

#pragma mark - Le ressort

- (void)springAt:(CFTimeInterval)t displacement:(CGFloat *)x velocity:(CGFloat *)v
{
  CGFloat omega = 2 * M_PI / _response;
  if (_damping >= 0.999) {
    CGFloat c = _v0 + omega * _x0;
    CGFloat decay = exp(-omega * t);
    *x = decay * (_x0 + c * t);
    *v = decay * (_v0 - omega * c * t);
    return;
  }
  CGFloat a = _damping * omega;
  CGFloat b = omega * sqrt(1 - _damping * _damping);
  CGFloat B = (_v0 + a * _x0) / b;
  CGFloat decay = exp(-a * t);
  *x = decay * (_x0 * cos(b * t) + B * sin(b * t));
  *v = decay * (_v0 * cos(b * t) - (a * B + b * _x0) * sin(b * t));
}

- (void)moveTo:(CGFloat)target
{
  UIScrollView *scroll = _host.scrollView;
  CGFloat current = scroll.contentOffset.y;
  if (UIAccessibilityIsReduceMotionEnabled()) {
    [self stop];
    if (fabs(target - current) >= 0.5) {
      [self setOffset:target];
    }
    return;
  }
  if (_link != nil && fabs(target - _target) < 0.5) {
    return; // déjà en route vers là
  }
  if (_link == nil && fabs(target - current) < 0.5) {
    return;
  }
  CFTimeInterval now = CACurrentMediaTime();
  CGFloat x = 0, v = 0;
  if (_link != nil) {
    [self springAt:now - _t0 displacement:&x velocity:&v];
  }
  _target = target;
  _x0 = current - target;
  _v0 = v;
  _t0 = now;
  _lastSet = current;
  if (_link == nil) {
    _link = [CADisplayLink displayLinkWithTarget:self selector:@selector(tick:)];
    [_link addToRunLoop:[NSRunLoop mainRunLoop] forMode:NSRunLoopCommonModes];
  }
}

- (void)tick:(CADisplayLink *)link
{
  UIScrollView *scroll = _host.scrollView;
  if (scroll == nil || scroll.window == nil) {
    [self stop]; // la page est partie
    return;
  }
  CGFloat x = 0, v = 0;
  [self springAt:link.targetTimestamp - _t0 displacement:&x velocity:&v];
  CGFloat y = _target + x;
  if (fabs(x) < 0.5 && fabs(v) < 8) {
    y = _target;
    [self stop];
  }
  [self setOffset:y];
}

- (void)stop
{
  [_link invalidate];
  _link = nil;
}

/// Pose la position, notée AVANT : `contentOffset` rappelle `scrollViewDidScroll:`
/// sur-le-champ, qui doit y reconnaître la nôtre.
- (void)setOffset:(CGFloat)y
{
  UIScrollView *scroll = _host.scrollView;
  _lastSet = y;
  scroll.contentOffset = CGPointMake(scroll.contentOffset.x, y);
}

#pragma mark - La mise en page qui bouge

- (CGFloat)shownTop
{
  TentacleFocusSection *section = _shown;
  RCTScrollView *host = _host;
  if (section == nil || host == nil || section.window == nil) {
    return NAN;
  }
  return CGRectGetMinY([section convertRect:section.bounds toView:host.scrollView]);
}

- (void)uiManagerWillPerformMounting:(RCTUIManager *)manager
{
  __weak TentacleRevealScroller *weakSelf = self;
  [manager prependUIBlock:^(__unused RCTUIManager *uiManager, __unused NSDictionary<NSNumber *, UIView *> *registry) {
    TentacleRevealScroller *strongSelf = weakSelf;
    if (strongSelf) {
      strongSelf->_shownBefore = strongSelf->_shown;
      strongSelf->_shownTopBefore = [strongSelf shownTop];
    }
  }];
  [manager addUIBlock:^(__unused RCTUIManager *uiManager, __unused NSDictionary<NSNumber *, UIView *> *registry) {
    [weakSelf keepShownInPlace];
  }];
}

/// La section montrée a bougé dans la page : la page la suit dans le même
/// montage (rien ne saute à l'écran), puis la montre de nouveau si sa taille
/// l'exige — en douceur.
- (void)keepShownInPlace
{
  CGFloat before = _shownTopBefore;
  CGFloat after = [self shownTop];
  TentacleFocusSection *section = _shown;
  BOOL same = section != nil && section == _shownBefore;
  _shownTopBefore = NAN;
  _shownBefore = nil;
  UIScrollView *scroll = _host.scrollView;
  // Une AUTRE section montrée entre-temps (le focus a changé de section) : sa
  // position d'avant n'a pas été lue — rien à compenser.
  if (!same || isnan(before) || isnan(after) || scroll == nil) {
    return;
  }
  CGFloat delta = after - before;
  if (fabs(delta) >= 0.5) {
    [self setOffset:[self clamp:scroll.contentOffset.y + delta]];
    if (_link != nil) {
      _target += delta;
    }
  }
  CGFloat base = _link != nil ? _target : scroll.contentOffset.y;
  [self moveTo:[self targetFor:section from:base]];
}

@end
