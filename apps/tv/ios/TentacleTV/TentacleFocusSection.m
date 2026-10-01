//
//  TentacleFocusSection.m
//  TentacleTV (tvOS / Apple TV)
//
//  La vue d'une section (voir l'en-tête) : son inscription, le suivi du focus
//  qui entre, bouge et sort — qui pose les guides du voisinage sur l'élément
//  focalisé (`TentacleNeighborGuides.m`) et demande à la page de montrer la
//  section (`TentacleRevealScroller.m`).
//

#import "TentacleFocusSection.h"

#import <React/RCTBridge.h>
#import <React/RCTScrollView.h>
#import <React/RCTUIManager.h>
#import <React/RCTViewManager.h>

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

/// La section de voisinage la plus proche au-dessus de `view` (elle-même comprise).
static TentacleFocusSection *InnermostNeighborSection(UIView *view)
{
  for (UIView *v = view; v != nil; v = v.superview) {
    if ([v isKindOfClass:[TentacleFocusSection class]] && ((TentacleFocusSection *)v).tvNeighbors) {
      return (TentacleFocusSection *)v;
    }
  }
  return nil;
}

@implementation TentacleFocusSection

- (instancetype)initWithBridge:(RCTBridge *)bridge
{
  if ((self = [super initWithBridge:bridge])) {
    _sectionBridge = bridge;
    _revealMode = @"none";
    _revealMargin = 56;
    _revealTop = 72;
    _revealResponse = 0.5;
    _revealDamping = 1;
    _neighborGuides = [[TentacleNeighborGuides alloc] initWithSection:self];
    [TentacleNeighborGuides observeBridge:bridge];
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
  UIView *focused = self.window ? TentacleFocusedView(self) : nil;
  if (tvNeighbors && focused && InnermostNeighborSection(focused) == self) {
    [_neighborGuides guideItem:focused];
  } else {
    [_neighborGuides clear];
  }
}

- (void)didMoveToWindow
{
  [super didMoveToWindow];
  [TentacleNeighborGuides sectionsChanged];
  if (self.window) {
    [TentacleSectionRegistry() addObject:self];
  } else {
    [TentacleSectionRegistry() removeObject:self];
    [_neighborGuides clear];
  }
}

- (void)didUpdateFocusInContext:(UIFocusUpdateContext *)context
       withAnimationCoordinator:(UIFocusAnimationCoordinator *)coordinator
{
  [super didUpdateFocusInContext:context withAnimationCoordinator:coordinator];
  UIView *next = context.nextFocusedView;
  if (next == nil || ![next isDescendantOfView:self]) {
    [_neighborGuides clear];
    return;
  }
  // Les guides : la section la plus proche de l'élément, une seule.
  if (_tvNeighbors && InnermostNeighborSection(next) == self) {
    [_neighborGuides guideItem:next];
  } else {
    [_neighborGuides clear];
  }
  if (![_revealMode isEqualToString:@"none"]) {
    [[TentacleRevealScroller scrollerForSection:self] revealItem:next];
  }
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
