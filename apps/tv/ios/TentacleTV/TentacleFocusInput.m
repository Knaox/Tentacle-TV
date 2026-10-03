//
//  TentacleFocusInput.m
//  TentacleTV (tvOS / Apple TV)
//
//  Ce que fait la télécommande au moment d'un pas du focus : un appui ISOLÉ
//  (une flèche enfoncée à l'instant), ou une RAFALE — la même flèche
//  maintenue, que tvOS répète, ou un glisser sur le pavé tactile.
//
//  La page qui suit le focus (`TentacleRevealScroller.m`) en dépend : un pas
//  isolé, elle le joue sur son ressort ; une rafale, c'est l'animateur de
//  défilement du focus de tvOS qui la joue (vers la même cible). Au bout d'une
//  à deux secondes de rafale, tvOS passe en défilement rapide et part de la
//  vitesse de SON animateur (`currentVelocityForScrollableContainer:`, lu au
//  débogueur) — 0 si notre ressort défilait à sa place : la page tombait de
//  ~5 000 à ~400 pt/s, puis remontait en ~1,8 s (mesuré au banc des
//  bibliothèques, à la descente comme à la remontée).
//
//  L'observateur est passif : un geste posé sur la fenêtre, qui ne se
//  reconnaît jamais et n'empêche ni ne retarde rien — il note les flèches
//  enfoncées et l'activité du pavé.
//
//  La spécification est dans tv-core : `packages/tv-core/src/focus/revealMotion.ts`
//  (`isInputBurst`, `REVEAL_BURST.repeatAfterMs` et `swipeWindowMs`).
//

#import "TentacleFocusSection.h"

#import <UIKit/UIGestureRecognizerSubclass.h>

/// Une flèche enfoncée depuis plus longtemps : le pas qu'elle fait faire est
/// une répétition de tvOS (la première vient ~470 ms après l'appui).
static const CFTimeInterval kRepeatAfter = 0.2;
/// Un pas qui suit l'activité du pavé de moins que ça vient d'un glisser.
static const CFTimeInterval kSwipeWindow = 0.5;

/// Depuis quand chaque flèche est enfoncée (0 : relâchée) — haut, bas, gauche, droite.
static CFTimeInterval gArrowDownSince[4];
/// La dernière activité du pavé tactile (doigt posé, glissé, levé).
static CFTimeInterval gLastTouch;

static NSInteger ArrowIndex(UIPressType type)
{
  switch (type) {
    case UIPressTypeUpArrow: return 0;
    case UIPressTypeDownArrow: return 1;
    case UIPressTypeLeftArrow: return 2;
    case UIPressTypeRightArrow: return 3;
    default: return -1;
  }
}

@interface TentacleFocusInputObserver : UIGestureRecognizer <UIGestureRecognizerDelegate>
@end

@implementation TentacleFocusInputObserver

- (instancetype)init
{
  if ((self = [super initWithTarget:nil action:nil])) {
    self.cancelsTouchesInView = NO;
    self.delaysTouchesBegan = NO;
    self.delaysTouchesEnded = NO;
    self.allowedPressTypes = @[ @(UIPressTypeUpArrow), @(UIPressTypeDownArrow), @(UIPressTypeLeftArrow), @(UIPressTypeRightArrow) ];
    self.allowedTouchTypes = @[ @(UITouchTypeIndirect) ];
    self.delegate = self;
  }
  return self;
}

- (void)notePresses:(NSSet<UIPress *> *)presses down:(BOOL)down
{
  CFTimeInterval now = CACurrentMediaTime();
  for (UIPress *press in presses) {
    NSInteger index = ArrowIndex(press.type);
    if (index >= 0) {
      gArrowDownSince[index] = down ? now : 0;
    }
  }
}

- (void)pressesBegan:(NSSet<UIPress *> *)presses withEvent:(UIPressesEvent *)event
{
  [super pressesBegan:presses withEvent:event];
  [self notePresses:presses down:YES];
}

- (void)pressesEnded:(NSSet<UIPress *> *)presses withEvent:(UIPressesEvent *)event
{
  [super pressesEnded:presses withEvent:event];
  [self notePresses:presses down:NO];
  self.state = UIGestureRecognizerStateFailed; // rien à reconnaître : il se réarme
}

- (void)pressesCancelled:(NSSet<UIPress *> *)presses withEvent:(UIPressesEvent *)event
{
  [super pressesCancelled:presses withEvent:event];
  [self notePresses:presses down:NO];
  self.state = UIGestureRecognizerStateFailed;
}

- (void)touchesBegan:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event
{
  [super touchesBegan:touches withEvent:event];
  gLastTouch = CACurrentMediaTime();
}

- (void)touchesMoved:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event
{
  [super touchesMoved:touches withEvent:event];
  gLastTouch = CACurrentMediaTime();
}

- (void)touchesEnded:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event
{
  [super touchesEnded:touches withEvent:event];
  gLastTouch = CACurrentMediaTime();
  self.state = UIGestureRecognizerStateFailed;
}

- (void)touchesCancelled:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event
{
  [super touchesCancelled:touches withEvent:event];
  gLastTouch = CACurrentMediaTime();
  self.state = UIGestureRecognizerStateFailed;
}

- (BOOL)gestureRecognizer:(UIGestureRecognizer *)gestureRecognizer
    shouldRecognizeSimultaneouslyWithGestureRecognizer:(UIGestureRecognizer *)otherGestureRecognizer
{
  return YES;
}

- (BOOL)canPreventGestureRecognizer:(UIGestureRecognizer *)preventedGestureRecognizer
{
  return NO;
}

- (BOOL)canBePreventedByGestureRecognizer:(UIGestureRecognizer *)preventingGestureRecognizer
{
  return NO;
}

@end

void TentacleFocusInputObserve(UIWindow *window)
{
  static __weak UIWindow *observed;
  if (window == nil || window == observed) {
    return;
  }
  observed = window;
  [window addGestureRecognizer:[TentacleFocusInputObserver new]];
}

BOOL TentacleFocusInputIsBurst(void)
{
  CFTimeInterval now = CACurrentMediaTime();
  BOOL anyDown = NO;
  for (NSInteger i = 0; i < 4; i++) {
    if (gArrowDownSince[i] > 0) {
      if (now - gArrowDownSince[i] > kRepeatAfter) {
        return YES; // une flèche maintenue : tvOS répète le pas
      }
      anyDown = YES;
    }
  }
  // Une flèche enfoncée à l'instant : un appui isolé, même doigt posé sur le pavé.
  return !anyDown && gLastTouch > 0 && now - gLastTouch < kSwipeWindow;
}
