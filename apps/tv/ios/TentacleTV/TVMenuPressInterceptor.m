//
//  TVMenuPressInterceptor.m
//  TentacleTV (tvOS / Apple TV)
//
//  Une `View` qui prend le bouton Menu (Retour de la Siri Remote) quand le
//  focus est dans son sous-arbre, et le rend au JS au lieu de le laisser à
//  UIKit. Posée comme conteneur racine du rail latéral.
//
//  Le rail est monté À CÔTÉ du navigateur, hors des view controllers des
//  écrans : un appui Menu parti de l'une de ses entrées ne traverse aucun
//  `RNSScreen` (où le patch de react-native-screens le rend à
//  `usePreventRemove`), ni le `UINavigationController` de la pile, dont le
//  geste Menu n'est posé que dans SA hiérarchie de vues. Il remontait donc la
//  chaîne de répondeurs jusqu'à `UIApplication`, qui suspend l'application —
//  Menu depuis le rail quittait l'app, sur n'importe quel écran.
//
//  Ici on l'arrête en chemin, tant que `enabled` le demande, et le JS décide
//  (`navigationRef.goBack()`, que `usePreventRemove` intercepte comme depuis le
//  contenu). `enabled` faux laisse l'appui intact : à la racine de l'accueil,
//  quitter l'application reste la règle tvOS, et seul UIKit sait le faire.
//
//  Pourquoi pas `TVEventControl.enableTVMenuKey()` : son geste se pose sur la
//  vue racine, donc prend AUSSI les appuis partis du contenu, en concurrence
//  avec le dépilage natif ; et l'activer au gré du focus depuis le JS court
//  toujours derrière le focus réel. Ici, c'est UIKit qui livre l'appui à
//  l'élément focalisé à l'instant même : rien à synchroniser.
//

#import <React/RCTViewManager.h>
#import <React/RCTTVView.h>

@interface TVMenuPressInterceptor : RCTTVView

/// Prendre les appuis Menu du sous-arbre. Faux : UIKit les reçoit comme avant.
@property (nonatomic, assign) BOOL enabled;
@property (nonatomic, copy) RCTDirectEventBlock onMenuPress;

@end

@implementation TVMenuPressInterceptor {
  // L'appui en cours a été pris dès son début. La décision tient jusqu'à sa
  // fin : `enabled` peut basculer entre les deux (une navigation en vol), et
  // UIKit ne doit jamais recevoir la fin d'un appui dont il n'a pas vu le début
  // — ni l'inverse.
  BOOL _menuPressTaken;
}

static BOOL TVContainsMenuPress(NSSet<UIPress *> *presses)
{
  for (UIPress *press in presses) {
    if (press.type == UIPressTypeMenu) {
      return YES;
    }
  }
  return NO;
}

// Les autres appuis d'un même lot suivent leur chemin : seul Menu est pris.
static NSSet<UIPress *> *TVPressesOtherThanMenu(NSSet<UIPress *> *presses)
{
  return [presses objectsPassingTest:^BOOL(UIPress *press, BOOL *stop) {
    return press.type != UIPressTypeMenu;
  }];
}

- (void)pressesBegan:(NSSet<UIPress *> *)presses withEvent:(UIPressesEvent *)event
{
  if (!TVContainsMenuPress(presses) || !self.enabled || !self.onMenuPress) {
    [super pressesBegan:presses withEvent:event];
    return;
  }
  _menuPressTaken = YES;
  NSSet<UIPress *> *others = TVPressesOtherThanMenu(presses);
  if (others.count > 0) {
    [super pressesBegan:others withEvent:event];
  }
}

- (void)pressesChanged:(NSSet<UIPress *> *)presses withEvent:(UIPressesEvent *)event
{
  if (!_menuPressTaken || !TVContainsMenuPress(presses)) {
    [super pressesChanged:presses withEvent:event];
    return;
  }
  NSSet<UIPress *> *others = TVPressesOtherThanMenu(presses);
  if (others.count > 0) {
    [super pressesChanged:others withEvent:event];
  }
}

- (void)pressesEnded:(NSSet<UIPress *> *)presses withEvent:(UIPressesEvent *)event
{
  if (!_menuPressTaken || !TVContainsMenuPress(presses)) {
    [super pressesEnded:presses withEvent:event];
    return;
  }
  _menuPressTaken = NO;
  NSSet<UIPress *> *others = TVPressesOtherThanMenu(presses);
  if (others.count > 0) {
    [super pressesEnded:others withEvent:event];
  }
  // Au relâchement, comme le dépilage natif et le patch de react-native-screens.
  if (self.onMenuPress) {
    self.onMenuPress(@{});
  }
}

- (void)pressesCancelled:(NSSet<UIPress *> *)presses withEvent:(UIPressesEvent *)event
{
  if (!_menuPressTaken || !TVContainsMenuPress(presses)) {
    [super pressesCancelled:presses withEvent:event];
    return;
  }
  // Appui annulé (appui long repris par le système, par exemple) : rien à dire.
  _menuPressTaken = NO;
  NSSet<UIPress *> *others = TVPressesOtherThanMenu(presses);
  if (others.count > 0) {
    [super pressesCancelled:others withEvent:event];
  }
}

@end

@interface TVMenuPressInterceptorManager : RCTViewManager
@end

@implementation TVMenuPressInterceptorManager

RCT_EXPORT_MODULE()

- (UIView *)view
{
  // Comme `RCTViewManager` sur tvOS : toute `View` y est une `RCTTVView`.
  return [[TVMenuPressInterceptor alloc] initWithBridge:self.bridge];
}

RCT_EXPORT_VIEW_PROPERTY(enabled, BOOL)
RCT_EXPORT_VIEW_PROPERTY(onMenuPress, RCTDirectEventBlock)

@end
