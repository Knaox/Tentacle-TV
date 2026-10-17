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
//  On ne défile pas à la place de tvOS (son animateur garde sa vitesse, une
//  rafale passe en défilement rapide sans creux — `TentacleRevealScroller.m`) :
//  on CORRIGE la cible qu'il propose (`scrollViewWillEndDragging:…
//  targetContentOffset:`, aussi appelée pour un défilement de focus), et c'est
//  lui qui la joue. La règle est celle d'Android TV, dans tv-core :
//  `packages/tv-core/src/focus/burstFollow.ts`, `rowRevealOffset` — ici avec,
//  pour « là où elle va », la proposition de tvOS : la rangée bouge le moins
//  possible à partir d'elle pour garder la carte entre les deux marges.
//
//  Seules les rangées d'une section qui le demande (`rowReveal`, l'accueil et
//  « Pour vous ») : la section l'attache à la ScrollView horizontale qui porte
//  l'élément focalisé, au premier focus.
//

#import "TentacleFocusSection.h"

#import <objc/runtime.h>
#import <React/RCTScrollView.h>

static char kRowScrollerKey;

@interface TentacleRowScroller : NSObject <UIScrollViewDelegate>
@end

@implementation TentacleRowScroller {
  __weak RCTScrollView *_row;
}

- (instancetype)initWithRow:(RCTScrollView *)row
{
  if ((self = [super init])) {
    _row = row;
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
  // `rowRevealOffset`, depuis la proposition de tvOS.
  CGFloat base = targetContentOffset->x;
  CGFloat start = left - leading;
  CGFloat end = left + width + trailing - viewport;
  CGFloat target = end > base ? MIN(end, start) : (start < base ? start : base);
  targetContentOffset->x = MIN(MAX(target, 0), MAX(0, contentWidth - viewport));
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
      TentacleRowScroller *scroller = [[TentacleRowScroller alloc] initWithRow:row];
      objc_setAssociatedObject(row, &kRowScrollerKey, scroller, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
      [row addScrollListener:scroller];
    }
    return;
  }
}
