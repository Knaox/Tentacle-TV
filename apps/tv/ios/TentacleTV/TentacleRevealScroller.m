//
//  TentacleRevealScroller.m
//  TentacleTV (tvOS / Apple TV)
//
//  Le défilement d'une page qui suit le focus — UN SEUL mouvement.
//
//  Avant lui, deux défilements se superposaient d'une rangée à l'autre : celui
//  de tvOS, puis, une image ou deux plus tard, le `scrollTo` animé du JS, qui
//  interrompait le premier en plein vol — le « saut très étrange » vu sur
//  l'Apple TV. Désormais tvOS propose sa cible par
//  `scrollViewWillEndDragging:…targetContentOffset:` (aussi pour un défilement
//  de focus — forum des développeurs d'Apple, fil 22103), et la page va à la
//  cible de la section (`nearest`, `anchor`, `start`) :
//  - un pas ISOLÉ (un appui) : on rend à tvOS la position COURANTE — il ne
//    bouge rien — et la page y va sur notre ressort (`TentacleRevealMotion.m`) ;
//  - une RAFALE — une flèche maintenue, que tvOS répète, un glisser du pavé
//    (`TentacleFocusInput.m`) : on rend à tvOS NOTRE cible, et c'est son
//    animateur de défilement du focus qui la joue. Au bout d'une à deux
//    secondes de rafale, tvOS passe en défilement rapide en partant de la
//    vitesse de CET animateur (lu au débogueur :
//    `currentVelocityForScrollableContainer:`). Notre ressort à sa place, il
//    partait de zéro : la page tombait de ~5 000 à ~400 pt/s, puis remontait
//    en ~1,8 s — le « léger ralentissement » vu sur l'Apple TV, mesuré au banc
//    des bibliothèques à la descente comme à la remontée. Le premier pas
//    d'une flèche maintenue reste au ressort : la première répétition vient
//    ~470 ms plus tard, quand il a presque fini — la main passe sans à-coup.
//

#import "TentacleRevealScroller+Private.h"

#import <objc/runtime.h>
#import <React/RCTBridge.h>
#import <React/RCTScrollView.h>
#import <React/RCTUIManager.h>

static char kScrollerKey;

/// Après le dernier pas d'une rafale, tvOS garde la main ce temps-là : son
/// animateur finit son mouvement sans qu'un pas isolé ne le dispute.
static const CFTimeInterval kBurstLinger = 0.7;
/// tvOS a posé la page il y a moins que ça : il défile encore.
static const CFTimeInterval kForeignMoving = 0.05;

@implementation TentacleRevealScroller

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
  TentacleFocusInputObserve(section.window);
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

#pragma mark - Pas isolé ou rafale

/// Ce pas du focus appartient-il à une rafale ? La télécommande le dit ; une
/// rafale qui finit, ou tvOS qui défile encore, aussi : on ne lui dispute
/// jamais la page en plein mouvement.
- (BOOL)isBurst
{
  CFTimeInterval now = CACurrentMediaTime();
  BOOL burst = TentacleFocusInputIsBurst() || now < _burstUntil || now - _foreignAt < kForeignMoving;
  if (burst) {
    _burstUntil = now + kBurstLinger;
  }
  return burst;
}

- (void)revealItem:(UIView *)item
{
  TentacleFocusSection *section = [self sectionRevealing:item];
  if (section != nil && [self isBurst]) {
    // tvOS défile, vers notre cible (`scrollViewWillEndDragging:…`) ; s'il ne
    // propose rien pour ce pas, la section se montre comme pour un pas isolé.
    [self stop];
    _shown = nil;
    CFTimeInterval at = CACurrentMediaTime();
    __weak TentacleRevealScroller *weakSelf = self;
    __weak TentacleFocusSection *weakSection = section;
    dispatch_async(dispatch_get_main_queue(), ^{
      [weakSelf revealUnproposed:weakSection at:at tries:10];
    });
    return;
  }
  [self springToSection:section];
}

/// Le pas isolé : la page va montrer `section` sur le ressort.
- (void)springToSection:(TentacleFocusSection *)section
{
  _shown = section;
  if (section == nil) {
    return;
  }
  _response = MAX(0.05, section.revealResponse);
  _damping = MIN(1, MAX(0.1, section.revealDamping));
  CGFloat base = _link != nil ? _target : _host.scrollView.contentOffset.y;
  [self moveTo:[self targetFor:section from:base]];
}

/// Un pas de rafale pour lequel tvOS n'a rien proposé (l'élément lui semblait
/// assez visible) : la section se montre comme pour un pas isolé — la première
/// ligne d'une grille ramène ainsi le titre — mais jamais contre tvOS en plein
/// mouvement : on attend qu'il s'arrête.
- (void)revealUnproposed:(TentacleFocusSection *)section at:(CFTimeInterval)at tries:(NSInteger)tries
{
  UIScrollView *scroll = _host.scrollView;
  if (section == nil || section.window == nil || scroll == nil || _proposedAt >= at - 0.02) {
    return; // tvOS défile pour ce pas, vers notre cible
  }
  UIView *focused = TentacleFocusedView(scroll);
  if (focused == nil || [self sectionRevealing:focused] != section) {
    return; // le focus est déjà ailleurs
  }
  if (CACurrentMediaTime() - _foreignAt < kForeignMoving) {
    if (tries > 0) {
      __weak TentacleRevealScroller *weakSelf = self;
      __weak TentacleFocusSection *weakSection = section;
      dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.1 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
        [weakSelf revealUnproposed:weakSection at:at tries:tries - 1];
      });
    }
    return;
  }
  [self springToSection:section];
}

#pragma mark - Le défilement de tvOS, ou d'un autre

/// Un défilement qui n'est pas le nôtre (tvOS, le `scrollTo` du banc, une page
/// raccourcie) : on cesse de suivre la section — sans quoi le prochain montage
/// ramènerait la page sur elle, contre lui.
- (void)scrollViewDidScroll:(UIScrollView *)scrollView
{
  if (fabs(scrollView.contentOffset.y - _lastSet) > 1) {
    [self stop];
    _shown = nil;
    _lastSet = scrollView.contentOffset.y;
    _foreignAt = CACurrentMediaTime();
  }
}

- (void)scrollViewWillEndDragging:(UIScrollView *)scrollView
                     withVelocity:(CGPoint)velocity
              targetContentOffset:(inout CGPoint *)targetContentOffset
{
  UIView *focused = TentacleFocusedView(scrollView);
  TentacleFocusSection *section = focused != nil && [focused isDescendantOfView:scrollView] ? [self sectionRevealing:focused] : nil;
  if (section == nil) {
    [self stop]; // pas une de nos sections : tvOS défile seul, sans concurrent
    return;
  }
  CFTimeInterval now = CACurrentMediaTime();
  _proposedAt = now;
  if ([self isBurst]) {
    // Une rafale : tvOS défile, vers NOTRE cible — depuis celle du pas
    // précédent de la même rafale, là où la page va déjà.
    [self stop];
    _shown = nil;
    BOOL following = now - _burstTargetAt < kBurstLinger;
    _burstTarget = [self targetFor:section from:following ? _burstTarget : scrollView.contentOffset.y];
    _burstTargetAt = now;
    targetContentOffset->y = _burstTarget;
    return;
  }
  // Un pas isolé : tvOS ne bouge rien, le ressort s'en charge.
  targetContentOffset->y = scrollView.contentOffset.y;
  [self revealItem:focused];
}

@end
