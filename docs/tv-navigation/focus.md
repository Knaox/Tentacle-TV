# Focus, sections et rangées (Apple TV) — relevé et extraction

Tâche T3 du lot « Extraction de la navigation Apple TV » (2026-10-03). Ce
document est le RELEVÉ exhaustif du domaine — chaque comportement, chaque
touche, chaque durée, chaque cas particulier — tel qu'il est au SHA de
référence `84f3cedd0`, puis le plan et l'état de son extraction vers
`@tentacle-tv/tv-core`.

Chaque comportement porte un identifiant (`R3`, `H2`…) : les scénarios de
référence (`apps/tv/harness/nav-golden/scenarios/focus/`) et l'audit de T8 s'y
réfèrent. Un comportement relevé ici ne change pas pendant l'extraction ; un
défaut relevé est noté (« Constats »), jamais corrigé.

## Périmètre

| À T3 | Fichiers |
|---|---|
| Le port du focus (vues) | `apps/tv/src/redesign/focus/*` — `FocusTarget`, `FocusGroup`, `FocusSection`, `focusBinding`, `focusPreview`, `nativeFocusSection`, `useFocusProgress` |
| Le câblage du focus | `apps/tv/src/redesignWiring/focus/*` SAUF `backFocus.tsx` (T4) — `focusStore`, `claimAfterRestore`, `entryGuide`, `focusGuides`, `focusLocks`, `sectionEntry`, `sectionNeighbors`, `useKeepFocusWithin`, `useKeyFocused` |
| L'entrée d'un écran | `apps/tv/src/redesignWiring/screen/useEntryFocus.ts` |
| Au-delà du bord | `apps/tv/src/redesignWiring/remote/useBeyondEdge.ts` |
| Accueil, « Pour vous », héros | `redesignWiring/{home,forYou,hero}`, `redesign/screens/{home,forYou}/*`, `redesign/rows`, `redesign/hero`, `redesign/screens/shared/useForcedFocusReveal.ts` |
| Les règles pures | `packages/tv-core/src/focus/*` (`geometry`, `sections`, et ce que l'extraction y ajoute) |
| Hooks hérités, usages refondus | `hooks/useFocusRecovery.ts`, `hooks/useContentFocusCapture.ts` (§ Z) |
| Natif (NON modifié) | `ios/TentacleTV/TentacleFocusSection.{h,m}`, `TentacleFocusNeighbors.m`, `TentacleNeighborGuides.m`, `TentacleRevealScroller{.m,+Private.h}`, `TentacleRevealMotion.m`, `TentacleFocusInput.m` — leur spécification vit dans tv-core, ils n'en reçoivent qu'un commentaire de renvoi |

Hors périmètre, relevé pour mémoire (§ O) : la croix Retour (`backFocus.tsx`)
et les ponts du rail (`RailBridges`, `RailShortcuts`) → T4 ; Parcourir et la
règle d'entrée PROPRE à la fiche (`detail/useDetailGuides.ts`) → T7 ;
`useChoiceEntry` → T6.

## P — Le port du focus : ce que les vues déclarent

Une vue de `redesign/` ne décide jamais où va le focus ; elle déclare des
CLÉS et des FORMES, l'intégration répond par le port (`FocusBindingProvider`).

- **P1 — `FocusTarget`**, la seule façon de rendre un élément focalisable : un
  `Pressable` qui pose d'abord les props natives de la liaison
  (`binding.native`), puis ses propres gestionnaires (jamais remplacés).
  L'appui long part à **550 ms** (`LONG_PRESS_THRESHOLD_MS`, tv-core).
- **P2 — Garde anti-clic fantôme** (`phantomPressGuard`) : OK n'est validé que
  si l'appui a COMMENCÉ sur l'élément (`onPressIn` vu avant `onPress`). Un
  flou annule l'appui commencé (il ne validera pas plus tard) et relâche le
  ressort de l'appui.
- **P3 — Démonté sous le focus**, l'élément annonce sa perte lui-même
  (`binding.onBlur`, `onFocusChange(false)`) : tvOS envoie le flou à une vue
  déjà retirée, l'événement se perdrait.
- **P4 — `FocusGroup`** : le conteneur lié à sa clé (`binding.container`), ou
  une `View` aux mêmes style et `pointerEvents` — ni changement de rendu, ni
  de mise en page.
- **P5 — `FocusSection`** : la forme `section` du port (§ R) et la
  révélation (`reveal`, § V) ; `list` → `lineList`. Sans la vue native (hors
  Apple TV, ou binaire qui ne l'embarque pas : `UIManager` ne connaît pas
  `TentacleFocusSection`) : une `View`, ni règle ni défilement propre.
  Défauts : `revealMode` `none`, marge `nearest` **56**, ressort
  `TV_MOTION.spring.scroll` (réponse **0,5 s**, amortissement **1**).
- **P6 — Fournisseurs imbriqués** : l'intérieur répond d'abord, l'extérieur
  ensuite (`bind(key) ?? outer(key)`).
- **P7 — Focus figé du banc** (`focusPreview`) : une clé posée → seul
  l'élément de cette clé se dessine focalisé, le focus natif est ignoré.
  Hors banc, aucun fournisseur.

## S — Le magasin de focus d'un écran (`focusStore.ts`)

- **S1 — Suivi** : focus de `k` → `current = k`, `last = k` ; flou de `k` →
  `current = null` seulement si `current === k` ; `last` reste. Les abonnés
  reçoivent chaque prise et chaque perte, dans l'ordre des événements (tvOS :
  le flou de l'ancien AVANT le focus du nouveau).
- **S2 — Nœuds** : la référence de chaque cible s'inscrit et se retire ; les
  abonnés des nœuds sont prévenus ; une réclamation en attente part au
  MONTAGE (nœud non nul) de sa cible.
- **S3 — Liaison** : une par clé, mise en cache (STABLE) ; reconstruite à la
  lecture suivante après `bind(key, extras)`. La forme n'est lue qu'à la
  première liaison (figée avec elle). Props natives = effets de la forme,
  PUIS les extras de la clé (ils l'emportent).
- **S4 — Effets de forme** : `section` → `{ tvNeighbors: true }` ; `card` →
  parallaxe **6 pt / 0,07 rad** ; `row` → **3 pt / 0 rad** ; sans forme → le
  défaut de React Native (2 pt / 0,05 rad) ; jamais d'agrandissement natif
  (`magnification` et `pressMagnification` à 1). « Réduire les animations » :
  parallaxe coupée (`enabled: false`), lu quand une cible se lie — vaut pour
  l'écran suivant.
- **S5 — `claim(k)`** : cible montée → la réclamation tvOS (`claimTvFocus`) :
  à **+40 ms** `hasTVPreferredFocus=false`, **+50 ms** `true`, **+120 ms**
  `false` (le nœud relu à chaque écriture : une cible démontée en route ne
  reçoit rien). Cible absente → en attente de son montage, SANS péremption.
  L'annulation retire l'attente et coupe les minuteurs.
- **S6 — `focusNow(k)`** : `requestTVFocus()` tout de suite (part avant ce que
  le même geste fera ensuite) ; faux si la cible n'est pas montée. Sans effet
  dans une `Modal` (§ N5).
- **S7 — `handle(k)`** : le numéro natif (`findNodeHandle`) — `nextFocus*`,
  destinations, entrée d'une section.

## R — La règle des sections (HAUT / BAS)

Source : `packages/tv-core/src/focus/sections.ts` (testée) ; application :
`TentacleFocusNeighbors.m` (le même algorithme, pas à pas, au moment du
geste). Constantes : `STACK_SLACK` 24, `SAME_EDGE` 8, `FRONTIER_SLACK` 2.

- **R1 — BAS dans la section quittée** : les éléments au-delà (avance ≥ −2),
  la ligne la plus proche (ce qui partage plus de la moitié de la plus petite
  hauteur avec l'élément le plus proche), puis le centre le plus proche.
- **R2 — HAUT dans la section quittée** : seulement à l'APLOMB (chevauchement
  horizontal > 0) — la pastille d'un en-tête se rejoint depuis la carte du
  dessous, jamais une étape depuis le bout d'une rangée. Une `list` n'a rien
  qui la coiffe : HAUT y fait comme BAS.
- **R3 — Sections candidates** : au-delà de la section quittée (tolérance
  `min(24, plus petite hauteur / 4)`), qui partagent une abscisse avec elle
  (une autre colonne n'est jamais visée), avec au moins un élément
  focalisable — affiché (ni caché ni alpha ≤ 0,01 jusqu'à la fenêtre),
  `canBecomeFocused` et `userInteractionEnabled`, hors sections de voisinage
  imbriquées —, dans la même fenêtre et le même contrôleur de vue.
- **R4 — Les plus proches** : la section la plus proche, et celles dont le
  bord est à moins de **8** points d'elle (côte à côte).
- **R5 — Ce qui fait face** : les éléments sans rien de leur section entre eux
  et nous dans leur colonne (jeu de 2) — la dernière ligne incomplète d'une
  grille ne cache pas les colonnes qu'elle n'a pas.
- **R6 — Le centre le plus proche**, horizontalement, de l'élément quitté ; à
  égalité (±0,5) le moins loin dans la direction, puis le plus à gauche.
- **R7 — L'entrée déclarée** de la section retenue l'emporte si elle est parmi
  ses éléments (montée, focalisable, affichée) — § E.
- **R8 — Rien au-delà** : aucune décision, aucun guide — tvOS et les guides
  des écrans gardent la main (la bande de la croix Retour).
- **R9 — Pose native** : sur l'élément focalisé, un guide d'**1 point** de
  haut, de SA largeur, collé au-dessus, un autre au-dessous — seulement dans
  une direction qui a une cible. Porteur : le premier ancêtre qui contient
  l'élément (±2 points en hauteur) sans franchir le contenu d'une ScrollView.
  Le guide renvoie à un RÉSOLVEUR (vue de taille nulle, non focalisable) dont
  `preferredFocusEnvironments` applique la règle au geste ; plus de cible
  entre la pose et le geste → il rend l'élément focalisé (on reste).
- **R10 — Réévaluation** : après chaque montage React ; complète si une
  section est arrivée ou partie, sinon seulement les directions sans guide.
  Guides retirés quand le focus quitte l'élément ; seule la section de
  voisinage la plus intérieure les pose.
- **R11 — GAUCHE / DROITE** : aucune règle — le moteur géométrique de tvOS
  (dans une rangée : la carte voisine ; bord : § X, § O).

## E — L'entrée déclarée d'une section (primitive générique)

- **E1 — `useSectionEntry(focus, sectionKey, entryKey)`** : pose `tvEntry`
  (numéro natif de l'élément d'entrée) sur le nœud de la section, par
  `setNativeProps` ; reposée quand la section OU l'élément se montent (le
  numéro n'existe qu'une fois monté) ; `null` retire l'entrée. Le natif ne
  l'honore que si l'élément est un descendant de la section (R7).
- **E2 — Politique « toujours »** : un sélecteur entre par sa sélection (la
  fiche : l'onglet de la saison affichée — règle propre à T7).
- **E3 — Politique « première visite »** : l'ancre tant que la section n'a
  pas eu le focus depuis le dernier réarmement, puis plus d'entrée (le plus
  proche, R6). Désarmée au premier focus d'une clé de la section ; réarmée
  quand la clé de réarmement change (la fiche : l'épisode à reprendre,
  réarmé à chaque saison choisie — règle propre à T7). L'API : « API
  publiée », plus bas.

## V — La page qui suit le focus (révélation)

Source : `TentacleRevealScroller.m`, `TentacleRevealMotion.m`,
`TentacleFocusInput.m` ; spécification pure à venir dans tv-core (§ Plan).

- **V1 — La section qui révèle** : la plus proche au-dessus de l'élément
  focalisé dont le mode n'est pas `none`, dans la même page (la ScrollView
  VERTICALE la plus proche ; une rangée horizontale est passée).
- **V2 — `nearest`** (marge `m`, 56 par défaut) : `haut = y − m`,
  `bas = y + h + m − hauteurVue` ; si `bas > base` → `min(bas, haut)` (jamais
  au-delà de son haut) ; sinon si `haut < base` → `haut` ; sinon `base`.
- **V3 — `anchor`** : `y − top` (la fiche : 72). **V4 — `start`** : 0.
- **V5 — Bornes** : `[−insetHaut, max(min, hauteurContenu + insetBas −
  hauteurVue)]`. Base = la cible en cours si le ressort tourne, sinon la
  position.
- **V6 — Pas isolé** : tvOS propose (`scrollViewWillEndDragging…`) → on lui
  rend la position COURANTE, la page va à la cible sur le ressort (critique :
  `x(t) = e^{−ωt}(x0 + (v0 + ω x0) t)`, `ω = 2π / 0,5`) ; un focus en plein vol
  reprend position ET vitesse. Rien si `|cible − position| < 0,5`, ni si le
  ressort va déjà à cette cible (`< 0,5`).
- **V7 — Rafale** : une flèche enfoncée depuis plus de **200 ms** (répétition
  de tvOS, la 1re vient ~470 ms après l'appui) ; ou, aucune flèche enfoncée,
  le pavé actif il y a moins de **500 ms** ; ou moins de **700 ms** après le
  dernier pas de rafale ; ou tvOS a posé la page il y a moins de **50 ms**. Un
  pas de rafale prolonge la fenêtre de 700 ms. tvOS défile alors vers NOTRE
  cible, calculée depuis la cible du pas précédent de la même rafale (moins
  de 700 ms), sinon depuis la position.
- **V8 — Pas de rafale sans proposition de tvOS** : rejoué comme un pas
  isolé quand tvOS a fini de bouger (sondé toutes les **100 ms**, **10**
  essais), si le focus est toujours dans cette section et qu'aucune
  proposition n'est arrivée depuis (jeu de 20 ms).
- **V9 — Défilement d'un autre** (tvOS, `scrollTo` du banc, page raccourcie :
  plus d'1 point d'écart avec la dernière position posée) : le ressort
  s'arrête, la section n'est plus suivie. Un défilement de tvOS hors de nos
  sections : on ne le dispute pas.
- **V10 — Compensation** : ce qui bouge AU-DESSUS de la section montrée (une
  rangée qui arrive, un logo lu) est compensé dans le même montage — en
  comparant la MÊME section.
- **V11 — « Réduire les animations »** : la page se pose aussitôt.
- **V12 — Modes par écran** : accueil et « Pour vous » — héros `start`,
  rangées `nearest` 56 ; fiche — en-tête `start`, sections `anchor` 72 ;
  grilles — 1re ligne `start`, les autres `nearest` ; barre de filtres
  `start` ; recherche `nearest` ; réglages : une `list` sans révélation.
- **V13 — Au banc** (focus figé) : `useForcedFocusReveal` — `scrollTo` SANS
  animation de la section qui couvre la clé figée (préfixes `id` /
  `id:*`), marge 56 : `y = bas > vue − 56 ? bas − vue + 56 : 0`, borné à
  `[0, haut − 56]`.

## A — L'entrée d'un écran et le retour (`useEntryFocus`)

- **A1 — Arrivée** : l'entrée porte `hasTVPreferredFocus` dès son premier
  rendu (liée avant le rendu des cibles). Une entrée qui change pendant
  l'arrivée : l'ancienne perd sa liaison (TOUTE la liaison ajoutée à sa clé,
  § L1), la nouvelle la reçoit.
- **A2 — Réclamation** : à chaque entrée non nulle pendant l'arrivée — le
  montage compris —, `claim(entrée)` (visée dès son montage), la précédente
  annulée.
- **A3 — Fin de l'arrivée** : au premier focus de CONTENU (clé hors `nav:`),
  ou au premier focus dans la navigation plus de **600 ms** après le premier
  rendu de l'écran (l'utilisateur l'a gagnée). La réclamation en cours est
  annulée, la préférence retirée.
- **A4 — `contentKey()`** : la dernière clé de contenu focalisée si son nœud
  est monté, sinon l'entrée courante.
- **A5 — Retour sur l'écran** (`useFocusEffect`, jamais au premier passage) :
  `claim(contentKey())`, annulée si l'écran perd la main avant.
- **A6 — Entrées de mes écrans** — accueil : erreur (vedettes ET
  bibliothèques en échec) → `status:primary` ; chargement ou accueil vide →
  aucune ; un héros → `hero:primary` ; sinon `<1re rangée>:0`.
  « Pour vous » : un panneau d'état → `status:primary` s'il a une action,
  sinon aucune ; un héros → `hero:primary` ; sinon `<1re étagère>:0` ; sinon
  aucune.
- **A7 — Quitter l'accueil par le rail** (`beforeLeave`, T4) :
  `focusNow(contentKey())` dans le même geste — UIKit retient le contenu.

## G — Les guides de groupe

- **G1 — `createEntryGuide(store, { owns, fallback, remember, trapLeft,
  trapRight })`** : le focus qui arrive dans le groupe atterrit sur la
  dernière clé du groupe qui l'a eu (si `remember`, défaut oui, et montée),
  sinon sur `fallback()` (relu à chaque visée). Sans cible : `destinations`
  vide ET `focusable: false`. Visée recalculée après chaque rendu et à chaque
  focus d'une clé du groupe. La mémoire vit dans le composant : remonter le
  groupe l'efface.
- **G2 — `AutoFocusGuide`** : `autoFocus` — 1re visite au premier élément,
  ensuite au dernier quitté ; rend atteignable un groupe désaligné.
- **G3 — `TrapFocusGuide`** : `autoFocus` + `trapFocus{Up,Down,Left,Right}` —
  le D-pad n'en sort pas (une réclamation, si : § N3).

## L, C, K, Q — Verrous, réclamations, garde, clé focalisée

- **L1 — `setFocusLocked(store, key, locked)`** : `isTVSelectable: false` par
  la liaison (prochain rendu) ET par le nœud déjà monté ; libérer retire
  TOUTE la liaison ajoutée à la clé et remet `isTVSelectable: true` sur le
  nœud. (`focusable: false` ne fait rien sur tvOS.)
- **C1 — `claimAfterRestore(store, key)`** : réclame ; si, dans les
  **900 ms**, une AUTRE clé prend le focus, réclame UNE fois de plus
  (UIKit restaure sa dernière cible après coup) ; le focus pris par la clé
  elle-même n'arrête pas la surveillance ; au-delà de 900 ms, plus rien.
- **K1 — `useKeepFocusWithin(store, keys, entryKey)`** : au montage,
  `claim(entryKey)` ; la dernière = l'entrée. Focus d'une clé de la surface →
  elle devient la dernière. Flou d'une clé de la surface → **50 ms** plus
  tard, si la clé focalisée n'est pas de la surface (ou s'il n'y en a
  aucune), la réclamation précédente est annulée et la dernière réclamée. Au
  démontage : tout s'arrête. Les clés ne sont lues qu'au montage.
- **Q1 — `useKeyFocused(store, key)`** : un état, vrai tant que la clé porte
  le focus (lu aussi à l'abonnement).

## X — Au-delà du bord (`useBeyondEdge`)

- **X1 — Le geste** : un glisser vers la direction, ou un appui simple de la
  flèche (pas un appui long, et pas son début `down`).
- **X2 — Le focus** doit être sur la clé du bord, et y être arrivé au moins
  **400 ms** avant l'arrivée de l'événement dans le JS : un appui déplace le
  focus à l'enfoncement et ne s'annonce qu'au relâchement (~60 ms après) ; un
  glisser, à sa fin. Le geste qui AMÈNE le focus au bord ne compte pas.
- **X3** — un événement, un appel. **X4** — rien sans clé de bord, ni quand
  `enabled` est faux (écran pas devant).

## H — Le héros (accueil, « Pour vous »)

- **H1 — Titres** : les reprises (5 au plus, `HERO_MAX_ITEMS`), sinon la
  sélection du serveur (5 au plus). Fonds préchargés.
- **H2 — Rotation** (accueil) : un titre toutes les **8 s** (**16 s** en
  mouvement réduit, sans fondu), même focalisé — les boutons ne bougent pas.
  L'attente repart de zéro à CHAQUE événement de la télécommande (tout appui,
  Menu et Lecture compris, tout glisser, le pan tenu) et à chaque prise ou
  perte de focus dans l'écran, et à chaque titre visé. Un appui long qui
  COMMENCE la suspend ; tout autre événement long la relance. Rien ne tourne
  sous 2 titres, écran pas devant, héros défilé de plus de moitié (défilement
  ≥ **376** = 56 + 640 / 2), application inactive, grand panneau ouvert ; en
  devenant inactive, l'appui maintenu est oublié.
- **H3 — Rotation à la main** : DROITE au-delà de « Ma liste »
  (`hero:list`, le dernier bouton, § X), écran devant, 2 titres au moins → le
  suivant, en boucle (`(i + 1) % n`), un par geste ; le focus ne bouge pas.
- **H4 — Titre affiché** : celui de la rotation dès que son art est réglé
  (chargé ou en échec) ; sinon le précédent reste — les boutons visent
  toujours ce qui est affiché. L'écran se dit en chargement tant que le
  premier n'a pas son art.
- **H5 — Appui maintenu** sur un bouton (accueil) : le grand panneau du titre
  affiché — variante 16:9 si le héros vient des reprises, sinon affiche.
  « Maintenir OK » sous les pilules **350 ms** après le focus d'un bouton.
- **H6 — « Pour vous »** : un héros fixe (sa meilleure suggestion), sans
  rotation, sans appui maintenu, sans bord ; l'ancienne tête reste le temps
  que la nouvelle arrive.
- **H7 — Clés** : `hero:primary` (Lire / Reprendre), `hero:secondary` (Plus
  d'infos), `hero:list` (Ma liste) ; section `section:hero`.

## W — Les rangées (accueil, « Pour vous »)

- **W1 — Clés** : carte `<rangée>:<index>` ; section `section:<rangée>`.
- **W2 — Pastille du filtre** `filter:remove`, dans l'en-tête de la rangée
  filtrée (accueil : la première rangée recommandée réellement servie ;
  « Pour vous » : la première étagère) : HAUT depuis la carte sous elle
  (R2) ; OK la retire.
- **W3 — GAUCHE / DROITE** : moteur natif, AUCUN piège aux bouts ; GAUCHE au
  bord du contenu : le pont vers le rail (T4, § O).
- **W4 — OK** : vignette 16:9 (Reprendre, Prochains épisodes, Déjà vu) → la
  lecture ; affiche → la fiche ; appui long → le grand panneau, dans la
  variante de la carte.
- **W5 — Recul des voisines** : visuel ; « aucune » dit **32 ms** après un
  flou que personne n'a relevé.
- **W6 — Retour au début (mode « mixte », 2026-10-04)** — tv-core
  `focus/rowRewind.ts`, appliqué par `platform/tvos/focus/useRowRewind.ts`
  sur les pages qui le demandent (`useRedesignScreen({ rewindRows: true })` :
  l'accueil, « Pour vous ») :
  - une rangée GARDE sa position tant qu'une part d'elle est à l'écran ;
  - sortie de l'écran (plus rien d'elle ne se voit, en dessous comme au-dessus),
    elle revient au début d'un `scrollTo` sans animation — jamais celle qui
    porte le focus, jamais une rangée pas encore mesurée ;
  - changer de page PAR LE RAIL (Accueil → Films → Accueil) remet toutes les
    rangées au début et rend le focus à la première carte de celle où l'on
    était ; revenir d'une fiche ne change rien (la carte ouverte reprend le
    focus, la rangée est telle qu'on l'a laissée) ;
  - Retour sur une carte autre que la première → la première (couche
    `rowStart` de `railScreenBackLayers`, retour-rail.md § 3, R2.0).
  Une rangée est « déplacée » quand une carte autre que la première a pris le
  focus. Ni les épisodes, ni les saisons, ni la distribution d'une fiche, ni
  la recherche : aucun fournisseur du port (`redesign/rows/rowRewindPort.tsx`),
  rien ne bouge. Cas couvert : la page quittée par le rail alors qu'une fiche
  la couvrait — UIKit lui rendra la carte d'où l'on était parti ; sa rangée
  attend donc le retour pour revenir au début (sinon elle défilerait, à la
  vue, jusqu'à la carte puis jusqu'au début).

## Z — Les hooks hérités, côté Apple TV

- **Z1 — `useFocusRecovery`** : Android seulement (l'effet sort sur iOS) ;
  aucun usage refondu.
- **Z2 — `useContentFocusCapture`** : monté sur tvOS (par `TVNavChrome`, à
  côté du navigateur) mais INERTE : toutes les routes qui ont un rail sont
  refondues (`REDESIGN_ROUTES`), le rail hérité ne s'affiche jamais, son
  armement n'est jamais appelé. Ce qu'il faisait, la refonte le fait par A1-A5
  et A7. Ni l'un ni l'autre ne se touche (partagés avec Android TV).

## N — Faits de plateforme mesurés (ce que l'adaptateur doit respecter)

- **N1** — Après un pop, réclamer au `transitionEnd` de l'écran révélé, pas à
  son focus : UIKit restaure sa dernière cible une fois le fondu fini.
- **N2** — Focus dans le rail : la 1re réclamation rend à l'écran sa dernière
  cible ; une 2e (~400 ms) atteint la vue voulue — toujours deux.
- **N3** — La dernière réclamation gagne ; `trapFocus*` n'arrête que le D-pad.
- **N4** — Pas de chevauchement horizontal = pas de voisin (`nextFocus*`).
- **N5** — Dans une `Modal`, `hasTVPreferredFocus` / `requestTVFocus` /
  réclamation et `nextFocus*` sont sans effet (tvOS y focalise l'élément du
  haut) : entrée par `isTVSelectable: false` sur les autres cibles.
- **N6** — Une vue plein écran posée sur le contenu (même transparente, même
  `box-none`) empêche le moteur d'y entrer ; rien d'opaque ne couvre un
  focalisable.
- **N7** — Alpha < 0,01 = caché pour le moteur : ce qui porte du focus pendant
  un fondu garde `SWAP_FLOOR` (0,02).
- **N8** — `UIFocusGuide` : tvOS lit la valeur STOCKÉE des destinations ; un
  guide hors des limites de son porteur n'est pas trouvé ; une contrainte qui
  traverse une ScrollView n'est pas recalculée quand elle défile.
- **N9** — Un guide dont `destinations` est un tableau (même vide) est
  sélectionnable : sans cible, `focusable: false`.
- **N10** — Ancienne architecture : deux `setState` après un `await` ne sont
  pas groupés (`unstable_batchedUpdates`).

## O — Relevé hors périmètre (pour mémoire, transmis)

- **Croix Retour** (`backFocus.tsx`, T4) : verrou d'arrivée, libération au
  premier autre focus, `nextFocusDown`, bande HAUT — notes envoyées à T4.
- **Ponts du rail** (`RailBridges`, T4) : contenu focalisé → bande à gauche
  du contenu (de 0 à `contentLeft − 20` = 156, toute la hauteur) vers
  l'entrée ACTIVE (à défaut, Accueil) ; rail focalisé → zone à droite du
  rail ouvert (`left + expandedWidth + 12`) vers `contentKey()`.
- **Raccourcis du rail** (`RailShortcuts`, T4) : 450 ms / 1 100 ms d'armement
  du guide de gauche (350 ms de « rafale ») ; le rail s'arrête à ses bouts (il bouclait Rechercher ↔ profil jusqu'au 2026-10-04).
- **Parcourir** (T7) : entrée `status:primary` / `grid:0` / `browse:back`,
  reprise de `grid:0` ou `status:primary` quand la croix tient le focus —
  notes envoyées à T7.
- **Fiche** (T7) : saisons → saison affichée, épisodes → épisode à reprendre
  à la première visite (réarmé par saison), bouts des rangées piégés.

## Constats (relevés, non corrigés)

1. **Libérer efface tout** (L1, A1, A3) : `bind(key, null)` retire TOUTE la
   liaison ajoutée à la clé, pas seulement le verrou ou la préférence. Aucun
   cas actuel n'empile deux liaisons sur une même clé ; fragile.
2. **Une réclamation sans annulation attend pour toujours** (S5, C1) : sur
   une cible absente, elle part à son prochain montage, même des minutes
   plus tard. `claimAfterRestore` jette l'annulation.
3. **C1 contrarie un geste rapide** : un déplacement de l'utilisateur dans
   les 900 ms qui suivent est repris une fois.
4. **A3 compte depuis le premier rendu** de l'écran, pas depuis le dernier
   changement d'entrée. Conséquence mesurée par T4 sur la référence, sous
   charge : l'accueil n'a pas d'entrée tant qu'il charge, et tvOS donne le
   focus au rail. Si ce focus arrive plus de 600 ms après le premier rendu,
   la règle le prend pour un geste de l'utilisateur et clôt l'arrivée : le
   héros ne reprend pas le focus quand le contenu arrive. Le banc focus ne
   l'a pas vu en trois passages (charge ordinaire) ; ses scénarios d'accueil
   s'en gardent quand même (« Scénarios de référence »).
5. **« Pour vous » poussée par-dessus l'accueil arrive parfois sans focus**
   (banc de référence, deux passages différents) : ouverte par une
   navigation programmée (`navigate`, pile `[Home, Recommendations]`), elle
   n'a pas toujours de focus à l'arrivée ; par le rail (`railNavigate`), si.
   Aucun chemin de l'app ne la pousse ainsi aujourd'hui — à surveiller si un
   lien profond le fait un jour.

## L'extraction (phase B) — ce qui est dans tv-core, ce que l'adaptateur garde

Contrat : `docs/TV-NAVIGATION.md`. Les règles sont pures (ni React, ni
minuteur : l'horloge est passée), testées par vitest ; les applicateurs
vivent dans `apps/tv/src/platform/tvos/focus/` et ne décident plus.

| Décision | Règle (`@tentacle-tv/tv-core`) | Applicateur (tvOS) |
|---|---|---|
| R1-R8 voisin vertical | `focus/sections.ts` (existait) | la section native, inchangée ; `sectionNeighbors.ts` |
| E1-E3 entrée de section | `focus/sectionEntry.ts` | `sectionEntry.ts` : `useSectionEntry`, `useFirstVisitEntry` |
| V1-V12 cible, bornes, compensation | `focus/reveal.ts` (spécification miroir) | le natif, inchangé (`TentacleRevealScroller.m`) |
| V6-V8 rafale, ressort | `focus/revealMotion.ts` (spécification miroir) | le natif, inchangé (`TentacleRevealMotion.m`, `TentacleFocusInput.m`) |
| V13 révélation du banc | `focus/reveal.ts` : `benchRevealOffset` | `useForcedFocusReveal` (vue du banc) |
| P5 marge par défaut | `focus/reveal.ts` : `REVEAL_NEAREST_MARGIN` | `FocusSection` (vue) |
| S1 clé courante, dernière | `focus/focusTrack.ts` | `focusStore.ts` (nœuds, réclamations, liaisons) |
| A1-A5 arrivée, retour | `focus/screenEntry.ts` (600 ms) | `useEntryFocus.ts` (préférence, réclamation, `useFocusEffect`) |
| A6 entrées de l'accueil, « Pour vous » | `focus/homeEntry.ts` | `HomeRedesign`, `ForYouRedesign` |
| G1 entrée d'un groupe | `focus/groupEntry.ts` | `entryGuide.tsx` (le guide natif) |
| C1 reprise après restauration | `focus/restoreClaim.ts` (900 ms) | `claimAfterRestore.ts` |
| K1 garder dedans | `focus/keepWithin.ts` (50 ms) | `useKeepFocusWithin.ts` |
| X1-X4 au-delà du bord | `focus/beyondEdge.ts` (400 ms, faits de la table) | `useBeyondEdge.ts` (intentions de l'entrée unique) |
| H1-H4 titres, rotation, bord, titre affiché | `hero/rotation.ts` (5 titres, 8 s) | `useHeroRotation.ts` (minuteur), `useHomeHero.ts` |
| H5, W4 appui maintenu → panneau | `cards/cardHold.ts` (T6) | `useHomeRowModels`, `useHomeHero`, `ForYouRedesign` |
| W4 OK sur une carte | `cards/cardPress.ts` (écrit par T3, accord de T6) | `useHomeRowModels`, `ForYouRedesign` |

Aucune durée ni aucun seuil ne reste dans `platform/tvos/focus/`
(`node eslint/tvNavigationAudit.mjs` n'en liste plus).

**Ce que l'adaptateur garde** : les nœuds natifs et leurs liaisons (le port),
la réclamation tvOS (`claimTvFocus` de `hooks/useTvFocusClaim.ts`, cycle
40 / 50 / 120 ms, contournement RN-tvos #849 — partagé avec Android TV, non
modifié), `focusNow` (`requestTVFocus`), les guides natifs (`TVFocusGuideView`,
`AutoFocusGuide`, `TrapFocusGuide`), les verrous (`isTVSelectable`), la
parallaxe par forme (rendu : `redesignWiring/remote/parallax.ts`), les
minuteurs dont tv-core donne les durées.

**Exceptions de la garde** (`eslint/tvNavigationExceptions.mjs`, la garde :
`docs/tv-navigation/garde.md`) — PERMANENTES depuis la fusion :
`FocusTarget` (le seul `Pressable` de la refonte, la porte des vues vers le
focus natif), `FocusSection` et `nativeFocusSection` (la section native). Une
vue n'importe que `redesign/` et les paquets partagés : la détection de la
section native ne peut pas rejoindre `platform/tvos/` (essayé, refusé par le
lint des imports).

**Arbitrages** : P2, la garde anti-clic fantôme de `FocusTarget`, est
extraite par T6 (sa machine `cards/pressGuard`) ; `contentKey()` (A4) est ce
que visent les ponts du rail de T4 — son contrat ne change pas ; la croix
Retour (`backFocus.tsx`) est à T4, Parcourir et la règle propre à la fiche à
T7.

### Réexports provisoires — retirés

Les applicateurs déplacés ont gardé leur ancien chemin le temps que leurs
importateurs (fiche, bibliothèque, réglages, panneaux, lecteur, Vigie,
surimpressions, jumelage, rail) visent `platform/tvos/` :
`redesignWiring/focus/{focusStore, claimAfterRestore, entryGuide,
focusGuides, focusLocks, sectionEntry, sectionNeighbors, useKeepFocusWithin,
useKeyFocused}`, `redesignWiring/screen/useEntryFocus`, et le relais de la
croix Retour `redesignWiring/focus/backFocus` (T4, vers
`platform/tvos/back/backFocus`). Tous retirés ensemble au ménage de fin de
lot : plus aucun import de l'ancien chemin, et le dossier
`redesignWiring/focus/` n'existe plus. Seuls les bancs de traces citent encore
les anciens chemins, pour l'arbre de RÉFÉRENCE : `focus-trace` (`variantOf`)
et `panels-trace` (`@bench/focusStore`, résolu là où le magasin vit).

### À retirer au portage Android TV

Aucune copie temporaire : `hooks/useTvFocusClaim.ts`, `useFocusRecovery.ts` et
`useContentFocusCapture.ts` (partagés avec Android TV) ne sont pas touchés.
Au portage, Android TV lit les mêmes règles (`focus/`, `hero/rotation`,
`cards/cardPress`, `cards/cardHold`) et n'écrit que son applicateur ; la
révélation et le voisinage des sections n'existent chez lui qu'une fois une
section native écrite (ses tests sont dans `focus/sections.test.ts`,
`reveal.test.ts`, `revealMotion.test.ts`).

## API publiée — l'entrée d'une section (pour T7)

Livrée (figée) :

```ts
// @tentacle-tv/tv-core — focus/sectionEntry.ts
export interface FirstVisitEntryState { readonly armed: boolean }
export const FIRST_VISIT_ARMED: FirstVisitEntryState; // { armed: true }
export const FIRST_VISIT_DONE: FirstVisitEntryState;  // { armed: false }, valeur unique
/** Un focus posé : désarme si la clé est de la section. */
export function firstVisitAfterFocus(state, focusedKey: string, owns: (key: string) => boolean): FirstVisitEntryState;
/** L'entrée à déclarer : l'ancre tant que c'est armé, sinon aucune (le plus proche). */
export function firstVisitEntry(state, anchorKey: string | null): string | null;

// apps/tv/src/platform/tvos/focus/sectionEntry.ts — l'applicateur
useSectionEntry(focus, sectionKey, entryKey | null);                       // inchangé
useFirstVisitEntry(focus, { owns, anchorKey, resetKey }): string | null;   // nouveau
```

La fiche s'écrit alors (T7) : `useSectionEntry(focus, "detail:seasons",
season)` ; `useSectionEntry(focus, "detail:episodes",
useFirstVisitEntry(focus, { owns: (k) => k.startsWith("episode:"),
anchorKey: episode, resetKey: seasonId }))` — les mêmes rendus qu'avant :
réarmer une entrée déjà armée, ou désarmer deux fois, ne redessine rien.

## Les preuves d'équivalence

**Banc de traces** (`apps/tv/harness/focus-trace`, React sans DOM, horloge
factice) : les applicateurs de la référence `84f3cedd0` et ceux de l'arbre
courant, rejoués sur les mêmes neuf scénarios — magasin (suivi, réclamations),
reprise après restauration, guide d'entrée, garde d'une surface, arrivée et
retour d'un écran, au-delà du bord, rotation du héros, entrées de la fiche
(règle d'origine contre `useFirstVisitEntry`) : **traces identiques**. Huit
contre-épreuves (reprise à 800 ms, garde à 100 ms, arrivée à 700 ms, bord à
300 ms, Retour qui relance la rotation, première visite jamais désarmée,
groupe sans mémoire, puis l'ensemble) font toutes échouer `verify`.

**Banc de référence** (nav-golden de T2, app réelle au simulateur, place 3) :
les scénarios de `scenarios/focus/` enregistrés sur `84f3cedd0` puis rejoués
sur la branche. Ce que l'enregistrement a appris de la référence (attentes
d'auteur corrigées, jamais le code) :

- depuis « À suivre », BAS arrive sur la pastille du filtre et non sur la
  1re affiche : les deux premières affiches sont SOUS la pastille, elles ne
  font pas face (R5) ; depuis la pastille, BAS va à la 2e affiche (R1) ;
- la base du banc a une rangée « Derniers ajouts — Films » entre « Pour
  vous » et « Déjà vus » ;
- « Pour vous » ouverte par une navigation programmée par-dessus l'accueil
  arrive parfois SANS focus (deux passages différents) ; ouverte par le rail,
  comme l'utilisateur ;
- la sonde du banc ne trouvait aucun texte (elle cherchait des fibres
  `RCTRawText`, ce sont des `HostText`) : signalé à T2, corrigé (2f7d20f0b) ; la
  rotation du héros se reconnaît au synopsis que le jeu `focus/home` écrit.

## Scénarios de référence

Dans `apps/tv/harness/nav-golden/scenarios/focus/*.json` (format figé par T2),
enregistrés sur `84f3cedd0`. Chacun liste les comportements qu'il couvre ;
ce qu'un pavé ne sait pas montrer (glisser, pan) se lit au natif ou se joue
sur l'Apple TV « Chambre ».

Sous charge, l'accueil perd parfois son entrée au démarrage, référence
comprise (constat 4) : les scénarios d'accueil qui ne testent pas l'entrée
partent d'un aller-retour au rail (`wait:1`, GAUCHE, DROITE), qui ramène à
`hero:primary` que le focus soit parti du héros ou du rail. `home-entry` garde
la course, puisque c'est elle qu'il relève.

| Fichier · scénario | Couvre |
|---|---|
| `home-sections` · `home-entry` (rail aller-retour) | A1-A4, A6, H7, W3 |
| `home-sections` · `home-rows` (BAS / HAUT : vignettes, pastille, affiches) | R1-R6, V1, V2, V4-V6, W1, W2, H7 |
| `home-sections` · `home-row-end` (bout d'un carrousel, rangée courte) | R3-R6, R8, R11, W3 |
| `home-sections` · `home-filter-chip` (pastille du filtre) | R1, R2, R5, R11, W2 |
| `home-sections` · `home-return` (retour d'une fiche) | A4, A5, W4, N1 |
| `home-sections` · `home-burst` (flèche maintenue) | V7-V9, R1, R6 |
| `home-hero` · `hero-beyond-edge` (au-delà du bord) | X1-X4, H3, H4, H7, R11 |
| `home-hero` · `hero-rotation` (rotation, panneau) | H2, H4, H5 |
| `foryou` · `foryou-entry-shelves` (ouverte par le rail) | A1, A3, A6, H6, R1, R2, R6, W1, W2, V2, V4 |

Couverts ailleurs : C1 (T4, T7), G1 (T6, T7), K1 (le voile hors ligne, T6),
E1-E3 (la fiche, T7). Format, jeux de données et relevés :
`apps/tv/harness/nav-golden/scenarios/focus/README.md`.
