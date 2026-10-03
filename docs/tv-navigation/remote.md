# La télécommande — intentions, table tvOS, entrée unique

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

## L'entrée unique tvOS (phase 2)

Un seul abonnement natif pour le chemin refondu : `apps/tv/src/platform/tvos/input/`.
Il lit chaque événement (`readTvosEvent`) et le donne à l'entrée commune
(`createRemoteInput(TVOS_BINDINGS)`). Les écouteurs passent par lui :

- observer les intentions (réveil, relance) : un crochet d'observation ;
- prendre une intention dans un contexte : un crochet d'inscription
  (`kind`, `decide` pur, `apply`, actif tant que l'écran est devant) ;
- les écouteurs d'avant (`redesignWiring/remote/remoteEvents.ts`) gardent
  leur API le temps de migrer : elle est rebranchée sur l'entrée unique, sans
  second abonnement.

Les détails de l'API de l'adaptateur sont dans la section suivante, une fois
la phase 2 livrée.

## Relevé des points d'entrée (2026-10-03, SHA 84f3cedd0)

Ce qui écoute la télécommande aujourd'hui sur le chemin Apple TV, et la tâche
qui le migre vers les intentions :

| Point d'entrée | Fichier | Ce qu'il lit | Tâche |
|---|---|---|---|
| L'abonnement partagé de la refonte | `redesignWiring/remote/remoteEvents.ts` | tout `TVEventHandler` → appui · glisser · pan | T1 |
| La prise du pan | `lib/tvPanGesture.ts` | `TVEventControl` | T1 |
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
| Reprise du focus du lecteur | `hooks/useFocusRecovery.ts` via `useTVPanelControls` | `TVEventHandler` (classe) : `focus`, `blur` | T5 — idem |
| Capture du focus après le rail | `hooks/useContentFocusCapture.ts` (`TVNavChrome`) | flèches | hors lot : ancienne UI (Android TV) ; `TVNavChrome` ne rend rien sur les routes refondues |

`parallax.ts` reste dans `redesignWiring/remote/` : c'est du rendu (l'inclinaison
au pouce), pas de la navigation.
