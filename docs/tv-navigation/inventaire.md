# Inventaire — la télécommande et le focus sur le chemin refondu

Domaine de T8 (la garde). Index : [`../TV-NAVIGATION.md`](../TV-NAVIGATION.md) ·
la garde : [`garde.md`](garde.md).

Pour CHAQUE usage d'une API native de télécommande ou de focus sur le chemin
Apple TV refondu : où il est (fichier:ligne), qui le traite (T1 à T7) et ce
qu'il devient. Relevé sur 84f3cedd0 (avant toute extraction), recalé sur
`3cd7a5d19`. T8 le remet à jour après chaque fusion ; les lignes d'un fichier
qu'une tâche vient de toucher sont celles de main au moment du recalage.

## Comment il est fait

- **Le chemin** — la fermeture des imports depuis `App.tsx`, résolue comme
  Metro pour tvOS (`.ios` d'abord), qui ne suit aux aiguillages
  (`REDESIGN_ACTIVE ? <XRedesign /> : <LegacyX />`) que la branche refondue :
  536 fichiers, dont 190 hors de `redesign/` et `redesignWiring/`. Les
  surfaces montées par `App.tsx` y sont, même quand elles ne rendent rien sur
  tvOS (`TVNavChrome`).
- **Les API** — `TVEventHandler`, `useTVEventHandler`, `TVEventControl`,
  `BackHandler`, `TVFocusGuideView` ; les props `hasTVPreferredFocus`,
  `nextFocus*`, `isTVSelectable`, `tvParallaxProperties`, `autoFocus`,
  `trapFocus*`, `destinations`, `focusable` ; `onLongPress`, `delayLongPress`,
  `onPressIn/Out` ; `onFocus` / `onBlur` ; `Pressable` / `Touchable*` ; glissers
  et balayages (`pan`, `swipe*`) ; `Platform.OS` / `isTV` ; modules natifs
  (`requireNativeComponent`, `NativeModules`, `UIManager`, `findNodeHandle`,
  `setNativeProps`, `requestTVFocus`, `MenuPressInterceptor`, la section
  native) ; minuteries (`setTimeout`, `setInterval`, `requestAnimationFrame`,
  `InteractionManager`) ; la pile (`goBack`, `usePreventRemove`,
  `useFocusEffect`, `useIsFocused`, `gestureEnabled`) ; le Retour
  (`useBackLayer`), le bus de la télécommande, les Modals (`onRequestClose`),
  les défilements, `.focus()`. Commentaires exclus.
- **700 occurrences dans 186 fichiers**, chacune lue et classée ; un
  script vérifie qu'aucune n'est sans ligne ci-dessous.
- **Ce que le relevé ne voit pas** et que la lecture a retrouvé : les
  décisions prises PAR le magasin de focus, sans API native visible (annexe C),
  et les « ratés » (annexe E).

## Les états

| État | Sens | Où ça va |
|---|---|---|
| **EXTRAIRE** | une décision : règle, délai, cible, ordre | tv-core, dans le dossier de domaine (règle de rangement) |
| **MIXTE** | décision et application mêlées | la décision → tv-core ; l'application → l'adaptateur |
| **ADAPTATEUR** | application native pure | `apps/tv/src/platform/tvos/<domaine>/`, telle quelle |
| **DÉJÀ** | la règle est déjà dans tv-core | brancher l'app dessus |
| **RESTE** | câblage légitime, sans natif ni décision | rien |
| **VUE** | contrat d'une vue de `redesign/` : prop de rappel, section déclarative | rien |
| **HORS** | sans rapport avec la navigation | rien |
| **ANCIENNE** | ancienne UI, branche Android, ou prop inerte sur tvOS | pas concerné |

« **FAIT** » dans une note : déjà extrait, fusionné dans main.

« **partagé Android TV** » (`⇄`) : le fichier sert aussi Android TV. Règle du
lot : il ne s'amincit sur tv-core que si l'équivalence Android est prouvée par
un banc déterministe (le lecteur : `apps/tv/harness/player-trace/` et
`apps/tv/harness/nav-golden/scenarios/lecteur/traces/` ; le Retour :
`apps/tv/harness/back-trace/`).

« **garde : …** » : les familles de la garde ESLint encore exemptées pour ce
fichier (`eslint/tvNavigationExceptions.mjs`). La fusion qui l'extrait retire
la ligne ; `node eslint/tvNavigationAudit.mjs` le vérifie.

## Bilan

Occurrences du relevé, par tâche et par état (un fichier est rangé chez la
tâche qui en porte le plus ; une ligne d'une autre tâche le dit en tête).

| Tâche | fichiers | EXTRAIRE | MIXTE | ADAPTATEUR | DÉJÀ | RESTE | VUE | HORS | ANCIENNE |
|---|---|---|---|---|---|---|---|---|---|
| T1 | 4 | — | — | 11 | — | 1 | — | — | — |
| T3 | 22 | — | — | 73 | 6 | 2 | 29 | — | 6 |
| T4 | 17 | — | — | 35 | 2 | 11 | 16 | 1 | — |
| T5 | 18 | 13 | 9 | 66 | 1 | 4 | 3 | 2 | 13 |
| T6 | 12 | — | — | 7 | 4 | 4 | 20 | — | — |
| T7 | 32 | 2 | 2 | 24 | 8 | 6 | 43 | 1 | 1 |
| pas concernés | 81 | — | — | — | — | — | — | 133 | 141 |
| **total** | 186 | 15 | 11 | 216 | 21 | 28 | 111 | 137 | 161 |

## T1 — le socle : intentions, traduction, entrée unique

> Fait (756ed8bc7, 54b02445d, 3cd7a5d19) : l'entrée unique `platform/tvos/input/` porte l'UNIQUE abonnement natif du chemin refondu (à l'ancien rail près, annexe A) et la prise du pan ; Menu des Modals y passe (`withMenuIntent`) ; tous les écouteurs lisent des intentions ; le code de transition (`remoteEvents.ts`, `lib/tvPanGesture.ts`) est retiré.
>
> 4 fichiers.

#### `platform/tvos/input/index.ts`
- L7 · réexport de la prise du pan · **ADAPTATEUR** · FAIT (756ed8bc7) : l'entrée unique de la télécommande

#### `platform/tvos/input/panGesture.ts`
- L2, 24, 32, 38 · `TVEventControl.enable/disableTVPanGesture`, `Platform.OS` · **ADAPTATEUR** · FAIT (756ed8bc7) : la prise du pan, drapeau global compté — dans l'adaptateur, permis par la garde

#### `platform/tvos/input/remoteInput.ts`
- L1, 24, 38 · `TVEventHandler.addListener`, `Platform.OS` · **ADAPTATEUR** · FAIT (756ed8bc7) : L'abonnement natif du chemin refondu, `readTvosEvent` → `createRemoteInput` — dans l'adaptateur, permis par la garde

#### `redesignWiring/redesignGate.ts` — garde : `no-platform-branch`
- L19 · Platform.OS · **RESTE** · l'aiguillage de la refonte — exception permanente

## T3 — focus, sections, rangées ; accueil, Pour vous, héros

> Fait (cbe686f9f) : les applicateurs de `platform/tvos/focus/` appliquent tv-core (suivi, entrée d'écran, de groupe et de section, reprise après restauration, garde dans une surface, au-delà du bord) ; l'accueil, le héros et Pour vous suivent `hero/rotation`, `cards/cardHold` et `cards/cardPress` ; plus aucune durée dans l'adaptateur ; équivalence prouvée par le banc de traces du focus. Restent, PERMANENTES, les portes des vues (`FocusTarget`, `FocusSection`, `nativeFocusSection`).
>
> 22 fichiers.

#### `hooks/useTvFocusClaim.ts` — partagé Android TV
- L4, 77, 86–91, 94 · setNativeProps({hasTVPreferredFocus}), setTimeout 40/50/120 ms · **ADAPTATEUR** · branche tvOS de `claimTvFocus` : cycle faux→vrai→faux (contournement RN-tvos #849) — LA primitive de `focusStore.claim` ; mécanique native → `platform/tvos/focus/` (T1 l'emploie aussi)
- L66, 67, 79, 82 · requestAndroidTvFocus, Platform.OS !== "ios" · **ANCIENNE** · branche Android TV

#### `platform/tvos/focus/claimAfterRestore.ts`
- L26 · setTimeout(`RESTORE_WITHIN_MS`) · **ADAPTATEUR** · FAIT (dfb021e84) : la règle (`restoreStep`, `watchRestore`) et sa durée viennent de tv-core `focus/restoreClaim` ; l'applicateur ne fait que compter

#### `platform/tvos/focus/entryGuide.tsx`
- L2, 73, 76–79, 82 · TVFocusGuideView, destinations, focusable, trapFocusLeft/Right · **ADAPTATEUR** · FAIT : le guide natif ; la visée vient de tv-core (`groupEntryKey`)

#### `platform/tvos/focus/focusGuides.tsx`
- L1, 18, 20, 30–35, 40 · TVFocusGuideView, autoFocus, trapFocus* · **ADAPTATEUR** · guides génériques : mémoire, piège — DÉPLACÉ (f56e83f30)

#### `platform/tvos/focus/focusLocks.ts`
- L14, 16, 20 · isTVSelectable, setNativeProps · **ADAPTATEUR** · verrou d'une cible, par la liaison et par le nœud — DÉPLACÉ (f56e83f30)

#### `platform/tvos/focus/focusStore.ts`
- L2, 75, 76, 127, 149, 159, 160 · findNodeHandle, setNativeProps, requestTVFocus · **ADAPTATEUR** · FAIT : nœuds natifs, réclamation, focus immédiat
- L116, 117 · onFocus/onBlur (observation) · **ADAPTATEUR** · FAIT (29dd64c68) : le suivi courant / dernier est la règle de tv-core (`trackFocus`)

#### `platform/tvos/focus/sectionEntry.ts`
- L18, 22 · setNativeProps(tvEntry) · **ADAPTATEUR** · entrée déclarée d'une section — DÉPLACÉ et branché sur tv-core `focus/sectionEntry` (f56e83f30)

#### `platform/tvos/focus/useBeyondEdge.ts`
- L26 · useBeyondEdge · **ADAPTATEUR** · FAIT (29d63e4df) : écoute l'entrée unique (`useRemoteIntents`) et applique tv-core `focus/beyondEdge`

#### `platform/tvos/focus/useEntryFocus.ts`
- L2, 33, 101 · hasTVPreferredFocus, useFocusEffect · **ADAPTATEUR** · FAIT (dfb021e84) : applique tv-core `focus/screenEntry` (préférence pendant l'arrivée, clôture, retour au dernier contenu) ; `useFocusEffect` = événement de pile

#### `platform/tvos/focus/useRowRewind.ts`
- L94, 95 · `onRailPageChange`, `navigation.isFocused()` · **ADAPTATEUR** · FAIT (T9, 2026-10-04) : applique tv-core `focus/rowRewind` — la rangée sortie de l'écran ou quittée par le rail revient au début (`scrollTo` sans animation) ; l'état du Retour vers la première carte (`useAwayFromRowStart`)

#### `platform/tvos/focus/useKeepFocusWithin.ts`
- L19, 30 · setTimeout(`KEEP_WITHIN_CHECK_MS`) · **ADAPTATEUR** · FAIT : règle et durée de tv-core `focus/keepWithin`

#### `redesign/focus/focusBinding.tsx`
- L42, 43 · onFocus/onBlur (types du port) · **VUE** · le contrat du port du focus

#### `redesign/focus/focusPreview.tsx`
- L35, 36, 47, 48, 51 · onFocus/onBlur · **VUE** · état visuel du focus : natif dans l'app, figé au banc

#### `redesign/focus/FocusSection.tsx` — garde : `no-native-focus-calls`
- L6, 55, 63, 78 · NativeFocusSection · **ADAPTATEUR** · la porte des vues vers la section native — exception PERMANENTE de la garde ; la marge et la révélation viennent de tv-core (81dac22ab)

#### `redesign/focus/FocusTarget.tsx` — garde : `no-native-press`
- L2, 114, 119, 120, 122–125, 132 · Pressable, onPressIn/Out, onLongPress, delayLongPress, onFocus/onBlur · **ADAPTATEUR** · la SEULE porte des vues vers le focus natif (OK, appui long natif à `LONG_PRESS_THRESHOLD_MS` de tv-core, focus, flou) — exception PERMANENTE de la garde (porte des vues) ; raté par le relevé : `{...binding?.native}`
- L17, 55, 67, 69, 70, 79, 82, 85, 91 · onLongPress (prop), onFocus/onBlur (relais) · **VUE** · relais vers la vue et le port
- L88 · `guard.blur()` · **DÉJÀ** · T6 · FAIT (0bb4c4b6c) : la garde anti-clic fantôme est la machine de tv-core (`usePressGuard`) ; ce `.blur()` n'est pas un focus natif (faux positif du relevé)

#### `redesign/focus/nativeFocusSection.ts` — garde : `no-native-focus-calls`, `no-platform-branch`
- L1, 26, 27, 31, 32 · requireNativeComponent, UIManager, Platform.OS/isTV · **ADAPTATEUR** · détection et montage de la section native → `platform/tvos/focus/`

#### `redesign/hero/HeroBanner.tsx`
- L80, 108, 166, 168, 178, 182 · onLongPress · **VUE** · rappel posé sur les 3 boutons ; « Maintenir OK » ne paraît que si un rappel est fourni

#### `redesign/screens/forYou/ForYouView.tsx`
- L9, 113, 121, 179, 204 · FocusSection · **VUE** · sections déclaratives

#### `redesign/screens/home/HomeView.tsx`
- L8, 131, 138, 140, 194, 215 · FocusSection, onHeroLongPress · **VUE** · sections déclaratives, relais

#### `redesign/screens/shared/useForcedFocusReveal.ts`
- L67 · scrollTo · **VUE** · au banc seulement ; la révélation vient de tv-core (`focus/reveal`, 81dac22ab)

#### `redesignWiring/home/HomeRedesign.tsx`
- L145 · onHeroLongPress · **VUE** · branchement de prop ; l'appui maintenu suit tv-core `cards/cardHold` (342cf4694)

#### `redesignWiring/home/useHeroRotation.ts`
- L63, 69 · setTimeout · **ADAPTATEUR** · FAIT (890ab2140) : la rotation est la règle de tv-core `hero/rotation` ; le crochet tient le minuteur et écoute les intentions (`useRemoteIntents`)

#### `redesignWiring/home/useHomeHero.ts`
- L4, 68 · useIsFocused · **RESTE** · « écran devant » (pile)
- L10, 132 · useBeyondEdge · **DÉJÀ** · FAIT : au-delà du bord par tv-core et l'entrée unique
- L43, 125, 139 · onLongPress · **DÉJÀ** · FAIT (342cf4694) : l'appui maintenu du héros suit tv-core `cards/cardHold`

## T4 — Retour, rail, menus

> Fait (b27e71330) : le Retour et le rail sont sur tv-core `nav/` (couches, croix Retour, ponts et raccourcis, OK et menu d'une entrée, pile en onglets, repli, fenêtre des demandes), leurs applicateurs dans `platform/tvos/back/` ; Menu des Modals par l'entrée unique ; équivalence prouvée par `back-trace` et les 38 références de retour-rail. Reste, inerte et décidé tel : l'ancien rail monté sur tvOS (annexe A).
>
> 17 fichiers.

#### `components/focus/MenuPressInterceptor.ios.tsx` — garde : `no-native-focus-calls`
- L1, 6, 22 · requireNativeComponent (TVMenuPressInterceptor) · **ADAPTATEUR** · la vue native qui prend Menu → `platform/tvos/back/` (signal `menu` de la table tvOS)

#### `navigation/AppNavigator.tsx` — partagé Android TV
- L10, 103, 107 · BackScope · **RESTE** · pose la portée du Retour autour de chaque écran (`screenLayout`)
- L92 · gestureEnabled: !REDESIGN_ACTIVE · **ADAPTATEUR** · Menu ne dépile jamais un écran de lui-même (react-native-screens) — c'est le fait `backDecidedAhead` de la table tvOS
- L120 · usePreventRemove (commentaire JSX) · **HORS** · faux positif du relevé

#### `platform/tvos/back/backFocus.tsx`
- L2, 152, 155, 156, 159 · TVFocusGuideView, destinations, focusable · **ADAPTATEUR** · FAIT (7a9c3ea59) : le guide de la bande de la croix Retour ; la décision est dans tv-core (`nav/backCross`)
- L55, 102 · setNativeProps(nextFocusDown) · **ADAPTATEUR** · FAIT : BAS depuis la croix, vers la cible que tv-core désigne

#### `platform/tvos/back/BackScope.tsx`
- L4, 62, 64 · MenuPressInterceptor · **ADAPTATEUR** · FAIT (5a12cb255) : l'applicateur du Retour monte la vue native ; `enabled` = `takesBack` (tv-core)
- L34, 44, 54 · canGoBack, goBack · **ADAPTATEUR** · FAIT : applique `isPushedPage` (tv-core) — sans couche, une page poussée recule

#### `platform/tvos/back/RailBridges.tsx`
- L2, 55 · TVFocusGuideView, destinations · **ADAPTATEUR** · FAIT (edba3344e) : les ponts natifs entre navigation et contenu ; quel pont et vers quoi : tv-core (`railBridge`, `railEntryTarget`)

#### `platform/tvos/back/RailShortcuts.tsx`
- L2, 42, 63–65 · TVFocusGuideView, setTimeout(`railLeftArmDelay`) · **ADAPTATEUR** · FAIT : les raccourcis natifs du rail ; boucle et armement décidés par tv-core (`nav/railShortcuts`)

#### `platform/tvos/back/useBackLayers.ts`
- L3, 19 · useBackLayer · **ADAPTATEUR** · FAIT : l'inscription des couches dans la pile de tv-core

#### `redesign/motion/FadingModal.tsx`
- L24, 30, 41 · Modal, onRequestClose · **VUE** · une Modal : son Menu arrive par `onRequestClose` (signal `menu` de la table tvOS) ; ce qu'il ferme se décide au câblage

#### `redesign/nav/NavItem.tsx`
- L48, 55, 57, 64 · onLongPress (prop) · **VUE** · appui long d'une entrée du rail, relayé

#### `redesign/nav/NavList.tsx`
- L60, 171, 180, 213 · onLongPress (prop) · **VUE** · relais
- L120, 127 · scrollTo · **VUE** · défilement propre de la liste du rail ; la règle (`railRevealOffset`) est déjà dans tv-core `nav/railScroll` — `IN_FLIGHT_MS` ne fait que se souvenir d'une demande en vol

#### `redesign/nav/NavRail.tsx`
- L115, 131, 164 · onLongPress (prop) · **VUE** · relais

#### `redesignWiring/back/BackScope.tsx`
- L1, 4, 26 · BackScope, useBackLayer (réexport) · **RESTE** · FAIT (5a12cb255) : il ne reste que l'aiguillage de la portée ; l'applicateur vit dans `platform/tvos/back/`, la règle dans tv-core (`nav/backLayers`, `nav/backResolve`)

#### `redesignWiring/nav/NavMenuModal.tsx`
- L55 · FadingModal onRequestClose={withMenuIntent(closeMenu)} · **ADAPTATEUR** · FAIT : Menu dans le menu d'une entrée passe par l'entrée unique ; le menu lui-même est une règle de tv-core (`nav/railMenu`, dc88358de)

#### `redesignWiring/nav/useRailState.ts`
- L32, 43 · setTimeout(`railBlurDelay`) · **ADAPTATEUR** · FAIT (72ea1ab61) : le repli du rail ; règle et délai dans tv-core (`nav/railFocus` : `railBlurDelay`, `railCollapseAfterBlur`)
- L65, 127 · onLongPress · **RESTE** · l'appui long d'une entrée ouvre le menu d'organisation (règle : tv-core `nav/railMenu`)

#### `redesignWiring/screen/useRailBackLayers.ts`
- L4 · `useBackLayers` · **DÉJÀ** · FAIT (07030ff6d) : les couches du Retour d'un écran à rail sont déclarées par tv-core (`nav/railBack`)

#### `redesignWiring/screen/useRedesignScreen.ts`
- L94, 110, 111 · onLongPress (relais du rail) · **RESTE** · câblage de la vue du rail

#### `redesignWiring/vigie/RequestsPanel.tsx`
- L10 · `useBackLayers` · **DÉJÀ** · FAIT (5a973c072) : la couche du Retour et la croix gardée de la fenêtre des demandes viennent de tv-core (`nav/railRequests`)
- L60 · `Modal … onRequestClose={withMenuIntent(requestClose)}` · **ADAPTATEUR** · FAIT : Modal native ; son Menu passe par l'entrée unique

## T5 — le lecteur

> Fait (fecc655c6) : le lecteur est sur tv-core `player/` (contrôles, saut et avance rapide, maintien, pavé, Retour, focus de l'habillage, panneau des pannes), ses applicateurs dans `platform/tvos/player/`, sa télécommande par l'entrée unique ; minuteurs injectés (`hooks/playerTimers.ts`) ; les crochets partagés avec Android TV sont devenus de minces adaptateurs, équivalence prouvée par le banc de traces du lecteur ; `verify` 9/9 au simulateur et sur « Chambre ». Reste au lecteur : `AVPlayerSurface` (exception permanente « rendu »).
>
> 18 fichiers.

#### `components/player/focus/osdFocusBus.ts` — partagé Android TV
- L107, 108 · `BACKGROUND_FOCUS` onFocus/onBlur · **MIXTE** · observe le focus natif du fond (application) ; la décision est lue ailleurs : ←/→ ne saute que fond focalisé et habillage caché (useScrubController.ts:240)

#### `components/player/focus/overlayFocusCore.ts` — partagé Android TV
- L21, 216, 226, 228, 234, 238 · onFocus des boutons · **EXTRAIRE** · mémoire du dernier bouton de l'habillage, gelée pendant la restauration et le défilement — la seule partie de `buttonProps` lue sur tvOS (usePlayerFocus.ts:130)
- L153, 159, 168 · setTimeout 220 / 520 ms · **MIXTE** · cible (demandée > dernier bouton > lecture/pause), cession à la pilule (fenêtre de 200 ms, `skipHoldsFocus`) = règle ; 220 ms imposés par le natif (panneau pas encore démonté) et gel de 520 ms = application ; `restore` est déjà injecté
- L18 · type `FocusNode { setNativeProps }` · **ADAPTATEUR** · contrat du nœud natif passé à `restore`
- L22, 109 · préférence initiale + `setTimeout(…, 0)` · **ANCIENNE** · jamais posée sur tvOS refondu (qui ne lit que `onFocus`) : Android seulement
- L23–26, 229, 230, 239 · `nextFocus*` · **ANCIENNE** · voisins, verrou de défilement, montée vers la pilule : jamais appliqués sur tvOS refondu
- L2, 89, 127, 209 · `findNodeHandle`, `queueMicrotask` · **ANCIENNE** · handles pour les seuls `nextFocus*` — exécutés sur tvOS sans usage (bug 8)

#### `components/player/focus/useSkipPillFocus.ts` — partagé Android TV
- L6, 92, 93 · onFocus/onBlur de Passer / Masquer · **EXTRAIRE** · qui tient le focus dans la pilule, publié sur le bus : cession de la restauration implicite, relais quand le bouton disparaît

#### `hooks/playerTimers.ts` — partagé Android TV
- L11, 12 · setTimeout / clearTimeout (`PLAYER_TIMERS`) · **ADAPTATEUR** · les minuteurs du moteur JS, injectés aux machines du lecteur de tv-core (qui n'en arment aucun)

#### `hooks/usePlayerRemoteBinding.ios.ts` (devenu `usePlayerIntentBinding.ts`, commun à Android TV refondu)
- L1, 15 · useIsFocused · **ADAPTATEUR** · FAIT (819571cc0) : la télécommande du lecteur Apple TV par l'entrée unique (`useRemoteIntents`) → `playerRemoteSteps` (tv-core), écran devant

#### `hooks/useTVEpisodeNav.ts` — partagé Android TV
- L37 · setTimeout(…, 0) + `navigation.replace` · **MIXTE** · ouvrir l'épisode (arrêt signalé, invalidations, lecteur remplacé) = règle ; replace différé d'un tick pour passer `usePreventRemove`, sans objet sur tvOS refondu

#### `hooks/useTVPlaybackLifecycle.ts` — partagé Android TV
- L75 · `navigation.goBack` (leavePlayer) · **MIXTE** · garde contre la double sortie (`exitingRef`) et arrêt signalé = règle ; goBack = application
- L83 · `navigation.goBack` (handleFinished) · **MIXTE** · T7 · en fin de série, la fiche de la série (replace) sauf lecteur lancé depuis une fiche, sinon reculer

#### `hooks/useTVPlaybackPresence.ts` — partagé Android TV
- L85 · setTimeout ×3 (400 / 1 500 / 3 000 ms) · **MIXTE** · focus sur Lecture au retour au premier plan (`presenceStep.focusPlay`, déjà dans tv-core) ; signal répété parce que la scène UIKit se réattache lentement (bug 2)

#### `platform/tvos/player/overlayFocusRestore.ts`
- L11–15 · setNativeProps(hasTVPreferredFocus), setTimeout · **ADAPTATEUR** · FAIT : le cycle de la préférence native ; ses durées viennent de tv-core (`FOCUS_PREFERENCE_CYCLE`)

#### `platform/tvos/player/PlayerBackground.tsx`
- L2, 13, 20, 26, 27, 32 · TouchableOpacity, hasTVPreferredFocus, focusable · **ADAPTATEUR** · FAIT (6bf9971a3) : le fond focalisable du lecteur ; quand il l'est, c'est tv-core qui le dit (`playerStage`)

#### `platform/tvos/player/playerFocusBindings.ts`
- L11, 15 · isTVSelectable, hasTVPreferredFocus (`native: {…}`) · **ADAPTATEUR** · FAIT : verrou de sortie et préférence des commandes, décidés par tv-core (`playerFocus`)

#### `platform/tvos/player/playerFocusContainers.tsx`
- L2, 62, 66, 68, 77, 86, 97, 99–105, 110, 117, 123, 129, 139, 141–143, 148, 169, 192, 194–197, 215, 220, 226, 232, 237 · TVFocusGuideView, destinations, focusable, trapFocus*, autoFocus · **ADAPTATEUR** · FAIT (6bf9971a3) : guides, pièges et ponts natifs de l'habillage, des îlots et des panneaux ; les destinations sont décidées par tv-core (`player/playerFocus`)

#### `redesign/screens/player/PlayerChromeView.tsx`
- L112, 136 · `onPanelExited` (useExit « handoff ») · **VUE** · rappel de fin du fondu d'un panneau ; raté : L130, 168 `pointerEvents={chrome ? "box-none" : "none"}` rend l'habillage caché infocalisable sur tvOS — une décision de focus PRISE DANS LA VUE

#### `redesignWiring/player/PlayerRedesignStage.tsx`
- L74 · `holdsFocus` (prop de `PlayerBackground`) · **RESTE** · câblage : le fond focalisable est décidé par tv-core (`player/playerStage`), appliqué par `platform/tvos/player/PlayerBackground`
- L80 · `onPanelExited` · **VUE** · relais du rappel de la vue

#### `redesignWiring/player/usePlaybackTrouble.ts`
- L29, 102 · setTimeout / setInterval · **HORS** · échéances d'affichage, décompte « nouvelle vérification »
- L132 · setTimeout(`TROUBLE_REFOCUS_MS`) + `store.claim` · **ADAPTATEUR** · FAIT : panneau actif mais focus sorti → « Réessayer » ; la règle et la durée viennent de tv-core (`focusInTrouble`, `TROUBLE_REFOCUS_MS`) ; l'activation voit passer les intentions de l'entrée unique (669a5261f)

#### `redesignWiring/player/usePlayerBackLayers.ts`
- L3 · `useBackLayers` · **DÉJÀ** · FAIT (63f8dc099) : les couches du Retour du lecteur (états passagers, grâce, habillage, page) sont des règles de tv-core (`player/playerBack`)

#### `redesignWiring/player/usePlayerFocus.ts`
- L120, 132, 133 · onFocus/onBlur (relais vers la mémoire de l'habillage et la pilule) · **ADAPTATEUR** · l'observation seule ; mémoire, préférences, croix, ponts et îlot sont des règles de tv-core (`player/playerFocus` : `preferredFocusOf`, `playerFocusClaims`, `skipIslandGuides`, `skipPillFocus`)
- L82, 163, 170 · `onPanelExited` · **RESTE** · relais vers `usePanelReturnFocus`, qui applique tv-core (`panelOpener`, `panelReturnTarget`)

#### `screens/PlayerScreen.tsx` — partagé Android TV
- L2, 54 · réf. `TouchableOpacity` (backgroundRef) · **ADAPTATEUR** · référence de la vue native du fond, visée par les réclamations (tvOS) et par useFocusRecovery (Android) ; ratés : L129-145 `onBack` (ordre du Retour doublé, bug 9), L290-292 cibles de focus des panneaux

## T6 — panneaux, cartes, appui maintenu ; surimpressions

> Fait (3f231223d) : règles dans tv-core (`cards/`, `panels/`, `titles/seasonsSheet`) et applicateurs dans `platform/tvos/panels/` (grand panneau, verrou d'entrée des listes en Modal) ; la garde anti-clic fantôme de `FocusTarget` est la machine de tv-core ; Menu des panneaux par l'entrée unique ; équivalence prouvée par le banc `panels-trace`. Surimpressions : arbitrage T6.
>
> 12 fichiers.

#### `platform/tvos/panels/useChoiceEntry.ts`
- L36 · setTimeout(`CHOICE_ENTRY_RELEASE_MS`) · **ADAPTATEUR** · FAIT (e4279f28c) : le verrou d'entrée d'une liste en Modal ; règle et durée dans tv-core (`createChoiceEntry`)

#### `redesign/cards/CardShell.tsx`
- L34, 50, 71 · `onLongPress` (prop transmise à `FocusTarget form="card"`) · **VUE** · relais ; l'appui long n'est pas une API native ici : c'est le minuteur JS de Pressable (`delayLongPress` = 550 ms de tv-core, posé par FocusTarget), armé à l'`onPressIn` natif ; le `longSelect` d'UIKit (0,5 s) part sur le bus mais n'est pas écouté

#### `redesign/cards/MediaCard.tsx`
- L64, 105, 121 · `onLongPress` (transmis à CardShell) · **VUE** · relais
- L178 · `hold={focused && onLongPress !== undefined}` · **VUE** · affichage de « Maintenir OK : plus d'options » (350 ms, purement visuel)

#### `redesign/cards/MorphCard.tsx`
- L64, 68, 78 · `onLongPress` (transmis à FocusTarget, sans `form`) · **VUE** · relais ; pas d'indication « Maintenir OK » (voir bugs)

#### `redesign/controls/PillButton.tsx`
- L37, 76, 81 · `onLongPress` transmis à FocusTarget · **VUE** · relais (grand panneau du titre, sur le héros)

#### `redesign/controls/RoundButton.tsx`
- L28, 40, 44 · `onLongPress` transmis à FocusTarget · **VUE** · relais

#### `redesign/rows/MediaRow.tsx`
- L81 · onLongPress (prop) · **VUE** · appui long d'une carte, relayé

#### `redesign/screens/overlays/ScreenErrorView.tsx`
- L37, 46, 67 · canGoBack (prop) · **VUE** · pas de croix si faux

#### `redesignWiring/overlays/ScreenErrorRedesign.tsx`
- L53 · canGoBack={false} · **DÉJÀ** · FAIT (8c215b94a) : l'entrée et la croix sont décidées par tv-core (`panels/overlayFocus`, `SCREEN_ERROR_FOCUS`) ; à la racine, pas de croix
- L63, 66, 75, 78 · canGoBack()/goBack · **RESTE** · la pile : la croix paraît si la pile peut reculer et recule d'un écran (bug 3 des écrans, non corrigé)

#### `redesignWiring/sheet/ActionSheetRedesign.tsx`
- L10 · `useBackLayers` · **DÉJÀ** · FAIT (e7514a67f) : les couches du Retour du panneau viennent de tv-core (`panelBackLayers`)
- L64 · setTimeout(ms) (`useElapsed`, `SHEET_ENTRY_WAIT_MS`) · **ADAPTATEUR** · FAIT (7eb2aa6e4) : le filet d'entrée lit sa durée dans tv-core, l'adaptateur ne fait que compter
- L99 · `Modal visible={panelPresented(…)} onRequestClose={onMenu}` · **ADAPTATEUR** · FAIT : la présentation est décidée par tv-core (`panelPresented`), Menu passe par l'entrée unique (`withMenuIntent`)

#### `redesignWiring/vigie/AbsentSheetRedesign.tsx`
- L12 · `useBackLayers` · **DÉJÀ** · FAIT (e7514a67f) : couches du Retour par tv-core (`panelBackLayers`)
- L99 · setTimeout(`ABSENT_SHEET_ENTRY_WAIT_MS`) · **ADAPTATEUR** · FAIT : la durée du filet vient de tv-core (`absentSheetEntry`)
- L111 · `Modal visible={panelPresented(…)} onRequestClose={onMenu}` · **ADAPTATEUR** · FAIT : présentation par tv-core, Menu par l'entrée unique

#### `redesignWiring/vigie/SeasonsSheetRedesign.tsx`
- L30 · `useBackLayers` · **DÉJÀ** · FAIT (4c8740955) : couches du Retour par tv-core
- L121 · setTimeout(`SEASONS_SHEET_ENTRY_WAIT_MS`) · **ADAPTATEUR** · FAIT : cibles, entrée et présentation dans tv-core (`titles/seasonsSheet`) ; Lecture/Pause passe par `useRemoteContext` (00880373c)
- L166 · `FadingModal value={panelPresented(…)} onRequestClose={onMenu}` · **ADAPTATEUR** · FAIT : présentation par tv-core, Menu par l'entrée unique

## T7 — les écrans

> Fait (a01ffe11e) : fiche, bibliothèque, Ma liste, Favoris, grilles, Parcourir, recherche (clavier système, validation, retour d'étagère), réglages, jumelage et bande-annonce appliquent tv-core (`focus/detailFocus`, `focus/libraryFocus`, `focus/gridFocus`, `search/`, `session/loginForm`, `player/trailerChrome`, `titles/absentActions`) ; applicateurs dans `platform/tvos/screens/` ; 41 références « ecrans », verify 62/62 au simulateur et sur « Chambre ». Les vues de `redesign/screens/` ne font plus que déclarer (l'ouverture du clavier a quitté `PairingField`).
>
> 32 fichiers.

#### `components/search/searchBarReturn.ts` — partagé Android TV
- L31 · navigationRef.goBack · **MIXTE** · tourne sur tvOS (le rail l'appelle, useRailState.ts:132 ; la barre s'inscrit, useSystemKeyboard.ts:75) : « Rechercher » choisi de nouveau → sur Parcourir, reculer ; sur la recherche, viser la barre (règle) ; getCurrentRoute/goBack (application) — bug 1

#### `hooks/usePairingFlow.ts` — partagé Android TV
- L66, 93 · setTimeout SUCCESS_DELAY_MS · **EXTRAIRE** · après un jumelage réussi, le passage à l'accueil (`replace("Home")`) attend 2 s
- L104 · setTimeout(abort) · **HORS** · borne réseau de /api/health

#### `platform/tvos/screens/detail.ts`
- L33 · `native: { trapFocusLeft, trapFocusRight }` · **ADAPTATEUR** · FAIT (64b9f706c) : pièges latéraux des rangées de la fiche, décidés par tv-core (`focus/detailFocus`, `DETAIL_ROW_EDGES`)

#### `platform/tvos/screens/pairing.ts`
- L34, 35 · TextInput `.blur()` / `.focus()` · **ADAPTATEUR** · FAIT (c6a9fbf91) : l'ouverture du clavier système, sortie de la vue `PairingField` ; quel champ ouvrir : tv-core (`session/loginForm`)
- L74 · setTimeout · **ADAPTATEUR** · FAIT : la reprise du focus après un refus ; sa durée vient de tv-core

#### `platform/tvos/screens/search.ts`
- L49, 63, 65 · setNativeProps (relais vers le premier résultat) · **ADAPTATEUR** · FAIT (59ec69f1e) : l'atterrissage de la validation au clavier système (bug 6 des écrans, non corrigé)
- L58, 80, 114, 126, 134 · setTimeout · **ADAPTATEUR** · FAIT : clavier parti, seconde réclamation, retour d'étagère ; règles et durées de tv-core (`search/`)
- L166 · `inputRef.focus()` · **ADAPTATEUR** · FAIT : ouvre le clavier système

#### `platform/tvos/screens/settings.tsx`
- L2, 36, 38, 40 · TVFocusGuideView, destinations · **ADAPTATEUR** · FAIT (69adb7511) : le guide des onglets ; la destination (l'onglet affiché) vient de tv-core

#### `platform/tvos/screens/trailer.ts`
- L24 · `native: { hasTVPreferredFocus }` · **ADAPTATEUR** · FAIT (e9ced567c) : la croix est l'entrée
- L36, 44, 65 · setTimeout · **ADAPTATEUR** · FAIT : chrome au repos et retour seul à la fiche ; durées de tv-core (`player/trailerChrome`)

#### `redesign/screens/detail/CastRow.tsx`
- L9, 120, 134 · FocusSection · **VUE** · section déclarative

#### `redesign/screens/detail/DetailSection.tsx`
- L4, 57, 69 · FocusSection reveal (sans clé) · **VUE** · ancrage déclaratif à 72 pt

#### `redesign/screens/detail/DetailSections.tsx`
- L5, 70, 80, 100, 125, 131, 141 · FocusSection, onLongPress · **VUE** · sections collection et similaires ; rappels d'appui maintenu

#### `redesign/screens/detail/DetailView.tsx`
- L8, 102, 143, 156 · scrollTo, FocusSection · **VUE** · en-tête « start », déclaratif ; L102 ne sert qu'au banc (inerte dans l'app)

#### `redesign/screens/detail/EpisodeCard.tsx`
- L81, 89, 103, 142 · onLongPress · **VUE** · rappel ; « Maintenir OK » s'il existe

#### `redesign/screens/detail/EpisodeRail.tsx`
- L4, 45, 51, 68, 76, 82, 98 · onLongPress, FocusSection · **VUE** · relais, section déclarative

#### `redesign/screens/detail/ExtrasRow.tsx`
- L9, 115, 129 · FocusSection · **VUE** · section déclarative

#### `redesign/screens/detail/SagaRow.tsx`
- L8, 59, 69, 83, 93, 104, 109, 115, 125, 130 · onLongPress, FocusSection · **VUE** · pas d'appui maintenu sur un volet `holdable: false` (donnée du modèle)

#### `redesign/screens/detail/SeasonTabs.tsx`
- L5, 55, 59, 98 · scrollTo, FocusSection · **VUE** · L55 cale une fois la bande sur la saison affichée (sans lien avec le focus)

#### `redesign/screens/detail/useSectionAnchors.ts`
- L53, 55 · scrollTo · **VUE** · sert seulement au banc ; dans l'app, l'ancrage est fait par la section native

#### `redesign/screens/library/FilterBar.tsx`
- L5, 40, 49, 51, 66 · FocusSection · **VUE** · sections déclaratives

#### `redesign/screens/library/LibraryView.tsx`
- L188 · FadingModal onRequestClose · **VUE** · Menu dans la Modal → `onSheetClose` (décidé par useLibrarySheets) ; le repli `?? onSheetApply` fait décider la vue (bug 9)

#### `redesign/screens/library/PosterGrid.tsx`
- L75, 85 · onLongPress · **VUE** · relais de l'appui maintenu d'une affiche
- L124 · `<FocusSection reveal>` · **VUE** · section déclarative ; la révélation de chaque ligne vient de tv-core (`gridLineReveal`)

#### `redesign/screens/search/SearchDiscover.tsx`
- L5, 47, 60, 63, 76 · FocusSection · **VUE** · sections déclaratives

#### `redesign/screens/search/SearchResults.tsx`
- L6, 83, 92, 96, 98, 102, 115, 119, 132 · FocusSection · **VUE** · sections déclaratives

#### `redesign/screens/settings/SettingsView.tsx`
- L9, 159, 192 · FocusSection list · **VUE** · liste de lignes, déclarative

#### `redesignWiring/browse/BrowseRedesign.tsx`
- L51, 94 · navigation.goBack (la croix) · **RESTE** · la croix recule d'un écran (pile) ; l'entrée et les réclamations sont appliquées par `platform/tvos/screens/browse` sur tv-core (`browseClaimOnItems`, `browseClaimOnError`)
- L75 · onReselect: goBack · **ANCIENNE** · toujours inerte (bug 2 des écrans, non corrigé)

#### `redesignWiring/detail/useDetailActions.ts`
- L138 · goBack · **RESTE** · la croix de la fiche recule d'une page (pile)

#### `redesignWiring/detail/useOpenDetail.ts`
- L59 · nav.goBack · **ADAPTATEUR** · applique le verdict « back » de `detailMove` (règle déjà dans tv-core `nav/detailChain`)

#### `redesignWiring/library/useLibrarySheets.ts`
- L8, 67 · useBackLayer("menu") · **DÉJÀ** · FAIT (999e350ee) : la couche « menu » des listes de filtres ; entrée et verrous suivent tv-core (`focus/libraryFocus`)

#### `redesignWiring/pairing/PairingRedesign.tsx`
- L15, 90 · useBackLayer("page") · **DÉJÀ** · FAIT (c6a9fbf91) : Menu recule d'une étape selon la règle de tv-core ; entrée par étape, connexion et clavier appliqués par `platform/tvos/screens/pairing`

#### `redesignWiring/settings/ChoiceModal.tsx`
- L8, 34 · useBackLayer("menu") · **DÉJÀ** · FAIT (69adb7511) : la couche « menu » de la liste de choix
- L36 · FadingModal onRequestClose={withMenuIntent(onClose)} · **ADAPTATEUR** · FAIT : Modal native ; Menu par l'entrée unique

#### `redesignWiring/settings/SettingsRedesign.tsx`
- L12, 42 · useBackLayer("menu") · **DÉJÀ** · FAIT (69adb7511) : Retour annule d'abord un déplacement d'entrée (tv-core `nav/arrange`)

#### `redesignWiring/trailer/TrailerRedesign.tsx`
- L3, 57 · useIsFocused · **RESTE** · « écran devant »
- L60 · goBack · **RESTE** · fermer la bande-annonce = reculer (pile) ; entrée, chrome au repos et retour seul à la fiche : tv-core `player/trailerChrome`, appliqués par `platform/tvos/screens/trailer` (e9ced567c)

#### `redesignWiring/vigie/useTitleRequests.tsx`
- L176 · setTimeout(`MODAL_GAP_MS`) · **MIXTE** · « Demander » depuis le grand panneau : le fermer puis rejouer OK — règle dans tv-core (`titles/absentActions`, 98df4f171) ; les 320 ms viennent d'UIKit (bug 6 des panneaux : jamais annulé, non corrigé)

## Pas concernés — hors navigation, ancienne UI, props inertes

81 fichiers sur le chemin, sans rien à extraire : réseau, stockage, moteur vidéo, rendu, corps `Legacy*` des aiguillages, branches Android, props sans effet sur tvOS. `⇄` : partagé avec Android TV.

| Fichier | Lignes | API | État | Pourquoi |
|---|---|---|---|---|
| `App.tsx` | 17, 75, 113 | IS_TVOS, Platform.OS | HORS | purge du cache NSUserDefaults, nom du client Jellyfin |
| `auth/pairingTransport.ts` | 21 | setTimeout | HORS | délai réseau du jumelage |
| `auth/revocationQueue.ts` | 23, 28, 58 | setTimeout | HORS | délais réseau de la file de révocation |
| `auth/tokenRefresh.ts` | 32, 53 | setTimeout | HORS | délais réseau du rafraîchissement du jeton |
| `components/ErrorBoundary.tsx` ⇄ | 55 | hasTVPreferredFocus | ANCIENNE | branche `!REDESIGN_ACTIVE` ; sur tvOS, `ScreenErrorRedesign` |
| `components/ForegroundDataRefresher.tsx` | 2, 33 | InteractionManager | HORS | rafraîchissement des données au retour au premier plan |
| `components/nav/TVNavChrome.tsx` ⇄ | 30, 84–86, 97, 98 | canGoBack, goBack | ANCIENNE | rail de l'ancienne UI : rend `null` sur toutes les routes de tvOS, MAIS il est monté (App.tsx) et ses crochets tournent — dont `useContentFocusCapture` (abonnement `useTVEventHandler` inerte, voir hooks/) |
| `components/OfflineBanner.tsx` ⇄ | 2, 59–61, 99–101, 107, 117 | BackHandler, TVFocusGuideView, autoFocus, trapFocus*, hasTVPreferredFocus | ANCIENNE | corps `LegacyOfflineBanner` ; sur tvOS, `OfflineRedesign` |
| `components/player/AVPlayerSurface.tsx` | 254 | `focusable={false}` sur `<Video>` | ANCIENNE | prop Android seulement (react-native-video) : INERTE sur tvOS ; la surface AVPlayer n'est de toute façon pas focalisable (bug 6) — exception PERMANENTE de la garde (arbitrage : gardé tel quel) |
| `components/TVColdStartLanding.tsx` ⇄ | 86, 102, 105 | setTimeout | HORS | navigation de PILE au démarrage à froid (essais de `navigate`, attente de la file) ; ni télécommande ni focus (règle déjà dans tv-core `playback/coldStart`) |
| `components/TVPlaybackOutbox.tsx` | 2, 38, 39, 46 | InteractionManager, setTimeout | HORS | file des rapports de lecture |
| `hooks/useAudioErrorRetry.ts` ⇄ | 36, 81 | setTimeout | HORS | relance du flux après une erreur audio AVPlayer |
| `hooks/useAutoCapNotice.ts` ⇄ | 36 | setTimeout 5 s | HORS | durée du message « Qualité réduite » |
| `hooks/useContentFocusCapture.ts` ⇄ | 6, 7, 45, 80, 91, 101, 109, 110, 114–117 | useTVEventHandler, setNativeProps(hasTVPreferredFocus), minuteries | ANCIENNE | seul `TVNavChrome.handleNavigate` (ancien rail) l'arme, jamais rendu sur tvOS ; MAIS l'abonnement de L101 vit sur tvOS toute la session, à vide (bug 4) — un 2ᵉ canal natif hors du bus |
| `hooks/useFocusRecovery.ts` ⇄ | 2, 16, 19, 20, 22, 23, 27, 29, 31 | `TVEventHandler`, `findNodeHandle`, `UIManager.sendAccessibilityEvent`, setTimeout 500 ms | ANCIENNE | tout le corps s'arrête sur `Platform.OS !== "android"` (L16) : filet propre à Android, INERTE sur tvOS |
| `hooks/useHomeLifecycle.ts` ⇄ | 2, 3, 37, 43, 54 | InteractionManager, useFocusEffect | HORS | rafraîchit les données au retour sur l'accueil, préchauffe les écrans ; ni focus ni gestes |
| `hooks/usePairingCode.ts` ⇄ | 80 | setInterval | HORS | compte à rebours du code |
| `hooks/usePlatformFilter.ts` ⇄ | 89, 110 | setTimeout RETRY_MS | HORS | nouvelle tentative du filtre TMDB (données) |
| `hooks/usePlaybackRecovery.ts` ⇄ | 238 | setInterval | HORS | tic de la reprise réseau |
| `hooks/usePlayerItem.ts` ⇄ | 60 | setTimeout | HORS | délai avant le recours à la fiche (réseau) |
| `hooks/usePlayerMediaState.ts` ⇄ | 39, 44 | setTimeout 8 s | HORS | effacement du bandeau d'erreur |
| `hooks/useSeasonEpisodes.ts` ⇄ | 2, 26 | InteractionManager | HORS | préchargement réseau des saisons |
| `hooks/useServerReachable.ts` ⇄ | 32, 36, 46, 79, 120 | setTimeout/setInterval | HORS | joignabilité du serveur |
| `hooks/useSessionMessages.ts` ⇄ | 34, 56 | setTimeout | HORS | échéance des messages de l'administrateur |
| `hooks/useStartupRecovery.ts` ⇄ | 34, 41 | setTimeout | HORS | sondes de reprise de l'ouverture |
| `hooks/useStartupWait.ts` ⇄ | 120 | setInterval | HORS | surveillance de l'ouverture du transcodage |
| `hooks/useStoredToken.ts` ⇄ | 20 | setInterval | HORS | relecture du jeton |
| `hooks/useTVPanelControls.ts` ⇄ | 2, 18 | type `TouchableOpacity` (backgroundRef) | ANCIENNE | ne sert qu'à useFocusRecovery (Android) |
| `hooks/useTVPanelControls.ts` ⇄ | 4, 63 | `usePreventRemove` | ANCIENNE | coupé sur tvOS refondu (`holdsSystemBack: !REDESIGN_ACTIVE`) : là, le panneau est une couche de BackScope |
| `hooks/useTVPlaybackMarker.ts` ⇄ | 46 | setInterval 30 s | HORS | marqueur de relance à froid |
| `hooks/useTVPlayerBack.ts` ⇄ | 2, 58 | usePreventRemove | ANCIENNE | coupé sur tvOS refondu (`holdsSystemBack: false`) ; la grâce et l'ordre du Retour du lecteur sont dans tv-core `player/playerBack` (63f8dc099) |
| `hooks/useTVPlayerEventHandlers.ts` ⇄ | 155 | setInterval 1 s | HORS | chien de garde du rebuffering |
| `hooks/useTVPrismProgress.ts` ⇄ | 56 | `Platform.OS !== "ios"` | HORS | jalons PrismCore de l'écran de chargement |
| `hooks/useTVReloadHold.ts` ⇄ | 23, 29 | setTimeout 35 s | HORS | levée de sécurité du gel de rechargement |
| `hooks/useTVSettingsBridge.ts` ⇄ | 56 | `onClose` (goBack de la route modale) | ANCIENNE | pont vers la modale PlayerSettings, jamais ouverte sur tvOS refondu ; seul `handleCloseSettings` (L74-79) y est actif |
| `hooks/useTVStreamUrl.ios.ts` | 121, 123, 285 | setTimeout RETIRE_DELAY_MS | HORS | arrêt différé des sessions PrismCore et des encodages |
| `hooks/useTVSubtitleControl.ts` ⇄ | 61, 69 | `Platform.OS` | HORS | bascule des sous-titres |
| `hooks/useTVSubtitles.ts` ⇄ | 62 | setInterval 250 ms | HORS | ligne de sous-titre active |
| `hooks/useTVSubtitleSync.ts` ⇄ | 50, 56, 69 | `Platform.OS` | HORS | pistes texte natives (Android), surimpression JS (tvOS) |
| `hooks/useTVTextTracks.ts` ⇄ | 47 | `Platform.OS` | HORS | format VTT ou natif |
| `lib/hdrCapabilities.ios.ts` | 1, 31 | `NativeModules.HDRCapabilities` | HORS | capacités de décodage HDR |
| `lib/platformLabel.ts` | 8 | Platform.OS | HORS | libellé « Apple TV » / « Android TV » |
| `redesign/cards/nativeDesaturate.ts` | 1, 17, 18, 21 | `requireNativeComponent`, `UIManager`, `Platform.OS`/`isTV` | HORS | vue native de RENDU (gris GPU d'un titre absent) ; ni focus ni télécommande |
| `redesign/glass/nativeGlass.ts` | 1, 25, 26, 35 | requireNativeComponent, UIManager, Platform | HORS | le verre natif (rendu) |
| `redesign/motion/motion.ts` | 17 | Platform.OS/isTV | HORS | le mouvement n'est joué que sur Apple TV (rendu) |
| `redesign/motion/Reveal.tsx` | 32 | setTimeout | HORS | apparition différée (rendu) |
| `redesign/motion/useRowRecede.ts` | 31, 54 | setTimeout | HORS | recul des voisines au focus (rendu) |
| `redesign/motion/useStagedMount.ts` | 27, 30, 31 | requestAnimationFrame, setTimeout | HORS | montage étagé (rendu) |
| `redesign/requests/liveClock.ts` | 17, 27 | `setInterval` (`LIVE_PROGRESS.tickMs`) | HORS | horloge d'affichage de l'avancement des demandes |
| `redesign/requests/useLeavingItems.ts` | 75 | `setTimeout` | HORS | phases visuelles d'une demande qui part |
| `redesignWiring/library/useLibraryPrefetch.ts` | 34, 50 | setTimeout | HORS | préchargement d'une bibliothèque depuis la navigation ; son délai est lu dans tv-core (993916398) |
| `redesignWiring/overlays/transientNotice.ts` | 21, 34 | setTimeout | HORS | échéance d'un avis bref, jamais focalisable |
| `redesignWiring/player/usePlayerEpisodesPanel.ts` | 85, 90 | setTimeout(`SEASON_PREFETCH_INTENT_MS`) | HORS | précharge une saison quand le focus s'y attarde (données) |
| `redesignWiring/remote/parallax.ts` | 29, 61, 64, 65 | Platform.OS, tvParallaxProperties | HORS | RENDU (docs/tv-navigation/remote.md) : l'inclinaison au pouce par forme, coupée au mouvement réduit ; elle reste dans `redesignWiring/remote/` — exception permanente de la garde |
| `redesignWiring/search/useSearchInput.ts` | 20 | setTimeout(`DEBOUNCE_MS`) | HORS | debounce de la recherche |
| `redesignWiring/settings/useSettingsModel.ts` | 72 | Platform.OS | HORS | réglages propres à Android TV — branche morte (la refonte ne tourne que sur tvOS) |
| `redesignWiring/vigie/liveRequests.ts` | 37, 46 | `setInterval` (`CHECK_MS` = 2 000) | HORS | battement de relecture des demandes (données) |
| `redesignWiring/vigie/liveRequests.ts` | 181 | `setTimeout` | HORS | fin du maintien d'une arrivée (affichage) |
| `redesignWiring/vigie/RequestsEntry.tsx` | 3, 37 | `useIsFocused` | HORS | écran au premier plan → cadence de relecture (données) |
| `redesignWiring/vigie/useAbsentStates.ts` | 3, 51 | `useIsFocused` | HORS | relecture en direct (données) |
| `redesignWiring/vigie/useSeriesGapTabs.ts` | 3, 54 | `useIsFocused` | HORS | relecture en direct (données) |
| `redesignWiring/vigie/useVigieGate.ts` | 30 | `Platform.OS` → `TV_PLATFORM` | HORS | la plateforme inscrite dans l'origine des demandes (donnée envoyée au serveur) |
| `screens/FavoritesScreen.tsx` ⇄ | 44 | useTVRemote/goBack | ANCIENNE | corps Legacy |
| `screens/HomeScreen.tsx` ⇄ | 2, 80, 150, 151, 154, 205, 220 | TVFocusGuideView autoFocus, scrollTo | ANCIENNE | import + corps Legacy |
| `screens/LibraryScreen.tsx` ⇄ | 2, 7, 83, 94, 103, 111, 156, 161, 187 | TVFocusGuideView, usePreventRemove, minuterie, goBack | ANCIENNE | import + corps Legacy |
| `screens/MediaDetailScreen.tsx` ⇄ | 2, 9, 70, 73, 78, 80, 88–92, 100, 113, 135, 180, 185, 197, 199, 215 | findNodeHandle, setNativeProps, useFocusEffect, scrollTo, goBack | ANCIENNE | imports + corps Legacy |
| `screens/RecommendationsScreen.tsx` ⇄ | 2, 87, 108, 135, 144, 153 | TVFocusGuideView, scrollTo, onLongPress | ANCIENNE | import + corps Legacy |
| `screens/SearchBrowseScreen.tsx` ⇄ | 2, 52, 53, 74, 110, 138 | findNodeHandle, goBack, onFocus/onBlur | ANCIENNE | import + corps Legacy |
| `screens/SearchScreen.tsx` ⇄ | 2, 63, 98, 109–111, 121, 201, 203, 226, 228, 231, 257 | TVFocusGuideView, setNativeProps, minuteries | ANCIENNE | import + corps Legacy |
| `screens/SettingsScreen.tsx` ⇄ | 2, 39, 56, 58–60, 62, 72 | TVFocusGuideView autoFocus, goBack | ANCIENNE | import + corps Legacy (L56-60 : commentaire) |
| `screens/trailer/resolveTrailerStream.ts` | 54, 56 | setTimeout | HORS | borne réseau (45 s) de la résolution du flux |
| `screens/trailer/TrailerWebView.tsx` (ex-`.ios`) | 96 | focusable={false} | ANCIENNE | commun à Apple TV et Android TV depuis le lot Android TV : la prop n'existe que sur Android dans react-native-video 6.19 — inerte sur tvOS (bug 7), vivante sur Android ; le fichier sort de la portée de la garde (plus de `.ios`), l'exception est retirée |
| `screens/trailer/useTrailerPlaybackWatch.ts` | 53, 92, 95, 96 | setTimeout | HORS | chien de garde du flux ; ses verdicts ne deviennent un retour que dans TrailerRedesign |
| `screens/trailer/useTrailerPreparation.ts` (ex-`.ios`, commun) | 24 | setTimeout 300 ms | HORS | préchauffage serveur de la bande-annonce |
| `screens/TrailerScreen.tsx` ⇄ | 43, 72, 86, 87, 90 | goBack, hasTVPreferredFocus, onFocus | ANCIENNE | corps Legacy |
| `screens/WatchlistScreen.tsx` ⇄ | 46 | useTVRemote/goBack | ANCIENNE | corps Legacy |
| `storage/queryPersistStorage.ts` | 3, 22, 29, 36 | IS_TVOS | HORS | stockage |
| `storage/RNStorageAdapter.ts` | 9, 27, 36, 44, 53, 65, 74 | IS_TVOS, Platform.OS | HORS | stockage |
| `utils/fetchItemDirect.ts` ⇄ | 35 | setTimeout (abort) | HORS | délai réseau |
| `utils/playerLoadProbe.ts` ⇄ | 1, 27 | `NativeModules.TentaclePlayerProbe` | HORS | sonde de chargement AVPlayer |
| `utils/prismCoreStart.ts` ⇄ | 1, 57, 188 | `NativeModules.PrismBridge`, setTimeout (abort) | HORS | pont PrismCore et sonde HTTP |
| `utils/screenMetricsDiag.ts` | 1, 23, 32 | InteractionManager, Platform.OS | HORS | diagnostic |
| `utils/streamPathProbe.ts` ⇄ | 30, 52 | setTimeout (abort) | HORS | sondes réseau |

## Annexe A — abonnements natifs encore HORS de l'entrée unique

L'entrée unique (`platform/tvos/input/`) porte l'abonnement natif du chemin
refondu : le lecteur y est passé (fecc655c6), la recherche aussi (a01ffe11e —
son applicateur tvOS, `platform/tvos/screens/search.ts`, porte la validation ;
le hook partagé `components/search/useSearchSubmit.ts` et `useTVRemote` ne
servent plus qu'à Android TV). Un seul abonnement y échappe encore :

| Abonnement | Par où il tourne sur tvOS | Tâche | Garde |
|---|---|---|---|
| `hooks/useContentFocusCapture.ts:101` ⇄ | `components/nav/TVNavChrome.tsx`, l'ancien rail, MONTÉ par `App.tsx` sur tvOS alors qu'il n'y rend rien : un abonnement à vide toute la session — il RESTE, inerte (décision de T4, retour-rail.md, ab64999ad) | T4 | hors portée (ancienne UI) |

## Annexe B — l'API d'avant (`remoteEvents.ts`) : retirée

Tous ses écouteurs étaient passés aux intentions (`useRemoteIntents`,
`useRemoteContext`) : « au-delà du bord » et la rotation du héros (T3), la
feuille des saisons (T6), la bande-annonce (T7). Devenue code mort, elle est
retirée avec le reste du code de transition — `lib/tvPanGesture.ts`,
`subscribeNativeRemote` — par T1 (3cd7a5d19).

## Annexe C — le second cercle : décisions prises PAR le magasin de focus

Aucune API native n'y paraît, et ni le relevé ni la garde ne les voient :
réclamations (`focus.claim`), liaisons (`focus.bind` : guides, préférences,
pièges), verrous (`setFocusLocked`), guides d'entrée (`createEntryGuide`),
croix (`useBackFocus`), entrées de section (`useSectionEntry`), gardes
(`phantomPressGuard`), entrées de liste en Modal (`useChoiceEntry`,
`useSheetFocus`). Chacune porte une règle — quelle cible, quand, jusqu'à quand —
qui doit rejoindre tv-core comme les autres.

| Fichier | Lignes | Tâche |
|---|---|---|
| `redesignWiring/nav/NavMenuModal.tsx` | 39 | T4 |
| `redesignWiring/nav/useRailArrange.ts` | 82, 137, 163 | T4 |
| `redesignWiring/nav/useRailState.ts` | 108 | T4 |
| `redesignWiring/overlays/OfflineRedesign.tsx` | 43, 44 | T6 |
| `redesignWiring/overlays/ScreenErrorRedesign.tsx` | 50, 61, 62, 74 | T6 |
| `redesignWiring/player/usePanelReturnFocus.ts` | 39 | T5 |
| `redesignWiring/player/usePlaybackTrouble.ts` | 77, 133 | T5 |
| `redesignWiring/player/usePlayerEpisodesPanel.ts` | 77 | T5 |
| `redesignWiring/player/usePlayerFocus.ts` | 78, 121 | T5 |
| `redesignWiring/screen/useRailBackLayers.ts` | 19 | T4 |
| `redesignWiring/screen/useRedesignScreen.ts` | 70, 76, 80, 91 | T4 |
| `redesignWiring/settings/ChoiceModal.tsx` | 29 | T7 |
| `redesignWiring/sheet/ActionSheetRedesign.tsx` | 84 | T6 |
| `redesignWiring/vigie/AbsentSheetRedesign.tsx` | 105 | T6 |
| `redesignWiring/vigie/RequestsEntry.tsx` | 41, 42 | T4 |
| `redesignWiring/vigie/RequestsPanel.tsx` | 55, 87, 92 | T4 |
| `redesignWiring/vigie/SeasonsSheetRedesign.tsx` | 118, 130 | T6 |

## Annexe D — le natif : Objective-C et correctifs

Ils restent natifs : ce sont l'adaptateur, côté UIKit.

| Fichier | Rôle | Tâche |
|---|---|---|
| `apps/tv/ios/TentacleTV/TentacleFocusSection.{h,m}` | la section native : inscription, focus qui entre, bouge et sort ; pose les guides du voisinage, demande la révélation | T3 |
| `TentacleFocusNeighbors.m` | la règle HAUT / BAS entre sections, TRADUITE de tv-core `focus/sections.ts` — mêmes étapes, mêmes constantes ; les tests TypeScript en sont le cahier des charges (deux écritures d'une même règle) | T3 |
| `TentacleNeighborGuides.m` | guides d'un point collés au-dessus et au-dessous de l'élément focalisé (le mécanisme de `nextFocusUp/Down`, porté par ce qui défile) | T3 |
| `TentacleRevealScroller.m` (+ `Private.h`), `TentacleRevealMotion.m` | la page qui suit le focus en UN mouvement : ressort d'un pas isolé, rafale laissée à l'animateur de tvOS | T3 |
| `TentacleFocusInput.m` | appui isolé ou rafale (flèche maintenue, glisser) au moment d'un pas du focus | T3 |
| `TVMenuPressInterceptor.m` | prend Menu dans son sous-arbre et le rend au JS | T4 |
| `patches/react-native-screens@4.16.0.patch` | Menu avalé avant UIKit tant que l'écran empêche sa fermeture (`RNSScreen.mm`, `RNSScreenStack.mm`) | T4 |
| `patches/react-native-tvos@0.80.1-0.patch` | un appui long ANNULÉ émet sa fin (`eventKeyAction` 1) — `RCTTVNavigationEventNotification.mm` | T1 |

## Annexe E — ratés par le relevé, retrouvés à la lecture

**Socle, focus, Retour (T8)**

- `redesign/focus/FocusTarget.tsx:118` et `redesign/focus/FocusSection.tsx:66` — `{...binding?.native}` : LE point où toutes les props natives de focus posées par le câblage (`native: {…}`) atteignent une vue native. Invisibles au relevé, vues par la garde quand elles sont écrites en clair (`no-focus-props`).
- `platform/tvos/focus/sectionNeighbors.ts` (déplacé par T3) — `tvNeighbors: true`, la règle des sections appliquée en natif (la garde la voit).
- `redesignWiring/focus/backFocus.tsx:53-112` (à 84f3cedd0 ; aujourd'hui `platform/tvos/back/backFocus.tsx`, la décision dans tv-core `nav/backCross`) — la décision de la croix Retour (jamais l'entrée sauf seule action ; bande armée hors rail ; BAS → dernier contenu, sinon l'entrée).

**Panneaux et cartes (T6)**

- `redesign/cards/CardShell.tsx:69` · `form="card"` · VUE · T6 · description ; `platform/tvos/focus/focusStore.ts:114-117` en tire `tvParallaxProperties` (`parallaxOf`). `MorphCard.tsx:75-83` n'a pas de `form` → pas de parallaxe.
- `redesignWiring/sheet/sheetFocus.ts` — FAIT (7eb2aa6e4) : déplacé dans `platform/tvos/panels/sheetFocus.ts` et branché sur tv-core (`cards/sheetEntry`). Avant : (AUCUNE occurrence au relevé) · MIXTE · T6 · pose les verrous `isTVSelectable` (L70), la garde anti-clic fantôme (`GUARDED`, L47, 77 : échelle, pictos, croix) et les guides d'entrée `sheet:header/scale/actions` (L101-123) — tout passe par le magasin (`FocusExtras`), d'où l'absence au relevé.
- `redesignWiring/sheet/ActionSheetRedesign.tsx:75, 80-83, 96` · `sheetEntryOf` / `firstPictoOf`, `useSheetFocus` · MIXTE · T6 · entrée sur l'échelle (note posée, sinon 5), sinon 1er picto, puis figée.
- `redesignWiring/sheet/ActionSheetRedesign.tsx:86-92` · `rate` · EXTRAIRE · T6 · mode « Noter » : OK note puis ferme.
- `redesignWiring/library/useLibrarySheets.ts:15-30, 121-126` · `sheetEntryKey`, `onSheetClear` · EXTRAIRE · T7 (arbitrage) · entrée = élément retenu, sinon le 1er (intervalle sur mesure : `sheet:from:prev`) ; « Effacer » disparu → nouvelle entrée. Fonctions pures.
- `redesignWiring/library/useLibrarySheets.ts:91` · `createEntryGuide` du pied · MIXTE · T7 (arbitrage) · BAS depuis n'importe quelle colonne → « Voir N titres ».
- `redesignWiring/library/useLibrarySheets.ts:94` · `useChoiceEntry` · MIXTE · T7 (arbitrage) · seule l'entrée est focalisable à l'ouverture (une Modal n'honore aucune préférence) : verrous `isTVSelectable`, levés au 1er focus ou à 800 ms (`settingsFocus.tsx:81-111`).
- `redesignWiring/library/useLibrarySheets.ts:112-116` · `focus.claim(pill)` · MIXTE · T7 (arbitrage) · rendre le focus à la pastille d'origine en fin de fondu.
- `redesignWiring/settings/ChoiceModal.tsx:24-26, 30` · `useChoiceEntry`, `shown` recréé · MIXTE · T7 (arbitrage) · entrée = valeur retenue, sinon la 1re.
- `redesignWiring/vigie/AbsentSheetRedesign.tsx:95, 101-104, 108` · `useSheetFocus` · MIXTE · T6 · entrée décidée quand l'état est connu (`isFetched || isError`) ou au filet.
- `redesignWiring/vigie/RequestsEntry.tsx:39-43` · `setFocusLocked(REQUESTS_DOCK_KEY, moving)` · MIXTE · T4 · pendant le déplacement d'une entrée du rail, l'aperçu des demandes n'est pas une destination.
- `redesignWiring/vigie/RequestsPanel.tsx:49-55` · `phantomPressGuard` sur la croix · EXTRAIRE · T4 (arbitrage).
- `redesignWiring/vigie/RequestsPanel.tsx:48, 79-92` · `useRowLocks` · MIXTE · T4 (arbitrage) · lignes focalisables seulement au-delà de 4 (`REQUESTS_VISIBLE_ROWS`).
- `redesignWiring/vigie/SeasonsSheetRedesign.tsx:110, 122-126` · guide du pied, entrée + `useChoiceEntry` · MIXTE · T6.
- `redesignWiring/vigie/SeasonsSheetRedesign.tsx:159-160` · `event.kind`, `event.button === "playPause"`, `event.long`, `focus.focusedKey()` · MIXTE · T1/T6 · traduction faite sur place.
- `redesignWiring/vigie/useTitleRequests.tsx:161` · `hold` (`setHeld`) · EXTRAIRE · T6 · sur un titre absent, « plus d'options » ouvre `AbsentSheetRedesign`.

**Lecteur (T5)**

- `hooks/useTVPlayerControls.ts:2, 218-275` — `useTVRemote({…})` : l'abonnement PRINCIPAL du lecteur à la télécommande (`useTVEventHandler` + `BackHandler`) et toute sa traduction (playPause, ←/→, longLeft/Right, rewind/fastForward, keyUp, ↑/↓/tout appui → habillage, select → valider). ADAPTATEUR T1 pour l'abonnement, EXTRAIRE T5 pour les règles. Fenêtres d'arbitrage : L15 `SCRUB_TWIN_PRESS_MS` 400, L21 `MEDIA_KEY_ECHO_MS` 300, L24 `TOUCH_AFTER_PRESS_MS` 600 (lues L156, 183, 234-236, 263-265), `guardScrub` L153-158 ; L145-148 rallume l'habillage à chaque bascule pause ; L203-215 branche le pan sur le défilement.
- `hooks/useScrubGestures.ios.ts:14-17, 127-140` — `HWEvent` et décodage de `state` (Began/Changed/Ended) : traduction (T1/T5) ; `:53 usePanGesture(enabled)` : prise du reconnaisseur natif (ADAPTATEUR T1).
- `hooks/useScrubHoldMotor.ts:3, 99, 113, 121` — `SCRUB_INPUT` (`scrubInput.ios.ts` : le relâchement vaut appui, `longLeft` ouvre le maintien, la fin est annoncée) = la traduction tvOS des flèches ; `:182-183 isHoldTicking` 400 ms (doublons ←/→ pendant un maintien). EXTRAIRE T5.
- `redesignWiring/player/usePlaybackTrouble.ts:73` `GESTURES.has(evt?.eventType)` ; `:81-82` `noteSkipFocusClaim()` + `store.claim("trouble:retry")` ; `:92` `returnFocusToOsd()`.
- `redesignWiring/player/PlayerRedesignStage.tsx:45` `useTvFocusClaim(backgroundRef, backgroundFocusable && !skipActive)` (MIXTE T5 : le fond reprend le focus sauf si un bouton de saut est monté) ; `:72 {...BACKGROUND_FOCUS}` ; `:78 accessible={backgroundFocusable}` — le VRAI levier de `isTVSelectable` sur tvOS ; `:79 importantForAccessibility` (Android seulement, inerte).
- `redesignWiring/player/usePlayerFocus.ts:85, 165-168` `store.claim` au front montant (chargement, carte, affiche, entrée de feuille) ; `:131 phantomPressGuard: true` ; `:140 setSkipNode(node)` ; `:174-175` décisions `islandTrap` / `islandExit` (EXTRAIRE T5).
- `redesignWiring/player/usePlayerEpisodesPanel.ts:75-80` `store.claim(entryKey)` — entrée du panneau : l'épisode en cours, sinon la 1re ligne (MIXTE T5/T6).
- `components/player/focus/useSkipPillFocus.ts:57` `useTvFocusClaim` (relancé à l'extinction de l'habillage), `:64 noteSkipFocusClaim`, `:84 returnFocusToOsd`, `:85 claimTvFocus(skipRef.current)` (MIXTE T5).
- `components/player/focus/overlayFocusCore.ts:125` `osdPlayPauseNodeRef.current = node`, `:184 setOsdFocusReturn` ; `osdFocusBus.ts:9, 35-51` : registres de nœuds natifs servant de `destinations` (ADAPTATEUR T5).
- `redesignWiring/player/playerFocusContainers.tsx:5, 242-256` `AutoFocusGuide` / `TrapFocusGuide` (guides génériques de T3) ; `:163-164, 211-212` `useSyncExternalStore(store.focusedKey)` : le focus courant oriente les ponts.
- `redesign/screens/player/PlayerChromeView.tsx:130, 168` `pointerEvents={chrome ? "box-none" : "none"}` : sur tvOS `none` rend l'habillage caché infocalisable — décision prise DANS LA VUE ; `:155-157 SWAP_FLOOR` : opacité jamais nulle pour garder le focus pendant le fondu.
- `hooks/useTVPlayerBack.ts:99-125` `routeBack` / `holding` (grâce > défilement > carte/affiche > passage automatique) — EXTRAIRE T4/T5.
- `redesignWiring/player/usePlayerBackLayers.ts:13-21` `useOsdPin` (la pause épingle l'habillage, Retour le désépingle) — EXTRAIRE T4/T5.
- `hooks/useTVEpisodeNav.ts:42-51` — deux appuis sur « précédent » à moins de 500 ms → épisode précédent, sinon retour au début — EXTRAIRE T5.
- `hooks/useTVPlaybackLifecycle.ts:82` `navigation.replace("MediaDetail")`, `:137 navigation.getState()` — T7.
- `screens/PlayerScreen.tsx:66, 182, 284, 296` `REDESIGN_ACTIVE` ; `:94 bumpOsdFocus("playpause")` au retour au premier plan ; `:129-145 onBack` (routeBack > réglages > épisodes > quitter, Android en pratique) ; `:189 useTVOsdEntryFocus` ; `:290-292` cibles de focus des panneaux.
- `hooks/useTVPanelControls.ts:72` `useFocusRecovery` (Android) ; `hooks/useTVPlaybackPresence.ts:72` `AppState.addEventListener`.

**Écrans (T7)**

- `components/search/useSearchSubmit.ts:49` `claimTvFocus(first.current)` (ADAPTATEUR) ; `:85-89` `useTVRemote({ onAnyPress })` = `useTVEventHandler` actif sur tvOS, hors du bus : « une touche après le départ du clavier annule l'atterrissage » (EXTRAIRE T7) — bug 5.
- `redesignWiring/home/useHeroRotation.ts:81` `event.kind` / `event.long` / `event.phase` (suspension par appui maintenu) ; `:84 focus.subscribe(() => arm())` (un pas du focus relance l'attente).
- `redesignWiring/browse/BrowseRedesign.tsx:71` choix de l'entrée (status:primary > grid:0 > browse:back) ; `:78 useBackFocus` ; `:84-90` `focus.subscribe` + `focus.claim("grid:0")` (la 1re affiche reprend le focus à la croix tant qu'aucune ne l'a eu) ; `:92-95 focus.claim("status:primary")` — EXTRAIRE T7.
- `redesignWiring/detail/useDetailGuides.ts:38` `focus.bind(key, SIDES)` ; `:49-58` entrées déclarées (`useSectionEntry` → `tvEntry`) : saisons → onglet affiché, épisodes → épisode à reprendre à la 1re entrée (décision T7, application T3).
- `redesignWiring/detail/useOpenDetail.ts:70-71, 79-80` `nav.push` / `nav.replace` : application de `detailMove` (ADAPTATEUR).
- `redesignWiring/home/HomeRedesign.tsx:77-78` choix de l'entrée : status:primary, rien pendant le chargement, hero:primary, sinon 1re carte (EXTRAIRE T7).
- `redesign/screens/detail/EpisodeRail.tsx:91` `initialScrollIndex` : défilement natif initial sur l'épisode d'ancrage (VUE).
- `redesignWiring/overlays/ScreenErrorRedesign.tsx:48, 60` `store.claim(ENTRY)` (l'entrée est Réessayer, jamais la croix) ; `:59, 72 useBackFocus`.
- `redesignWiring/pairing/PairingRedesign.tsx:63` `navigation.replace("Home")` ; `:86-91` `store.bind(…, { container: AutoFocusGuide })` ; `:93-95` `entryKeyOf` + `store.claim(entryKey)` (entrée par étape) ; `:94 useBackFocus`.
- `redesignWiring/pairing/loginFocus.ts:23-26` `store.subscribe` + `store.claim(PASSWORD_KEY)`.
- `redesignWiring/search/useSystemKeyboard.ts:42` `focus.claim(FIRST_KEY)` (Menu ferme le clavier → 1re touche) ; `:63-65 focus.subscribe` (la barre refocalisée signale que le clavier est parti) ; `:68 focus.claim(FIELD_KEY)` ; `:84 navigation.addListener("transitionEnd")`.
- `redesignWiring/settings/settingsFocus.tsx:46-47` `focus.bind(…, { container: TabsGuide | AutoFocusGuide })` ; `:52-62 useActiveTabDestination` (destination = onglet affiché) ; `:86, 88, 97 setFocusLocked` ; `:101 focus.subscribe`.
- `redesignWiring/settings/SettingsRedesign.tsx:37` l'entrée est l'onglet affiché.
- `redesignWiring/trailer/TrailerRedesign.tsx:42, 89` binder ad hoc `bindClose` passé à `FocusBindingProvider` : props natives posées hors du magasin de focus.

## Annexe F — bugs relevés, NON corrigés (règle du lot)

Relevés à la lecture sur 84f3cedd0, pour mémoire : aucun n'est corrigé dans
ce lot (l'extraction a pu déplacer le code en cause, jamais changer ce qu'il
fait). « À vérifier » : déduit du code, pas reproduit.

**Panneaux et cartes**

1. Retour AVANT la présentation (ActionSheetRedesign.tsx:72-73, 80-82, 95 ; AbsentSheetRedesign.tsx:81-84, 103, 107) : `requestClose` ne fait que passer `closing` ; la Modal se présente quand même à l'entrée décidée (jusqu'à 1,2 s / 0,9 s plus tard) puis se referme aussitôt — Retour semble sans effet pendant l'attente. SeasonsSheetRedesign.tsx:100-103 ferme directement : incohérence.
2. AbsentSheetRedesign.tsx:84 : couche « menu » `active` à `true` en dur (les autres : `!closing`).
3. Filets d'entrée hétérogènes pour le même comportement : 1 200 ms (ActionSheet), 900 ms (AbsentSheet), 1 500 ms (SeasonsSheet), plus 800 ms de libération des verrous (settingsFocus.tsx:65).
4. ActionSheetRedesign.tsx:82 + sheetFocus.ts:57-58 : en mode `rate`, note encore `pending` au filet → entrée sur la croix au lieu de l'échelle (à vérifier).
5. SeasonsSheetRedesign.tsx:140-152 : Retour pendant l'envoi, fondu fini avant la réponse → « Demande envoyée » et la mise à jour des listes perdues (`after.current` jamais exécuté).
6. useTitleRequests.tsx:170 : `setTimeout` jamais annulé — écran quitté dans les 320 ms → `open(title)` sur un composant démonté.
7. MorphCard.tsx:68-86 reçoit `onLongPress` mais n'affiche pas « Maintenir OK : plus d'options » (contredit MediaCard.tsx:31-34, CardHoldHint.tsx:8-9).
8. RequestsPanel.tsx:18-20, 52 (à vérifier) : garde anti-clic justifiée par « un OK encore enfoncé », or l'aperçu ouvre par `onPress` (au relâchement) ; les autres panneaux ouverts par OK n'en ont pas.
9. RequestsEntry.tsx:41-42, RequestsPanel.tsx:84, 89 (via focusLocks.ts:19) : déverrouiller fait `focus.bind(key, null)` — efface TOUTES les extras de la clé ; RequestsEntry déverrouille dès le montage. Sans effet aujourd'hui, piège pour l'extraction.
10. RequestsPanel.tsx:79-92 : verrous écrits (magasin + `setNativeProps`) pendant le RENDU — un rendu abandonné les appliquerait quand même.
11. Retour du focus à la fermeture d'un panneau : réclamé pour les listes de filtres (useLibrarySheets.ts:112-116), laissé à la restauration de tvOS ailleurs (ChoiceModal, RequestsPanel, feuilles Vigie, grand panneau) — divergence à trancher.

**Lecteur**

1. Variables de module écrasées au passage à l'épisode suivant (probable, à vérifier) — overlayFocusCore.ts:125, osdFocusBus.ts:9/35/87, usePlayerFocus.ts:140, useSkipPillFocus.ts:101 : à `navigation.replace`, le nouveau lecteur monte avant que l'ancien parte ; le démontage de l'ancien remet `osdPlayPauseNodeRef` à null puis `setSkipNode(null)` et `noteSkipHolding(false)` — la sortie BAS de l'îlot (playerFocusContainers.tsx:186) manquerait tout l'épisode suivant. Seul `setOsdFocusReturn` est protégé.
2. useTVPlaybackPresence.ts:85 — re-signaux de focus jamais annulés : les trois minuteries tirent après démontage ; à 1,5 s et 3 s, `bumpOsdFocus("playpause")` peut ramener le focus sur Lecture pendant que l'utilisateur navigue (la garde de PlayerScreen.tsx:94 ne couvre que les panneaux).
3. useOverlayFocus.ios.ts:34, 39 — le cycle faux→vrai→faux n'est jamais annulé (contrairement à `claimTvFocus`) : deux restaurations rapprochées s'entremêlent.
4. usePlaybackTrouble.ts:137-139 — l'annulation rendue par `store.claim` est perdue dans le `setTimeout` : la réclamation survit au nettoyage.
5. ←/→ sous le message-outil (à vérifier) — usePlaybackTrouble.ts:71-75 + useScrubController.ts:238-242 : le 1er ←/→ qui active le panneau part aussi dans `useTVRemote` (global) ; fond focalisé et habillage caché → saut de −10/+30 s pendant l'arrêt ; `troubleCovers` n'entre pas dans `panelOpen` (PlayerScreen.tsx:151) : pavé et maintien ←/→ restent actifs sous le panneau.
6. Props sans effet sur tvOS — PlayerRedesignStage.tsx:77 `focusable` (ancienne architecture : seul `isTVSelectable` existe ; c'est `accessible` L78 qui l'agit — fragile) ; AVPlayerSurface.tsx:254 `focusable={false}` (Android seulement, commentaire trompeur) ; PlayerRedesignStage.tsx:79 `importantForAccessibility` (Android seulement).
7. Commentaires faux sur `nextFocus*` — overlayFocusCore.ts:62, 72, 206, osdFocusBus.ts:6, 18 disent que tvOS les ignore : faux pour react-native-tvos 0.80.1 (RCTTVView.m:327-392 pose des `UIFocusGuide` ; backFocus.tsx:98 s'en sert).
8. overlayFocusCore.ts:89-95, 107-111, 127-128 — sur tvOS refondu, `findNodeHandle`, `bumpHandles` et `initialPreferred` déclenchent des re-rendus pour des props jamais appliquées.
9. Retour : code mort et deux sources de vérité — useTVPlayerControls.ts:221-229 `onBack` ne s'exécute jamais sur tvOS (Menu n'atteint pas le JS ; le commentaire L222-225 dit l'inverse) ; PlayerScreen.tsx:129-145 double l'ordre tenu par usePlayerBackLayers ; PlayerScreen.tsx:136 vise `"settings"` même si la feuille a été ouverte par `"options"`.
10. useTVPlayerControls.ts:219 — `debugTag: "PLAYER"` (« TODO(diag): À RETIRER ») toujours actif : un `console.log` à chaque select, longSelect, rewind, fastForward.
11. playerFocusContainers.tsx:59-66 — `useStoreDestination` ne vide jamais ses destinations au démontage du nœud (contrairement à `useLiveDestination`) : un pont peut viser un nœud disparu (à vérifier).

**Écrans**

1. « Rechercher » ramène au mauvais écran — searchBarReturn.ts:30-32 (appelé par useRailState.ts:132) : une page Personne ouverte depuis une fiche est un SearchBrowse remplacé ou empilé (useOpenDetail.ts:75-81) ; « Rechercher » y fait `goBack()` → l'écran d'avant la suite de fiches (souvent l'Accueil), jamais la recherche. Même hypothèse dans BrowseRedesign.tsx:23-26.
2. `onReselect` mort — BrowseRedesign.tsx:73 : jamais atteint (useRailState.ts:132 intercepte « Search » avant le test `key === railKey`). Deux chemins pour une même règle.
3. Croix et Menu divergent sur l'écran d'erreur d'une page du rail — ScreenErrorRedesign.tsx:69-76 : hors Accueil la pile vaut [Home, page], `canGoBack()` est vrai, la croix recule vers l'Accueil ; Menu suit `railBackStep` et ouvre le rail ; contredit railNavigate.ts:10.
4. Abonnement natif à vide — useContentFocusCapture.ts:101 : `TVNavChrome` toujours monté (App.tsx:207) appelle ses crochets avant `return null` ; un `useTVEventHandler` reste actif toute la session pour une capture jamais armée — un 2ᵉ canal hors du bus.
5. `useTVRemote` hors du bus, glissers ignorés — useSearchSubmit.ts:85-89 : encore un abonnement hors bus ; `onAnyPress` ignore swipe* et pan → un glisser après le départ du clavier n'annule pas l'atterrissage, une réponse dans les 3 s peut encore arracher le focus.
6. Réclamation perdue sans bruit — useSystemKeyboard.ts:50-60 : le faux nœud expose toujours `setNativeProps` → `claimTvFocus` ne renonce jamais et contourne l'attente de montage de `focus.claim` : 1er résultat pas encore monté → réclamation perdue.
7. Prop inerte — TrailerWebView.ios.tsx:96 `focusable={false}` est Android seulement ; la Video n'est sourde que parce que RCTVideo n'est pas focalisable de nature (commentaire L22-24 trompeur).
8. Binder ad hoc hors magasin — TrailerRedesign.tsx:41-42, 89 : `hasTVPreferredFocus: true` à demeure, sans le cycle vers faux ; aucune observation onFocus/onBlur.
9. Une vue qui décide — LibraryView.tsx:188 : le repli `onSheetClose ?? onSheetApply ?? noop` fait que Menu APPLIQUE faute de fermer.
10. Effets natifs pendant le rendu — settingsFocus.tsx:85-90 : `useChoiceEntry` pose ses verrous (bind + setNativeProps) pendant le rendu.
11. Re-rendus pour le banc — useForcedFocusReveal.ts:47, 57 : `setLayoutTick` redessine Accueil, Pour vous et recherche à chaque mise en page de section, pour un outil réservé au banc.

**Socle (T8)**

1. `redesignWiring/settings/useSettingsModel.ts:72` — `Platform.OS === "android"` dans le câblage refondu : branche morte, la refonte ne tourne que sur tvOS.
2. `components/nav/TVNavChrome.tsx` — l'ancien rail est monté sur tvOS (App.tsx) et ses crochets tournent pour rien (`useLibraries`, `useContentFocusCapture` et son abonnement natif — annexe A).

**Ailleurs dans le lot** — chaque tâche a tenu sa liste, non corrigée elle aussi :
`focus.md` (« Constats »), `retour-rail.md` (§ 15, B1 à B8), `lecteur.md`
(§ 10), `panneaux-cartes.md` (§ 6), `ecrans.md` (« Constats »). Ce qui ne
s'écrit nulle part ailleurs dans le dépôt :

1. Socle (rapport final de T1) — la rotation du héros relancée par un maintien « Changed » (phase nulle) ; `useTVRemote` lit un `longLeft` / `longRight` « Changed » comme un relâchement ; deux seuils d'OK maintenu (500 ms au `longSelect` natif, 550 ms au `Pressable`) ; un second abonnement natif inerte hors de l'entrée unique, `BackHandler.ios.js` de react-native-tvos (le premier : annexe A) ; plus tard, le rang d'activation des contextes (`setKind`, `remote/contexts.ts`) pour y fondre `nav/backLayers`.
2. Banc (passage final) — CORRIGÉS depuis, par T2 et T7 : `ecrans/jumelage.json` tapait `http://localhost:3107` en dur, ses deux scénarios ne passaient que sur la place 7, et sur l'Apple TV « localhost » est l'Apple TV (`{backend}` substitué par place : df1563bbe, c8abb66f5, références d8a190162) ; sur l'appareil, un `type:` sans clavier ouvert mettait fin au test de l'agent XCUITest (`AgentUITests.swift:55`) et tout ce qui suivait sortait « agent absent » (refus du geste : f81442ad0 ; agent absent relancé une fois : eb1d0deee). Reste : `ensureAgent` garde un agent vivant sans regarder son empreinte — après un changement d'agent, `down` la place avant de rejouer.
3. Faux backend (T6, T7) — `/api/preferences/reco` sans `settings`, `/api/search` sans `match`, `/api/search/episodes` non servi.
4. Tests instables sous forte charge — webOS `searchState` / zones (plus de 5 s au-delà d'une charge de 40), api-client `bitrateMeasure` : à rejouer seuls.

## Annexe G — partagés avec Android TV qui portent une décision

Ceux-là ne s'amincissent sur tv-core qu'avec un banc qui prouve l'équivalence
Android (règle du lot) ; le rapport final les liste s'ils ont été touchés.

- `components/player/focus/osdFocusBus.ts` (T5)
- `components/player/focus/overlayFocusCore.ts` (T5)
- `components/player/focus/useSkipPillFocus.ts` (T5)
- `components/search/searchBarReturn.ts` (T7)
- `hooks/playerTimers.ts` (T5)
- `hooks/usePairingFlow.ts` (T7)
- `hooks/useTVEpisodeNav.ts` (T5)
- `hooks/useTvFocusClaim.ts` (T3)
- `hooks/useTVPlaybackLifecycle.ts` (T5)
- `hooks/useTVPlaybackPresence.ts` (T5)
- `navigation/AppNavigator.tsx` (T4)
- `screens/PlayerScreen.tsx` (T5)

**Touchés pendant le lot** (git, 84f3cedd0 → 73b3839d1) — tous par T5, et
l'équivalence Android prouvée par `player-trace` (`TRACE_PLATFORM=android`,
rejoué au passage final) :

- amincis sur tv-core : `hooks/useTVPlayerControls.ts`, `hooks/useTVPlayerBack.ts` ; modifié : `hooks/scrubGestureTypes.ts` ;
- ajoutés : `hooks/playerTimers.ts`, `hooks/usePlayerRemoteBinding.ts` (et son pendant `.ios`) ;
- retirés, leurs règles parties dans tv-core (`player/`) : `useScrubController`, `useScrubHoldMotor`, `useScrubCountdown`, `scrubCountdown`, `scrubTouchTuning`, `seekTuning`, `useSkipFlash`.

Hors `apps/tv`, tv-core `nav/backLayers.ts` (T4) n'a gagné que des
commentaires et `BACK_INTENT` : comportement identique, `back-trace` identique
sur iOS et Android. Aucun autre fichier partagé n'a bougé ; `lib/tvPanGesture.ts`,
lu par le seul chemin tvOS, est devenu `platform/tvos/input/panGesture.ts`.

## Annexe H — attributions proposées

Les arbitrages du coordinateur (`.claude/nav-lot/STATUS.md`) font foi et sont
appliqués ci-dessus (« arbitrage »). Les propositions faites pour le lecteur
sont devenues sans objet avec son branchement (fecc655c6). Restent :

- `redesignWiring/settings/SettingsRedesign.tsx` (`useBackLayer`) → T7 ; les couches : T4.
- `redesignWiring/remote/parallax.ts` → rendu, il reste (remote.md) : exception permanente de la garde.

## Annexe I — accord avec `remote.md` (relevé des points d'entrée de T1)

Le tableau des points d'entrée de `remote.md` et cet inventaire disent la
même chose : `useSearchSubmit` y est (depuis 54b02445d), `useContentFocusCapture`
y est dit monté sur Apple TV avec un abonnement permanent et inerte (depuis
c7aca069b), `useFocusRecovery` y est dit inerte sur tvOS (8ab4c73f2). Les deux
tableaux se recalent l'un sur l'autre à chaque fusion.

## Annexe J — seuils et durées dans l'adaptateur

`docs/TV-NAVIGATION.md` : l'adaptateur n'a pas le droit de contenir un seuil
ni une durée. L'audit (`node eslint/tvNavigationAudit.mjs`) les liste. Les
quatre de `platform/tvos/focus/` (`RESTORE_WITHIN_MS`, `SETTLE_MS`,
`USER_RAIL_AFTER_MS`, `LEAVE_CHECK_MS`) sont parties avec le branchement de
T3 (cbe686f9f) : les applicateurs lisent leur durée dans tv-core. Au
recalage : AUCUNE.

## Annexe K — l'adaptateur Android TV, sur papier

Rien n'est écrit pour Android TV dans ce lot : son code n'est pas touché, et la
refonte n'y tourne pas (`redesignGate.ts`). Voici ce que son adaptateur devra
fournir, en face de celui de tvOS. Les COMPORTEMENTS sont déjà là, dans
tv-core : restent une table, des applicateurs et une pièce native. Les faits
sont lus dans react-native-tvos 0.80.1-0 (`ReactAndroidHWInputDeviceHelper.java`
— celui que montent `ReactRootView` et les `Modal` —, `ReactViewGroup.java`,
`ReactViewManager.kt`) et dans le code partagé d'aujourd'hui ; « à mesurer » :
aucun appareil ne l'a encore dit.

**La table** — `packages/tv-core/src/remote/bindings/androidtv.ts` (`RemoteBindings`) :
- chaque touche annonce son enfoncement (`eventKeyAction` 0) PUIS son
  relâchement (1) — l'app pose `enableKeyDownEvents = true`
  (`MainApplication.kt`). La table choisit la phase de chaque appui (`on`),
  sinon il compterait deux fois ; le code partagé agit à l'enfoncement et
  ignore le relâchement jumeau (`useTVRemote.ts`) : `pressOnRelease: false`.
- tenue plus de 300 ms (`mLongPressedDelta`), une touche devient `longSelect`,
  `longUp`… — une fois à l'enfoncement, une fois au relâchement ; avant,
  l'enfoncement se répète. Ce signal n'arrive pas partout (l'émulateur, clavier
  de l'hôte, ne l'émet jamais : `hooks/scrubInput.ts` reconnaît le maintien à
  l'enfoncement resté sans relâchement). `announcedHolds`, `holdThresholdMs`
  et `RemoteSignal.repeat` : à mesurer.
- le Retour ne passe PAS par `TVEventHandler` (`KEYCODE_BACK` n'est pas dans la
  table native) : `BackHandler` (`hardwareBackPress`), pris ou laissé AU MOMENT
  de l'appui (`return true`) → `backDecidedAhead: false`. `menu`
  (`KEYCODE_MENU`) est une autre touche.
- des touches que la Siri Remote n'a pas : `play`, `pause`, `stop`, `record`,
  `next`, `previous`, `rewind`, `fastForward`, `info`, `captions`, `guide`,
  `channelUp` / `channelDown`, les chiffres `0`…`9`, `bookmark`, `dvr`,
  `avrInput`, `avrPower` — chacune une intention (`transport`…) ou du bruit
  déclaré, jamais oubliée (les tests de la table le vérifient).
- aucune surface tactile : `touchSurface: false`, `dragOnDemand: false`,
  `dragUnit: null`, ni `swipes` ni `drags`.
- `focusMovesBeforeIntent` : la touche part vers le JS, puis le moteur
  d'Android déplace le focus dans la même distribution
  (`ReactRootView.dispatchKeyEvent`) ; le JS, asynchrone, l'apprend après —
  vrai a priori, à mesurer.

**L'entrée** — `platform/androidtv/input/` : un `TVEventHandler` et un
`BackHandler`, lus en `RemoteSignal`, donnés à
`createRemoteInput(ANDROIDTV_BINDINGS)` ; le Retour y entre par où `receiveMenu`
entre sur tvOS. Pas de pan (`panGesture.ts` : tvOS seul).

**Le focus** — `platform/androidtv/focus/` :
- verrou (`focusLocks.ts`) : `focusable={false}` — Android ignore
  `isTVSelectable`, tvOS ignore `focusable` ;
- guides (`focusGuides.tsx`, `entryGuide.tsx`, ponts et raccourcis du rail) :
  `TVFocusGuideView` existe sur Android (`destinations`, `autoFocus`,
  `trapFocus*` dans `ReactViewGroup`) — à éprouver tels quels ;
- préférence : `hasTVPreferredFocus` y demande le focus (`ReactViewManager.kt`) ;
  le cycle faux → vrai → relâchée (`FOCUS_PREFERENCE_CYCLE`) est une affaire de
  tvOS ;
- la SECTION native n'a pas de pendant : `TentacleFocusSection` et
  `TentacleFocusNeighbors.m` (annexe D) appliquent `focus/sections.ts` au
  geste. Il faudra un `ViewGroup` qui surcharge `focusSearch` avec la même
  règle, entrée déclarée comprise (`tvEntry`) — les tests de `sections.ts` en
  sont le cahier des charges, comme pour l'Objective-C ; à défaut, des
  `nextFocusUp/Down` posés par élément ;
- la page qui suit le focus (`TentacleRevealScroller`, pas isolé ou rafale :
  `TentacleFocusInput.m`) : à refaire ;
- `claimAfterRestore.ts` répond à une restauration propre à UIKit : à mesurer
  avant de le porter.

**Le Retour** — `platform/androidtv/back/` : la pile des couches est celle de
tv-core (`nav/backLayers`, `nav/backResolve`) ; la portée écoute
`hardwareBackPress` et résout à l'appui — rien à poser d'avance
(`MenuPressInterceptor.tsx` n'est, sur Android, qu'une `View`).
`navigation/railNavigate.ts`, la règle recopiée, se retire au portage
(`retour-rail.md`, § 18).

**Panneaux** — la règle d'entrée est dans tv-core (`panels/choiceEntry`,
`cards/sheetEntry`) ; l'applicateur verrouille par `focusable`. Le verrou existe
parce qu'une `Modal` de tvOS n'honore aucune préférence : à mesurer sur
Android, où il pourrait ne servir à rien — sans changer la règle.

**Lecteur** — `useTVPlayerControls` et `useTVPlayerBack` sont déjà minces sur
tv-core, l'équivalence Android prouvée par `player-trace`
(`TRACE_PLATFORM=android`) ; le maintien des flèches suit le profil de
`scrubInput.ts` ; `PlayerBackground` et les guides du lecteur
(`playerFocusContainers.tsx`) se portent par guides et préférence.

**Écrans** — le clavier : sur tvOS, un bouton focalise un champ caché
(`HiddenSearchInput`, `openPairingKeyboard`) ; sur Android, OK sur un
`TextInput` focalisé ouvre l'IME — à éprouver écran par écran (recherche,
jumelage).

**Ne se porte pas** — parallaxe (`tvParallaxProperties`), verre natif,
désaturation, `enableTVPanGesture` : tvOS seulement, et hors navigation.

**La garde** — `TV_NAV_ALLOWED` (`eslint/tvNavigation.mjs`) gagne
`apps/tv/src/platform/androidtv/**`, `TV_NAV_SCOPE` les `*.android.{ts,tsx}` du
chemin refondu ; le test de pureté de tv-core ne change pas.

**La preuve** — le banc doré ne joue que tvOS (simulateur, « Chambre ») : il
lui faudra un mode Android (émulateur ou appareil) avant de brancher la
refonte. Ses références tvOS serviront de cahier des charges, aux différences
de plateforme près (Retour à l'appui, pas de pavé tactile).
