# Inventaire — la télécommande et le focus sur le chemin refondu

Domaine de T8 (la garde). Index : [`../TV-NAVIGATION.md`](../TV-NAVIGATION.md) ·
la garde : [`garde.md`](garde.md).

Pour CHAQUE usage d'une API native de télécommande ou de focus sur le chemin
Apple TV refondu : où il est (fichier:ligne), qui le traite (T1 à T7) et ce
qu'il devient. Relevé sur 84f3cedd0 (avant toute extraction), recalé sur
`3f231223d`. T8 le remet à jour après chaque fusion ; les lignes d'un fichier
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
- **772 occurrences dans 193 fichiers**, chacune lue et classée ; un
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
| T1 | 6 | — | — | 11 | 13 | 5 | — | — | — |
| T3 | 21 | 17 | 12 | 55 | 1 | 2 | 28 | — | 6 |
| T4 | 18 | 10 | 15 | 22 | 5 | 11 | 16 | 1 | — |
| T5 | 19 | 39 | 31 | 43 | — | — | 3 | 3 | 20 |
| T6 | 12 | — | — | 7 | 4 | 4 | 20 | — | — |
| T7 | 35 | 21 | 8 | 13 | — | 2 | 44 | 1 | 1 |
| pas concernés | 82 | — | — | — | — | — | — | 135 | 143 |
| **total** | 193 | 87 | 66 | 151 | 23 | 24 | 111 | 140 | 170 |

## T1 — le socle : intentions, traduction, entrée unique

> Fait (756ed8bc7, 54b02445d) : l'entrée unique `platform/tvos/input/` porte l'abonnement natif du chemin refondu et la prise du pan ; Menu des Modals y passe (`withMenuIntent`). Reste : l'API d'avant (`remoteEvents.ts`) et ses quatre écouteurs (annexe B), et quatre abonnements natifs encore HORS de l'entrée unique (annexe A).
>
> 6 fichiers.

#### `lib/tvPanGesture.ts`
- L6 · réexport de `acquirePanGesture` / `usePanGesture` · **RESTE** · ne fait plus que réexporter la prise du pan de l'entrée unique, le temps que `hooks/useScrubGestures.ios.ts` (T5) migre

#### `platform/tvos/input/index.ts`
- L9 · réexport de la prise du pan · **ADAPTATEUR** · FAIT (756ed8bc7) : l'entrée unique de la télécommande

#### `platform/tvos/input/panGesture.ts`
- L2, 24, 32, 38 · `TVEventControl.enable/disableTVPanGesture`, `Platform.OS` · **ADAPTATEUR** · FAIT (756ed8bc7) : la prise du pan, drapeau global compté — dans l'adaptateur, permis par la garde

#### `platform/tvos/input/remoteInput.ts`
- L1, 24, 45 · `TVEventHandler.addListener`, `Platform.OS` · **ADAPTATEUR** · FAIT (756ed8bc7) : L'abonnement natif du chemin refondu, `readTvosEvent` → `createRemoteInput` — dans l'adaptateur, permis par la garde

#### `redesignWiring/redesignGate.ts` — garde : `no-platform-branch`
- L19 · Platform.OS · **RESTE** · l'aiguillage de la refonte — exception permanente

#### `redesignWiring/remote/remoteEvents.ts`
- L52, 65–68, 74–79, 92, 96 · swipe*, long*, pan · **DÉJÀ** · l'API d'AVANT, gardée le temps que ses écouteurs migrent ; elle lit l'entrée unique (`subscribeNativeRemote`, 756ed8bc7) et sa traduction est réécrite dans tv-core (`remote/bindings/tvos.ts`)
- L118, 135, 138 · subscribeRemote, useRemoteEvents · **RESTE** · le bus d'avant, sans abonnement natif à lui ; ses écouteurs (useBeyondEdge, useHeroRotation, TrailerRedesign, SeasonsSheetRedesign) passent à `useRemoteIntents` / `useRemoteContext` (T3, T6, T7)

## T3 — focus, sections, rangées ; accueil, Pour vous, héros

> Fait (f56e83f30) : les applicateurs du focus sont dans `platform/tvos/focus/` (réexportés aux anciens chemins), les règles dans tv-core `focus/` et `hero/rotation`. MAIS seul `sectionEntry` est branché : les autres applicateurs gardent leur copie de la décision, et quatre durées vivent encore dans l'adaptateur (annexe J). Arbitrage : l'accueil, Pour vous et le héros sont à T3 (spec miroir, fichiers non modifiés).
>
> 21 fichiers.

#### `hooks/useTvFocusClaim.ts` — partagé Android TV
- L4, 77, 86–91, 94 · setNativeProps({hasTVPreferredFocus}), setTimeout 40/50/120 ms · **ADAPTATEUR** · branche tvOS de `claimTvFocus` : cycle faux→vrai→faux (contournement RN-tvos #849) — LA primitive de `focusStore.claim` ; mécanique native → `platform/tvos/focus/` (T1 l'emploie aussi)
- L66, 67, 79, 82 · requestAndroidTvFocus, Platform.OS !== "ios" · **ANCIENNE** · branche Android TV

#### `platform/tvos/focus/claimAfterRestore.ts`
- L28 · setTimeout · **EXTRAIRE** · re-réclamer UNE fois si tvOS restaure le focus ailleurs dans `RESTORE_WITHIN_MS` = 900 ms → `focus/` (employé par T4 : rail, T7 : réglages) — DÉPLACÉ (f56e83f30) ; la règle est dans tv-core `focus/restoreClaim` mais l'applicateur garde SA copie (constante en double) — pas encore branché

#### `platform/tvos/focus/entryGuide.tsx`
- L2, 72, 75–78, 81 · TVFocusGuideView, destinations, focusable, trapFocusLeft/Right · **MIXTE** · guide natif (ADAPTATEUR) ; la visée — dernier visité, sinon l'entrée par défaut, `remember`, pièges latéraux — est une règle (EXTRAIRE `focus/`) — DÉPLACÉ (f56e83f30) ; la visée a sa règle dans tv-core `focus/groupEntry`, pas encore branchée

#### `platform/tvos/focus/focusGuides.tsx`
- L1, 18, 20, 30–35, 40 · TVFocusGuideView, autoFocus, trapFocus* · **ADAPTATEUR** · guides génériques : mémoire, piège — DÉPLACÉ (f56e83f30)

#### `platform/tvos/focus/focusLocks.ts`
- L14, 16, 20 · isTVSelectable, setNativeProps · **ADAPTATEUR** · verrou d'une cible, par la liaison et par le nœud — DÉPLACÉ (f56e83f30)

#### `platform/tvos/focus/focusStore.ts`
- L2, 72, 73, 130, 152, 162, 163 · findNodeHandle, setNativeProps, requestTVFocus · **ADAPTATEUR** · nœuds natifs, réclamation (`claimTvFocus`), focus immédiat — DÉPLACÉ (f56e83f30) ; le suivi courant / dernier a sa règle dans tv-core `focus/focusTrack`
- L119, 120 · onFocus/onBlur (observation) · **MIXTE** · le magasin (clés, courant, dernier, réclamations en attente, abonnés) est pur → `focus/` ; la forme → effets natifs (L114 : parallaxe, voisinage) reste à l'adaptateur — DÉPLACÉ (f56e83f30) ; le suivi courant / dernier a sa règle dans tv-core `focus/focusTrack`

#### `platform/tvos/focus/sectionEntry.ts`
- L18, 22 · setNativeProps(tvEntry) · **ADAPTATEUR** · entrée déclarée d'une section — DÉPLACÉ et branché sur tv-core `focus/sectionEntry` (f56e83f30)

#### `platform/tvos/focus/useBeyondEdge.ts`
- L3, 37, 42, 56, 58 · useRemoteEvents, isGestureToward · **EXTRAIRE** · « au-delà du bord » : un geste vers une direction sans issue, focus posé depuis `SETTLE_MS` = 400 ms, appuis longs exclus → `focus/` (seul usage : le héros de l'accueil, T7) — DÉPLACÉ (f56e83f30) ; règle dans tv-core `focus/beyondEdge`, pas encore branchée : `SETTLE_MS` en double

#### `platform/tvos/focus/useEntryFocus.ts`
- L2, 21, 91 · hasTVPreferredFocus, useFocusEffect · **MIXTE** · préférence pendant l'arrivée, clôture au 1er focus de contenu ou au rail après `USER_RAIL_AFTER_MS` = 600 ms, retour → dernier contenu sinon l'entrée = règle (EXTRAIRE `focus/`) ; `hasTVPreferredFocus` et la réclamation = ADAPTATEUR ; `useFocusEffect` = événement de pile (reste) — DÉPLACÉ (f56e83f30) ; règle dans tv-core `focus/screenEntry` (spec miroir), pas encore branchée : `USER_RAIL_AFTER_MS` reste dans l'adaptateur

#### `platform/tvos/focus/useKeepFocusWithin.ts`
- L22, 33 · setTimeout · **EXTRAIRE** · garder le focus dans une surface : sortie confirmée après `LEAVE_CHECK_MS` = 50 ms, reprise sur la dernière clé → `focus/` (le voile hors ligne, T7) — DÉPLACÉ (f56e83f30) ; règle dans tv-core `focus/keepWithin`, pas encore branchée : `LEAVE_CHECK_MS` reste dans l'adaptateur

#### `redesign/focus/focusBinding.tsx`
- L42, 43 · onFocus/onBlur (types du port) · **VUE** · le contrat du port du focus

#### `redesign/focus/focusPreview.tsx`
- L35, 36, 47, 48, 51 · onFocus/onBlur · **VUE** · état visuel du focus : natif dans l'app, figé au banc

#### `redesign/focus/FocusSection.tsx` — garde : `no-native-focus-calls`
- L5, 56, 64, 79 · NativeFocusSection · **ADAPTATEUR** · la porte des vues vers la section native `TentacleFocusSection` (raté par le relevé : `{...binding?.native}` L66) ; `reveal` est déclaratif (VUE)

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

#### `redesignWiring/home/HomeRedesign.tsx`
- L144 · onHeroLongPress · **VUE** · branchement de prop (la décision est dans useHomeHero.ts:124)

#### `redesignWiring/home/useHeroRotation.ts`
- L5, 57, 63, 80 · useRemoteEvents, setTimeout · **EXTRAIRE** · rotation du héros toutes les 8 s (16 s en mouvement réduit) ; tout geste ou un pas du focus relance l'attente, un appui maintenu la suspend ; seulement héros affiché, app active, ≥ 2 titres

#### `redesignWiring/home/useHomeHero.ts`
- L4, 66 · useIsFocused · **RESTE** · « écran devant » (pile) : alimente la rotation et le geste au-delà du bord
- L11, 130 · useBeyondEdge · **EXTRAIRE** · DROITE au-delà du dernier bouton du héros (≥ 2 titres, écran devant) → titre suivant, en boucle ; le focus ne bouge pas
- L40, 124, 137 · onLongPress · **EXTRAIRE** · appui maintenu sur un bouton → panneau du titre AFFICHÉ, en paysage pour une reprise, sinon affiche

## T4 — Retour, rail, menus

> Fait (5a12cb255) : l'applicateur du Retour (`platform/tvos/back/`), règles dans tv-core `nav/`, Menu des Modals par l'entrée unique ; `nav/arrange` et `railKeys` (dbd9ad386). Reste : la croix Retour (`backFocus`), les ponts et raccourcis du rail, le repli du rail, `gestureEnabled`, l'aperçu et la fenêtre des demandes (arbitrage).
>
> 18 fichiers.

#### `components/focus/MenuPressInterceptor.ios.tsx` — garde : `no-native-focus-calls`
- L1, 6, 22 · requireNativeComponent (TVMenuPressInterceptor) · **ADAPTATEUR** · la vue native qui prend Menu → `platform/tvos/back/` (signal `menu` de la table tvOS)

#### `navigation/AppNavigator.tsx` — partagé Android TV
- L10, 103, 107 · BackScope · **RESTE** · pose la portée du Retour autour de chaque écran (`screenLayout`)
- L92 · gestureEnabled: !REDESIGN_ACTIVE · **ADAPTATEUR** · Menu ne dépile jamais un écran de lui-même (react-native-screens) — c'est le fait `backDecidedAhead` de la table tvOS
- L120 · usePreventRemove (commentaire JSX) · **HORS** · faux positif du relevé

#### `platform/tvos/back/BackScope.tsx`
- L4, 62, 64 · MenuPressInterceptor · **ADAPTATEUR** · FAIT (5a12cb255) : l'applicateur du Retour monte la vue native ; `enabled` = `takesBack` (tv-core)
- L34, 44, 54 · canGoBack, goBack · **ADAPTATEUR** · FAIT : applique `isPushedPage` (tv-core) — sans couche, une page poussée recule

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

#### `redesignWiring/focus/backFocus.tsx` — garde : `no-focus-guides`, `no-focus-props`, `no-native-focus-calls`
- L2, 148, 151, 152, 155 · TVFocusGuideView, destinations, focusable · **ADAPTATEUR** · guide de la bande de la croix Retour
- L51, 98 · setNativeProps(nextFocusDown) · **ADAPTATEUR** · BAS depuis la croix
- L53–112 · décision de la croix · **EXTRAIRE** · jamais l'entrée sauf seule action, reverrouillée à chaque arrivée ; bande armée seulement croix libre et hors rail ; BAS → dernière cible de contenu sinon l'entrée → `focus/` (T3 pour le guide générique)

#### `redesignWiring/nav/NavMenuModal.tsx`
- L50 · FadingModal onRequestClose={withMenuIntent(closeMenu)} · **ADAPTATEUR** · FAIT (5a12cb255) : Menu dans le menu d'organisation passe par l'entrée unique (`withMenuIntent`) → `closeMenu` (couche « menu »)

#### `redesignWiring/nav/useRailState.ts`
- L37, 48 · setTimeout · **EXTRAIRE** · repli du rail : attendre `COLLAPSE_DELAY_MS` = 30 ms que le focus se pose ; focus hors de l'écran (une Modal) → la barre reste ouverte → `nav/`
- L91, 143 · onLongPress · **RESTE** · l'appui long d'une entrée ouvre le menu d'organisation (`useRailArrange`)

#### `redesignWiring/player/usePlayerBackLayers.ts`
- L2, 41–43, 49, 50 · `useBackLayer` · **EXTRAIRE** · couches du Retour du lecteur : menu (état transitoire → routeBack ; feuille ; épisodes) > surimpression (masquer + désépingler) > page (quitter) ; le registre est déjà dans tv-core (`createBackLayers`)

#### `redesignWiring/screen/RailBridges.tsx` — garde : `no-focus-guides`, `no-platform-branch`
- L2, 40, 48, 51 · TVFocusGuideView, destinations, Platform.OS · **MIXTE** · guides natifs (ADAPTATEUR) ; quel pont, vers quoi (l'entrée active ; le dernier contenu, sinon l'entrée) = règle (EXTRAIRE `nav/`)

#### `redesignWiring/screen/RailShortcuts.tsx` — garde : `no-focus-guides`, `no-platform-branch`
- L2, 58, 72, 78–80 · TVFocusGuideView, setTimeout, Platform.OS · **MIXTE** · guides (ADAPTATEUR) ; boucle HAUT/BAS profil ↔ Rechercher, GAUCHE → profil armé après `ARM_AFTER_MS` = 450 ms, ou 1 100 ms au sortir d'une rafale (`STREAM_MS` = 350) = règle (EXTRAIRE `nav/`)

#### `redesignWiring/screen/useRailBackLayers.ts`
- L5, 38–41 · useBackLayer · **DÉJÀ** · la règle est dans tv-core (`railBackStep`, `createBackLayers`) ; les inscriptions restent au câblage

#### `redesignWiring/screen/useRedesignScreen.ts`
- L94, 110, 111 · onLongPress (relais du rail) · **RESTE** · câblage de la vue du rail

#### `redesignWiring/vigie/RequestsPanel.tsx`
- L9, 47 · `useBackLayer("menu", !closing, requestClose)` · **EXTRAIRE** · couche « menu » de « Mes demandes »
- L59 · `Modal … onRequestClose={withMenuIntent(requestClose)}` · **ADAPTATEUR** · Modal native toujours présentée ; son Menu passe déjà par l'entrée unique (T4, 5a12cb255)

## T5 — le lecteur

> Beaucoup de fichiers PARTAGÉS avec Android TV : on ne les amincit sur tv-core qu'avec le banc de traces (`apps/tv/harness/player-trace/`, `nav-golden/scenarios/lecteur/traces/`). L'abonnement principal du lecteur passe encore par `useTVRemote` (annexe A).
>
> 19 fichiers.

#### `components/focus/useTVRemote.ts` — partagé Android TV
- L3, 6, 7, 55, 81, 109, 111 · useTVEventHandler, useIsFocused, longLeft/longRight · **MIXTE** · hook de l'ancienne UI, TOUJOURS sur le chemin refondu : l'abonnement principal du lecteur (`useTVPlayerControls`, T5) et l'atterrissage de la recherche (`useSearchSubmit`, T7) — un 2ᵉ abonnement natif et une 2ᵉ traduction tvOS, hors de l'entrée unique ; les deux doivent passer aux intentions (`useRemoteIntents`), le hook reste à Android TV
- L91 · select/longSelect (journal `debugTag`) · **HORS** · diagnostic marqué « À RETIRER »
- L2, 70, 71, 100, 138 · BackHandler, Platform.OS android · **ANCIENNE** · branches Android seulement

#### `components/player/focus/osdFocusBus.ts` — partagé Android TV
- L107, 108 · `BACKGROUND_FOCUS` onFocus/onBlur · **MIXTE** · observe le focus natif du fond (application) ; la décision est lue ailleurs : ←/→ ne saute que fond focalisé et habillage caché (useScrubController.ts:240)

#### `components/player/focus/overlayFocusCore.ts` — partagé Android TV
- L21, 216, 226, 228, 234, 238 · onFocus des boutons · **EXTRAIRE** · mémoire du dernier bouton de l'habillage, gelée pendant la restauration et le défilement — la seule partie de `buttonProps` lue sur tvOS (usePlayerFocus.ts:130)
- L153, 159, 168 · setTimeout 220 / 520 ms · **MIXTE** · cible (demandée > dernier bouton > lecture/pause), cession à la pilule (fenêtre de 200 ms, `skipHoldsFocus`) = règle ; 220 ms imposés par le natif (panneau pas encore démonté) et gel de 520 ms = application ; `restore` est déjà injecté
- L18 · type `FocusNode { setNativeProps }` · **ADAPTATEUR** · contrat du nœud natif passé à `restore`
- L22, 109 · préférence initiale + `setTimeout(…, 0)` · **ANCIENNE** · jamais posée sur tvOS refondu (qui ne lit que `onFocus`) : Android seulement
- L23–26, 229, 230, 239 · `nextFocus*` · **ANCIENNE** · voisins, verrou de défilement, montée vers la pilule : jamais appliqués sur tvOS refondu
- L2, 89, 127, 209 · `findNodeHandle`, `queueMicrotask` · **ANCIENNE** · handles pour les seuls `nextFocus*` — exécutés sur tvOS sans usage (bug 8)

#### `components/player/focus/useOverlayFocus.ios.ts` — garde : `no-focus-props`, `no-native-focus-calls`
- L32–35, 39 · `setNativeProps({ hasTVPreferredFocus })` faux→vrai→faux, setTimeout 50 / 120 ms · **ADAPTATEUR** · primitive native de prise de focus (RN-tvos #849), doublon de `claimTvFocus` (bug 3)

#### `components/player/focus/useSkipPillFocus.ts` — partagé Android TV
- L6, 92, 93 · onFocus/onBlur de Passer / Masquer · **EXTRAIRE** · qui tient le focus dans la pilule, publié sur le bus : cession de la restauration implicite, relais quand le bouton disparaît

#### `hooks/scrubCountdown.ts` — partagé Android TV
- L31, 37, 38, 88 · minuteurs injectables (`CountdownTimers`, `REAL_TIMERS`) · **EXTRAIRE** · décompte de reprise du défilement (5 s, suspendu pendant un geste continu) — déjà pur, prêt à migrer

#### `hooks/useScrubGestures.ios.ts` — garde : `no-remote-events`
- L10, 11, 125 · `useTVEventHandler` · **ADAPTATEUR** · abonnement natif DIRECT à la télécommande, hors de l'entrée unique (annexe A) : il passe à `useRemoteIntents` (T1)
- L126 · `eventType === "pan"` + `body` · **EXTRAIRE** · traduction tvOS du pan (state, x, y, velocityX) en geste du pavé — la table `TVOS_BINDINGS` la porte déjà ; la garde `enabled` (panneau ouvert) relève de T5
- L68, 69, 97, 157 · setTimeout silence 450 ms / regroupement 33 ms · **EXTRAIRE** · machine pan → défilement : un pan annulé se clôt sur silence, les pas sont regroupés (minuteurs à injecter)

#### `hooks/useTVEpisodeNav.ts` — partagé Android TV
- L37 · setTimeout(…, 0) + `navigation.replace` · **MIXTE** · ouvrir l'épisode (arrêt signalé, invalidations, lecteur remplacé) = règle ; replace différé d'un tick pour passer `usePreventRemove`, sans objet sur tvOS refondu

#### `hooks/useTVPlaybackLifecycle.ts` — partagé Android TV
- L75 · `navigation.goBack` (leavePlayer) · **MIXTE** · garde contre la double sortie (`exitingRef`) et arrêt signalé = règle ; goBack = application
- L83 · `navigation.goBack` (handleFinished) · **MIXTE** · T7 · en fin de série, la fiche de la série (replace) sauf lecteur lancé depuis une fiche, sinon reculer

#### `hooks/useTVPlaybackPresence.ts` — partagé Android TV
- L85 · setTimeout ×3 (400 / 1 500 / 3 000 ms) · **MIXTE** · focus sur Lecture au retour au premier plan (`presenceStep.focusPlay`, déjà dans tv-core) ; signal répété parce que la scène UIKit se réattache lentement (bug 2)

#### `hooks/useTVPlayerBack.ts` — partagé Android TV
- L88, 93 · setTimeout BACK_GRACE_MS 600 · **EXTRAIRE** · fenêtre de grâce après un Retour consommé (le double appui est avalé), active sur tvOS via la couche « menu » (`back.transient`)
- L2, 126 · `usePreventRemove` · **ANCIENNE** · T4 · coupé sur tvOS refondu (`holdsSystemBack: false`)

#### `hooks/useTVPlayerControls.ts` — partagé Android TV
- L87, 103 · setTimeout OVERLAY_HIDE_MS 5 s · **EXTRAIRE** · masquage automatique de l'habillage hors pause et hors panneau : rend le fond focalisable, retire la couche « surimpression » ; raté : L2, 218-275 `useTVRemote({…})` = l'abonnement principal du lecteur et toute sa traduction (fenêtres `SCRUB_TWIN_PRESS_MS` 400, `MEDIA_KEY_ECHO_MS` 300, `TOUCH_AFTER_PRESS_MS` 600, `guardScrub`)

#### `redesign/screens/player/PlayerChromeView.tsx`
- L112, 136 · `onPanelExited` (useExit « handoff ») · **VUE** · rappel de fin du fondu d'un panneau ; raté : L130, 168 `pointerEvents={chrome ? "box-none" : "none"}` rend l'habillage caché infocalisable sur tvOS — une décision de focus PRISE DANS LA VUE

#### `redesignWiring/player/endExitLock.ts` — garde : `no-focus-props`
- L33 · `native: { isTVSelectable: false }` · **ADAPTATEUR** · prop native de la croix verrouillée ; la décision (verrou jusqu'au 1er focus de l'entrée) est dans `useExitLocked` L12-25, commune à toutes les croix

#### `redesignWiring/player/playerFocusContainers.tsx` — garde : `no-focus-guides`, `no-focus-props`
- L2, 95–103, 108, 140–144, 149 · `TVFocusGuideView` (ScreenTrap, BridgeGuide), `trapFocus*`, `focusable={…? undefined : false}` · **ADAPTATEUR** · guides natifs (piège 4 directions, pont) ; `focusable={false}` contourne RN-tvos (un guide sans destination devenait focalisable)
- L60, 64, 66 · `useStoreDestination` · **ADAPTATEUR** · clé → nœud natif du magasin, relu après chaque rendu (bug 11)
- L75, 84 · `useLiveDestination` · **MIXTE** · la 1re clé montée d'une liste ordonnée, jamais un nœud parti (règle) ; abonnement aux montages (application)
- L116, 123, 130 · destinations d'entrée · **EXTRAIRE** · entrée d'un écran qui couvre la vidéo : chargement → « Réessayer » sinon la croix ; fin → « Lire maintenant » ; message-outil → « Réessayer maintenant »
- L169 · destinations de la frise · **EXTRAIRE** · sens du pont lu sur le focus : depuis Retour → lecture/pause ; sinon → la pilule de saut, à défaut Retour
- L192, 194 · `TVFocusGuideView autoFocus trapFocusLeft/Right` · **ADAPTATEUR** · mémoire et piège de l'îlot (la décision `islandTrap` est dans usePlayerFocus.ts:174)
- L195–197 · guides de sortie de l'îlot · **MIXTE** · BAS → lecture/pause, HAUT et GAUCHE → Retour, habillage visible et focus dans l'îlot (règle) ; guides positionnés (application)
- L215 · destinations du pont du message-outil · **EXTRAIRE** · depuis la croix → « Réessayer » ; sinon → la croix
- L220, 226, 232, 237 · destinations de l'en-tête, des marges, des saisons · **EXTRAIRE** · en-tête des épisodes et marges Pistes / Réglages → leur croix ; bande des saisons → saison affichée

#### `redesignWiring/player/PlayerRedesignStage.tsx` — garde : `no-native-press`, `no-focus-props`
- L1, 70, 82 · `TouchableOpacity` du fond · **ADAPTATEUR** · vue native focalisable plein écran ; OK réveille l'habillage
- L76, 77 · `hasTVPreferredFocus` / `focusable` = backgroundFocusable · **MIXTE** · le fond n'est focalisable que chargement fini, habillage caché et rien par-dessus (règle) ; `focusable` est INERTE sur tvOS (ancienne architecture) : c'est `accessible` (L78) qui pose `isTVSelectable` (bug 6)
- L85 · `onPanelExited={focus.onPanelExited}` · **VUE** · branche le rappel de la vue

#### `redesignWiring/player/usePlaybackTrouble.ts` — garde : `no-remote-events`
- L12, 13, 71 · `useTVEventHandler` · **ADAPTATEUR** · T1 · abonnement natif DIRECT (hors du bus)
- L23 · `GESTURES` (select, playPause, flèches, longSelect) · **EXTRAIRE** · quels événements comptent pour « un appui » (pas le pan) ; règle T5 : le 1er appui active le panneau (bug 5)
- L35, 107 · setTimeout (useUntil) / setInterval 1 s · **HORS** · échéances d'affichage, décompte « nouvelle vérification »
- L137 · setTimeout 120 ms + `store.claim` · **MIXTE** · panneau actif mais focus sorti après réordonnancement → rendre le focus à « Réessayer » (règle) ; délai UIKit et réclamation (application) — bug 4

#### `redesignWiring/player/usePlayerFocus.ts` — garde : `no-focus-props`
- L130 · onFocus des clés de l'habillage · **EXTRAIRE** · mémoire du dernier bouton (table pure `OSD_KEYS`, L32-43)
- L142, 143 · onFocus/onBlur de la pilule · **EXTRAIRE** · qui tient le focus de la pilule (cession, relais)
- L162 · `native: { hasTVPreferredFocus }` · **MIXTE** · `preferredFocus` L187-200 : Masquer si le passage part seul, sinon Passer ; Retour ou Réessayer selon l'échec ; carte, affiche, entrée de feuille (règle) ; prop native (application)
- L89, 170, 179 · `onPanelExited` (usePanelReturnFocus) · **MIXTE** · rendre le focus au bouton qui a ouvert le dernier panneau, en fin de fondu, habillage visible (règle) ; `store.focusNow` → `requestTVFocus` (application)

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

> Entrées, croix et retours d'étape, héros (rotation, au-delà du bord), bande-annonce, recherche et clavier système. Les vues de `redesign/screens/` ne font que déclarer (`FocusSection`, rappels) — deux exceptions relevées : `PairingField` (`.focus()`) et le repli de `LibraryView`.
>
> 35 fichiers.

#### `components/search/searchBarReturn.ts` — partagé Android TV
- L31 · navigationRef.goBack · **MIXTE** · tourne sur tvOS (le rail l'appelle, useRailState.ts:132 ; la barre s'inscrit, useSystemKeyboard.ts:75) : « Rechercher » choisi de nouveau → sur Parcourir, reculer ; sur la recherche, viser la barre (règle) ; getCurrentRoute/goBack (application) — bug 1

#### `components/search/useSearchSubmit.ts` — partagé Android TV
- L39, 77 · setTimeout KEYBOARD_GONE_MS · **EXTRAIRE** · tout le crochet tourne sur tvOS (useSystemKeyboard.ts:44) : clavier réputé parti quand la barre reprend le focus ou 800 ms après sa fermeture ; atterrir sur le 1er résultat si la réponse est là (≤ 3 s, `searchSubmitAnswer`) ; une fermeture plus d'1 s après la validation vaut Menu → 1re touche (L72). Raté : `useTVRemote({ onAnyPress })` L85-89 = un abonnement natif HORS du bus (bug 5), `claimTvFocus` L49

#### `hooks/usePairingFlow.ts` — partagé Android TV
- L66, 93 · setTimeout SUCCESS_DELAY_MS · **EXTRAIRE** · après un jumelage réussi, le passage à l'accueil (`replace("Home")`) attend 2 s
- L104 · setTimeout(abort) · **HORS** · borne réseau de /api/health

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
- L7, 76, 86, 127, 132 · onLongPress, FocusSection · **VUE** · 1re ligne « start », les autres « nearest » (déclaratif)

#### `redesign/screens/pairing/PairingField.tsx` — garde : `no-native-press`
- L65, 66 · TextInput.blur()/focus() · **ADAPTATEUR** · une VUE ouvre le clavier système sur le champ natif caché (blur d'abord pour oublier un focus périmé)

#### `redesign/screens/search/SearchDiscover.tsx`
- L5, 47, 60, 63, 76 · FocusSection · **VUE** · sections déclaratives

#### `redesign/screens/search/SearchResults.tsx`
- L6, 83, 92, 96, 98, 102, 115, 119, 132 · FocusSection · **VUE** · sections déclaratives

#### `redesign/screens/settings/SettingsView.tsx`
- L9, 159, 192 · FocusSection list · **VUE** · liste de lignes, déclarative

#### `redesign/screens/shared/useForcedFocusReveal.ts`
- L66 · scrollTo · **VUE** · sert seulement au banc, inerte dans l'app (bug 11)

#### `redesignWiring/browse/BrowseRedesign.tsx`
- L49, 112 · navigation.goBack · **MIXTE** · la croix recule d'un écran (règle) ; goBack (application)
- L73 · onReselect: goBack · **ANCIENNE** · inerte : `returnToSearchBar` intercepte « Search » avant (useRailState.ts:132) — bug 2

#### `redesignWiring/detail/useDetailActions.ts`
- L125 · goBack · **MIXTE** · la croix de la fiche recule d'une page (la suite de fiches n'en laisse qu'une)

#### `redesignWiring/detail/useDetailGuides.ts` — garde : `no-focus-guides`
- L24 · FocusExtras native {trapFocusLeft/Right} · **MIXTE** · aux bouts des rangées de la fiche, GAUCHE et DROITE ne sortent pas (règle) ; props natives posées par `focus.bind` (L38) ; entrées déclarées L49-58 (`useSectionEntry` → `tvEntry`) : saisons → onglet affiché, épisodes → épisode à reprendre

#### `redesignWiring/detail/useOpenDetail.ts`
- L59 · nav.goBack · **ADAPTATEUR** · applique le verdict « back » de `detailMove` (règle déjà dans tv-core `nav/detailChain`)

#### `redesignWiring/library/useLibrarySheets.ts`
- L5, 118 · `useBackLayer("menu", open !== null, closeSheet)` · **EXTRAIRE** · couche « menu » tant qu'une liste de filtres est ouverte ; Retour la referme (pile de T4)

#### `redesignWiring/pairing/loginFocus.ts`
- L28 · setTimeout RESTORE_WINDOW_MS · **EXTRAIRE** · connexion refusée : si tvOS rend le focus à l'identifiant dans les 1,2 s, on le rend une fois au mot de passe

#### `redesignWiring/pairing/PairingRedesign.tsx`
- L11, 101 · useBackLayer("page") · **EXTRAIRE** · Menu recule d'une étape (`exitOf`, L27-39) : code relais/serveur → accueil, identifiants → serveur, code serveur → identifiants ; rien sur l'accueil ni sur le succès

#### `redesignWiring/search/useSystemKeyboard.ts` — garde : `no-native-press`, `no-native-focus-calls`
- L39, 52, 54, 55 · TextInput.focus(), setNativeProps · **ADAPTATEUR** · L39 ouvre le clavier système ; L52-55 : faux nœud qui relaie la réclamation de useSearchSubmit vers le 1er résultat (bug 6)
- L69, 83, 88 · setTimeout · **EXTRAIRE** · viser la barre : 2ᵉ réclamation à 400 ms (tvOS rend d'abord sa dernière cible) ; au retour d'une étagère, chaque fin de transition pendant 1,5 s réclame la barre

#### `redesignWiring/settings/ChoiceModal.tsx`
- L5, 31 · `useBackLayer("menu", list !== null, onClose)` · **EXTRAIRE** · couche « menu » tant que la liste de choix est ouverte
- L33 · `FadingModal onRequestClose={onClose}` · **ADAPTATEUR** · Modal native : piège le focus, reçoit Menu (`onRequestClose` = signal `menu`)

#### `redesignWiring/settings/settingsFocus.tsx` — garde : `no-focus-guides`
- L2, 26, 28, 30 · TVFocusGuideView destinations · **ADAPTATEUR** · guide natif de la colonne d'onglets ; la destination (l'onglet AFFICHÉ) est décidée par `useActiveTabDestination` ; `useChoiceEntry` n'est plus ici qu'un réexport de `platform/tvos/panels` (T6, e4279f28c)

#### `redesignWiring/settings/SettingsRedesign.tsx`
- L10, 39 · useBackLayer("menu") · **EXTRAIRE** · Retour annule d'abord un déplacement d'entrée en cours dans l'onglet Navigation

#### `redesignWiring/trailer/TrailerRedesign.tsx` — garde : `no-focus-props`
- L3, 64 · useIsFocused · **RESTE** · « écran devant » (garde de L69 et L73)
- L12, 69, 73 · useRemoteEvents, setTimeout · **EXTRAIRE** · tout geste rallume le chrome ; vidéo indisponible → retour seul à la fiche après 4 s, écran devant
- L41, 65 · native {hasTVPreferredFocus}, goBack · **MIXTE** · la croix est l'entrée (seule action) ; croix, fin et indisponibilité reculent (règle) ; prop native via un binder ad hoc (bug 8), puis goBack

#### `redesignWiring/trailer/useIdleChrome.ts`
- L13, 19 · setTimeout IDLE_MS · **EXTRAIRE** · en lecture seulement, le chrome s'estompe après 3 s sans geste (réveil : TrailerRedesign.tsx:69) — même machine que l'habillage du lecteur, à aligner avec T5

#### `redesignWiring/vigie/useTitleRequests.tsx`
- L170 · `setTimeout(open, MODAL_GAP_MS)` (320 ms) · **MIXTE** · « Demander » depuis le grand panneau ferme le panneau puis rejoue OK (règle) ; les 320 ms viennent d'UIKit (une Modal présentée pendant le retrait d'une autre ne paraît pas) → paramètre de l'adaptateur

## Pas concernés — hors navigation, ancienne UI, props inertes

82 fichiers sur le chemin, sans rien à extraire : réseau, stockage, moteur vidéo, rendu, corps `Legacy*` des aiguillages, branches Android, props sans effet sur tvOS. `⇄` : partagé avec Android TV.

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
| `hooks/useScrubHoldMotor.ts` ⇄ | 104, 118 | setTimeout(holdArmMs) | ANCIENNE | armement après l'appui long natif : jamais armé sur tvOS (`holdArmMs` = 0) ; Android : 250 ms |
| `hooks/useScrubHoldMotor.ts` ⇄ | 126, 135 | setTimeout 400 / 550 ms | ANCIENNE | maintien déduit d'un key-down sans key-up : faux sur tvOS (useScrubController.ts:257) |
| `hooks/useSeasonEpisodes.ts` ⇄ | 2, 26 | InteractionManager | HORS | préchargement réseau des saisons |
| `hooks/useServerReachable.ts` ⇄ | 32, 36, 46, 79, 120 | setTimeout/setInterval | HORS | joignabilité du serveur |
| `hooks/useSessionMessages.ts` ⇄ | 34, 56 | setTimeout | HORS | échéance des messages de l'administrateur |
| `hooks/useSkipFlash.ts` ⇄ | 16, 25 | setTimeout 1,5 s | HORS | durée et cumul du badge « ±N s » (le saut part sans attendre) |
| `hooks/useStartupRecovery.ts` ⇄ | 34, 41 | setTimeout | HORS | sondes de reprise de l'ouverture |
| `hooks/useStartupWait.ts` ⇄ | 120 | setInterval | HORS | surveillance de l'ouverture du transcodage |
| `hooks/useStoredToken.ts` ⇄ | 20 | setInterval | HORS | relecture du jeton |
| `hooks/useTVPanelControls.ts` ⇄ | 2, 18 | type `TouchableOpacity` (backgroundRef) | ANCIENNE | ne sert qu'à useFocusRecovery (Android) |
| `hooks/useTVPanelControls.ts` ⇄ | 4, 63 | `usePreventRemove` | ANCIENNE | coupé sur tvOS refondu (`holdsSystemBack: !REDESIGN_ACTIVE`) : là, le panneau est une couche de BackScope |
| `hooks/useTVPlaybackMarker.ts` ⇄ | 46 | setInterval 30 s | HORS | marqueur de relance à froid |
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
| `redesignWiring/library/useLibraryPrefetch.ts` | 37, 53 | setTimeout 300 ms | HORS | préchargement quand le focus s'arrête sur une bibliothèque du rail (données) |
| `redesignWiring/overlays/transientNotice.ts` | 21, 34 | setTimeout | HORS | échéance d'un avis bref, jamais focalisable |
| `redesignWiring/player/usePlayerEpisodesPanel.ts` | 87, 92 | setTimeout INTENT_MS 200 | HORS | précharge une saison quand le focus s'y attarde (données) |
| `redesignWiring/remote/parallax.ts` | 29, 61, 64, 65 | Platform.OS, tvParallaxProperties | HORS | RENDU (docs/tv-navigation/remote.md) : l'inclinaison au pouce par forme, coupée au mouvement réduit ; elle reste dans `redesignWiring/remote/` — exception permanente de la garde |
| `redesignWiring/search/useSearchInput.ts` | 19 | setTimeout DEBOUNCE_MS | HORS | debounce de la recherche |
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
| `screens/trailer/TrailerWebView.ios.tsx` | 96 | focusable={false} | ANCIENNE | le fichier tourne sur tvOS, mais la prop n'existe que sur Android dans react-native-video 6.19.3 : INERTE (bug 7) — exception PERMANENTE de la garde (arbitrage : gardé tel quel) |
| `screens/trailer/useTrailerPlaybackWatch.ts` | 53, 92, 95, 96 | setTimeout | HORS | chien de garde du flux ; ses verdicts ne deviennent un retour que dans TrailerRedesign |
| `screens/trailer/useTrailerPreparation.ios.ts` | 24 | setTimeout 300 ms | HORS | préchauffage serveur de la bande-annonce |
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

L'entrée unique (`platform/tvos/input/`) devait porter le SEUL abonnement à
`TVEventHandler` du chemin refondu. Quatre lui échappent encore :

| Abonnement | Par où il tourne sur tvOS | Tâche | Garde |
|---|---|---|---|
| `hooks/useScrubGestures.ios.ts:125` — `useTVEventHandler` direct (`pan`) | le défilement au pavé du lecteur | T5 | `no-remote-events` |
| `redesignWiring/player/usePlaybackTrouble.ts:71` — `useTVEventHandler` direct | l'activation du panneau de panne | T5 | `no-remote-events` |
| `components/focus/useTVRemote.ts:81` ⇄ | `hooks/useTVPlayerControls.ts:218-275` (l'abonnement PRINCIPAL du lecteur, T5) et `components/search/useSearchSubmit.ts:85-89` (l'atterrissage de la recherche, T7) | T5, T7 | hors portée (partagé) |
| `hooks/useContentFocusCapture.ts:101` ⇄ | `components/nav/TVNavChrome.tsx`, l'ancien rail, MONTÉ par `App.tsx` sur tvOS alors qu'il n'y rend rien : un abonnement à vide toute la session | T4 | hors portée (ancienne UI) |

## Annexe B — les écouteurs de l'API d'avant (`remoteEvents.ts`)

L'API d'avant lit maintenant l'entrée unique ; ses écouteurs passent aux
intentions (`useRemoteIntents`, `useRemoteContext`) :

- `platform/tvos/focus/useBeyondEdge.ts:56` — « au-delà du bord » (T3, déplacé ; seul usage : `redesignWiring/home/useHomeHero.ts:130`) ;
- `redesignWiring/home/useHeroRotation.ts:80` — tout geste relance la rotation, un maintien la suspend (T3, arbitrage ; règle : tv-core `hero/rotation`) ;
- `redesignWiring/trailer/TrailerRedesign.tsx:69` — tout geste rallume le chrome (T7) ;
- ~~`redesignWiring/vigie/SeasonsSheetRedesign.tsx`~~ — FAIT (00880373c) : Lecture/Pause passe par `useRemoteContext` (contexte « panneau »).

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
| `redesignWiring/browse/BrowseRedesign.tsx` | 78, 89, 94 | T7 |
| `redesignWiring/detail/MediaDetailRedesign.tsx` | 78, 79, 89 | T7 |
| `redesignWiring/detail/useDetailGuides.ts` | 38, 57, 58 | T7 |
| `redesignWiring/library/LibraryRedesign.tsx` | 83, 86, 110 | T7 |
| `redesignWiring/library/useLibraryFilterBar.ts` | 40, 46 | T7 |
| `redesignWiring/library/useLibrarySheets.ts` | 91, 94, 115 | T7 |
| `redesignWiring/nav/NavMenuModal.tsx` | 30 | T4 |
| `redesignWiring/nav/useRailArrange.ts` | 117, 173, 204 | T4 |
| `redesignWiring/nav/useRailState.ts` | 129 | T4 |
| `redesignWiring/overlays/OfflineRedesign.tsx` | 43, 44 | T6 |
| `redesignWiring/overlays/ScreenErrorRedesign.tsx` | 50, 61, 62, 74 | T6 |
| `redesignWiring/pairing/loginFocus.ts` | 26 | T7 |
| `redesignWiring/pairing/PairingRedesign.tsx` | 86, 87, 91, 94, 95 | T7 |
| `redesignWiring/player/usePanelReturnFocus.ts` | 42 | T5 |
| `redesignWiring/player/usePlaybackTrouble.ts` | 82, 138 | T5 |
| `redesignWiring/player/usePlayerEpisodesPanel.ts` | 79 | T5 |
| `redesignWiring/player/usePlayerFocus.ts` | 85, 131 | T5 |
| `redesignWiring/screen/useRailBackLayers.ts` | 34 | T4 |
| `redesignWiring/screen/useRedesignScreen.ts` | 69, 75, 80, 91 | T4 |
| `redesignWiring/search/SearchRedesign.tsx` | 53, 54 | T7 |
| `redesignWiring/search/useSystemKeyboard.ts` | 42, 68, 69 | T7 |
| `redesignWiring/settings/ChoiceModal.tsx` | 26 | T7 |
| `redesignWiring/settings/settingsFocus.tsx` | 45, 46 | T7 |
| `redesignWiring/settings/useNavigationSettings.ts` | 53, 55, 56, 111, 120, 124 | T7 |
| `redesignWiring/sheet/ActionSheetRedesign.tsx` | 84 | T6 |
| `redesignWiring/vigie/AbsentSheetRedesign.tsx` | 105 | T6 |
| `redesignWiring/vigie/RequestsEntry.tsx` | 41, 42 | T4 |
| `redesignWiring/vigie/RequestsPanel.tsx` | 54, 86, 91 | T4 |
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
- `redesignWiring/focus/backFocus.tsx:53-112` — la décision de la croix Retour (jamais l'entrée sauf seule action ; bande armée hors rail ; BAS → dernier contenu, sinon l'entrée).

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

Relevés à la lecture, pour mémoire : aucun n'est corrigé dans ce lot. « À
vérifier » : déduit du code, pas reproduit.

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

## Annexe G — partagés avec Android TV qui portent une décision

Ceux-là ne s'amincissent sur tv-core qu'avec un banc qui prouve l'équivalence
Android (règle du lot) ; le rapport final les liste s'ils ont été touchés.

- `components/focus/useTVRemote.ts` (T5)
- `components/player/focus/osdFocusBus.ts` (T5)
- `components/player/focus/overlayFocusCore.ts` (T5)
- `components/player/focus/useSkipPillFocus.ts` (T5)
- `components/search/searchBarReturn.ts` (T7)
- `components/search/useSearchSubmit.ts` (T7)
- `hooks/scrubCountdown.ts` (T5)
- `hooks/usePairingFlow.ts` (T7)
- `hooks/useTVEpisodeNav.ts` (T5)
- `hooks/useTvFocusClaim.ts` (T3)
- `hooks/useTVPlaybackLifecycle.ts` (T5)
- `hooks/useTVPlaybackPresence.ts` (T5)
- `hooks/useTVPlayerBack.ts` (T5)
- `hooks/useTVPlayerControls.ts` (T5)
- `navigation/AppNavigator.tsx` (T4)
- `screens/PlayerScreen.tsx` (T5)

## Annexe H — attributions proposées

Les arbitrages du coordinateur (`.claude/nav-lot/STATUS.md`) font foi et sont
appliqués ci-dessus (« arbitrage »). Restent des PROPOSITIONS, pour ce qu'ils
ne couvrent pas :

- `components/player/focus/useOverlayFocus.ios.ts` → T5 (dans le périmètre autorisé de T5 : `components/player/focus/*`) ; c'est une primitive de réclamation, doublon de `claimTvFocus` (T3).
- `hooks/useScrubGestures.ios.ts` (abonnement direct et traduction du pan) → T5 (son périmètre autorisé) ; la table et l'entrée unique : T1.
- `hooks/useTVEpisodeNav.ts`, `hooks/useTVPlaybackLifecycle.ts:75` → T5 ; candidat : T7.
- `hooks/useTVPlayerBack.ts:88` (grâce de 600 ms) → T5 ; l'API des couches : T4.
- `redesignWiring/player/endExitLock.ts` → T5 ; la règle des croix est commune (T3, T4).
- `redesignWiring/player/playerFocusContainers.tsx` (destinations, `useStoreDestination`, `useLiveDestination`) → T5 ; règle générique : T3 ; saisons : T6.
- `redesignWiring/player/usePlaybackTrouble.ts:23` (`GESTURES`) → T5 ; la traduction : T1.
- `redesignWiring/player/usePlayerFocus.ts` (`onPanelExited`) → T5 ; candidat : T6.
- `redesignWiring/settings/SettingsRedesign.tsx` (`useBackLayer`) → T7 ; les couches : T4.
- `redesignWiring/remote/parallax.ts` → rendu, il reste (remote.md) : exception permanente de la garde.

## Annexe I — accord avec `remote.md` (relevé des points d'entrée de T1)

Le tableau des points d'entrée de `remote.md` et cet inventaire disent la
même chose : `useSearchSubmit` y est (depuis 54b02445d), `useContentFocusCapture`
y est dit monté sur Apple TV avec un abonnement permanent et inerte (depuis
c7aca069b), `useFocusRecovery` y est dit inerte sur tvOS (8ab4c73f2). Les deux
tableaux se recalent l'un sur l'autre à chaque fusion.

## Annexe J — seuils et durées encore dans l'adaptateur

`docs/TV-NAVIGATION.md` : l'adaptateur n'a pas le droit de contenir un seuil
ni une durée. L'audit (`node eslint/tvNavigationAudit.mjs`) les liste ; au
recalage :

| Applicateur | Constante | Dans tv-core |
|---|---|---|
| `platform/tvos/focus/claimAfterRestore.ts:4` | `RESTORE_WITHIN_MS` = 900 | `focus/restoreClaim.ts` : la MÊME, en double — pas encore branchée |
| `platform/tvos/focus/useBeyondEdge.ts:25` | `SETTLE_MS` = 400 | `focus/beyondEdge.ts` : `BEYOND_EDGE_SETTLE_MS`, en double — pas encore branchée |
| `platform/tvos/focus/useEntryFocus.ts:24` | `USER_RAIL_AFTER_MS` = 600 | `focus/screenEntry.ts` (spec miroir) — pas encore branchée |
| `platform/tvos/focus/useKeepFocusWithin.ts:6` | `LEAVE_CHECK_MS` = 50 | `focus/keepWithin.ts` — la durée reste dans l'adaptateur |
