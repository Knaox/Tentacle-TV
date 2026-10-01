//
//  TentacleFocusSection.m
//  TentacleTV (tvOS / Apple TV)
//
//  La vue d'une section (voir l'en-tête) : son inscription, le suivi du focus
//  qui entre et qui sort, et les deux BANDES du voisinage.
//
//  Les bandes : deux guides de focus d'un point de haut, de toute la largeur de
//  la section, posés juste au-dessus et juste au-dessous d'elle tant que le
//  focus est DEDANS. Le moteur de tvOS cherche dans la direction ; ce qui est
//  dans la section, sous le doigt, passe avant elles (la pastille d'un en-tête
//  depuis la carte qui est dessous) — sinon il rencontre la bande, toujours
//  dans l'axe puisqu'elle couvre la largeur, et la bande résout la cible À CE
//  MOMENT-LÀ : la rangée a fini (ou non) de défiler, la géométrie est celle de
//  l'écran. Hors de la section, elles n'existent pas : elles ne détournent
//  rien d'autre (rail, guides des écrans, entrées de côté).
//

#import "TentacleFocusSection.h"

#import <React/RCTBridge.h>
#import <React/RCTScrollView.h>
#import <React/RCTUIManager.h>
#import <React/RCTViewManager.h>

/// Une bande : ses destinations se calculent quand le moteur la consulte.
@interface TentacleNeighborGuide : UIFocusGuide
- (instancetype)initWithSection:(TentacleFocusSection *)section up:(BOOL)up;
@end

@implementation TentacleNeighborGuide {
  __weak TentacleFocusSection *_section;
  BOOL _up;
}

- (instancetype)initWithSection:(TentacleFocusSection *)section up:(BOOL)up
{
  if ((self = [super init])) {
    _section = section;
    _up = up;
  }
  return self;
}

- (NSArray<id<UIFocusEnvironment>> *)preferredFocusEnvironments
{
  TentacleFocusSection *section = _section;
  UIView *focused = section ? TentacleFocusedView(section) : nil;
  if (!focused || ![focused isDescendantOfView:section]) {
    return @[];
  }
  UIView *target = TentacleNeighborTarget(section, focused, _up);
  return target ? @[ target ] : @[];
}

@end

static NSHashTable<TentacleFocusSection *> *TentacleSectionRegistry(void)
{
  static NSHashTable *registry;
  static dispatch_once_t once;
  dispatch_once(&once, ^{
    registry = [NSHashTable weakObjectsHashTable];
  });
  return registry;
}

NSArray<TentacleFocusSection *> *TentacleNeighborSections(void)
{
  return TentacleSectionRegistry().allObjects;
}

RCTScrollView *TentacleVerticalHost(UIView *view)
{
  for (UIView *v = view.superview; v != nil; v = v.superview) {
    if (![v isKindOfClass:[RCTScrollView class]]) {
      continue;
    }
    UIScrollView *scroll = ((RCTScrollView *)v).scrollView;
    BOOL horizontalOnly = scroll.contentSize.width > CGRectGetWidth(scroll.bounds) + 1 &&
        scroll.contentSize.height <= CGRectGetHeight(scroll.bounds) + 1;
    if (!horizontalOnly) {
      return (RCTScrollView *)v;
    }
  }
  return nil;
}

UIView *TentacleFocusedView(id<UIFocusEnvironment> environment)
{
  id<UIFocusItem> item = [UIFocusSystem focusSystemForEnvironment:environment].focusedItem;
  return [(id)item isKindOfClass:[UIView class]] ? (UIView *)item : nil;
}

@implementation TentacleFocusSection {
  TentacleNeighborGuide *_upGuide;
  TentacleNeighborGuide *_downGuide;
}

- (instancetype)initWithBridge:(RCTBridge *)bridge
{
  if ((self = [super initWithBridge:bridge])) {
    _sectionBridge = bridge;
    _revealMode = @"none";
    _revealMargin = 56;
    _revealTop = 72;
    _revealResponse = 0.5;
    _revealDamping = 1;
  }
  return self;
}

- (UIView *)entryView
{
  if (_tvEntry == nil) {
    return nil;
  }
  UIView *view = [_sectionBridge.uiManager viewForReactTag:_tvEntry];
  return [view isDescendantOfView:self] ? view : nil;
}

- (void)setTvNeighbors:(BOOL)tvNeighbors
{
  _tvNeighbors = tvNeighbors;
  if (!tvNeighbors) {
    [self removeNeighborGuides];
  } else if (self.window && TentacleFocusedView(self) && [TentacleFocusedView(self) isDescendantOfView:self]) {
    [self installNeighborGuides];
  }
}

- (void)didMoveToWindow
{
  [super didMoveToWindow];
  if (self.window) {
    [TentacleSectionRegistry() addObject:self];
  } else {
    [TentacleSectionRegistry() removeObject:self];
    [self removeNeighborGuides];
  }
}

- (void)didUpdateFocusInContext:(UIFocusUpdateContext *)context
       withAnimationCoordinator:(UIFocusAnimationCoordinator *)coordinator
{
  [super didUpdateFocusInContext:context withAnimationCoordinator:coordinator];
  UIView *next = context.nextFocusedView;
  if (next == nil || ![next isDescendantOfView:self]) {
    [self removeNeighborGuides];
    return;
  }
  if (_tvNeighbors) {
    [self installNeighborGuides];
  }
  if (![_revealMode isEqualToString:@"none"]) {
    [[TentacleRevealScroller scrollerForSection:self] revealItem:next];
  }
}

- (void)installNeighborGuides
{
  if (_upGuide != nil) {
    return;
  }
  _upGuide = [[TentacleNeighborGuide alloc] initWithSection:self up:YES];
  _downGuide = [[TentacleNeighborGuide alloc] initWithSection:self up:NO];
  for (TentacleNeighborGuide *guide in @[ _upGuide, _downGuide ]) {
    [self addLayoutGuide:guide];
    [guide.leftAnchor constraintEqualToAnchor:self.leftAnchor].active = YES;
    [guide.widthAnchor constraintEqualToAnchor:self.widthAnchor].active = YES;
    [guide.heightAnchor constraintEqualToConstant:1].active = YES;
  }
  [_upGuide.bottomAnchor constraintEqualToAnchor:self.topAnchor].active = YES;
  [_downGuide.topAnchor constraintEqualToAnchor:self.bottomAnchor].active = YES;
}

- (void)removeNeighborGuides
{
  if (_upGuide != nil) {
    [self removeLayoutGuide:_upGuide];
  }
  if (_downGuide != nil) {
    [self removeLayoutGuide:_downGuide];
  }
  _upGuide = nil;
  _downGuide = nil;
}

@end

@interface TentacleFocusSectionManager : RCTViewManager
@end

@implementation TentacleFocusSectionManager

RCT_EXPORT_MODULE()

- (UIView *)view
{
  // Comme `RCTViewManager` sur tvOS : toute `View` y est une `RCTTVView`.
  return [[TentacleFocusSection alloc] initWithBridge:self.bridge];
}

RCT_EXPORT_VIEW_PROPERTY(revealMode, NSString)
RCT_EXPORT_VIEW_PROPERTY(revealMargin, CGFloat)
RCT_EXPORT_VIEW_PROPERTY(revealTop, CGFloat)
RCT_EXPORT_VIEW_PROPERTY(revealResponse, CGFloat)
RCT_EXPORT_VIEW_PROPERTY(revealDamping, CGFloat)
RCT_EXPORT_VIEW_PROPERTY(tvNeighbors, BOOL)
RCT_EXPORT_VIEW_PROPERTY(tvEntry, NSNumber)

@end
