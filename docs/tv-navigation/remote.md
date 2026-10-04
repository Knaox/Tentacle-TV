# La télécommande — intentions, tables tvOS et Android TV, entrée unique

Domaine de T1. Index : [`../TV-NAVIGATION.md`](../TV-NAVIGATION.md).
Code : `packages/tv-core/src/remote/` (contrat), `packages/tv-core/src/input/`
(machines d'appui), `apps/tv/src/platform/tvos/input/` (adaptateur).

## Ce que la Siri Remote émet — relevé de react-native-tvos 0.80

Tout ce que l'app reçoit de la télécommande d'Apple TV, relevé dans
`React/Base/RCTTVRemoteHandler.m`, `RCTTVRemoteSelectHandler.m`,
`RCTTVNavigationEventNotification.mm` et `React/Views/RCTTVView.m`
(`node_modules/react-native`, alias de `react-native-tvos@0.80.1-0`), plus les
sources propres à l'app. La table est `TVOS_BINDINGS` ; son test
(`bindings/tvos.test.ts`) refuse un signal oublié ou inventé.

| Geste | Signal (`eventType`) | Phase livrée | Intention |
|---|---|---|---|
| Bord du pavé cliqué, flèche du clavier | `up` `down` `left` `right` | relâchement seulement (1) | `move` |
| Clic au centre | `select` | relâchement (1), et seulement s'il n'est pas devenu un maintien | `select` |
| Clic maintenu au centre | `longSelect` | début à 0,5 s (0), fin ou annulation (1) | `hold` · `select` |
| Lecture/Pause | `playPause` | relâchement (1) | `playPause` |
| Lecture/Pause maintenu | `longPlayPause` | début (0), fin (1) | `hold` · `playPause` |
| Bord maintenu | `longUp` `longDown` `longLeft` `longRight` | début (0), « Changed » (rien), fin ou annulation (1) | `hold` · direction |
| Page ↑ / ↓ (clavier, tvOS 14.3+) | `pageUp` `pageDown` | relâchement (1) | `page` |
| Glisser rapide sur le pavé | `swipeUp` `swipeDown` `swipeLeft` `swipeRight` | fin du geste (`body.state` « Ended ») | `swipe` |
| Doigt sur le pavé (pan tenu) | `pan` | « Began » · « Changed » · « Ended » ; un pan ANNULÉ n'émet rien | `drag` |
| Menu | `menu` (rendu par l'adaptateur) | — | `retour` |
| Le focus arrive, part | `focus` `blur` | — | aucune (bruit déclaré) |

Où chaque signal se lit :

- **`TVEventHandler`** — tout le tableau sauf Menu. `select` et `longSelect`
  viennent de l'élément focalisé (`RCTTVView`), les autres des reconnaisseurs
  posés sur la vue racine. `pan` n'existe que tant qu'un écran tient le pan
  (`TVEventControl.enableTVPanGesture`, un drapeau GLOBAL, d'où le compteur de
  `panGesture.ts`) ; tant qu'il est tenu, les glissers directionnels ne passent
  plus.
- **Menu** n'arrive jamais par `TVEventHandler` : l'app n'active pas
  `enableTVMenuKey` (il prendrait aussi les appuis du contenu, en concurrence
  avec le dépilage natif). Il arrive par `MenuPressInterceptor.onMenuPress`
  (la portée du Retour, décidée d'avance) et par `Modal.onRequestClose` (Menu
  dans une modale, qui a son propre contrôleur). L'adaptateur rend les deux en
  signal `menu`.
- **Le `Pressable` de l'élément focalisé** reçoit OK (`onPress`) et OK
  maintenu (`onLongPress`, `delayLongPress = LONG_PRESS_THRESHOLD_MS` = 550 ms
  après l'enfoncement) : c'est lui qui APPLIQUE la validation d'un élément. Le
  même appui passe aussi en `select` / `longSelect` pour qui l'observe. Deux
  seuils coexistent donc pour « OK maintenu » : 500 ms natifs (`longSelect`),
  550 ms au Pressable — à garder tels quels.

Ce que la télécommande a mais que l'app ne reçoit jamais : `TVOS_BINDINGS.system`
(bouton TV, Menu maintenu, Siri, volume et alimentation, geste circulaire de
l'anneau du pavé de 3e génération).

## L'entrée unique tvOS — `apps/tv/src/platform/tvos/input/`

Un seul abonnement à `TVEventHandler` pour le chemin refondu
(`remoteInput.ts`). Chaque événement natif est lu (`readTvosEvent`) et donné à
l'entrée commune (`tvosInput = createRemoteInput(TVOS_BINDINGS)`), dans cet
ordre : observateurs, puis pile des contextes.
L'abonnement naît avec le premier écouteur et part avec le dernier ; hors
Apple TV, rien ne s'abonne. La refonte importe tout du point d'entrée NEUTRE,
`platform/input` (`index.ts` : l'Apple TV, la base ; `index.android.ts` : Android
TV, aux mêmes noms — `remoteInput` et `REMOTE_SUPPORTED` y désignent l'entrée de
la plateforme) ; seuls les fichiers `.ios` et l'adaptateur lui-même importent
`platform/tvos/input`. Les crochets sont écrits une fois
(`platform/shared/remoteHooks.ts`) et posés sur chaque entrée :

| Export | Signature | Usage |
|---|---|---|
| `useRemoteIntents` | `(listener: (event: IntentEvent) => void, enabled = true) => void` | VOIR passer chaque intention, sans la prendre (réveil, relance d'attente). Écouteur relu à chaque rendu ; `enabled` faux quand l'écran n'est pas devant. |
| `useRemoteContext` | `<D>({ kind, name, active, decide, apply }) => () => void` | PRENDRE des intentions dans un contexte (`kind` : `keyboard` · `panel` · `player` · `screen`). `decide` PUR, `apply` au geste, tous deux relus à chaque rendu ; `active` suit l'écran. Rend `refresh`, à appeler quand l'état lu par `decide` change. |
| `useTakenAhead` | `(intent: RemoteIntent) => boolean` | La décision anticipée : un contexte prendrait-il cette intention, maintenant ? |
| `receiveMenu` | `() => IntentEvent \| null` | Menu, rendu par `MenuPressInterceptor` : il passe par l'entrée unique (`retour`). |
| `withMenuIntent` | `(close: () => void) => () => void` | `Modal.onRequestClose={withMenuIntent(close)}` : Menu passe par l'entrée unique, puis la modale se ferme comme avant. |
| `acquirePanGesture`, `usePanGesture` | `() => () => void`, `(enabled: boolean) => void` | Tenir le pan (au compteur, drapeau global du natif) ; ses événements arrivent en `drag`. |
| `tvosInput` | `RemoteInput` | L'instance unique (essais, diagnostic ; `tvosInput.observeSignals` pour le signal brut). |

`retour` n'est décidé par aucun contexte de cette pile : chaque écran le
résout par SA pile de couches (`TV-NAVIGATION.md`, « Retour : la pile de
chaque écran »).

L'API d'avant l'extraction — `redesignWiring/remote/remoteEvents.ts`
(`useRemoteEvents`, `subscribeRemote`, `RemoteEvent`) et la réexportation
`lib/tvPanGesture.ts` — a servi de transition le temps que ses écouteurs
migrent (rotation du héros et « au-delà du bord » : T3 ; feuille des saisons :
T6 ; bande-annonce : T7 ; pan du lecteur : T5). Plus rien ne l'important, elles
sont RETIRÉES (fin du lot, 2026-10-03), avec l'événement brut qu'elles lisaient
(`subscribeNativeRemote`).

## Android TV — table et entrée unique (lot A0, 2026-10-05)

**La table** `packages/tv-core/src/remote/bindings/androidtv.ts`, relevée dans
`ReactAndroid/.../modules/core/ReactAndroidHWInputDeviceHelper.java` (la
version qu'appelle `ReactRootView.dispatchKeyEvent`) — tests :
`androidtv.test.ts`, aucun signal oublié ni inventé.

| Ce que fait la télécommande | Signal (`eventType`) | Phase livrée | Intention |
|---|---|---|---|
| Croix | `up` `down` `left` `right` | relâchement (1) seulement | `move` |
| OK (DPAD_CENTER, ENTER, NUMPAD_ENTER, BUTTON_SELECT, SPACE ; manette A par repli) | `select` | relâchement | `select` |
| OK maintenu | `longSelect` | 0 à la première répétition d'Android (500 ms sous Android 11), 1 au relâchement — pas de `select` derrière | `hold select start` / `end` |
| Croix maintenue | `longUp`… | idem ; le focus natif suit lui-même les répétitions | `hold <direction>` — le défilement rapide, comme le glisser du pavé de tvOS |
| Lecture/Pause (Shield ; absente des télécommandes Google TV) | `playPause` | relâchement | `playPause` |
| Lecture, Pause, Stop, Avance, Retour rapides | `play` `pause` `stop` `fastForward` `rewind` | relâchement | `transport` |
| Chaîne +/− | `channelUp` `channelDown` | relâchement | `page` |
| Retour (BACK, manette B) | `back` — lu dans `BackHandler`, `Modal.onRequestClose` | relâchement | `retour` |
| Menu ≡, Info, chiffres, couleurs, guide… | leur nom | — | bruit déclaré : aucune intention (Apple TV n'a pas ces touches ; l'appui maintenu sur OK tient lieu de Menu, comme sur Apple TV) |
| `longPlayPause`, `longRewind`… | — | jamais émis (maintien détecté pour OK et la croix seulement) | bruit déclaré |

`traits` : focus natif déplacé AVANT l'intention, appui au relâchement, maintien
ANNONCÉ (seuil 500 ms), Retour décidé AU GESTE (`backDecidedAhead: false`), pas
de surface tactile, `playPauseKey: "sometimes"`. Aucun ajout natif n'a été
nécessaire : react-native-tvos livre déjà Menu, le relâchement et le maintien ;
les répétitions, il les avale (et le focus natif les suit).

**L'entrée unique** `apps/tv/src/platform/androidtv/input/` : `TVEventHandler`
à la demande, comme tvOS ; Retour par UN écouteur `BackHandler`, inscrit après
le conteneur de navigation (BackHandler interroge le DERNIER inscrit d'abord ;
`useBackButton` de react-navigation s'inscrit à la pose du conteneur). Au
geste : Retour entre dans l'entrée commune, puis il est pris si un contexte le
prend, sinon si un PRENEUR inscrit le prend (`takeBack(() => boolean)`, le
dernier inscrit d'abord — tv-core `remote/backTakers`) : c'est là que
l'applicateur du Retour d'Android (couches, page poussée) se branche, le
pendant de `MenuPressInterceptor`. Personne : le navigateur, puis la sortie.

**Le journal** (`remoteLog.ts`) : `TENTACLE_TV_REMOTE_LOG=1` dans
l'environnement de Metro (`pnpm tv:refonte:android --journal`) écrit chaque
signal et son intention, préfixe `[remote]`, dans Metro et logcat.

### Les indications de touches — `RemoteBindings.hints`

Tout texte qui nomme une touche vient de la table (`bindings/hints.ts`, seize
identifiants) : `remoteHint(id)` dans le branchement (`platform/input`),
`useRemoteHints()` dans les vues (`redesign/remote/remoteHints.tsx`,
fournisseur posé dans `App.tsx` ; sans lui — le banc —, les mots de la Siri
Remote). Apple TV garde ses clés ; Android TV n'en change qu'une :

- **la feuille des saisons** — Lecture/Pause y demande. Sur une télécommande
  qui l'a (Shield), rien ne change ; sans (Google TV), l'équivalent le plus
  naturel est déjà dans la feuille : cocher par OK, puis son bouton
  « Demander N saisons » au pied, focalisable. L'indication le dit
  (`requests:seasonsShortcutAndroid` : « Lecture/Pause, ou cocher puis
  Demander »). Menu ≡ n'a pas été retenu : absent des télécommandes Google TV,
  et sans rapport avec « demander » ;
- **le lecteur sans Lecture/Pause** (décision de l'utilisateur) : le
  comportement de l'Apple TV, et OK prend le relais — un OK montre l'habillage,
  un second met en pause. La table l'annonce (`playPauseKey: "sometimes"`) ;
  le câblage est celui du lecteur (tâche A4).

### Équivalences d'une migration (pour mémoire, et pour Android TV)

| Avant | En intentions (tvOS) |
|---|---|
| `useRemoteEvents(fn)` « tout geste » | `useRemoteIntents(fn)` — mais Menu y passe désormais (`retour`), ce que `useRemoteEvents` ne voyait jamais : l'exclure pour rester identique |
| `press` simple vers une direction, ou `swipe` (`isGestureToward`) | `directionOf(intent) === direction` |
| `press` long, `phase: "down"` / `"up"` / `null` | `hold`, `phase: "start"` / `"end"` / `"update"` |
| `press` `playPause`, non long | `{ type: "playPause" }` |
| `pan` `began` / `changed` / `ended` | `drag` `start` / `move` / `end` |
| `useTVRemote({ onAnyPress })` | `move` ou `select` (les seuls qui le déclenchent sur tvOS) |
| `onKeyUp` de `useTVRemote` | tout appui (`traits.pressOnRelease`), la fin d'un maintien ; pour `longLeft` / `longRight`, aussi « sans phase » (`hold` `update`) |

## Relevé des points d'entrée (2026-10-03, SHA 84f3cedd0)

Ce qui écoute la télécommande aujourd'hui sur le chemin Apple TV, et la tâche
qui le migre vers les intentions :

| Point d'entrée | Fichier | Ce qu'il lit | Tâche |
|---|---|---|---|
| L'abonnement partagé de la refonte | `redesignWiring/remote/remoteEvents.ts` | tout `TVEventHandler` → appui · glisser · pan | T1 — FAIT : l'entrée unique ; RETIRÉ à la fin du lot |
| La prise du pan | `lib/tvPanGesture.ts` | `TVEventControl` | T1 — FAIT : `platform/tvos/input/panGesture.ts` ; réexportation RETIRÉE |
| « Au-delà du bord » | `redesignWiring/remote/useBeyondEdge.ts` (accueil : `useHomeHero`) | glissers et appuis simples vers un bord | T3 (règle), T7 (accueil) |
| Rotation du héros | `redesignWiring/home/useHeroRotation.ts` | tout geste ; un maintien la suspend | T7 |
| Réveil de la bande-annonce | `redesignWiring/trailer/TrailerRedesign.tsx` | tout geste | T7 |
| Lecture/Pause dans la feuille des saisons | `redesignWiring/vigie/SeasonsSheetRedesign.tsx` | `playPause` simple | T6 |
| Menu dans une modale | `redesign/motion/FadingModal.tsx`, `redesignWiring/sheet/ActionSheetRedesign.tsx`, `redesignWiring/vigie/*Sheet*`, `RequestsPanel.tsx`, `settings/ChoiceModal.tsx`, `nav/NavMenuModal.tsx` | `onRequestClose` | T6 (feuilles), T4 (rail), T7 (réglages) |
| Portée du Retour | `redesignWiring/back/BackScope.tsx` + `components/focus/MenuPressInterceptor.ios.tsx` | Menu, décidé d'avance | T4 |
| OK, OK maintenu sur un élément | `redesign/focus/FocusTarget.tsx` (`Pressable`) | `onPress`, `onLongPress` (550 ms) | T6 (cartes), T3 |
| Activation du panneau de panne | `redesignWiring/player/usePlaybackTrouble.ts` | `useTVEventHandler` direct : appuis et `longSelect` | T5 |
| Défilement au pavé | `hooks/useScrubGestures.ios.ts` | `useTVEventHandler` direct : `pan` | T5 |
| Commandes du lecteur | `components/focus/useTVRemote.ts` via `useTVPlayerControls`, `useTVPlayerBack`… | `useTVEventHandler` : tout | T5 — partagé avec Android TV, qui n'est pas touché |
| Reprise du focus du lecteur | `hooks/useFocusRecovery.ts` via `useTVPanelControls` | `TVEventHandler` (classe) : `focus`, `blur` | hors lot : INERTE sur tvOS — il sort dès sa première ligne hors Android (`Platform.OS !== "android"`), sans s'abonner |
| « Une touche annule le saut vers les résultats » | `components/search/useSearchSubmit.ts` (via `redesignWiring/search/useSystemKeyboard.ts`) | `useTVRemote({ onAnyPress })` : flèches et OK | T7 (adaptateur neuf ; le fichier, partagé avec Android TV, n'est pas touché) |
| Capture du focus après le rail | `hooks/useContentFocusCapture.ts` (`TVNavChrome`) | flèches | hors lot : ancienne UI (Android TV). `TVNavChrome` est monté sur Apple TV aussi (il rend `null` APRÈS ses crochets) : l'abonnement est permanent mais inerte, rien ne l'y arme |
| Retour de react-native-tvos | `node_modules/react-native/Libraries/Utilities/BackHandler.ios.js` | `menu` | hors lot : abonné dès l'import, inerte (`enableTVMenuKey` coupé, `menu` jamais émis) |

Mesuré au jumelage (simulateur, 2026-10-03) : deux abonnés natifs hors de
l'entrée unique — le compte de ces deux derniers ; l'entrée unique n'en ajoute
qu'UN, quel que soit le nombre de ses écouteurs, et le rend au dernier départ.

`parallax.ts` reste dans `redesignWiring/remote/` : c'est du rendu (l'inclinaison
au pouce), pas de la navigation.
