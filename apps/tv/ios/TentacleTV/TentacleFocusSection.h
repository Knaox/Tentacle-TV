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

#import <React/RCTTVView.h>

@class RCTScrollView;

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

/// La règle de voisinage vertical s'applique à cette section.
@property (nonatomic, assign) BOOL tvNeighbors;
/// L'entrée déclarée (numéro natif d'un de ses éléments), ou nil.
@property (nonatomic, copy, nullable) NSNumber *tvEntry;

/// L'élément d'entrée, résolu à la demande (nil s'il n'est pas monté).
- (nullable UIView *)entryView;

/// Le pont React (le magasin des vues, les observateurs du montage).
@property (nonatomic, weak, readonly, nullable) RCTBridge *sectionBridge;

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

/// Le défilement d'une page : un par ScrollView verticale, créé à la demande
/// (`TentacleRevealScroller.m`).
@interface TentacleRevealScroller : NSObject <UIScrollViewDelegate>

/// Celui de la ScrollView verticale qui contient `section` ; nil hors d'une page.
+ (nullable instancetype)scrollerForSection:(TentacleFocusSection *)section;

/// Montre la section qui RÉVÈLE `item` (la plus proche, entre lui et la page).
- (void)revealItem:(UIView *)item;

@end

NS_ASSUME_NONNULL_END
