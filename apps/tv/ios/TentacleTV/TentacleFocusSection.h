//
//  TentacleFocusSection.h
//  TentacleTV (tvOS / Apple TV)
//
//  Une SECTION d'une page de la refonte — une rangée, une ligne de grille, un
//  réglage, l'en-tête d'une fiche —, montée par `FocusSection`
//  (apps/tv/src/redesign/focus/FocusSection.tsx). Deux rôles, indépendants :
//
//  - le SUIVI de la page (`reveal*`, décrit par la vue) : quand le focus entre
//    dans la section, la page défile pour la montrer ENTIÈRE, en un seul
//    mouvement à ressort (`TentacleRevealScroller`) — à la place du défilement
//    de tvOS, jamais par-dessus ;
//  - le VOISINAGE (`tvNeighbors`, décidé par l'intégration, par le port du
//    focus) : HAUT / BAS depuis un de ses éléments vise la section voisine,
//    l'élément au centre le plus proche — la règle de `@tentacle-tv/tv-core`
//    (`focus/sections.ts`), traduite ici parce que la géométrie n'est juste
//    qu'au moment même du geste.
//
//  Les décisions sont dans tv-core (`packages/tv-core/src/focus/` :
//  `sections.ts`, `sectionEntry.ts`, `reveal.ts`, `revealMotion.ts`) ; ces
//  fichiers natifs les APPLIQUENT au geste, pas à pas.
//

#import <React/RCTTVView.h>

@class RCTScrollView;
@class TentacleNeighborGuides;

NS_ASSUME_NONNULL_BEGIN

@interface TentacleFocusSection : RCTTVView

/// `none` · `nearest` (le moins de défilement, `revealMargin` aux bords) ·
/// `anchor` (le haut de la section à `revealTop` du haut de l'écran) ·
/// `start` (la page tout en haut).
@property (nonatomic, copy) NSString *revealMode;
@property (nonatomic, assign) CGFloat revealMargin;
@property (nonatomic, assign) CGFloat revealTop;
/// Le ressort du défilement : réponse (s) et fraction d'amortissement
/// (`TV_MOTION.spring.scroll`).
@property (nonatomic, assign) CGFloat revealResponse;
@property (nonatomic, assign) CGFloat revealDamping;

/// Une LISTE de lignes (un panneau de réglages, décrit par la vue) : HAUT y va
/// à la ligne du dessus au plus proche, comme BAS — rien ne la coiffe.
@property (nonatomic, assign) BOOL lineList;

/// Ses rangées gardent la carte focalisée loin des bords, au retrait de la
/// rangée — jamais sous le rail (`TentacleRowScroller.m`, tv-core
/// `rowRevealOffset`).
@property (nonatomic, assign) BOOL rowReveal;

/// Ses rangées posent TOUJOURS la carte focalisée au retrait de la rangée — la
/// carte qui s'ouvre (tv-core `cards/openCard.ts`, `rowRevealOffset` mode
/// `start`) ; sans elle, la rangée bouge le moins possible.
@property (nonatomic, assign) BOOL rowRevealStart;

/// La règle de voisinage vertical s'applique à cette section.
@property (nonatomic, assign) BOOL tvNeighbors;
/// L'entrée déclarée (numéro natif d'un de ses éléments), ou nil.
@property (nonatomic, copy, nullable) NSNumber *tvEntry;

/// L'élément d'entrée, résolu à la demande (nil s'il n'est pas monté).
- (nullable UIView *)entryView;

/// Sa TÊTE déclarée (numéro natif d'un de ses éléments : la puce du filtre de
/// « Pour vous »), ou nil : HAUT depuis la première carte de sa ligne y va,
/// à l'aplomb ou non (tv-core `headFromFirst`).
@property (nonatomic, copy, nullable) NSNumber *tvHead;
- (nullable UIView *)headView;

/// Le pont React (le magasin des vues, les observateurs du montage).
@property (nonatomic, weak, readonly, nullable) RCTBridge *sectionBridge;

/// Les guides HAUT / BAS posés sur son élément focalisé.
@property (nonatomic, strong, readonly) TentacleNeighborGuides *neighborGuides;

@end

/// Les sections de voisinage attachées à une fenêtre.
FOUNDATION_EXPORT NSArray<TentacleFocusSection *> *TentacleNeighborSections(void);

/// La ScrollView VERTICALE la plus proche au-dessus de `view` — sa page (une
/// rangée horizontale qui la contiendrait est passée) —, ou nil.
FOUNDATION_EXPORT RCTScrollView *_Nullable TentacleVerticalHost(UIView *view);

/// La vue qui porte le focus dans la fenêtre de `environment`, ou nil.
FOUNDATION_EXPORT UIView *_Nullable TentacleFocusedView(id<UIFocusEnvironment> environment);

/// L'élément visé par HAUT (`up`) ou BAS depuis `focused`, élément de la
/// section `from` — nil quand aucune section n'est au-delà
/// (`TentacleFocusNeighbors.m`).
FOUNDATION_EXPORT UIView *_Nullable TentacleNeighborTarget(TentacleFocusSection *from, UIView *focused, BOOL up);

/// Y a-t-il une cible ? La même règle, sans choisir : elle s'arrête au premier
/// élément trouvé (la pose des guides, réévaluée après chaque montage).
FOUNDATION_EXPORT BOOL TentacleNeighborExists(TentacleFocusSection *from, UIView *focused, BOOL up);

/// Les guides du voisinage d'une section (`TentacleNeighborGuides.m`).
@interface TentacleNeighborGuides : NSObject

- (instancetype)initWithSection:(TentacleFocusSection *)section;
/// Suit `item` (focalisé, dans la section) et pose ses guides — seulement ceux
/// qui ont une cible.
- (void)guideItem:(UIView *)item;
/// Retire les guides et oublie l'élément.
- (void)clear;
/// Réévalue les guides de l'élément suivi — tous (`full`), ou ceux qui manquent.
- (void)refreshFully:(BOOL)full;
/// Une section est arrivée ou partie : la prochaine réévaluation sera complète.
+ (void)sectionsChanged;
/// Réévalue toutes les sections ; inscrit, une fois par pont, après chaque montage.
+ (void)refreshAll;
+ (void)observeBridge:(nullable RCTBridge *)bridge;

@end

/// Attache le suivi de rangée à la ScrollView horizontale entre `item` et
/// `section` (une fois par rangée) — `TentacleRowScroller.m`.
FOUNDATION_EXPORT void TentacleRowScrollerAttach(TentacleFocusSection *section, UIView *item);

/// La carte qui s'ouvre (`rowRevealStart`, `TentacleOpenRow.m`) : la position de `row` qui pose
/// `focused` au retrait (NO : elle n'y est pas).
FOUNDATION_EXPORT BOOL TentacleOpenRowStart(RCTScrollView *row, UIView *focused, CGFloat *offset);

/// … et l'élément par lequel on y entre depuis une section voisine : celui posé au retrait
/// (tv-core `openRowEntry`) ; nil hors d'une telle rangée.
FOUNDATION_EXPORT UIView *_Nullable TentacleOpenRowEntry(TentacleFocusSection *section, NSArray<UIView *> *items);

/// Observe la télécommande sur `window` (une fois) : flèches enfoncées, pavé
/// (`TentacleFocusInput.m`).
FOUNDATION_EXPORT void TentacleFocusInputObserve(UIWindow *_Nullable window);

/// Le pas du focus en cours vient-il d'une RAFALE — une flèche maintenue (ses
/// répétitions), un glisser du pavé — plutôt que d'un appui isolé ?
FOUNDATION_EXPORT BOOL TentacleFocusInputIsBurst(void);

/// Le défilement d'une page : un par ScrollView verticale, créé à la demande
/// (`TentacleRevealScroller.m`).
@interface TentacleRevealScroller : NSObject <UIScrollViewDelegate>

/// Celui de la ScrollView verticale qui contient `section` ; nil hors d'une page.
+ (nullable instancetype)scrollerForSection:(TentacleFocusSection *)section;

/// Montre la section qui RÉVÈLE `item` (la plus proche, entre lui et la page).
- (void)revealItem:(UIView *)item;

@end

NS_ASSUME_NONNULL_END
