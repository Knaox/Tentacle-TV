//
//  TentacleRevealScroller.m
//  TentacleTV (tvOS / Apple TV)
//
//  Le défilement d'une page qui suit le focus — UN SEUL mouvement.
//
//  Avant lui, deux défilements se superposaient d'une rangée à l'autre : celui
//  de tvOS, puis, une image ou deux plus tard, le `scrollTo` animé du JS, qui
//  interrompait le premier en plein vol — le « saut très étrange » vu sur
//  l'Apple TV. Désormais :
//  - tvOS propose sa cible par `scrollViewWillEndDragging:…targetContentOffset:`
//    (aussi pour un défilement de focus — forum des développeurs d'Apple, fil
//    22103) : pour un élément de nos sections, on lui rend la position
//    COURANTE — il ne bouge rien ;
//  - la page va à la cible de la section (`nearest`, `anchor`, `start`) sur un
//    ressort : même courbe, même durée, quelle que soit la distance ; un focus
//    en plein vol reprend position ET vitesse. Joué image par image
//    (`CADisplayLink`) en posant `contentOffset` : les `onScroll` partent à
//    chaque image, et ce qui les lit (fond de la fiche, héros) suit ;
//  - la mise en page qui bouge AU-DESSUS de la section montrée (une rangée qui
//    arrive, un logo lu) est compensée dans le même montage : plus de recalage
//    après coup. « Réduire les animations » : la page se pose aussitôt.
//

#import "TentacleFocusSection.h"

#import <objc/runtime.h>
#import <React/RCTBridge.h>
#import <React/RCTScrollView.h>
#import <React/RCTUIManager.h>
#import <React/RCTUIManagerObserverCoordinator.h>

static char kScrollerKey;

@interface TentacleRevealScroller () <RCTUIManagerObserver>
@end

@implementation TentacleRevealScroller {
  __weak RCTScrollView *_host;
  CADisplayLink *_link;
  /// Le segment du ressort en cours : cible, écart et vitesse au départ, ressort.
  CGFloat _target, _x0, _v0, _response, _damping;
  CFTimeInterval _t0;
  /// La dernière position posée : une autre (un scrollTo du JS) arrête le ressort.
  CGFloat _lastSet;
  /// La section montrée — celle qui a le focus — et son haut avant un montage.
  __weak TentacleFocusSection *_shown;
  CGFloat _shownTopBefore;
}

+ (instancetype)scrollerForSection:(TentacleFocusSection *)section
{
  RCTScrollView *host = TentacleVerticalHost(section);
  if (host == nil) {
    return nil;
  }
  TentacleRevealScroller *scroller = objc_getAssociatedObject(host, &kScrollerKey);
  if (scroller == nil) {
    scroller = [TentacleRevealScroller new];
    scroller->_host = host;
    scroller->_shownTopBefore = NAN;
    objc_setAssociatedObject(host, &kScrollerKey, scroller, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
    [host addScrollListener:scroller];
    [section.sectionBridge.uiManager.observerCoordinator addObserver:scroller];
  }
  return scroller;
}

/// La section qui révèle `item` dans cette page : la plus proche de lui.
- (TentacleFocusSection *)sectionRevealing:(UIView *)item
{
  RCTScrollView *host = _host;
  for (UIView *v = item; v != nil && v != host; v = v.superview) {
    if ([v isKindOfClass:[TentacleFocusSection class]] && ![((TentacleFocusSection *)v).revealMode isEqualToString:@"none"]) {
      return TentacleVerticalHost(v) == host ? (TentacleFocusSection *)v : nil;
    }
  }
  return nil;
}

- (CGFloat)clamp:(CGFloat)y
{
  UIScrollView *scroll = _host.scrollView;
  UIEdgeInsets inset = scroll.adjustedContentInset;
  CGFloat min = -inset.top;
  CGFloat max = MAX(min, scroll.contentSize.height + inset.bottom - CGRectGetHeight(scroll.bounds));
  return MIN(MAX(y, min), max);
}

/// Où la page doit être pour montrer `section`, depuis `base` (là où elle va).
- (CGFloat)targetFor:(TentacleFocusSection *)section from:(CGFloat)base
{
  UIScrollView *scroll = _host.scrollView;
  CGRect box = [section convertRect:section.bounds toView:scroll];
  NSString *mode = section.revealMode;
  if ([mode isEqualToString:@"start"]) {
    return [self clamp:0];
  }
  if ([mode isEqualToString:@"anchor"]) {
    return [self clamp:CGRectGetMinY(box) - section.revealTop];
  }
  // `nearest` : le moins possible — descendre jusqu'à son bas, sinon remonter
  // jusqu'à son haut, jamais au-delà de son haut (plus haute que l'écran).
  CGFloat margin = section.revealMargin;
  CGFloat top = CGRectGetMinY(box) - margin;
  CGFloat bottom = CGRectGetMaxY(box) + margin - CGRectGetHeight(scroll.bounds);
  CGFloat target = bottom > base ? MIN(bottom, top) : (top < base ? top : base);
  return [self clamp:target];
}

- (void)revealItem:(UIView *)item
{
  TentacleFocusSection *section = [self sectionRevealing:item];
  _shown = section;
  if (section == nil) {
    return;
  }
  _response = MAX(0.05, section.revealResponse);
  _damping = MIN(1, MAX(0.1, section.revealDamping));
  CGFloat base = _link != nil ? _target : _host.scrollView.contentOffset.y;
  [self moveTo:[self targetFor:section from:base]];
}

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

#pragma mark - Le défilement de tvOS, ou d'un autre

/// Un défilement qui n'est pas le nôtre (le `scrollTo` du banc, une page
/// raccourcie) : on cesse de suivre la section — sans quoi le prochain montage
/// ramènerait la page sur elle, contre lui.
- (void)scrollViewDidScroll:(UIScrollView *)scrollView
{
  if (fabs(scrollView.contentOffset.y - _lastSet) > 1) {
    [self stop];
    _shown = nil;
    _lastSet = scrollView.contentOffset.y;
  }
}

- (void)scrollViewWillEndDragging:(UIScrollView *)scrollView
                     withVelocity:(CGPoint)velocity
              targetContentOffset:(inout CGPoint *)targetContentOffset
{
  UIView *focused = TentacleFocusedView(scrollView);
  if (focused == nil || ![focused isDescendantOfView:scrollView] || [self sectionRevealing:focused] == nil) {
    [self stop]; // pas une de nos sections : tvOS défile seul, sans concurrent
    return;
  }
  // Une de nos sections : tvOS ne bouge rien, le ressort s'en charge.
  targetContentOffset->y = scrollView.contentOffset.y;
  [self revealItem:focused];
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
  _shownTopBefore = NAN;
  TentacleFocusSection *section = _shown;
  UIScrollView *scroll = _host.scrollView;
  if (isnan(before) || isnan(after) || section == nil || scroll == nil) {
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
