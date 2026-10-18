//
//  TentacleRowScroller.m
//  TentacleTV (tvOS / Apple TV)
//
//  La RANGÉE qui suit le focus (GAUCHE / DROITE) — la carte focalisée jamais
//  plus près des bords que les bouts de la rangée ne le sont de son contenu.
//
//  tvOS défile seul une rangée pour montrer la carte focalisée, à SA marge
//  (~80 pt du bord de la ScrollView). À droite, c'est la marge sûre de la
//  rangée : rien ne se voyait. À gauche, la ScrollView commence au bord de
//  l'écran, sous le rail : en revenant vers la gauche, la carte se posait à
//  80 pt, SOUS le rail, au lieu du retrait des autres rangées (176 pt) —
//  relevé de Damien (17/10), mesuré au banc nav-golden.
//
//  La cible est celle d'Android TV, dans tv-core :
//  `packages/tv-core/src/focus/burstFollow.ts`, `rowRevealOffset` — ici avec,
//  pour « là où elle va », la proposition de tvOS (ou la cible du ressort en
//  cours) : la rangée bouge le moins possible pour garder la carte entre les
//  deux marges. Qui la JOUE, comme la page (`TentacleRevealScroller.m`) :
//  - une RAFALE (flèche maintenue, glisser du pavé) : tvOS, vers notre cible
//    (`scrollViewWillEndDragging:…targetContentOffset:`, aussi appelée pour un
//    défilement de focus) — son animateur garde sa vitesse, une rafale passe
//    en défilement rapide sans creux ;
//  - un pas ISOLÉ : on rend à tvOS la position COURANTE — il ne bouge rien — et
//    la rangée y va sur le ressort de la page (`revealResponse`,
//    `revealDamping` de sa section : `TV_MOTION.spring.scroll`). L'animateur de
//    tvOS laissait une traîne d'une dizaine de points jusqu'à +1,15 s après le
//    focus (mesuré au banc de fluidité, 18/10) ; le ressort se pose en ~0,8 s,
//    comme la page. Formules : tv-core `focus/revealMotion.ts` (`springAt`,
//    `springSettled`), les mêmes que `TentacleRevealMotion.m`.
//
//  Seules les rangées d'une section qui le demande (`rowReveal`, l'accueil et
//  « Pour vous ») : la section l'attache à la ScrollView horizontale qui porte
//  l'élément focalisé, au premier focus.
//

#import "TentacleFocusSection.h"

#import <objc/runtime.h>
#import <React/RCTScrollView.h>

static char kRowScrollerKey;

/// Après qu'on lui a rendu la position courante (un pas isolé), tvOS l'APPLIQUE encore un
/// instant plus tard — une image après notre ressort, qui a déjà avancé : la rangée reculait
/// d'une image (4 à 5 pt) à chaque pas d'une suite rapprochée (mesuré au banc de fluidité,
/// 18/10). Une position étrangère posée dans ce délai est la sienne, tardive : le ressort la
/// recouvre aussitôt — si elle est à moins d'une image ou deux de mouvement de la nôtre : le
/// retour au début de la rangée (Retour, sortie de l'écran) en est toujours bien plus loin.
/// Au-delà, c'est un autre défilement : le ressort cède.
static const CFTimeInterval kLateStayWindow = 0.1;
static const CGFloat kLateStayDistance = 64;

@interface TentacleRowScroller : NSObject <UIScrollViewDelegate>
@end

@implementation TentacleRowScroller {
  __weak RCTScrollView *_row;
  __weak TentacleFocusSection *_section;
  CADisplayLink *_link;
  /// Le segment du ressort en cours : cible, écart et vitesse au départ, ressort.
  CGFloat _target, _x0, _v0, _response, _damping;
  CFTimeInterval _t0;
  /// La dernière position posée : une autre (tvOS, le retour au début de la rangée) arrête le ressort.
  CGFloat _lastSet;
  /// Quand on a rendu à tvOS la position courante (`kLateStayWindow`).
  CFTimeInterval _stayAt;
}

- (instancetype)initWithRow:(RCTScrollView *)row section:(TentacleFocusSection *)section
{
  if ((self = [super init])) {
    _row = row;
    _section = section;
  }
  return self;
}

- (void)scrollViewWillEndDragging:(UIScrollView *)scrollView
                     withVelocity:(CGPoint)velocity
              targetContentOffset:(inout CGPoint *)targetContentOffset
{
  RCTScrollView *row = _row;
  UIView *content = row.contentView;
  UIView *focused = TentacleFocusedView(scrollView);
  if (row == nil || content == nil || focused == nil || ![focused isDescendantOfView:content] || content.subviews.count == 0) {
    [self stop];
    return;
  }
  // La carte, sans sa transformation (l'agrandissement au focus) : son centre et sa largeur.
  CGPoint center = [focused.superview convertPoint:focused.center toView:content];
  CGFloat width = CGRectGetWidth(focused.bounds);
  CGFloat left = center.x - width / 2;
  // `RowTrack` : le retrait de la rangée, la marge de sa fin (jamais plus que le retrait).
  CGFloat viewport = CGRectGetWidth(scrollView.bounds);
  CGFloat contentWidth = scrollView.contentSize.width;
  CGFloat leading = CGRectGetMinX(content.subviews.firstObject.frame);
  CGFloat trailing = MIN(contentWidth - CGRectGetMaxX(content.subviews.lastObject.frame), leading);
  // `rowRevealOffset`, depuis là où la rangée va : la cible du ressort en cours, sinon la proposition de tvOS.
  CGFloat base = _link != nil ? _target : targetContentOffset->x;
  CGFloat start = left - leading;
  CGFloat end = left + width + trailing - viewport;
  CGFloat target = end > base ? MIN(end, start) : (start < base ? start : base);
  CGFloat clamped = MIN(MAX(target, 0), MAX(0, contentWidth - viewport));
  if (TentacleFocusInputIsBurst()) {
    // Une rafale : tvOS défile, vers notre cible.
    [self stop];
    targetContentOffset->x = clamped;
    return;
  }
  // Un pas isolé : tvOS ne bouge rien, le ressort s'en charge.
  targetContentOffset->x = scrollView.contentOffset.x;
  _stayAt = CACurrentMediaTime();
  [self moveTo:clamped in:scrollView];
  // tvOS lance quand même SON animation vers cette position, qui reposerait l'ancienne pendant
  // que le ressort avance : on l'annule au tour suivant, à la position du ressort.
  __weak TentacleRowScroller *weakSelf = self;
  __weak UIScrollView *weakScroll = scrollView;
  dispatch_async(dispatch_get_main_queue(), ^{
    [weakSelf cancelForeignAnimationIn:weakScroll];
  });
}

/// Annule une animation de défilement de tvOS en reposant, sans animation, la position du ressort.
- (void)cancelForeignAnimationIn:(UIScrollView *)scroll
{
  if (_link == nil || scroll == nil) {
    return;
  }
  [scroll setContentOffset:CGPointMake(_lastSet, scroll.contentOffset.y) animated:NO];
}

/// Un défilement qui n'est pas le nôtre (tvOS, le retour au début de la rangée) : le ressort cède
/// — sauf la position que tvOS applique en retard juste après un pas (`kLateStayWindow`) : le
/// ressort la recouvre, la rangée ne recule pas.
- (void)scrollViewDidScroll:(UIScrollView *)scrollView
{
  if (_link == nil || fabs(scrollView.contentOffset.x - _lastSet) <= 1) {
    return;
  }
  if (CACurrentMediaTime() - _stayAt < kLateStayWindow && fabs(scrollView.contentOffset.x - _lastSet) < kLateStayDistance) {
    [self setOffset:_lastSet in:scrollView];
    return;
  }
  [self stop];
}

#pragma mark - Le ressort (tv-core `revealMotion.ts`)

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

/// La rangée va à `target` sur le ressort ; en plein vol, elle reprend position ET vitesse.
- (void)moveTo:(CGFloat)target in:(UIScrollView *)scroll
{
  CGFloat current = scroll.contentOffset.x;
  if (UIAccessibilityIsReduceMotionEnabled()) {
    [self stop];
    if (fabs(target - current) >= 0.5) {
      [self setOffset:target in:scroll];
    }
    return;
  }
  if (_link != nil && fabs(target - _target) < 0.5) {
    return; // déjà en route vers là
  }
  if (_link == nil && fabs(target - current) < 0.5) {
    return;
  }
  TentacleFocusSection *section = _section;
  _response = MAX(0.05, section != nil ? section.revealResponse : 0.5);
  _damping = MIN(1, MAX(0.1, section != nil ? section.revealDamping : 1));
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
  UIScrollView *scroll = _row.scrollView;
  if (scroll == nil || scroll.window == nil) {
    [self stop]; // la rangée est partie
    return;
  }
  CGFloat x = 0, v = 0;
  [self springAt:link.targetTimestamp - _t0 displacement:&x velocity:&v];
  CGFloat position = _target + x;
  if (fabs(x) < 0.5 && fabs(v) < 8) {
    position = _target;
    [self stop];
  }
  [self setOffset:position in:scroll];
}

/// Le `CADisplayLink` RETIENT le scroller tant qu'il tourne (cycle voulu, le temps d'un
/// mouvement) : seul `invalidate` le rompt — à l'arrêt du ressort, quand un autre défile, à
/// une rafale, et quand la rangée quitte la fenêtre (`tick:`). Ne retirer aucun de ces arrêts.
- (void)stop
{
  [_link invalidate];
  _link = nil;
}

/// Pose la position, notée AVANT : `contentOffset` rappelle `scrollViewDidScroll:`
/// sur-le-champ, qui doit y reconnaître la nôtre.
- (void)setOffset:(CGFloat)x in:(UIScrollView *)scroll
{
  _lastSet = x;
  scroll.contentOffset = CGPointMake(x, scroll.contentOffset.y);
}

@end

void TentacleRowScrollerAttach(TentacleFocusSection *section, UIView *item)
{
  for (UIView *v = item.superview; v != nil && v != section; v = v.superview) {
    if (![v isKindOfClass:[RCTScrollView class]]) {
      continue;
    }
    RCTScrollView *row = (RCTScrollView *)v;
    if (objc_getAssociatedObject(row, &kRowScrollerKey) == nil) {
      TentacleRowScroller *scroller = [[TentacleRowScroller alloc] initWithRow:row section:section];
      objc_setAssociatedObject(row, &kRowScrollerKey, scroller, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
      [row addScrollListener:scroller];
    }
    return;
  }
}
