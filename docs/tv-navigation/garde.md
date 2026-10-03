# La garde — lint, audit et pureté de tv-core

Domaine de T8. Index : [`../TV-NAVIGATION.md`](../TV-NAVIGATION.md). Le relevé
ligne à ligne : [`inventaire.md`](inventaire.md).

La navigation TV n'a qu'une source : ce qui DÉCIDE vit dans `@tentacle-tv/tv-core`,
ce qui APPLIQUE vit dans l'adaptateur `apps/tv/src/platform/tvos/`. Trois gardes
le tiennent sans relecture.

## 1. Le lint — `eslint/tvNavigation.mjs`

Six règles locales (`tv-nav/…`), une par famille d'API native de télécommande
ou de focus :

| Règle | Ce qu'elle refuse |
|---|---|
| `no-remote-events` | `TVEventHandler`, `useTVEventHandler`, `TVEventControl`, `BackHandler` (import, ou `require("react-native")` déstructuré) |
| `no-focus-guides` | `TVFocusGuideView`, `TVTextScrollView` ; `destinations`, `autoFocus`, `trapFocus*` (attribut JSX ou clé d'objet) |
| `no-focus-props` | `hasTVPreferredFocus`, `nextFocus*`, `isTVSelectable`, `tvParallaxProperties`, `focusable`, `tvEntry`, `tvNeighbors` (attribut JSX ou clé d'objet — les props passées par `native: {…}` comptent) |
| `no-native-focus-calls` | `setNativeProps`, `requestTVFocus`, `findNodeHandle` ; les vues natives `TentacleFocusSection` et `TVMenuPressInterceptor` ; `MenuPressInterceptor`, `NativeFocusSection` |
| `no-native-press` | `Pressable` et `Touchable*` hors de `FocusTarget` ; `onFocus` / `onBlur` sur `View`, `TextInput`, `ScrollView` ; `.focus()` / `.blur()` |
| `no-platform-branch` | `Platform.OS`, `Platform.isTV`, `Platform.isTVOS`, `Platform.select` |

**Portée** — le chemin refondu : `apps/tv/src/redesign/`, `apps/tv/src/redesignWiring/`,
les fichiers `*.ios.ts(x)` d'apps/tv, et un fichier tvOS seul sans suffixe
(`components/player/AVPlayerSurface.tsx`). **Permis** :
`apps/tv/src/platform/tvos/**` et les tests.

**Pas concernés** (et pourquoi) : l'ancienne UI et le code d'Android TV ; les
fichiers PARTAGÉS avec Android TV (les crochets du lecteur, `useTvFocusClaim`,
`useTVRemote`…) — l'inventaire les suit, et un partagé ne s'amincit sur tv-core
qu'avec un banc qui prouve l'équivalence Android (règle du lot) ; les
minuteries de navigation et les décisions prises par le magasin de focus (le
« second cercle ») — illisibles pour un lint sans types, l'inventaire les suit.

**Exceptions** — `eslint/tvNavigationExceptions.mjs` : un fichier, les familles
qu'il garde, la tâche qui le traitait, et pourquoi. Une exception vise UNE
famille d'un fichier, jamais le fichier entier. `owner: null` = exception
PERMANENTE : toutes le sont depuis la fin du lot.

**Gravité** — en ERREUR depuis la fin du lot : la liste ne garde que des
exceptions PERMANENTES (les portes des vues, la vue native du Retour,
l'aiguillage de la refonte, le rendu, un libellé, un réglage d'appareil). Elle
tourne dans `pnpm lint` (`pnpm --filter @tentacle-tv/tv lint`). La garde pre-push ne joue pas le lint,
et la CI non plus : les ajouter ensemble est un choix de processus de livraison
(proposition : branche `nav/t8-prepush-lint`, à compléter de `quality.yml`).

## 2. L'audit — `node eslint/tvNavigationAudit.mjs`

Joue les six règles SANS exception sur la portée, et confronte :

- une exception qui ne couvre plus rien est **périmée** : la tâche a extrait le
  fichier, la ligne doit partir ;
- un usage hors de toute exception est **nouveau** : à extraire, ou à inscrire
  avec sa justification.

Sort en erreur s'il y a l'un ou l'autre ; `--json` rend le relevé complet,
ligne à ligne.

**La liste fond à chaque fusion.** Une tâche qui extrait un fichier retire ses
lignes d'exception DANS la même fusion ; T8 rejoue l'audit après chaque fusion
et signale au coordinateur ce qui a échappé.

## 3. La pureté de tv-core — `packages/tv-core/src/purity.test.ts`

Vitest, avec les tests du paquet :

- aucun paquet de la famille React Native, ni `react-dom`, ni
  `@react-navigation/*`, ni Expo — dans tv-core ET dans ce qu'il charge de
  `@tentacle-tv/shared` ;
- aucune globale du DOM (`window.`, `document.`, `HTML*Element`…) hors
  commentaire ; aucune dépendance déclarée de ce genre ; un tsconfig sans `lib`
  DOM ;
- la règle de rangement : hors des tables de traduction (`remote/bindings/`),
  aucun `eventType` ni `Platform.OS` ;
- en cliquet sur l'existant d'avant le lot : aucun module NOUVEAU ne s'appuie
  sur React ni n'arme un minuteur caché (`setTimeout(` nu : l'horloge
  s'injecte). Les fichiers d'avant sont listés dans le test.

## Brancher une plateforme

Android TV, le jour venu : sa table (`remote/bindings/androidtv.ts`), son
adaptateur (`apps/tv/src/platform/androidtv/`, permis comme celui de tvOS), et
la portée de la garde étendue à son chemin refondu. Rien d'autre ne change :
les comportements de tv-core sont déjà les siens.
