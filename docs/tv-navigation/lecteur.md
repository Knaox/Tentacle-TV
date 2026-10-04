# Le lecteur — navigation et télécommande (Apple TV)

Relevé de la tâche T5 du lot « Extraction de la navigation Apple TV »
(2026-10-03). Il décrit le lecteur TEL QU'IL EST au SHA de référence
`84f3cedd0` (main d'origine) : chaque geste de la Siri Remote, dans chaque
contexte du lecteur, et ce qu'il produit — avec les durées et les seuils tels
qu'écrits dans le code. C'est la spécification à reproduire À L'IDENTIQUE
par l'extraction (tv-core) ; un défaut relevé ici se NOTE, il ne se corrige
pas (« Constats », en fin de page).

Contrat général du lot : `docs/TV-NAVIGATION.md` (T1). Les §§ 1 à 10
relèvent le code d'origine ; le § 11 dit où chaque décision vit après
l'extraction, le § 12 comment l'équivalence se prouve.

## 1. Où vit le comportement aujourd'hui

| Rôle | Fichier | Partagé avec Android TV ? |
|---|---|---|
| Orchestrateur des contrôles : habillage, saut, gardes, liaison télécommande | `apps/tv/src/hooks/useTVPlayerControls.ts` | oui (cerveau commun, sans `Platform.OS`) |
| Défilement : machine, sauts, décompte, routage ←/→ | `hooks/useScrubController.ts` | oui |
| Maintien ←/→ et touches média (adaptateur du moteur) | `hooks/useScrubHoldMotor.ts` | oui |
| Décompte de validation (pur) | `hooks/scrubCountdown.ts`, `hooks/useScrubCountdown.ts` | oui |
| Sauts et délai de validation | `hooks/seekTuning.ts` | oui |
| Badge des sauts (cumul) | `hooks/useSkipFlash.ts` | oui (Android : `TVSkipBadge`) |
| Couture des flèches par plateforme | `hooks/scrubInput.ts` (depuis le lot Android TV : `scrubInputProfileOf(traits)`, § 13) | profil lu dans les traits |
| Pavé tactile (pan) | `hooks/useScrubGestures.ios.ts` (Android : `useScrubGestures.ts`, vide) | tvOS seul |
| Gains et seuils du pavé (purs) | `hooks/scrubTouchTuning.ts` | tvOS seul (lu par le cerveau) |
| Pan tenu au compteur | `platform/tvos/input/panGesture.ts` (propriétaire : T1) | tvOS seul |
| Routage du Retour (états passagers, grâce) | `hooks/useTVPlayerBack.ts` | oui |
| Couches du Retour du lecteur, épingle de la pause | `redesignWiring/player/usePlayerBackLayers.ts` | Apple TV |
| Fond focalisable, aiguillage du focus | `redesignWiring/player/PlayerRedesignStage.tsx` | Apple TV |
| Visibilités (habillage, pilule, carte, fin) | `redesignWiring/player/usePlayerChrome.ts` | Apple TV |
| Entrées, réclamations, verrous, préférences | `redesignWiring/player/usePlayerFocus.ts`, `endExitLock.ts`, `usePanelReturnFocus.ts` | Apple TV |
| Guides (ponts, pièges) | `redesignWiring/player/playerFocusContainers.tsx` | Apple TV |
| Gestes des boutons de l'habillage | `redesignWiring/player/usePlayerChromeActions.ts` | Apple TV (Android : `TVPlayerView`) |
| Feuille Pistes / Réglages, panneau Épisodes | `redesignWiring/player/usePlayerSheet.ts`, `usePlayerEpisodesPanel.ts` | Apple TV |
| Message-outil (activation au premier appui) | `redesignWiring/player/usePlaybackTrouble.ts` | Apple TV |
| Mémoire du dernier bouton, restauration | `components/player/focus/overlayFocusCore.ts` (+ `useOverlayFocus.ios.ts`) | oui (cœur) |
| Pilule de saut : réclamation, relais | `components/player/focus/useSkipPillFocus.ts`, `osdFocusBus.ts` | oui |
| Reprise du focus (entrée, réapparition) | `hooks/useTVOsdEntryFocus.ts`, `hooks/useTVPanelControls.ts` | oui |
| Câblage de l'écran | `screens/PlayerScreen.tsx` | oui (une orchestration, deux rendus) |
| Machines communes avec la LG | `packages/tv-core/src/player/{scrubMachine,holdMotor,holdTiming,arrowArbiter}.ts` | + webOS |

`arrowArbiter` n'est lu QUE par webOS (`apps/tv-webos/client/src/playback/
playerKeysTv.ts`, `ControlsTv.tsx`) ; `holdMotor` et `scrubMachine` par
`apps/tv` ET webOS. Leur comportement ne doit pas bouger.

## 2. Ce que la télécommande envoie (tvOS)

Relu dans `react-native-tvos` 0.80.1-0 (`RCTTVRemoteHandler.m`,
`RCTTVView.m`) et `components/focus/useTVRemote.ts` :

| Événement natif | Quand | `eventKeyAction` |
|---|---|---|
| `left` `right` `up` `down` `playPause` | appui simple, au RELÂCHEMENT (reconnaisseur de tape) | 1 |
| `select` | appui sur l'élément focalisé (`RCTTVView`) | 1 |
| `longLeft` `longRight` `longUp` `longDown` `longPlayPause` | appui long : début (~0,5 s), puis fin ; RIEN entre les deux | 0, puis 1 (ou absent si tvOS l'annule) |
| `longSelect` | appui long sur l'élément focalisé | 0, puis 1 |
| `pan` | doigt sur le pavé, seulement pendant que le pan est tenu (`acquirePanGesture`) | `body.state` Began / Changed / Ended, `x`/`y` = translation depuis le début (bornée ±1920), `velocityX/Y` |
| `swipeUp/Down/Left/Right` | glisser rapide, à la fin | — |
| `pageUp` `pageDown` | tvOS ≥ 14.3 | — |
| `menu` | JAMAIS en JS (le reconnaisseur Menu n'est pas posé) | — |
| `rewind` `fastForward` | JAMAIS sur tvOS (aucun reconnaisseur) — Android seulement | — |

- **Menu** arrive par l'intercepteur natif (`MenuPressInterceptor.ios`) de la
  portée de l'écran (`redesignWiring/back/BackScope.tsx`, T4), qui appelle
  `layers.back()` : la pile de couches (`tv-core nav/backLayers`), ordre
  menu > surimpression (`overlay`) > page > rail, la plus récemment ACTIVÉE
  à rang égal. Le `onBack` de `useTVRemote` du lecteur est du code mort sur
  tvOS (vivant sur Android, par `BackHandler`).
- **Tout relâchement** (`eventKeyAction === 1`, n'importe quel type, et la fin
  d'un appui long, `1` ou absente) appelle d'abord `onKeyUp` →
  `useTVPlayerControls` : `lastPressAt = maintenant`, puis
  `onHoldRelease()` (fin de maintien, relance du décompte : § 4.3).
- Le pan tenu par le lecteur (`usePanGesture(!panelOpen)`) coupe les glissers
  directionnels du moteur de focus (`platform/tvos/input/panGesture.ts`) : habillage
  affiché, les boutons se parcourent AU CLIC, le pavé défile.
- Le moteur de focus natif déplace le focus à l'enfoncement ; l'événement JS
  arrive au relâchement (~60 ms après). Un appui long sur une flèche, là où le
  focus peut aller, est répété par tvOS (accélération native).

## 3. Les contextes du lecteur

Un contexte = ce qui reçoit les gestes. Les drapeaux sont ceux du code.

| Contexte | Condition (code) |
|---|---|
| **Ouverture** | `phase.kind !== "playing"` (`buildPhase` : `resolving` sans URL, `starting` avant la 1ʳᵉ image sans erreur, `failed`) — écran `PlayerLoading` |
| **Habillage masqué** | lecture (ou pause désépinglée par Retour), `!overlayShown`, aucun panneau, aucune surface : le FOND tient le focus (`backgroundHoldsFocus()`) |
| **Habillage affiché** | `osdVisible = (overlayVisible && !autoPlayActive) \|\| (pinned && !scrubbing)` ; focus dans l'habillage |
| **Défilement** | `scrubbing` (machine active) ; sous-états : entré EN LECTURE (décompte armé) ou EN PAUSE ; geste continu tenu (doigt, maintien) ou relâché |
| **Pilule de saut** | `overlay.kind` `skip` ou `nextButton`, lecture, ni défilement, ni panneau, ni fin, ni message-outil activé |
| **Carte « À suivre »** | `overlay.kind === "nextCard" && !final` (`autoPlay.source === "credits"`) |
| **Affiche de fin** | `nextCard && final` (`autoPlay.source === "eof"`) |
| **Panneau Épisodes** | `showEpisodes` |
| **Feuille Pistes / Réglages** | `showSettings` (onglet = pilule pressée, `usePlayerSheet`) |
| **Message-outil** | bandeau (jamais focalisable) ; panneau `waiting`/`recovering`/`stuck` INACTIF puis ACTIF au premier appui (`usePlaybackTrouble`) |
| **Erreur** | bandeau `videoError` (non focalisable, par-dessus l'habillage) ; échec d'ouverture = Ouverture `failed` |

Drapeaux dérivés (à reproduire tels quels) :

- `panelOpen` des CONTRÔLES (`PlayerScreen.tsx`) = `showSettings ||
  showEpisodes || autoPlay.source === "eof"` — la carte « À suivre » et le
  message-outil N'Y SONT PAS ;
- `panelOpen` du FOND (`PlayerRedesignStage.tsx`) = `showSettings ||
  autoPlayActive || showEpisodes || troubleCovers` ;
- `overlayShown = overlayVisible || (pinned && !scrubbing)` ;
  `backgroundFocusable = !loading && !overlayShown && !panelOpen(fond)` ; le
  fond RÉCLAME le focus au front montant de `backgroundFocusable && !(skip ||
  nextButton)` ;
- `pinned` (`useOsdPin`) = `paused && !unpinned` ; Retour désépingle ;
  `overlayVisible` devenu vrai, ou tout changement de `paused`, réépingle ;
- `osdShown` (couche Retour) = `playing && osdVisible && !panel && !scrub &&
  !endScreen && !troubleCovers` ;
- `pillShown` = pilule && `!covered` ; `upNextShown` = carte && `!covered` ;
  `covered = !playing || scrub || panel || endScreen || troubleCovers`.

## 4. Intention → effet, contexte par contexte

Notation : « saut » = saut INSTANTANÉ (§ 4.1) ; « rallume » = `showOverlay`
(§ 4.6) ; « défilement » = § 4.2.

### 4.1 Le saut instantané et son badge

`skipBy(delta)` (`useTVPlayerControls.ts`) : cible = `currentTimeRef + delta`,
bornée à `[0, durée]` (durée inconnue : seulement ≥ 0) ; `currentTimeRef`
reçoit la cible AVANT le seek (les appuis rapprochés se cumulent depuis la
dernière cible) ; `onSeek(cible)` ; lecture continue, pause gardée ; badge
`flash(delta)`. Deltas : → +30 s (`SKIP_FORWARD_SECONDS`), ← −10 s
(`SKIP_BACK_SECONDS`), `seekTuning.ts`.

Badge (`useSkipFlash.ts`) : même sens dans la fenêtre → cumul (+30 → +60 →
+90 ; −10 → −20), sens opposé ou fenêtre échue → repart du delta seul ;
affiché 1 500 ms (`SKIP_BADGE_MS`) après le DERNIER saut, puis cumul remis à
zéro. Apple TV : `SeekFlash` (« +30 s » à droite, « −10 s » à gauche), jamais
sous la vue du défilement. Android TV : `TVSkipBadge`.

### 4.2 Le défilement (avance rapide)

Machine `createScrubMachine` (tv-core) avec `idleCancelMs: null` (aucun
abandon sur inactivité dans `apps/tv` ; la LG garde 7 s).

- **Entrée** (`enter`, ou un pas qui amorce) : origine = position bornée ;
  état de lecture d'avant lu ; `onPause(true)` ; habillage MASQUÉ
  (`hideOverlay`) ; décompte `begin(entréEnPause)` ; aucun seek.
- **Pas d'un appui** (`stepScrub`) : la cible bouge du saut de son sens
  (+30 / −10) — jamais d'accélération ; vitesse effacée.
- **Tic de maintien** (`tickScrub`) : toutes les 250 ms, `scrubStep(durée) ×
  palier` ; palier ×1 → ×2 → ×4 → ×8, un cran par seconde de maintien ;
  libellé de vitesse `">>2x"` / `"<<4x"` au-delà de ×1, sinon rien.
  `scrubStep` (shared) = 2 % de la durée arrondis à 5 s, bornés [10, 90] s
  (10 s si durée inconnue).
- **Trappe** : la position AFFICHÉE fait foi — les pas de la machine s'y
  appliquent en DELTAS, glisser et appuis directement ; la confirmation
  cherche la position affichée.
- **Confirmation** (OK, ▶︎❙❙, décompte échu cible déplacée) : sortie
  (habillage rallumé), `currentTimeRef` = cible, seek à la cible, PUIS
  `onPause(false)` (toujours la lecture).
- **Annulation** (Retour, décompte échu cible inchangée à moins de 1 s,
  `UNMOVED_SECONDS`) : sortie, aucun seek, état de lecture d'avant rendu.
- **Sortie** (les deux) : décompte arrêté, moteurs coupés, `scrubEndedAt =
  maintenant`, vitesse effacée, habillage rallumé (`revealOverlay`).

Décompte (`scrubCountdown.ts`) : entré EN LECTURE, armé ; il se ferme seul
au bout du délai de sa POLITIQUE après le dernier geste, lue à chaque
ouverture (`readCountdownPolicy`) — issue `resume` (lire à la cible ; cible
inchangée : annulation) ou `return` (annulation : aucun seek, la lecture
repart d'où elle était). Sans politique : `RESUME_COUNTDOWN_POLICY` (reprise,
5 000 ms, `RESUME_COUNTDOWN_MS`) — Android TV. Apple TV : le réglage
« Avance rapide » du profil (`scrubCountdownSettings.ts` ; défaut : revenir,
5 s ; délais 3, 5, 10, 15 s), par la couture `hooks/scrubCountdownPolicy(.ios).ts`.
Affiché « Retour à 12:34 dans 5…1 s » / « Lecture dans 5…1 s », avec le geste
de l'autre choix (un rendu par seconde affichée). Tout geste
(`enter`, `step`, `touch`) le relance en entier (`reportingActivity`) ; un
geste CONTINU le tient (`hold` : décompte masqué) et son relâchement
(`release`) le relance en entier. Entré EN PAUSE : jamais armé, la cible
attend OK ou Retour. `hold`/`release` ne font rien s'il n'est pas armé.

### 4.3 Habillage masqué (fond focalisé)

| Intention | Effet |
|---|---|
| ← / → (appui) | **saut** −10 / +30 + badge, habillage NON rallumé (`skipAnyPress`). Seulement si le FOND tient le focus ; sinon (pilule, carte) : rallume. |
| ← / → maintenu (`longLeft/Right` a=0) | défilement ouvert aussitôt (`onEngage`), décompte tenu, tic 250 ms qui accélère (§ 4.2), sens de la flèche |
| fin du maintien (a=1 ou absent) | tic arrêté, vitesse effacée, décompte relancé (entré en lecture) ; les appuis ←/→ des 400 ms qui suivent sont ignorés (`isHoldTicking`) |
| ↑ / ↓ | rallume (aucun autre focalisable : le focus ne bouge pas) |
| OK (clic au centre) | rallume (`onPress` du fond + `onAnyPress`) |
| ▶︎❙❙ | bascule lecture/pause + rallume |
| Menu | couche page → `onBack` : `routeBack()` (rien de passager) → **quitte la lecture** |
| glisser (pan) | régime `hidden` : engage seulement après 600 ms de contact depuis le début du geste ET course horizontale ≥ 60 pt ET `|dx| ≥ 1,4·|dy|` ET durée connue → défilement ouvert sous le doigt (§ 4.8) |
| toucher sans glisser engagé | rallume, sauf dans les 600 ms qui suivent un appui ou un relâchement (`TOUCH_AFTER_PRESS_MS`) |

En pause désépinglée (Retour a masqué l'habillage) : mêmes gestes ; le saut
garde la pause.

### 4.4 Habillage affiché

| Intention | Effet |
|---|---|
| ← / → | le moteur de focus parcourt la rangée ; JS : rallume (relance l'extinction) — jamais de saut |
| ← / → maintenu | rien côté lecteur (`handleLongDirection` sort si l'habillage est affiché) ; tvOS répète le déplacement du focus |
| ↑ / ↓ | focus natif (ponts § 5.4) ; JS : rallume (deux fois : `onUp/onDown` puis `onAnyPress`) |
| OK | action du bouton focalisé, GARDÉE (§ 4.5) ; JS : `onSelect` (rien hors défilement), rallume |
| ▶︎❙❙ | bascule + rallume |
| Menu | couche `overlay` → masque l'habillage (`hideOverlay`) et désépingle ; la lecture continue (en pause : reste en pause) |
| glisser | régime `shown` : course horizontale ≥ 60 pt, `|dx| ≥ 1,4·|dy|`, ET (180 ms depuis le début OU ≥ 180 pt) → défilement |
| toucher | rallume (même exception des 600 ms) |
| inactivité | extinction 5 000 ms (`OVERLAY_HIDE_MS`) après le dernier `revealOverlay`, seulement en lecture et sans panneau (`pausedRef`, `panelOpen` lus à l'armement) ; en pause, épinglée : jamais |

Boutons (ordre de la rangée : `prev`, `skipback`, `playpause`,
`skipforward`, `scrub`, `next`, `episodes`, `settings` (Pistes), `options`
(Réglages) ; `back` sur la barre du haut) :

| Clé | Geste (`usePlayerChromeActions`) |
|---|---|
| `player:back` | Retour du lecteur : `routeBack()`, sinon quitte la lecture |
| `player:prev` / `player:next` | épisode précédent / suivant |
| `player:seekback` / `player:seekforward` | **saut** −10 / +30 + badge, puis rallume ; défilement ouvert : déplace la cible (`jump`) |
| `player:playpause` | bascule + rallume |
| `player:scrub` (⏩) | ouvre le défilement SANS bouger (`enterScrub`) ; décompte armé en lecture ; le « select » jumeau de cet OK est absorbé 400 ms (`pressEntry`) |
| `player:episodes` | bascule le panneau Épisodes + rallume |
| `player:tracks` / `player:settings` | ouvre la feuille sur son onglet (`showSettings`) + rallume |

### 4.5 Gardes des appuis

- `guardScrub` (boutons de l'habillage) : en défilement, l'appui VALIDE le
  défilement au lieu d'agir ; dans les 400 ms (`SCRUB_TWIN_PRESS_MS`) après
  la fin d'un défilement, l'appui est AVALÉ (le press jumeau d'un OK).
- `select` / `playPause` globaux en défilement : ignorés dans les 300 ms
  après une touche média (`MEDIA_KEY_ECHO_MS`, Android) et dans les 400 ms
  après une entrée par bouton (`scrubStartedAt`).
- `skipAnyPress` : un ←/→ traité par le lecteur n'est pas suivi du
  `onAnyPress` qui rallumerait l'habillage.
- `phantomPressGuard` sur chaque bouton de l'habillage (magasin du focus).

### 4.6 Rallumer l'habillage (`showOverlay`)

`showOverlay` ne fait rien en défilement ; sinon `revealOverlay` :
`lastShowOverlay = maintenant`, visible, minuterie d'extinction réarmée
(5 s) si la lecture n'est pas en pause et sans panneau. Chaque changement de
`paused` (hors défilement) et chaque changement de `panelOpen` (identité de
`showOverlay`) rappellent `showOverlay` (effet `[paused, showOverlay]`).
`hideOverlay` : minuterie coupée, masqué tout de suite.

### 4.7 Défilement

| Intention | Effet |
|---|---|
| ← / → (appui) | la cible bouge de +30 / −10 (bornée), décompte relancé ; IGNORÉ pendant un maintien et 400 ms après |
| ← / → maintenu | l'accélération reprend depuis la cible (`startScrubbing` → `touch`), décompte tenu |
| fin du maintien | décompte relancé en entier |
| OK | **confirme** (§ 4.2) — sauf jumeau ⏩ (< 400 ms) ou écho média (< 300 ms) ; le fond focalisé reçoit aussi l'appui (`showOverlay`, sans effet en défilement) |
| ▶︎❙❙ | confirme (mêmes exceptions) |
| Menu | couche `menu` passagère → `routeBack` → **annule** + grâce 600 ms (`BACK_GRACE_MS`) : un Retour dans la grâce est avalé |
| ↑ / ↓ | aucun effet propre ; leur relâchement relance le décompte (`onHoldRelease`) |
| glisser | régime `open` : engage dès 12 pt horizontaux (`|dx| ≥ 1,4·|dy|`) → la cible suit le doigt ; décompte tenu tant que le doigt agit |
| doigt posé (pan Began) | décompte tenu (`touchStart`) |
| doigt levé / immobile 450 ms | décompte relancé en entier (`endDrag`), vitesse effacée |
| décompte échu (entré en lecture) | cible déplacée ≥ 1 s : confirme ; sinon annule (lecture rendue, sans seek) |
| entré en pause | ni décompte ni abandon : OK ou Retour |

Entrées du défilement : maintien ←/→ habillage masqué, glisser (masqué : 600
ms ; affiché : 180 ms / 180 pt ; ouvert : 12 pt), bouton ⏩, touches média
(Android). JAMAIS un appui simple (`jump` hors défilement ne fait rien).

### 4.8 Le pavé (pan) — détail

`useScrubGestures.ios.ts` :

- `Began` : clôt un geste précédent resté sans fin, `touching`, régime lu
  (`readTouchMode` : `open` en défilement, sinon `shown`/`hidden` selon
  `overlayVisible`), contact compté d'ici, `onTouchStart`, veille de silence
  450 ms (`SILENT_END_MS`).
- `Changed` : hors geste (doigt qui repart après un silence, ou pan pris en
  cours), un geste repart d'ici (contact depuis la pose si le doigt n'a pas
  été levé) ; veille relancée ; non engagé : durée connue + `canEngage` →
  `onStartScrub` (curseur parti de la position du doigt : la zone morte ne
  déplace rien) ; engagé : `pas × scrubGainFor(|velocityX|)` cumulé, rendu
  toutes les 33 ms (`FLUSH_MS`).
- `Ended`, ou 450 ms sans nouvelle : vidage, `onEndScrub` si engagé, sinon
  `onWake`.
- Gain (`scrubTouchTuning.ts`) : pavé = 1 920 pt ; lent (≤ 1 largeur/s) :
  90 s par largeur ; vif (≥ 4 largeurs/s) : 360 s par largeur ; entre les
  deux, lissage `t²(3−2t)`.
- Coupé (`enabled` faux : panneau des contrôles ouvert) ou démonté : le geste
  en cours est oublié, le pan est rendu.

### 4.9 Pilule de saut

| Intention | Effet |
|---|---|
| apparition | prend le focus si `grabs` = affichée && `dismissible` (pas encore en sourdine) && pas de feuille : « Masquer » si passage AUTOMATIQUE refusable, sinon « Passer » ; la reprend quand l'habillage s'éteint. En sourdine (ressortie le temps de l'habillage), elle se montre sans prendre le focus |
| ← / → dans l'îlot, habillage masqué | focus entre « Passer » / « Masquer », RETENU à gauche et à droite pendant un passage automatique (`islandTrap`) ; JS : rallume (le fond n'a pas le focus) |
| ↑ | habillage masqué : rallume (la pilule GARDE le focus : `skipHoldsFocus`) ; habillage affiché, focus dans l'îlot : vers Retour (`islandUp`) |
| ← depuis « Passer », habillage affiché | vers Retour (`islandLeft`) |
| ↓, habillage affiché | vers lecture/pause (`islandExit`) |
| OK « Passer » | passe le passage, ou rejoint la suite (`nextButton`) ; `onAnyPress` rallume l'habillage |
| OK « Masquer » | met le passage en sourdine (`dismissOverlay`) |
| Menu | passage automatique refusable : le met en sourdine + grâce 600 ms ; sinon : Retour ordinaire |
| départ de la pilule | le focus va : habillage affiché → son dernier bouton ; pilule restée (Masquer parti) → la pilule ; sinon le fond |

### 4.10 Carte « À suivre » (générique)

| Intention | Effet |
|---|---|
| apparition | réclame `upnext:play` ; piège `upnext:actions` |
| ← / → | focus « Lire » ↔ « Masquer » ; JS : `overlayVisible` rallumé SANS effet visible (`!autoPlayActive`) |
| ← / → maintenu, glisser | habillage masqué : le défilement s'ouvre (la carte se tait pendant) — cf. Constats |
| OK « Lire » / « Masquer » | épisode suivant tout de suite / carte refusée |
| ▶︎❙❙ | bascule + rallume |
| Menu | couche passagère → carte refusée + grâce 600 ms |

### 4.11 Affiche de fin (EOF)

| Intention | Effet |
|---|---|
| apparition | réclame `end:play` ; piège d'écran `end:screen` (destination « Lire maintenant ») ; croix `end:leave` infocalisable tant que `end:play` n'a pas eu le focus (`useEndExitLocked`) |
| ←/→/OK/▶︎❙❙/pan des contrôles | neutralisés (`panelOpen` des contrôles) ; pan rendu |
| ↑ depuis « Lire maintenant » | la croix, une fois déverrouillée |
| OK « Lire maintenant » | épisode suivant |
| OK croix | refus → la coquille sort (`onFinished` : fiche de la série, ou `goBack` si lancé depuis une fiche) |
| Menu | `routeBack` → refus ; sortie engagée → pas de grâce |

### 4.12 Panneau Épisodes

| Intention | Effet |
|---|---|
| ouverture | l'épisode EN COURS prend le focus s'il est dans la saison affichée, sinon la 1ʳᵉ ligne (réclamation) ; chaque ouverture repart de la saison de l'épisode en cours |
| contrôles du lecteur | neutralisés (←/→, OK, ▶︎❙❙, ↑/↓, pan rendu : le pavé parcourt la liste) |
| ↑ depuis l'en-tête | vers la croix (`episodes:header`) ; entrée dans la bande des saisons par la saison AFFICHÉE |
| focus ≥ 200 ms sur une saison | la précharge (`INTENT_MS`) |
| OK saison | ses épisodes ; la ligne d'entrée reprend le focus |
| OK épisode | panneau fermé, épisode lancé |
| OK croix, Menu | fermeture : rallume, restauration NOMMÉE « Épisodes » (220 ms) ; le panneau garde le focus pendant son fondu (240 ms), puis `focusNow("player:episodes")` si l'habillage est visible |

### 4.13 Feuille Pistes / Réglages

| Intention | Effet |
|---|---|
| ouverture | entrée : l'option RETENUE de la 1ʳᵉ colonne (piste audio ; qualité), sinon la 1ʳᵉ, sinon la croix — figée tant qu'elle reste ouverte |
| contrôles du lecteur | neutralisés, pan rendu |
| ← depuis la 1ʳᵉ colonne | la croix (marge-pont `tracks:back` / `settings:back`) |
| OK option | appliquée (audio, sous-titres, qualité) + rallume |
| OK croix, Menu | fermeture : rallume + restauration IMPLICITE (dernier bouton, cède à la pilule) ; fin du fondu : `focusNow` sur la pilule qui l'a ouverte (« Pistes » ou « Réglages ») si l'habillage est visible |

### 4.14 Ouverture, erreur, message-outil

| Contexte / intention | Effet |
|---|---|
| Ouverture : apparition | réclame `loading:back` (seule action) — `loading:retry` si l'ouverture a échoué ; piège d'écran (destination vivante : Réessayer, sinon la croix) |
| Ouverture : OK croix | `onBack` → `routeBack` sinon quitte ; OK Réessayer → `onRetry` |
| Ouverture : Menu | couche page → quitte |
| Erreur (`videoError`) | bandeau non focalisable ; tous les gestes comme habillage affiché/masqué |
| Message-outil, bandeau | aucun effet sur les gestes |
| Panneau INACTIF : premier appui (`select`, `playPause`, flèches, `longSelect` — pas le pavé) | l'ACTIVE : focus sur « Réessayer maintenant » (la restauration de l'habillage lui cède) ; le même appui passe AUSSI aux contrôles (cf. Constats) |
| Panneau ACTIF | habillage recule (`covers`), fond infocalisable ; piège `trouble:screen` ; croix verrouillée tant que l'entrée n'a pas eu le focus ; pont croix ↔ panneau ; actions Réessayer / Baisser la qualité / croix (= Retour du lecteur) |
| Panneau ACTIF : Menu | couche page → quitte |
| Départ du panneau | focus rendu à l'habillage s'il est là, sinon le fond le réclame |

## 5. Le focus

### 5.1 Entrées et réclamations

| Moment | Cible | Mécanisme |
|---|---|---|
| 1ʳᵉ image | `playpause` (nommé) | `useTVOsdEntryFocus` → `bumpOsdFocus("playpause")`, une fois |
| habillage qui RÉAPPARAÎT (et se montre : ni carte, ni ouverture) | dernier bouton utilisé (implicite) | `bumpOsdFocus()` |
| retour au premier plan | `playpause` (nommé), sauf panneau ouvert | `onForeground` |
| fermeture des Épisodes | `episodes` (nommé) | `bumpOsdFocus("episodes")` + `focusNow` en fin de fondu |
| fermeture de la feuille | implicite | `bumpOsdFocus()` + `focusNow(opener)` en fin de fondu |
| fond focalisable | le fond | `useTvFocusClaim` (front montant) + `hasTVPreferredFocus` |
| ouverture, carte, fin, feuille, épisodes, message-outil | leur entrée (§ 4) | `store.claim` au front montant ; préférences `hasTVPreferredFocus` (`preferredFocus`) |

Restauration (`overlayFocusCore.ts`) : 220 ms après le signal ; cible =
nommée, sinon le dernier bouton, sinon `playpause`. Une restauration
IMPLICITE cède à la pilule qui a réclamé dans les 200 ms qui précèdent le
signal (`SKIP_CLAIM_LEAD_MS`) ou qui TIENT le focus. Mémoire gelée pendant la
restauration (jusqu'à 520 ms) et pendant le défilement. tvOS : cycle
`hasTVPreferredFocus` faux → 50 ms → vrai → 120 ms → faux. Réclamation
(`claimTvFocus`) : 40 ms → faux → 50 ms → vrai → 120 ms → faux (Android :
120 ms, transition faux → vrai).

### 5.2 Verrous de sortie

La croix d'un écran du lecteur n'est jamais son entrée : `end:leave` et
`trouble:back` restent `isTVSelectable: false` tant que leur entrée
(`end:play`, `trouble:retry`) n'a pas eu le focus depuis l'apparition
(`endExitLock.ts`). Sur l'écran d'ouverture, la croix EST l'entrée (seule
action) — sauf échec : « Réessayer ».

### 5.3 Retour d'un panneau

Le panneau refermé reste monté le temps de son fondu (`handoff`, 240 ms),
garde le focus (opacité plancher `SWAP_FLOOR`), puis `onPanelExited` →
`usePanelReturnFocus` : `focusNow` sur le bouton du DERNIER panneau ouvert
(`player:episodes`, ou la pilule de la feuille), seulement si l'habillage
est visible ; sinon rien (le fond reprend le focus).

### 5.4 Ponts et pièges

- `player:osd` : mémoire du dernier bouton (`autoFocus`).
- `player:timeline` (frise) : depuis les commandes, MONTE vers la pilule (si
  publiée) sinon vers Retour ; depuis Retour, DESCEND vers lecture/pause —
  sens lu sur le focus.
- `player:skip-island` : `autoFocus` ; piège gauche/droite pendant un
  passage automatique habillage masqué ; habillage affiché et focus dans
  l'îlot : sorties BAS → lecture/pause, HAUT et GAUCHE → Retour.
- `loading:screen`, `end:screen`, `trouble:screen` : pièges d'écran (quatre
  directions), destination vivante, jamais d'`autoFocus`.
- `trouble:bridge` : croix ↔ « Réessayer maintenant », sens lu sur le focus.
- `episodes:header` → croix ; `episodes:seasons` → saison affichée ;
  `tracks:back` / `settings:back` → croix ; `upnext:actions`,
  `tracks:panel`, `settings:panel`, `episodes:panel` : pièges.

## 6. Les couches du Retour du lecteur

`usePlayerBackLayers.ts`, inscrites dans la portée de l'écran (T4) :

| Couche | Active quand | Effet |
|---|---|---|
| `menu` | `back.holding` = défilement \|\| surface (carte/fin) \|\| passage auto refusable \|\| grâce | `routeBack()` |
| `menu` | `showSettings` | ferme la feuille |
| `menu` | `showEpisodes` | ferme les épisodes |
| `overlay` | `osdShown` | masque l'habillage + désépingle |
| `page` | toujours | `onBack` du lecteur : `routeBack()` sinon quitte |

`routeBack()` (`useTVPlayerBack.ts`), dans l'ordre : grâce en cours → avalé ;
défilement → annulé + grâce ; carte ou fin → refusée (grâce sauf sortie
engagée) ; passage automatique refusable → sourdine + grâce ; sinon `false`.
Grâce : 600 ms après chaque Retour consommé. Sur Android, `usePreventRemove`
(`holdsSystemBack`) retient le bouton système à la place de la pile.

## 7. Durées et seuils (à reprendre À L'IDENTIQUE)

| Valeur | Où |
|---|---|
| 5 000 ms extinction de l'habillage | `useTVPlayerControls` `OVERLAY_HIDE_MS` |
| 400 ms press jumeau après un défilement, ou après une entrée par bouton | `SCRUB_TWIN_PRESS_MS` |
| 300 ms écho select/playPause après une touche média | `MEDIA_KEY_ECHO_MS` |
| 600 ms toucher qui accompagne un appui | `TOUCH_AFTER_PRESS_MS` |
| +30 s / −10 s | `seekTuning` `SKIP_FORWARD_SECONDS` / `SKIP_BACK_SECONDS` |
| 5 000 ms décompte de validation (sans réglage : Android TV) ; Apple TV : 3/5/10/15 s du réglage | `seekTuning` `RESUME_COUNTDOWN_MS`, `scrubCountdownSettings` |
| 1 500 ms badge (et fenêtre de cumul) | `useSkipFlash` `SKIP_BADGE_MS` |
| 1 s cible « inchangée » | `useScrubController` `UNMOVED_SECONDS` |
| 400 ms d'appuis ignorés après un tic de maintien | `useScrubHoldMotor` `isHoldTicking` |
| 400 / 550 ms maintien déduit du key-down (Android) | `HOLD_FROM_DOWN_SCRUB_MS` / `_ENGAGE_MS` |
| profil tvOS : `tapOnRelease` faux, `holdFromKeyDown` faux, `holdArmMs` 0, `holdEndAnnounced` vrai | `scrubInput.ts` (`scrubInputProfileOf`) |
| profil Android : vrai, vrai, 250 ms, faux | `scrubInput.ts` |
| 250 ms tic ; 1 000 ms par palier ; paliers 1/2/4/8 | tv-core `holdTiming` / `scrubMachine` |
| silence 700 ms (défaut), 350 ms (plancher), ×2,5 l'intervalle, rebond < 60 ms, répétition ≤ 450 ms, 2 répétitions, cadence de dalle ≤ 200 ms, maintien annoncé plafonné 30 s | tv-core `holdTiming` |
| pas de base : 2 % de la durée, arrondi à 5 s, [10, 90] s | shared `scrubStep` |
| 7 000 ms abandon (LG seulement ; `null` sur Apple TV / Android TV) | tv-core `IDLE_CANCEL_MS` |
| 450 ms silence d'un pan ; 33 ms de rendu du curseur | `useScrubGestures.ios` |
| pavé 1 920 pt ; 90 s / 360 s par largeur ; 1 et 4 largeurs/s | `scrubTouchTuning` |
| 600 ms de contact (masqué) ; 60 pt ; rapport 1,4 ; 180 ms ou 180 pt (affiché) ; 12 pt (ouvert) | `scrubTouchTuning` |
| 600 ms grâce du Retour | `useTVPlayerBack` `BACK_GRACE_MS` |
| 220 ms restauration ; 520 ms gel de la mémoire ; 200 ms avance de la pilule | `overlayFocusCore` |
| tvOS : 50 ms / 120 ms (cycle de restauration) ; réclamation 40 / 50 / 120 ms ; Android 120 ms | `useOverlayFocus.ios`, `useTvFocusClaim` |
| 240 ms fondu d'un panneau refermé | `TV_MOTION.player.handoffMs` |
| 200 ms avant de précharger une saison | `usePlayerEpisodesPanel` `INTENT_MS` |
| 4 000 / 8 000 / 14 000 ms notices du message-outil ; 120 ms reprise du focus | `usePlaybackTrouble` |
| 500 ms reprise du focus perdu (Android) | `useFocusRecovery` |

## 8. Android TV (rien à changer, tout à garder)

Le même cerveau (`useTVPlayerControls` → `useScrubController` →
`useScrubHoldMotor`, `useTVPlayerBack`, `overlayFocusCore`) sert l'habillage
d'Android TV (`LegacyPlayerStage` → `TVPlayerView`). Différences, toutes
dans des coutures :

- `scrubInput.ts` : un appui se tranche au key-UP (`requestDeferredTap`), le
  maintien se déduit du key-DOWN sans key-up (550 ms habillage masqué, 400 ms
  en défilement, gardes relues au déclenchement) ou du `longLeft` natif +
  250 ms ; la fin, du silence des répétitions (`motor.press`) ;
- `useTVRemote` Android : action au key-DOWN (répétitions comprises), le
  key-up jumeau n'agit pas, `select`/`up`/`down` orphelins ignorés, Retour par
  `BackHandler` (LIFO, écran focalisé seulement) ; touches `rewind` /
  `fastForward` → `handleMediaSeekKey` (défilement direct, pas sec isolé,
  cadence de répétition → tic) ;
- `usePreventRemove` retient Menu (`holdsSystemBack` vrai) ; `useFocusRecovery`
  rend le focus au fond après 500 ms ;
- `TVSkipBadge` lit `skipFlash` ; `TVScrubFullscreen` n'affiche pas le
  décompte ; `TVPlayerOverlay` écrit « -10s » / « +30s » en dur.

## 9. webOS

Son propre cerveau (`apps/tv-webos/client/src/playback/playerKeysTv.ts`),
avec `createArrowArbiter`, `createHoldMotor` (`press` avec `repeat`) et
`createScrubMachine` (abandon 7 s par défaut). L'extraction ne modifie aucun
de ces trois modules ; ses tests et son build restent verts.

## 10. Constats (notés, NON corrigés)

Lus dans le code au SHA de référence ; les scénarios (§ 12) les enregistrent
tels quels, sans les juger.

1. **Tout relâchement relance le décompte.** `onKeyUp` → `onHoldRelease` →
   `countdown.release()` pour N'IMPORTE quel relâchement (↑, ↓, OK, ▶︎❙❙,
   fin d'appui long) : en défilement entré en lecture, un clic ↑ relance les
   5 s ; et un relâchement pendant qu'un doigt reste posé sur le pavé lève la
   tenue (`held` faux) : le décompte court sous le doigt.
2. **Message-outil inactif : le premier appui sert deux fois.** Il active le
   panneau ET passe aux contrôles du lecteur (le fond tenait encore le
   focus) : → peut SAUTER de +30 s pendant un arrêt, OK rallume l'habillage.
3. **Ouverture : contrôles vivants.** Pendant l'écran de chargement,
   `panelOpen` des contrôles est faux : ▶︎❙❙ bascule `paused` ; un glisser
   (régime `shown`, l'habillage naît visible) avec une durée déjà connue
   ouvre un défilement invisible (mise en pause comprise).
4. **Carte « À suivre » hors `panelOpen`.** ←/→ basculent `overlayVisible`
   sans rien montrer ; maintien et glisser (habillage masqué) ouvrent le
   défilement sous la carte ; ▶︎❙❙ bascule la pause.
5. **OK sur « Passer » rallume l'habillage** (`onAnyPress`) en plus du saut
   de passage.
6. **OK juste après une reprise automatique** du défilement : l'habillage
   revient avec le focus restauré sur son dernier bouton (220 ms) ; un OK
   tardif peut y agir (souvent Lecture/Pause → pause). Constat déjà noté au
   carnet (`docs/TV-REFONTE.md`, « Constats non corrigés »).
7. `useTVRemote({ debugTag: "PLAYER" })` journalise encore les transitions
   (`TODO(diag)`) — sur Android TV ; Apple TV passe désormais par l'entrée
   unique, sans ce journal.
8. **La sortie du défilement rallume l'habillage avec l'état du panneau du
   PREMIER rendu du lecteur** : la machine du défilement, créée une fois,
   gardait le `showOverlay` de ce rendu-là (fermeture figée). Sans effet
   connu (un défilement ne s'ouvre pas sous un panneau) ; repris tel quel
   (`createPlayerControls({ initialPanelOpen })`).
9. **Android TV (modèle d'événements supposé, non éprouvé)** : un maintien
   engagé par le signal natif (`longRight` + 250 ms) ne reçoit plus de
   répétitions du moteur — elles vont au défilement, qui les ignore pendant
   le tic —, et le chien de garde de silence (700 ms) arrête l'avance ;
   `isHoldTicking` reste vrai jusqu'au relâchement. Trace `and-02`.
10. **L'accueil, pour un banc** : OK sur « Reprendre » du héros lance le titre
    du MOMENT (le héros tourne seul toutes les 8 s) — les scénarios
    passent par la rangée Reprendre.

## 11. Après l'extraction : où vit chaque décision

**tv-core `player/`** (pur, testé, minuteurs INJECTÉS — `PlayerTimers`) :

| Module | Ce qu'il décide |
|---|---|
| `seekTuning` | +30 / −10 s, validation 5 s |
| `scrubTouchTuning` | gains du pavé, seuils d'engagement (`canEngage`, `scrubGainFor`) |
| `scrubCountdown` | le décompte de validation (5 s, tenu, relancé) |
| `skipFlash` | le badge des sauts (cumul, 1,5 s) |
| `pressGuards` | jumeaux (400 ms), échos média (300 ms), toucher après appui (600 ms), queue d'un maintien (400 ms) |
| `overlayAutoHide` | l'extinction de l'habillage (5 s ; jamais en pause ni panneau ouvert) |
| `arrowHold` | le maintien des flèches et des touches média, selon le profil (`ScrubInputProfile`) |
| `scrubController` | le défilement : machine, trappe, sauts en défilement, saut instantané hors défilement, reprise |
| `playerControls` | le cerveau entier (§ 4.3 à 4.7) et ses gestes de télécommande (`remote`) |
| `playerRemote` | LA TABLE intention → gestes du lecteur (`playerRemoteSteps`, `applyPlayerRemoteSteps`) |
| `touchScrub` | l'interprète du glisser (régimes, silence 450 ms, rendu 33 ms) |
| `playerBack` | le Retour des états passagers (grâce 600 ms), `playerBackLayers`, `isOsdPinned` |
| `playerStage` | ce que l'habillage montre, quand le fond tient le focus |
| `playerFocus` | pilule, préférences, réclamations, croix verrouillées, ponts, îlot, retour d'un panneau, entrées de la feuille et des épisodes, cycle de la préférence native |
| `troublePanel` | l'activation du message-outil au premier appui, sa reprise du focus |

`holdMotor`, `scrubMachine`, `arrowArbiter` (communs avec webOS) : inchangés.

**Apple TV** — l'entrée unique de T1 (`platform/tvos/input`) : la
télécommande (`hooks/usePlayerIntentBinding.ts`, ex-`usePlayerRemoteBinding.ios.ts` → `useRemoteIntents` →
`playerRemoteSteps`), le pavé (`useScrubGestures.ios.ts`, intentions
`drag`, pan tenu par `usePanGesture`), le message-outil
(`usePlaybackTrouble`). Retour : la pile de T4 (`usePlayerBackLayers` →
`useBackLayers(playerBackLayers(…))`) ; `retour` n'est jamais un geste du
lecteur. Les applicateurs : `platform/tvos/player` (fond focalisable,
guides, préférence native et croix verrouillée, cycle de restauration).

**Partagé avec Android TV, rendu mince sur tv-core (API inchangée)** :
`hooks/useTVPlayerControls`, `useTVPlayerBack`, `scrubGestureTypes`,
`scrubInput(.ios)`, `playerTimers` (neuf) ; fondus dans tv-core et retirés :
`useScrubController`, `useScrubHoldMotor`, `useScrubCountdown`,
`useSkipFlash`, `hooks/scrubCountdown`, `hooks/scrubTouchTuning`
(`hooks/seekTuning` ne reste qu'en relais pour le banc UI).

**À retirer au portage Android TV** (copies temporaires d'un chemin
partagé, que le banc de traces couvre) :
- `hooks/usePlayerRemoteBinding.ts` : `useTVRemote` traduit encore les
  événements Android (key-down qui agit, key-up qui relâche, BackHandler,
  touches média) vers `playerControls.remote` ; Android TV passera par sa
  table (`remote/bindings/`) et `playerRemoteSteps`, comme Apple TV ;
- `hooks/scrubInput.ts` : le profil des flèches d'Android TV, à dériver de
  ses `RemoteTraits`.

**Encore dans des fichiers partagés, non extrait** (aucun banc ne couvre
leur chemin Android — règle du lot : pas de modification sans preuve) :
`components/player/focus/overlayFocusCore.ts` (cible de la restauration,
cession à la pilule, 220 / 520 / 200 ms, voisins Android), `useSkipPillFocus`
(réclamation et relais de la pilule), `hooks/useTVOsdEntryFocus`,
`hooks/useTVPanelControls`. Leurs décisions sont relevées (§ 5) ; elles
rejoindront tv-core avec un banc qui monte ces crochets (nœuds factices).

## 12. Les preuves d'équivalence

- **Banc de traces** (`apps/tv/harness/player-trace`, README) : les vrais
  crochets dans React sans DOM, horloge factice ; 33 scénarios tvOS et 16
  Android enregistrés sur `84f3cedd0`, rejoués à l'identique, à la
  milliseconde, à chaque commit de l'extraction.
- **Banc du simulateur** (`apps/tv/harness/nav-golden/scenarios/lecteur`,
  README) : neuf parcours dans l'app réelle (une vraie vidéo servie par le jeu
  `flux-mp4`), enregistrés sur `84f3cedd0` (chacun joué deux fois à
  l'identique), vérifiés sur la branche : 9/9 identiques (simulateur
  Apple TV 4K, tvOS 26.2, 2026-10-03).
- **Apple TV « Chambre »** (AppleTV14,1, tvOS 26.6) : appuis et maintiens
  réels par l'agent, pans injectés par CDP dans le JS de l'appareil. Le code
  de la branche y rejoue les neuf parcours à l'identique des références du
  simulateur : 9/9 (2026-10-03), maintien réel (`holdright:2`) et pan compris.
  Un premier passage n'avait rien prouvé : la sonde suivait l'app du
  simulateur de la place, branchée sur le même Metro — le banc ne suit plus,
  depuis, que l'app de test. Le vrai glisser du doigt reste un essai de
  l'utilisateur.

## 13. Android TV — le lecteur refondu (lot « Android TV = Apple TV », A4)

Le lecteur d'Android TV rend désormais l'habillage de l'Apple TV refondue
(`PlayerRedesignStage` → `PlayerChromeView`), sur le MÊME cerveau
(`useTVPlayerControls` → tv-core `playerControls`) et sur le moteur d'Android,
repris tel quel : mpv (`com.tentacletv.mpv`) ou ExoPlayer
(`com.tentacletv.exoplayer`, bascule de fréquence d'affichage, rendu DV de
compatibilité), choisis comme avant par `useTVPlayerRouting`. Les §§ 1 à 12
valent pour Android TV ; ce qui suit ne dit que ce qui diffère, et pourquoi.

### 13.1 Ce qui change de place

| Rôle | Apple TV | Android TV |
|---|---|---|
| Applicateurs du lecteur | `platform/tvos/player` | `platform/androidtv/player` — fond et guides repris (react-native-tvos sert `autoFocus`, `destinations`, `trapFocus*` sur Android, `ReactViewGroup`), croix verrouillée par `focusable` |
| Point d'entrée neutre | `platform/player/index.ts` | `platform/player/index.android.ts` |
| Télécommande du lecteur | `usePlayerRemoteBinding` : `useRemoteIntents` → `playerRemoteSteps` | le même, sur l'entrée d'Android TV (`platform/input`, table `ANDROIDTV_BINDINGS`) |
| Profil des flèches | `scrubInputProfileOf(traits)` | le même : maintien annoncé (`longLeft` 0 puis 1) → profil de l'Apple TV |
| Habillage effacé | monté, transparent | DÉMONTÉ à la fin de son fondu (`CHROME_UNMOUNTS_WHEN_HIDDEN`) |
| Bande-annonce | flux HLS relayé (`/api/trailers/resolve`), react-native-video | le même composant (`TrailerWebView.tsx`) : ExoPlayer media3 dans react-native-video |

### 13.2 La télécommande dans le lecteur

Ce que livre react-native-tvos sur Android (relevé dans
`ReactAndroidHWInputDeviceHelper.java`, table `ANDROIDTV_BINDINGS`) : un appui
au relâchement ; un maintien de la croix ou d'OK ANNONCÉ (`longLeft` à 0 vers
500 ms — la première répétition d'Android 11 —, puis à 1 au relâchement, rien
entre) ; Retour par `BackHandler`. C'est le modèle de la Siri Remote : les
gestes du lecteur sont donc ceux des §§ 4.3 à 4.7, aux mêmes durées.

| Geste | Effet (identique à l'Apple TV, sauf mention) |
|---|---|
| ← / → (appui), habillage masqué | saut −10 / +30 s + badge |
| ← / → maintenus | défilement : tic 250 ms, paliers ×1 → ×8, décompte 5 s au relâcher |
| ⏩ / ⏪ (touches média, Shield) | ouvrent le défilement à l'ENFONCEMENT ; tenues, il accélère au rythme de leurs répétitions (`mediaPulse`, le moteur commun) et s'arrête au RELÂCHEMENT de la touche ; défilement ouvert, un appui pousse la cible. La table les lie à l'enfoncement, aux répétitions et au relâchement (`enableKeyDownEvents`) ; `playerRemoteSteps` lit la phase du signal |
| ↑ / ↓ | rallument l'habillage (ce que les consignes d'Android appellent « jeter un œil aux commandes ») |
| OK, habillage masqué | rallume l'habillage, focus sur **Lecture/Pause** (ci-dessous) |
| OK, habillage affiché | l'action du bouton focalisé (Lecture/Pause : la pause) |
| Lecture/Pause (Shield, téléviseurs) | bascule + rallume |
| Retour | ferme le panneau ouvert, sinon masque l'habillage (en pause : le désépingle), sinon quitte — la pile de couches du § 6, par `BackHandler` |
| Menu ≡, piste suivante/précédente, OK maintenu | rien (Apple TV n'a pas de geste équivalent dans le lecteur) |

**Sans touche Lecture/Pause** (télécommande Google TV ; trait `playPauseKey:
"sometimes"`) : le comportement de l'Apple TV est gardé, OK prend le relais —
un premier OK montre l'habillage, un second met en pause. Pour que le second OK
soit TOUJOURS la pause, l'habillage qui réapparaît se pose sur Lecture/Pause
(tv-core `osdRevealTarget` → `overlayFocusCore`, restauration implicite) au
lieu du dernier bouton utilisé ; la pilule de saut qui tient le focus le garde.
C'est la règle de YouTube et de Netflix sur Android TV et des consignes
d'Android (« le bouton central met en pause et montre les commandes ») ; le
défaut inverse — l'habillage revenu sur « +30 », et OK qui saute au lieu de
mettre en pause — est celui qu'on reproche au lecteur de Plex.

### 13.3 Performance

- **Surface vidéo : `SurfaceView`**, pour mpv comme pour ExoPlayer (et
  react-native-video, la bande-annonce). Composée par le matériel (HWC), elle
  seule transmet le HDR et le Dolby Vision à l'affichage et permet le
  tunneling d'ExoPlayer ; une `TextureView` passe par le GPU, en SDR, et coûte
  jusqu'à 30 % d'énergie de plus selon la documentation de media3. Rien ne
  l'anime : le style du lecteur (`useTVPlayerStyle`) est figé par le format de
  la vidéo, et tout ce qui bouge (habillage, voile de pause, badge) se compose
  AU-DESSUS, sans retracer la surface.
- **L'habillage effacé se démonte** (`useMountedWhileVisible`) : sur Android,
  une vue à opacité 0 n'est pas dessinée (HWUI saute un nœud transparent) mais
  elle coûte encore ses rendus — la frise suit la lecture chaque seconde — et
  surtout elle reste FOCALISABLE : le moteur de focus d'Android ignore la
  transparence. Le fondu de sortie se joue en entier, puis l'habillage part ;
  il revient avec le même fondu d'entrée.

### 13.4 Les preuves

- **Banc de traces, mode `androidtv`** (`apps/tv/harness/player-trace`,
  `TRACE_PLATFORM=androidtv`) : les 26 scénarios de l'Apple TV sans pavé,
  rejoués avec les événements tels qu'Android TV les émet (enfoncement puis
  relâchement, `longX` tiré de la répétition, jumeau d'OK avant le clic du
  bouton), sur l'entrée unique d'Android et l'aiguillage de la refonte
  allumé : effets et états IDENTIQUES aux traces de référence de l'Apple TV,
  à la milliseconde (26/26). ⏩ tenu puis lâché et ⏪ isolé, propres à
  Android, par assertions (`androidtv.test.ts`). Les modes `ios` (33) et
  `android` (16, l'ancienne UI tant que l'aiguillage la garde) restent
  identiques à leurs traces.
- **tv-core** : `osdRevealTarget`, `scrubInputProfileOf`,
  `playerRemoteSteps` (relâchement des touches média), table
  `ANDROIDTV_BINDINGS` (⏩/⏪ aux trois phases).
