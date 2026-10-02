//
//  TentacleNeighborGuides.m
//  TentacleTV (tvOS / Apple TV)
//
//  Les guides du VOISINAGE vertical d'une section : quand le focus est sur un
//  de ses éléments, un guide de focus d'un point, de la largeur de l'élément,
//  collé au-dessus de lui et un autre au-dessous — le mécanisme de
//  `nextFocusUp` / `nextFocusDown` de React Native tvOS, mais porté par ce qui
//  défile avec l'élément (`GuideOwnerOf`). Le plus proche et le mieux aligné des
//  candidats : il l'emporte toujours. Mesuré au simulateur : une bande de
//  toute la largeur, au bord de la section, perdait contre une carte DEUX
//  rangées plus bas dans l'axe — la rangée courte d'entre les deux était
//  sautée.
//
//  Un guide renvoie vers un RÉSOLVEUR, une vue sans taille de la section : sa
//  `preferredFocusEnvironments`, que tvOS consulte au moment du geste, applique
//  la règle (`TentacleNeighborTarget`) sur la géométrie de l'écran. Le guide
//  lui-même ne peut pas calculer : tvOS lit la valeur STOCKÉE de ses
//  destinations, jamais une méthode surchargée (mesuré).
//
//  Un guide n'est posé que si la règle a une cible dans sa direction : sans
//  cible, le geste reste à tvOS et aux guides des écrans (la bande de la croix
//  Retour d'une fiche). Ce qui se monte ensuite — une section qui arrive, des
//  cartes chargées — est réévalué après chaque montage de React.
//

#import "TentacleFocusSection.h"

#import <React/RCTBridge.h>
#import <React/RCTUIManager.h>
#import <React/RCTUIManagerObserverCoordinator.h>

/// Le porteur des guides de `item` : son premier ancêtre qui les CONTIENT — tvOS
/// ne trouve pas un guide hors des limites de la vue qui le porte (mesuré : sous
/// une affiche de grille, la section épousait l'affiche, et BAS ne trouvait
/// rien) — sans jamais aller au-delà du contenu d'une ScrollView : une
/// contrainte qui la traverse n'est pas recalculée quand elle défile (mesuré :
/// le guide restait là où l'élément était avant que sa rangée défile).
static UIView *GuideOwnerOf(UIView *item)
{
  CGRect area = CGRectInset(item.bounds, 0, -2);
  for (UIView *v = item.superview; v != nil; v = v.superview) {
    if (CGRectContainsRect(v.bounds, [item convertRect:area toView:v]) || [v.superview isKindOfClass:[UIScrollView class]]) {
      return v;
    }
  }
  return item.window;
}

@interface TentacleNeighborResolver : UIView
- (instancetype)initWithSection:(TentacleFocusSection *)section up:(BOOL)up;
@end

@implementation TentacleNeighborResolver {
  __weak TentacleFocusSection *_section;
  BOOL _up;
}

- (instancetype)initWithSection:(TentacleFocusSection *)section up:(BOOL)up
{
  if ((self = [super initWithFrame:CGRectZero])) {
    _section = section;
    _up = up;
    self.userInteractionEnabled = NO;
    self.accessibilityElementsHidden = YES;
  }
  return self;
}

- (BOOL)canBecomeFocused
{
  return NO;
}

- (NSArray<id<UIFocusEnvironment>> *)preferredFocusEnvironments
{
  TentacleFocusSection *section = _section;
  UIView *focused = section ? TentacleFocusedView(section) : nil;
  UIView *target = focused && [focused isDescendantOfView:section] ? TentacleNeighborTarget(section, focused, _up) : nil;
  // Plus rien (une section partie entre la pose et le geste) : on reste.
  return target ? @[ target ] : (focused ? @[ focused ] : @[]);
}

@end

@interface TentacleMountWatcher : NSObject <RCTUIManagerObserver>
@end

@implementation TentacleMountWatcher

- (void)uiManagerWillPerformMounting:(RCTUIManager *)manager
{
  [manager addUIBlock:^(__unused RCTUIManager *uiManager, __unused NSDictionary<NSNumber *, UIView *> *registry) {
    [TentacleNeighborGuides refreshAll];
  }];
}

@end

/// Une section est arrivée ou partie depuis la dernière réévaluation : tout
/// guide posé se réévalue (une cible a pu disparaître).
static BOOL gSectionsChanged = NO;

@implementation TentacleNeighborGuides {
  __weak TentacleFocusSection *_section;
  __weak UIView *_item;
  UIFocusGuide *_upGuide;
  UIFocusGuide *_downGuide;
  TentacleNeighborResolver *_upResolver;
  TentacleNeighborResolver *_downResolver;
}

+ (void)observeBridge:(RCTBridge *)bridge
{
  static NSMapTable<RCTBridge *, TentacleMountWatcher *> *watchers;
  if (watchers == nil) {
    watchers = [NSMapTable weakToStrongObjectsMapTable];
  }
  if (bridge == nil || [watchers objectForKey:bridge] != nil) {
    return;
  }
  TentacleMountWatcher *watcher = [TentacleMountWatcher new];
  [watchers setObject:watcher forKey:bridge];
  [bridge.uiManager.observerCoordinator addObserver:watcher];
}

+ (void)sectionsChanged
{
  gSectionsChanged = YES;
}

+ (void)refreshAll
{
  BOOL full = gSectionsChanged;
  gSectionsChanged = NO;
  for (TentacleFocusSection *section in TentacleNeighborSections()) {
    [section.neighborGuides refreshFully:full];
  }
}

- (instancetype)initWithSection:(TentacleFocusSection *)section
{
  if ((self = [super init])) {
    _section = section;
  }
  return self;
}

- (void)guideItem:(UIView *)item
{
  if (item != _item) {
    [self removeGuides];
    _item = item;
  }
  [self updateFully:NO];
}

/// Les guides de l'élément focalisé, selon ce que la règle trouve MAINTENANT.
/// Un guide posé reste juste tant qu'aucune section ne part (le résolveur
/// choisit au geste) : sans `full`, seule une direction sans guide se réévalue.
- (void)updateFully:(BOOL)full
{
  TentacleFocusSection *section = _section;
  UIView *item = _item;
  BOOL up = (!full && _upGuide != nil) || (section && item && TentacleNeighborExists(section, item, YES));
  BOOL down = (!full && _downGuide != nil) || (section && item && TentacleNeighborExists(section, item, NO));
  if (up == (_upGuide != nil) && down == (_downGuide != nil)) {
    return;
  }
  [self removeGuides];
  UIView *owner = item ? GuideOwnerOf(item) : nil;
  if (section == nil || owner == nil) {
    return;
  }
  if (_upResolver == nil) {
    _upResolver = [[TentacleNeighborResolver alloc] initWithSection:section up:YES];
    _downResolver = [[TentacleNeighborResolver alloc] initWithSection:section up:NO];
    [section insertSubview:_upResolver atIndex:0];
    [section insertSubview:_downResolver atIndex:0];
  }
  if (up) {
    _upGuide = [self addGuideTo:owner item:item up:YES];
  }
  if (down) {
    _downGuide = [self addGuideTo:owner item:item up:NO];
  }
}

- (UIFocusGuide *)addGuideTo:(UIView *)owner item:(UIView *)item up:(BOOL)up
{
  UIFocusGuide *guide = [UIFocusGuide new];
  [owner addLayoutGuide:guide];
  [guide.leftAnchor constraintEqualToAnchor:item.leftAnchor].active = YES;
  [guide.widthAnchor constraintEqualToAnchor:item.widthAnchor].active = YES;
  [guide.heightAnchor constraintEqualToConstant:1].active = YES;
  if (up) {
    [guide.bottomAnchor constraintEqualToAnchor:item.topAnchor].active = YES;
  } else {
    [guide.topAnchor constraintEqualToAnchor:item.bottomAnchor].active = YES;
  }
  guide.preferredFocusEnvironments = @[ up ? _upResolver : _downResolver ];
  return guide;
}

- (void)refreshFully:(BOOL)full
{
  UIView *item = _item;
  TentacleFocusSection *section = _section;
  if (item == nil || section == nil) {
    return;
  }
  if (TentacleFocusedView(section) == item) {
    [self updateFully:full];
  } else {
    [self clear];
  }
}

- (void)removeGuides
{
  [_upGuide.owningView removeLayoutGuide:_upGuide];
  [_downGuide.owningView removeLayoutGuide:_downGuide];
  _upGuide = nil;
  _downGuide = nil;
}

- (void)clear
{
  [self removeGuides];
  _item = nil;
}

@end
