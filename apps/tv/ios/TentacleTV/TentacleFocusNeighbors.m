//
//  TentacleFocusNeighbors.m
//  TentacleTV (tvOS / Apple TV)
//
//  La règle de voisinage vertical, traduite de `@tentacle-tv/tv-core`
//  (`packages/tv-core/src/focus/sections.ts`) — mêmes étapes, mêmes
//  constantes ; ses tests sont le cahier des charges des deux :
//
//  0. dans la section qu'on quitte : en descendant, sa ligne suivante (des
//     pastilles qui passent à la ligne) ; en remontant, ce qui est à
//     l'APLOMB seulement (la pastille d'un en-tête, au-dessus de sa carte),
//     sauf dans une LISTE de lignes (`lineList`) — la ligne la plus proche,
//     puis au centre ;
//  1. sinon, les sections AU-DELÀ de celle qu'on quitte, dans la direction, qui
//     partagent une abscisse avec elle (une autre colonne n'est jamais visée)
//     et qui ont un élément focalisable ;
//  2. la plus proche, et celles qui sont à sa hauteur (côte à côte) ;
//  3. dans chacune, les éléments qui FONT FACE (rien de leur section entre eux
//     et nous dans leur colonne), puis celui dont le centre est le plus
//     proche, horizontalement, du centre de l'élément qu'on quitte ;
//  4. l'entrée déclarée de la section retenue l'emporte, si elle est là.
//
//  Toute la géométrie est lue dans la fenêtre, au moment du geste : la rangée
//  qu'on quitte a pu défiler depuis que son élément a pris le focus.
//

#import "TentacleFocusSection.h"

#import <React/UIView+React.h>

static const CGFloat kStackSlack = 24;   // STACK_SLACK
static const CGFloat kSameEdge = 8;      // SAME_EDGE
static const CGFloat kFrontierSlack = 2; // FRONTIER_SLACK

static CGFloat OverlapX(CGRect a, CGRect b)
{
  return MIN(CGRectGetMaxX(a), CGRectGetMaxX(b)) - MAX(CGRectGetMinX(a), CGRectGetMinX(b));
}

/// `isBeyond` : `to` est au-delà de `from` dans la direction.
static BOOL IsBeyond(CGRect from, CGRect to, BOOL up)
{
  CGFloat slack = MIN(kStackSlack, MIN(CGRectGetHeight(from), CGRectGetHeight(to)) / 4);
  return up ? CGRectGetMaxY(to) <= CGRectGetMinY(from) + slack : CGRectGetMinY(to) >= CGRectGetMaxY(from) - slack;
}

/// Une vue affichée : ni cachée, ni transparente, jusqu'à la fenêtre. Le
/// moteur de tvOS ne focalise pas ce qui est à moins de 0,01 d'opacité.
static BOOL IsShown(UIView *view)
{
  for (UIView *v = view; v != nil; v = v.superview) {
    if (v.hidden || v.alpha <= 0.01) {
      return NO;
    }
  }
  return view.window != nil;
}

/// Les éléments focalisables d'une section, sans descendre dans une autre
/// section de voisinage (elles ne s'imbriquent pas ; si c'était le cas, ses
/// éléments seraient les siens).
static void CollectItems(UIView *view, NSMutableArray<UIView *> *items, BOOL root)
{
  if (view.hidden || view.alpha <= 0.01) {
    return;
  }
  if (!root && [view isKindOfClass:[TentacleFocusSection class]] && ((TentacleFocusSection *)view).tvNeighbors) {
    return;
  }
  if (!root && view.canBecomeFocused && view.userInteractionEnabled) {
    [items addObject:view];
    return;
  }
  for (UIView *subview in view.subviews) {
    CollectItems(subview, items, NO);
  }
}

typedef struct {
  __unsafe_unretained UIView *view;
  CGRect box;
} TentacleItem;

/// `facingItems` : ceux qui n'ont rien de leur section au-dessus d'eux (en
/// descendant) ou au-dessous (en remontant), dans leur colonne.
static NSArray<NSValue *> *FacingItems(NSArray<UIView *> *views, BOOL up)
{
  NSUInteger count = views.count;
  CGRect boxes[count];
  for (NSUInteger i = 0; i < count; i++) {
    boxes[i] = [views[i] convertRect:views[i].bounds toView:nil];
  }
  NSMutableArray<NSValue *> *facing = [NSMutableArray array];
  for (NSUInteger i = 0; i < count; i++) {
    BOOL hidden = NO;
    for (NSUInteger j = 0; j < count && !hidden; j++) {
      if (i == j || OverlapX(boxes[i], boxes[j]) <= 0) {
        continue;
      }
      hidden = up ? CGRectGetMinY(boxes[j]) >= CGRectGetMaxY(boxes[i]) - kFrontierSlack
                  : CGRectGetMaxY(boxes[j]) <= CGRectGetMinY(boxes[i]) + kFrontierSlack;
    }
    if (!hidden) {
      TentacleItem item = {views[i], boxes[i]};
      [facing addObject:[NSValue valueWithBytes:&item objCType:@encode(TentacleItem)]];
    }
  }
  return facing;
}

/// `nearestByCenter` : le centre le plus proche ; à égalité, le moins loin
/// dans la direction, puis le plus à gauche. `kept` : le meilleur jusqu'ici.
static BOOL IsNearer(TentacleItem item, TentacleItem kept, CGRect from, BOOL up)
{
  CGFloat center = CGRectGetMidX(from);
  CGFloat gap = fabs(CGRectGetMidX(item.box) - center) - fabs(CGRectGetMidX(kept.box) - center);
  if (gap < -0.5) {
    return YES;
  }
  if (gap > 0.5) {
    return NO;
  }
  CGFloat advanceItem = up ? CGRectGetMinY(from) - CGRectGetMaxY(item.box) : CGRectGetMinY(item.box) - CGRectGetMaxY(from);
  CGFloat advanceKept = up ? CGRectGetMinY(from) - CGRectGetMaxY(kept.box) : CGRectGetMinY(kept.box) - CGRectGetMaxY(from);
  CGFloat further = advanceItem - advanceKept;
  return further < -0.5 || (further <= 0.5 && CGRectGetMinX(item.box) < CGRectGetMinX(kept.box));
}

/// `onSameRow` (geometry.ts) : deux cadres qui partagent plus de la moitié de
/// la plus petite des deux hauteurs sont sur la même ligne.
static BOOL OnSameRow(CGRect a, CGRect b)
{
  CGFloat overlap = MIN(CGRectGetMaxY(a), CGRectGetMaxY(b)) - MAX(CGRectGetMinY(a), CGRectGetMinY(b));
  return overlap > 0 && overlap * 2 > MIN(CGRectGetHeight(a), CGRectGetHeight(b));
}

/// `inLineWithin` : au-delà de `from` dans sa section — à l'aplomb en
/// remontant, sauf dans une liste —, la ligne la plus proche, puis le centre.
static UIView *InLineWithin(CGRect from, NSArray<UIView *> *siblings, BOOL up, BOOL list)
{
  NSMutableArray<NSValue *> *beyond = [NSMutableArray array];
  TentacleItem closest = {nil, CGRectNull};
  CGFloat closestAdvance = CGFLOAT_MAX;
  for (UIView *view in siblings) {
    CGRect box = [view convertRect:view.bounds toView:nil];
    CGFloat advance = up ? CGRectGetMinY(from) - CGRectGetMaxY(box) : CGRectGetMinY(box) - CGRectGetMaxY(from);
    if ((up && !list && OverlapX(from, box) <= 0) || advance < -kFrontierSlack) {
      continue;
    }
    TentacleItem item = {view, box};
    if (advance < closestAdvance) {
      closestAdvance = advance;
      closest = item;
    }
    [beyond addObject:[NSValue valueWithBytes:&item objCType:@encode(TentacleItem)]];
  }
  TentacleItem kept = {nil, CGRectNull};
  for (NSValue *value in beyond) {
    TentacleItem item;
    [value getValue:&item];
    if (OnSameRow(closest.box, item.box) && (kept.view == nil || IsNearer(item, kept, from, up))) {
      kept = item;
    }
  }
  return kept.view;
}

/// Une section candidate : au-delà, dans la colonne — la géométrie seule, sans
/// rien parcourir de son contenu.
@interface TentacleCandidate : NSObject
@property (nonatomic, strong) TentacleFocusSection *section;
@property (nonatomic, assign) CGFloat edge;
@end

@implementation TentacleCandidate
@end

/// Les sections au-delà de `from`, dans sa colonne, la plus proche d'abord.
static NSArray<TentacleCandidate *> *CandidatesBeyond(TentacleFocusSection *from, BOOL up)
{
  UIWindow *window = from.window;
  UIViewController *scope = from.reactViewController;
  CGRect fromBox = [from convertRect:from.bounds toView:nil];
  NSMutableArray<TentacleCandidate *> *candidates = [NSMutableArray array];
  for (TentacleFocusSection *section in TentacleNeighborSections()) {
    if (section == from || !section.tvNeighbors || section.window != window || section.reactViewController != scope) {
      continue;
    }
    if ([section isDescendantOfView:from] || [from isDescendantOfView:section] || !IsShown(section)) {
      continue;
    }
    CGRect box = [section convertRect:section.bounds toView:nil];
    if (OverlapX(fromBox, box) <= 0 || !IsBeyond(fromBox, box, up)) {
      continue;
    }
    TentacleCandidate *candidate = [TentacleCandidate new];
    candidate.section = section;
    candidate.edge = up ? -CGRectGetMaxY(box) : CGRectGetMinY(box);
    [candidates addObject:candidate];
  }
  [candidates sortUsingComparator:^NSComparisonResult(TentacleCandidate *a, TentacleCandidate *b) {
    return a.edge < b.edge ? NSOrderedAscending : (a.edge > b.edge ? NSOrderedDescending : NSOrderedSame);
  }];
  return candidates;
}

/// Un premier élément focalisable dans `view` (sans tout parcourir).
static BOOL HasItem(UIView *view, BOOL root)
{
  if (view.hidden || view.alpha <= 0.01) {
    return NO;
  }
  if (!root && [view isKindOfClass:[TentacleFocusSection class]] && ((TentacleFocusSection *)view).tvNeighbors) {
    return NO;
  }
  if (!root && view.canBecomeFocused && view.userInteractionEnabled) {
    return YES;
  }
  for (UIView *subview in view.subviews) {
    if (HasItem(subview, NO)) {
      return YES;
    }
  }
  return NO;
}

BOOL TentacleNeighborExists(TentacleFocusSection *from, UIView *focused, BOOL up)
{
  if (from.window == nil) {
    return NO;
  }
  NSMutableArray<UIView *> *siblings = [NSMutableArray array];
  CollectItems(from, siblings, YES);
  [siblings removeObject:focused];
  if (InLineWithin([focused convertRect:focused.bounds toView:nil], siblings, up, from.lineList) != nil) {
    return YES;
  }
  for (TentacleCandidate *candidate in CandidatesBeyond(from, up)) {
    if (HasItem(candidate.section, YES)) {
      return YES;
    }
  }
  return NO;
}

UIView *TentacleNeighborTarget(TentacleFocusSection *from, UIView *focused, BOOL up)
{
  if (from.window == nil) {
    return nil;
  }
  CGRect itemBox = [focused convertRect:focused.bounds toView:nil];

  // 0. À l'aplomb, dans la section qu'on quitte.
  NSMutableArray<UIView *> *siblings = [NSMutableArray array];
  CollectItems(from, siblings, YES);
  [siblings removeObject:focused];
  UIView *within = InLineWithin(itemBox, siblings, up, from.lineList);
  if (within != nil) {
    return within;
  }

  // 1-3. La plus proche des sections au-delà qui a un élément, et celles à sa
  // hauteur ; dans chacune, ce qui fait face ; l'élément au centre le plus proche.
  TentacleFocusSection *keptSection = nil;
  NSArray<UIView *> *keptItems = nil;
  TentacleItem kept = {nil, CGRectNull};
  CGFloat groupEdge = CGFLOAT_MAX;
  for (TentacleCandidate *candidate in CandidatesBeyond(from, up)) {
    if (keptSection != nil && candidate.edge - groupEdge > kSameEdge) {
      break;
    }
    NSMutableArray<UIView *> *items = [NSMutableArray array];
    CollectItems(candidate.section, items, YES);
    if (items.count == 0) {
      continue;
    }
    groupEdge = MIN(groupEdge, candidate.edge);
    for (NSValue *value in FacingItems(items, up)) {
      TentacleItem item;
      [value getValue:&item];
      if (kept.view == nil || IsNearer(item, kept, itemBox, up)) {
        kept = item;
        keptSection = candidate.section;
        keptItems = items;
      }
    }
  }
  if (keptSection == nil) {
    return nil;
  }

  // 4. L'entrée déclarée, si elle est là et focalisable.
  UIView *entry = keptSection.entryView;
  return entry != nil && [keptItems containsObject:entry] ? entry : kept.view;
}
