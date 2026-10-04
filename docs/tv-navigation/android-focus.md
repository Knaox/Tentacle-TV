# Focus et défilement rapide sur Android TV (lot « Android TV = Apple TV », A1)

Android TV rend la refonte de l'Apple TV (`apps/tv/src/redesign`,
`redesignWiring`) avec le MÊME focus : mêmes voisins, mêmes entrées, même
mémoire, même pré-focalisation. Ce document dit ce que la refonte tvOS
attend du natif, ce qu'Android en fait, et comment la croix MAINTENUE
remplace le glisser rapide du pavé.

## 1. Inventaire : ce que le natif tvOS fournit au JS

| Module natif (`ios/TentacleTV/`) | Ce qu'il fournit | Lu par |
|---|---|---|
| `TentacleFocusSection.{h,m}` | la vue `TentacleFocusSection` (props `revealMode`, `revealMargin`, `revealTop`, `revealResponse`, `revealDamping`, `lineList`, `tvNeighbors`, `tvEntry`) ; son registre ; le suivi du focus qui entre, bouge, sort (`didUpdateFocusInContext`) | `FocusSection` (`redesign/focus/`), détectée par `nativeFocusSection.ts` |
| `TentacleFocusNeighbors.m` | la règle HAUT / BAS des sections au geste (`TentacleNeighborTarget`), l'entrée déclarée (`tvEntry`) | — (natif) ; la règle : tv-core `focus/sections.ts` |
| `TentacleNeighborGuides.m` | des `UIFocusGuide` d'1 point posés au-dessus et au-dessous de l'élément focalisé, renvoyant à un résolveur qui applique la règle au geste ; réévalués après chaque montage | — (natif) |
| `TentacleRevealScroller.m`, `TentacleRevealMotion.m`, `+Private.h` | la page qui suit le focus : cible de la section qui révèle (`nearest` / `anchor` / `start`), ressort repris en vol, compensation d'un montage au-dessus, rafale rendue à tvOS | — (natif) ; tv-core `focus/reveal.ts`, `focus/revealMotion.ts` |
| `TentacleFocusInput.m` | l'observateur passif des flèches enfoncées et du pavé : « ce pas est-il une rafale ? » | `TentacleRevealScroller` ; tv-core `isInputBurst` |

Ce que le JS pose lui-même par React Native (aucun module à nous) :
`hasTVPreferredFocus` (entrée d'un écran, réclamations `claimTvFocus`),
`requestTVFocus` (`focusNow`), `nextFocus*`, `TVFocusGuideView`
(`destinations`, `autoFocus`, `trapFocus*` : guides d'entrée de groupe, croix
Retour, ponts du rail et du lecteur), `isTVSelectable` (verrous,
`useChoiceEntry`), `tvParallaxProperties` (forme d'une cible).

Ce que tv-core décide (inchangé, lu par les deux plateformes) : `focus/`
(sections, entrée de section, révélation, suivi de clé, entrée d'écran, guide
de groupe, reprise après restauration, garde d'une surface, au-delà du bord,
rangées remises au début, écrans), `nav/` (Retour, rail), `panels/`
(`choiceEntry`), `cards/` (entrée du grand panneau), `input/` (appui long,
verrou d'OK).

## 2. L'adaptateur Android

Même API côté JS : `redesign/` et `redesignWiring/` ne changent pas. Les
fichiers qui diffèrent ont une variante `.android.ts` À CÔTÉ du fichier tvOS
(`platform/tvos/focus/`), qui ne fait que réexporter
`platform/androidtv/focus/` ; Metro la choisit, tsc lit le fichier tvOS
(contrôle `.android` : `moduleSuffixes`, `reference_controle_navigation_tv`).

| tvOS | Android TV | Pourquoi |
|---|---|---|
| `sectionNeighbors.ts` : `{ tvNeighbors: true }` | `{ tvNeighbors: true, tvPacing: REPEAT_PACING }` | la cadence d'une flèche tenue (§ 3), passée de tv-core à la section native |
| `focusLocks.ts` : `isTVSelectable` | `tvFocusable` (`FOCUS_LOCKED`) | ni `isTVSelectable` (tvOS seul) ni `focusable={false}` (RN Android garde la vue focalisable « pour l'accessibilité ») n'agissent |
| `guideFocusable.ts` : sans cible, `false` | `undefined` | `focusable={false}` d'un `TVFocusGuideView` devient `tvFocusable={false}` sur Android : `FOCUS_BLOCK_DESCENDANTS`, TOUT le groupe devient inatteignable. Un guide sans destination ni `autoFocus` n'y est pas un guide. Lu par le guide d'entrée, la croix Retour, les deux ponts du lecteur |
| `END_EXIT_LOCK` (lecteur) | `FOCUS_LOCKED` | le verrou de la plateforme |

Le reste sert tel quel : `hasTVPreferredFocus` appelle `requestFocus()` sur
Android à la transition (`claimTvFocus` : branche Android de
`hooks/useTvFocusClaim.ts`, inchangée) ; `requestTVFocus` est une commande
de `ReactViewManager` ; `TVFocusGuideView` (`destinations`, `autoFocus`,
`trapFocus*`) est implémenté par `ReactViewGroup` ; `nextFocus*` aussi.
`tvParallaxProperties` n'existe pas sur Android : ignoré.

### La section native — `com.tentacletv.focus`

`TentacleFocusSection.kt` (une `ReactViewGroup` : toutes les props d'une
`View`, guides compris) + `TentacleFocusSectionManager.kt` (mêmes props que
tvOS, plus `tvPacing`), enregistrés par `TentacleFocusPackage` dans
`MainApplication`.

- **Voisinage (R1-R11)** — `FocusNeighbors.kt`, pas à pas comme
  `TentacleFocusNeighbors.m`, constantes en points × densité. Android n'a pas
  besoin de guides : la section prend la flèche dans `dispatchKeyEvent`,
  descendu le long du chemin du focus AVANT que la ScrollView ne la traite —
  `ScrollView.arrowScroll` cherche par `FocusFinder` SANS consulter
  `focusSearch`, aucune surcharge plus bas ne la verrait. Rien au-delà :
  `super`, Android garde la main (R8). Bornée à l'écran (`Screen` de
  react-native-screens, le pendant du `reactViewController`) et aux pièges
  `trapFocusUp/Down` d'un ancêtre.
- **GAUCHE / DROITE dans une rangée** (R11) : le moteur géométrique
  d'Android borné à la rangée (`FocusFinder.findNextFocus(rangée…)`, ce que
  fait `HorizontalScrollView`), mais la rangée suit en un mouvement ; rien
  dans la rangée : `false`, et le moteur cherche au-delà (le rail) — sans le
  « saut de page » de `HorizontalScrollView.arrowScroll`.
- **Suivi (V1-V6, V9, V11)** — `RevealScroller.kt` + `RevealFollower.kt` :
  à `requestChildFocus`, la section la plus proche de l'élément relève la
  position de la page et de la rangée AVANT que `ReactScrollView` ne saute
  (`scrollToChild` → `scrollBy`), la rend, puis anime vers NOS cibles
  (`revealOffset` ; `rowRevealOffset`), dans le même message — le saut ne se
  dessine jamais. Pas isolé : le ressort de la section, repris en vol.
  Défilement d'un autre (le `scrollTo` du JS) : arrêt. « Supprimer les
  animations » : la vue se pose. Sans section qui révèle : la cible
  d'Android, animée.
- **Entrée déclarée (E1)** : `tvEntry` = l'identifiant de vue (ancienne
  architecture : le tag React), résolu par `findViewById` dans la section.

- **Compensation (V10)** — `ShownKeeper.kt` : la section montrée par un pas
  isolé reste en place quand un montage la déplace (une rangée qui arrive
  au-dessus) — la page la suit d'autant après la mise en page, avant
  l'image, puis la remontre si sa taille l'exige.

## 3. Le défilement rapide : la croix maintenue

Sans pavé tactile, la croix TENUE fait tout. Android répète la touche
(~470 ms après l'appui, puis toutes les ~50 ms) ; laissé à lui-même, le focus
ferait vingt pas par seconde dès la première répétition, chaque pas faisant
SAUTER la page.

Ce que font les autres (Leanback `BaseGridView` et ses déplacements en
attente, Compose for TV, Netflix, YouTube) : le focus avance à un rythme
PROPRE qui accélère, la liste défile à vitesse continue, rien ne se redessine
à chaque pas en dehors de la carte quittée et de la carte prise. D'où :

1. **La cadence** — tv-core `input/repeatPacing.ts` (`holdRepeat`,
   `holdTick`, `holdRelease`, `REPEAT_PACING`) : l'appui fait son pas (isolé) ;
   la première répétition OUVRE la tenue et fait un pas ; ensuite les pas
   tombent sur l'horloge des images, à un intervalle qui accélère EN CONTINU
   (160 ms → 70 ms en 1,5 s, ~6 → ~14 pas par seconde : l'Apple TV, flèche
   tenue, fait ~12 lignes par seconde au banc des bibliothèques), sans
   rattrapage. Les répétitions sont ABSORBÉES — elles ne disent plus que
   « toujours tenue » (le JS les a vues passer : `ReactRootView` émet avant de
   distribuer). Caler les pas sur les répétitions (toutes les ~50 ms) aurait
   donné une vitesse en marches : 150, 100 puis 50 ms, la vitesse doublant
   d'un coup. Plus aucune répétition depuis 300 ms : la tenue est finie (le
   relâchement est parti ailleurs). Appliquée nativement (`HoldPacer.kt`) :
   la décision précède le déplacement du focus.
2. **Le mouvement** — tv-core `focus/burstFollow.ts` : chaque pas de tenue
   va de là où la vue EST à sa cible, à vitesse constante, en l'intervalle
   jusqu'au pas suivant plus une image (`burstSegmentMs`) : la page ne
   s'arrête jamais entre deux pas. Le ressort par pas traînerait (2 v/ω :
   plus d'une ligne derrière à 6 pas/s) ; le saut saccade. Flèche relâchée :
   le segment en vol finit sur le ressort, vitesse bornée pour ne pas
   dépasser (`settleVelocity`).
3. **Rien à chaque pas qui ne soit nécessaire** : les grilles sont des
   FlashList (lignes recyclées, `drawDistance` de deux lignes), les rangées
   reculent par une valeur partagée lue sur le fil d'interface
   (`useRowFocus`) — un pas du focus ne redessine ni la rangée ni la page.

L'Apple TV ne lit ni l'un ni l'autre : sa table ne répète pas, et sa rafale
passe par l'animateur de tvOS (`revealMotion.ts`). Rien n'y change.

## 4. Le banc

- `node apps/tv/harness/android-burst/burst.mjs down 4 --repeat 3` : une
  flèche réellement TENUE (console de l'émulateur : Android synthétise les
  répétitions ; une rafale de `input keyevent` n'a pas de `repeatCount`),
  `dumpsys gfxinfo` remis à zéro à chaque passage.
- nav-golden sur Android (`--android`, les références de l'Apple TV
  rejouées telles quelles) : tâche A5.

## 5. Écarts connus

- **La rangée sur tvOS** suit le défilement propre de UIKit ; Android suit
  `rowRevealOffset` (la carte aussi loin des bords que les bouts de la
  rangée le sont de son contenu). À comparer à l'œil sur les deux.
