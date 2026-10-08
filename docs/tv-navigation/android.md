# Android TV refondu — Retour, panneaux, écrans (lot « Android TV = Apple TV », A3)

L'Apple TV refondue est la référence absolue : Android TV rend les MÊMES écrans,
les mêmes panneaux, le même Retour. Ne changent que la traduction de la
télécommande (A0), le focus natif (A1), les effets (A2) et le moteur du lecteur
(A4). Ce document tient, pour A3, ce qui diffère d'une plateforme à l'autre dans
le Retour, les panneaux et chaque écran — l'état, les écarts, les décisions.

## 1. Le Retour

| | Apple TV | Android TV |
|---|---|---|
| Signal | Menu, pris D'AVANCE par `MenuPressInterceptor` (vue native) | Retour, par `BackHandler` (`onBackPressed` de l'activité, au relâchement) |
| Décision | `takesBack` à l'enfoncement, `backOutcome` au relâchement | `backOutcome` au relâchement, sur l'état du moment |
| Pile | tv-core `nav/backLayers` (menu > surimpression > page > rail) | la MÊME, par le même `BackLayersContext` (`platform/shared/back/`) |
| Sortie | UIKit quitte (appui laissé) | `BackHandler.exitApp()` (geste par défaut de l'activité racine) |
| `Modal` | Menu → `onRequestClose` (contrôleur à part) | Retour → `onRequestClose` (`Dialog` à part) — rien ne passe par la portée |

- Applicateur : `platform/androidtv/back/AndroidBackScope.tsx`, posé par le
  navigateur via `redesignWiring/back/BackScope` → `platform/backScope`
  (`backScope.ts` Apple TV, jumeau `backScope.android.ts`).
- Chaque écran de la pile garde sa portée ; seule celle de l'écran DEVANT
  répond (`navigation.isFocused`). Devant, elle répond TOUJOURS : le
  gestionnaire de React Navigation, qui dépilerait une page du rail, ne voit
  jamais l'appui — Menu ne dépile rien de lui-même sur Apple TV non plus.
- Écart VOULU — le relevé B3 de tvOS (appui pris d'avance, couche désactivée
  avant le relâchement : avalé) n'existe pas : Android décide au relâchement.
- Voile hors ligne (monté hors des écrans) : Retour quitte, comme Menu y
  remonte à UIKit (`useExitOnBack`, sans effet sur tvOS).
- Écran de migration de la base (monté hors des écrans) : de même, Retour
  quitte (`useExitOnBack`).
- Preuve : `apps/tv/harness/back-trace` — variante « Android refondu », mêmes
  effets qu'iOS appui par appui (`node apps/tv/harness/back-trace/bench.mjs verify`).

## 2. Les panneaux (`Modal`)

Grand panneau des cartes (`ActionSheetRedesign`), panneau d'un titre absent
(`AbsentSheetRedesign`), feuille des saisons (`SeasonsSheetRedesign`), fenêtre
des demandes (`RequestsPanel`), listes de choix des réglages (`ChoiceModal`),
menu d'une entrée du rail (`NavMenuModal`), filtres de la bibliothèque.

Relevé dans react-native-tvos 0.80 (Android) :

- **Retour** dans une `Modal` : `onRequestClose` (`ReactModalHostView`
  intercepte BACK et ESCAPE au relâchement), jamais `BackHandler` — le même
  chemin que Menu sur tvOS ; la couche « menu » du panneau reste inscrite.
- **Touches** dans une `Modal` : son `Dialog` a son propre
  `ReactAndroidHWInputDeviceHelper`, qui émet vers le MÊME `TVEventHandler`
  JS — l'entrée unique (A0) les voit.
- **OK et l'appui maintenu** passent par `Pressable` comme sur tvOS : sur
  Android, `ReactViewGroup.onKeyDown/onKeyUp` (OK, Entrée) envoie
  `PressIn` / `PressOut` à la vue focalisée ; `Pressability` en tire `onPress`
  au `PressOut` et `onLongPress` après `delayLongPress` depuis le `PressIn`.
- **Clic fantôme** : le `PressOut` part au relâchement vers la vue focalisée
  MÊME si l'enfoncement n'a pas eu lieu sur elle — exactement le cas d'un
  panneau ouvert sous un OK encore enfoncé (l'échelle de note pré-focalisée
  recevrait OK). La garde de tv-core (`cards/pressGuard`, appliquée par
  `FocusTarget` : `onPressIn` puis `onPress`) la couvre telle quelle : un OK
  ne compte sur une cible gardée que s'il a commencé dessus.
- **Entrée** : tvOS n'honore aucune préférence de focus dans une `Modal` — d'où
  le verrou d'entrée (`useChoiceEntry`, tv-core `panels/choiceEntry`).
  Android choisit à l'ouverture du `Dialog` la première cible focalisable de
  l'arbre : le même verrou décide, posé par `tvFocusable` (jumeau
  `focusLocks.android.ts`, lot A1) au lieu d'`isTVSelectable`.
- **Entrée réclamée** : le verrou ne suffit pas sur Android. Le `Dialog` ne
  reçoit le focus qu'en prenant la fenêtre (`restoreDefaultFocus`), souvent
  avant le montage de son contenu, et plus jamais ensuite — tvOS, lui, finit
  par focaliser la seule cible libre. Le jumeau `useChoiceEntry.android.ts`
  réclame donc l'entrée décidée (`claim` → `hasTVPreferredFocus`).
- **Fermeture** : la fenêtre de l'activité reprend le focus là où il était (la
  carte d'origine), comme tvOS le rend à la carte.

### 2.1 Relevé à l'émulateur (2026-10-05, `main` + A0, refonte forcée)

| Essai | Résultat |
|---|---|
| OK maintenu sur une vignette 16:9 (« Reprendre la lecture ») | ✅ le grand panneau s'ouvre, « Reprendre » en tête |
| OK maintenu sur une affiche (Ma liste) | ✅ le panneau `poster` s'ouvre |
| OK maintenu sur un volet absent (saga, faux Vigie) | ✅ le panneau du titre absent s'ouvre, réduit à « Demander » ; rien n'est demandé au relâchement |
| Fenêtre « Mes demandes » (rail) | ✅ s'ouvre, Retour la ferme et rend le focus à l'entrée |
| Relâchement d'OK sous le panneau ouvert | ✅ aucune écriture au faux backend (garde anti-clic fantôme) |
| Retour dans le panneau | ✅ fermé par `onRequestClose`, un seul Retour, focus rendu à la carte |
| Entrée sur l'échelle (cran 5) | ❌ aucun focus dans le `Dialog` ; seule « Noter 5 » est focalisable (verrou d'A1 appliqué), mais sa demande de focus échoue |
| Flèche dans un panneau à guides (grand panneau, titre absent) | ❌ plantage natif : `StackOverflowError`, `ReactViewGroup.requestFocus` ↔ `requestFocusViewOrAncestor` |

Le plantage vient des guides de focus natifs de react-native-tvos sur Android
(lot A1) : un guide dont la destination refuse le focus remonte les ancêtres
de celle-ci jusqu'à lui-même, puis redemande la même destination, sans fin.
Sans le correctif d'A1 (`guideFocusable.android` : un guide sans cible ne doit
pas poser `focusable={false}`, qui bloque ses descendants sur Android), il
arrive dès l'ouverture du panneau. Avec ce correctif, il arrive à la première
flèche : la destination (le cran retenu) refuse encore le focus. À reprendre
avec A1 sur l'arbre fusionné, avant que la refonte ne soit livrée sur Android.

Méthode : `input keyevent --longpress` relâche avant le seuil de 550 ms
(`LONG_PRESS_THRESHOLD_MS`) et n'est pas un maintien. Le vrai maintien
(enfoncement, répétitions à 500 ms puis 50 ms, relâchement) est injecté par
`app_process` (`InputManagerGlobal.injectInputEvent`, comme la commande
`input`).

## 3. Les écrans

Légende : ✅ tourne tel quel · 🔧 câblé par A3 · ↗ autre tâche du lot · ⚠ écart assumé.

Retour relevé à l'émulateur, écran par écran : accueil (page → rail → profil
→ sortie de l'app, comme tvOS), Pour vous, Ma liste, recherche et Réglages
(le rail s'ouvre sur LEUR entrée ; depuis Réglages, ensuite, la sortie), fiche
poussée (recule, y compris la fiche d'une saga), lecteur (recule vers
l'accueil), grand panneau, panneau d'un titre absent et fenêtre des demandes
(fermés, focus rendu).

| Écran | Entrée | État Android | Écarts, décisions |
|---|---|---|---|
| Accueil | `HomeRedesign` | ✅ | rotation du héros et « au-delà du bord » : intentions de l'entrée unique (↗ A0, A1) |
| Pour vous | `ForYouRedesign` | ✅ | — |
| Bibliothèques | `LibraryRedesign` | ✅ | feuilles de filtres en `FadingModal` (§ 2) |
| Ma liste, Favoris | `CollectionRedesign` | ✅ | — |
| Recherche | `SearchRedesign` | 🔧 | clavier système d'Android + micro de l'app (§ 3.1) |
| Parcourir | `BrowseRedesign` | ✅ | — |
| Fiche, saga, saisons | `MediaDetailRedesign` | ✅ | panneaux en `Modal` (§ 2) ; préparation de la bande-annonce (↗ A4) |
| Réglages | `SettingsRedesign` | ✅ | Liquid Glass désactivé et masqué (↗ A0/A2, à vérifier sur le code fusionné) ; section décodeur Android déjà là |
| À propos | `AboutPanel` | ✅ | `platformLabel` connaît les deux plateformes |
| Jumelage, connexion | `PairingRedesign` | 🔧 | parcours de l'Apple TV (`afterServer: "login"`) ; conditions d'utilisation retirées comme sur Apple TV (⚠ § 3.2) |
| Profils, PIN, Gérer | `ProfilesRedesign`… | 🔧 | `PROFILES_ENABLED` suit la refonte, plus la plateforme (§ 3.3) |
| Demandes Vigie | `redesignWiring/vigie/` | ✅ | raccourci Lecture/Pause de la feuille des saisons : table d'A0 (indication propre aux télécommandes sans la touche) |
| Bande-annonce | `TrailerRedesign` | ↗ A4 | lecture relayée par le serveur, comme l'Apple TV |
| Hors ligne | `OfflineRedesign` | 🔧 | Retour quitte (§ 1) |
| Erreur d'écran | `ScreenErrorRedesign` | ✅ | dans la portée de l'écran |
| Démarrage, messages, jumelage expiré | `BootView`, `noticesRedesign` | ✅ | ne prennent pas le focus |

### 3.1 Recherche

Même écran. Le champ ouvre le clavier système (Gboard, clavier Leanback), comme
il ouvre celui de tvOS : le vrai champ reste hors écran (`HiddenSearchInput`).
Différence d'Android : refermé par Retour, le clavier laisse le focus au champ ;
`keyboardDidHide` le rend donc (`blur`), sa fin de saisie suit, et la règle
commune (`searchSubmitStep`) ramène le focus au clavier de l'écran, ou au
premier résultat après une validation. La dictée de l'app (module natif
`VoiceRecognition`, `useSpeechRecognition`) s'ajoute par la touche micro de la
grille : `SearchView` en mode `systemAndKey` (tvOS : `system`). Sans micro sur
l'appareil, `system` — la dictée du clavier système reste. Applicateur :
`platform/androidtv/screens/search.ts`, façade `platform/searchInput`.

### 3.1 bis Les champs cachés (recherche, jumelage, profils)

tvOS ignore une vue d'opacité nulle ; Android non. À l'émulateur, HAUT depuis
le champ de la recherche envoyait le focus au vrai `TextInput`, hors écran —
et `focusable={false}` n'y peut rien (seul `ReactViewManager` connaît la prop).
Hors mode tactile, react-native-tvos CACHE en plus le clavier sur un `focus()`
venu du JS : il attend un OK sur le champ lui-même.

`platform/textEntry` (jumeau `.android`) fournit `HiddenTextInput` : sur
Android, le champ vit dans une vue verrouillée (`tvFocusable={false}`,
`FOCUS_BLOCK_DESCENDANTS`), déverrouillée le temps de `focus()`, reverrouillée
au `blur` ; le module natif `TextEntry.showKeyboard` montre le clavier ; le
champ est rendu à sa fermeture, le focus remis au bouton du champ (jumelage,
profils : `KeyboardEntryProvider`) ou à la règle de l'écran (recherche). tvOS :
le `TextInput` tel quel. Émulateur : HAUT depuis le champ y reste ; OK ouvre le
clavier Gboard d'Android TV, et le texte tapé arrive à la recherche. (Le faux
backend du banc rend ses résultats sans `match` : l'écran plante ensuite, défaut
du banc relevé en T6, pas de l'app.)

### 3.2 Conditions d'utilisation

L'ancienne UI d'Android TV ouvrait l'app sur ses conditions d'utilisation
(`Disclaimer`). La refonte de l'Apple TV les a retirées (la langue se choisit
sur l'accueil du jumelage) ; Android TV refondu suit l'Apple TV : la route
n'est plus montée quand la refonte est active. La clé `disclaimer_accepted`
n'est ni lue ni effacée.

### 3.3 Profils (Famille)

Le serveur ne distingue pas les plateformes (`/api/family/tv/*`) : Android TV
refondu passe aux profils comme l'Apple TV (échange du jeton, « Qui regarde ? »,
PIN). Les claviers des formulaires (invité, invitation) passent par le même
`openPairingKeyboard`.

## 4. La bascule et la vérification finale (A5, 2026-10-05)

### 4.1 La bascule

`REDESIGN_ACTIVE` a valu vrai sur les deux téléviseurs, puis l'aiguillage
(`redesignGate.ts`) est parti avec l'ancienne UI d'Android TV, famille par
famille : accueil et « Pour vous », bibliothèque et collections, recherche,
fiche, réglages, jumelage et conditions d'utilisation, bande-annonce, lecteur
(ancien habillage, modale `PlayerSettings`, télécommande `useTVRemote`,
sous-titres natifs d'ExoPlayer), surfaces de l'app et feuille des cartes
(`TVCardActionSheet`), navigation (`TVNavChrome`, `TVSideRail`,
`TVNavContext`). Plus de 150 fichiers. Restent, parce qu'ils marchent côté
moteur : le lecteur natif (ExoPlayer, mpv, `MemoizedPlayer`, modules Kotlin),
la reconnaissance vocale (`useSpeechRecognition`, branchée sur la recherche
refondue), la densité, le stockage, l'authentification. Les routes qui rendent
leur propre rail : `redesignWiring/nav/railRoutes.ts`.

L'outil qui a fait l'inventaire : la fermeture des imports depuis `index.js`,
résolue comme Metro pour `.ios` ET `.android` (les fichiers morts des deux
côtés partent ; un import de type seul ne garde rien en vie à l'exécution —
c'est ainsi que l'ancien habillage du lecteur tenait encore, par
`TVPlayerViewProps`, désormais `playerStageBaseProps.ts`).

### 4.2 Ce que le banc dit (nav-golden `verify --android`, Shield API 31)

Les scénarios de l'Apple TV, rejoués sur l'émulateur contre LEURS références
(`banc.md`, « Android TV »). Un écart de CADRE seul n'est pas un écart de
comportement : les textes de boutons sont 3 à 6 % plus étroits sur Android,
même fichier Inter (`assets/fonts`) — le moteur de texte (Skia/Minikin contre
CoreText). Invisible sans comparaison côte à côte ; à juger sur la Shield.

Corrigé pendant la vérification :

| Écart | Cause | Correctif |
|---|---|---|
| GAUCHE, GAUCHE depuis le contenu s'arrête sur l'entrée, pas sur le profil | `RailShortcuts` coupé hors tvOS | monté sur Android (`REMOTE_SUPPORTED`) |
| GAUCHE depuis une rangée vise l'entrée alignée (« Séries »), pas l'entrée active | `FocusFinder` pondère l'écart croisé : le pont du rail (toute la hauteur) perdait | `BeamSearch` : un guide du faisceau plus proche sur l'axe du geste l'emporte |
| DROITE depuis le rail ouvert vise une carte recouverte | même moteur ; la carte chevauche le rail | un concurrent qui chevauche la source dans l'axe ne bat pas un guide |
| « Mes demandes » ouverte sans focus | le `Dialog` ne focalise rien de lui-même | croix réclamée (`useChoiceEntryClaim`) |
| Retour sur le clavier de la recherche → `key:A` | RE-6 à la lettre ; tvOS rend en fait le champ (constat 4) | `keyboardClosed.android.ts` vise le champ |
| DROITE depuis le rail ouvert vise une carte recouverte ; BAS depuis la dernière bibliothèque file dans le contenu | le rail n'était dans aucune section native : `FocusFinder` seul | groupe du rail (`RAIL_GROUP_KEY`) lié sur Android : section native + piège HAUT/BAS |
| Menu d'organisation ouvert sans focus ; « Tout afficher » rend le focus à la mauvaise entrée | `Dialog` : rien focalisé à l'ouverture, focus rendu SANS événement au retrait | « Déplacer » réclamée ; `railMenuReturnTarget` réclamé au retrait (`claimAfterModalExit`) |
| « Qui regarde ? » coupe « compat-user2 » | nom limité à la tuile (248 pt) — vrai aussi sur tvOS | nom sur la tuile et son écart, réduit plutôt que coupé (les deux téléviseurs) |
| (banc) focus d'une Modal invisible, app en arrière-plan non vue, maintiens | sonde et pilote | `topFocus`/`topBlur`, `AppState`, injecteur `Hold.java` |

Bilan des domaines rejoués (les écarts de CADRE seuls ne comptent pas) :
identiques à l'Apple TV — panneaux-cartes (19/19), socle/rail, raccourcis du
rail (4/4), organiser le rail (12/14), Retour des pages (3/4), recherche
(comportement), Retour → première carte, fenêtre des demandes, profils de la
Famille ; écarts restants listés au § 4.4.

Le plantage des panneaux à guides (§ 2.1, `StackOverflowError`) ne se
reproduit plus sur `main` fusionné : panneaux-cartes, 19 scénarios, même
comportement que l'Apple TV (entrée sur le cran 5, guides des trois groupes,
garde anti-clic, Retour).

### 4.3 Les profils de la Famille, de bout en bout (banc réel)

Jellyfin jetable (harnais `apps/backend/test/jellyfin-compat`, colima),
backend du worktree, comptes `compat-*` seulement : une famille (propriétaire,
un membre, deux invités dont un avec PIN), une TV jumelée par le flux
« appareil ». À l'émulateur : jeton échangé (`/api/family/tv/enroll`),
« Qui regarde ? » (quatre profils, cadenas, « Gérer les profils »), profil
sans PIN ouvert, changement de profil depuis le rail puis depuis les
Réglages (le focus revient au profil actif), profil AVEC PIN par le pavé,
« Gérer les profils » (rôles, droits, actions) — conformes. Seul défaut
relevé : le nom coupé (corrigé, ci-dessus).

### 4.4 Reste à faire (relevé par le banc, non corrigé ce soir)

- **Largeur des textes** : 3 à 6 % plus étroits qu'à l'Apple TV (même Inter) —
  écart de CADRE seul, sur toutes les pages ; à juger sur la Shield, et, si
  visible, à compenser par un `letterSpacing` mesuré (rendu, A2).
- **HAUT tenu dans une grille** passe à la barre de filtres ; l'Apple TV
  s'arrête sur `grid:0` (`ecrans/bibliotheque#bibliotheque-defilement`). La
  barre est dans la MÊME liste que la grille : la règle de tvOS vient
  vraisemblablement d'UIKit (un élément encore hors écran pendant la remontée
  n'est pas visé) — à imiter dans le pas tenu de `TentacleFocusSection`, avec
  un banc dédié.
- **Jumelage, HAUT depuis la langue** : « Configurer manuellement » au lieu
  d'« Afficher le code » — égalité géométrique (deux boutons presque à même
  distance ; tvOS départage par le recouvrement), aggravée par les textes plus
  étroits (`socle/demarrage#demarrage-jumelage`, pas 3).
- **Réglages : GAUCHE depuis le panneau** file au rail (`nav:Settings`) au
  lieu de l'onglet (`ecrans/reglages#reglages-onglets`) : le guide de la
  colonne (`TabsGuide`) a bien sa destination côté JS, mais le natif ne la
  tient pas — RÉAPPLIQUÉE à la main par la sonde (`setDestinations`), elle
  marche. Une réapplication à l'image suivante, puis à la mise en page, n'a
  pas suffi (essai retiré). Piste : l'ordre des commandes de vue de
  l'ancienne architecture (`UIViewOperationQueue` les exécute AVANT les
  créations du même lot, une seule reprise). Même famille, sans doute :
  l'entrée de Réglages › Navigation (`reglages-navigation-deplacer`).
- **Feuilles de filtres de la bibliothèque** : BAS tenu finit sur « Effacer »
  au lieu d'« Appliquer » (`bibliotheque-liste-genres`), BAS depuis les
  années vise « Appliquer » au lieu du préréglage (`bibliotheque-liste-annees`).
- **Parcourir une personne** : BAS depuis l'en-tête entre en `grid:1` au lieu
  de `grid:0` (`parcourir-personne`).
- **Bande-annonce indisponible** : l'écran reste au lieu de rendre la fiche
  (`bande-annonce-indisponible`, A4).
- **Jumelage** : le clavier système d'Android (Gboard) laisse le focus au
  champ, celui de tvOS le prend en plein écran — écart de plateforme, pas de
  comportement (`ecrans/jumelage`).
- **Non analysés** (dernière passe) : `vigie`, `jumelage-sortie`,
  `defilement#rail-24-bibliotheques`, `retour-pages#accueil-retour-x3`,
  `collections` (fiche lente à l'arrivée, sans doute la build debug).
- **Fiche lente** (série) : à l'arrivée, le focus peut tomber sur la croix
  (`ecrans/fiche#fiche-saisons-episodes`) — la build debug de l'émulateur est
  lente, à revérifier en release.
- **Lecteur** : Android ne demande pas `PlaybackInfo` à l'ouverture (chaîne
  de flux du moteur Android, reprise telle quelle) — l'Apple TV, si ;
  défilement : un OK sur la frise rend `player:playpause` au lieu de
  `player:scrub` (`lecteur#lec-05`, pas 5).
- **Mesures** : l'émulateur en build debug ne dit rien de la fluidité
  (~650 ms par image, rendu logiciel) ni de la mémoire (PSS 934 Mo dont
  757 Mo de tas natif, sans Hermes compilé) : à mesurer sur la Shield, en
  release.
