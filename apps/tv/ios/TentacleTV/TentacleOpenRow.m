//
//  TentacleOpenRow.m
//  TentacleTV (tvOS / Apple TV)
//
//  La rangée à carte qui S'OUVRE (`rowRevealStart`, tv-core
//  `cards/openCard.ts`) : la carte focalisée se pose toujours au RETRAIT de
//  la rangée, et c'est par la carte posée là qu'on entre dans la rangée
//  depuis une section voisine (`openRowEntry`) — jamais par celle d'en face.
//  Le mouvement lui-même est celui des rangées (`TentacleRowScroller.m`) ;
//  l'entrée, une exception du voisinage (`TentacleFocusNeighbors.m`). Le même
//  sur Android : `RevealScroller.kt`, `FocusNeighbors.kt`.
//

#import "TentacleFocusSection.h"

#import <React/RCTScrollView.h>

/// La ScrollView horizontale de la rangée qui porte `view`, sous `section`.
static RCTScrollView *RowOf(UIView *view, UIView *section)
{
  for (UIView *v = view.superview; v != nil && v != section; v = v.superview) {
    if ([v isKindOfClass:[RCTScrollView class]]) {
      return (RCTScrollView *)v;
    }
  }
  return nil;
}

/// Le bord gauche de `view` dans `ancestor` d'après la MISE EN PAGE : sans les transformations
/// (agrandissement, carte poussée par la carte ouverte) que `convertPoint:` compterait — la
/// place où la carte se posera, pas celle où elle passe.
static CGFloat LayoutLeft(UIView *view, UIView *ancestor)
{
  CGFloat x = 0;
  for (UIView *v = view; v != nil && v != ancestor; v = v.superview) {
    x += v.center.x - CGRectGetWidth(v.bounds) * v.layer.anchorPoint.x - CGRectGetMinX(v.superview.bounds);
  }
  return x;
}

BOOL TentacleOpenRowStart(RCTScrollView *row, UIView *focused, CGFloat *offset)
{
  UIView *content = row.contentView;
  UIScrollView *scroll = row.scrollView;
  if (content == nil || scroll == nil || content.subviews.count == 0 || ![focused isDescendantOfView:content]) {
    return NO;
  }
  CGFloat leading = CGRectGetMinX(content.subviews.firstObject.frame);
  CGFloat start = LayoutLeft(focused, content) - leading;
  *offset = MIN(MAX(start, 0), MAX(0, scroll.contentSize.width - CGRectGetWidth(scroll.bounds)));
  return YES;
}

UIView *TentacleOpenRowEntry(TentacleFocusSection *section, NSArray<UIView *> *items)
{
  if (!section.rowRevealStart || items.count == 0) {
    return nil;
  }
  // La piste des cartes : la première trouvée depuis un élément — l'en-tête de la rangée peut
  // porter une pastille (le filtre de « Pour vous »), hors de la piste.
  RCTScrollView *row = nil;
  for (UIView *item in items) {
    row = RowOf(item, section);
    if (row != nil) {
      break;
    }
  }
  UIView *content = row.contentView;
  if (row == nil || content == nil || content.subviews.count == 0) {
    return nil;
  }
  // Le retrait, à l'écran : le bord visible de la rangée plus son retrait de contenu.
  UIScrollView *scroll = row.scrollView;
  CGFloat leading = CGRectGetMinX(content.subviews.firstObject.frame);
  CGFloat retrait = [scroll convertPoint:CGPointMake(scroll.contentOffset.x + leading, 0) toView:nil].x;
  UIView *best = nil;
  CGFloat bestGap = CGFLOAT_MAX;
  for (UIView *item in items) {
    if (![item isDescendantOfView:content]) {
      continue;
    }
    CGFloat gap = fabs(CGRectGetMinX([item convertRect:item.bounds toView:nil]) - retrait);
    if (gap < bestGap) {
      best = item;
      bestGap = gap;
    }
  }
  return best;
}
