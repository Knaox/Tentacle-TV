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
| Relâchement d'OK sous le panneau ouvert | ✅ aucune écriture au faux backend (garde anti-clic fantôme) |
| Retour dans le panneau | ✅ fermé par `onRequestClose`, un seul Retour, focus rendu à la carte |
| Entrée sur l'échelle (cran 5) | ❌ aucun focus dans le `Dialog` ; seule « Noter 5 » est focalisable (verrou d'A1 appliqué), mais sa demande de focus échoue |
| Flèche dans le panneau sans focus | ❌ plantage natif : `StackOverflowError`, `ReactViewGroup.requestFocus` ↔ `requestFocusViewOrAncestor` |

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
→ sortie de l'app, comme tvOS), fiche poussée (recule), lecteur (recule vers
l'accueil), recherche (rail), Réglages (rail sur leur entrée, puis sortie),
grand panneau (fermé).

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
le champ de la recherche envoyait le focus au vrai `TextInput`, hors écran.
`platform/textEntry` (jumeau `.android`) : sur Android, le champ caché est non
focalisable hors saisie (`HIDDEN_INPUT_PROPS`), libéré le temps de l'ouvrir
(`openHiddenInput`), rendu et reverrouillé à la fermeture du clavier, le focus
remis au bouton du champ (jumelage, profils : `KeyboardEntryProvider`) ou à la
règle de l'écran (recherche).

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
