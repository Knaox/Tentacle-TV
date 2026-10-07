# Mode Lite : la mémoire (L6)

Pourquoi l'app Android TV montait de 300 à 600 Mo en dix minutes, ce qui a été
corrigé pour tout le monde, et ce que le niveau Lite change en plus. Les
mesures ont été prises à l'émulateur (`lite.mjs memoire run`, AVD
`Lite_L6_1G` et `Lite_L6_2G`). La passe sur la Shield reste à faire (voir la
fin).

## 1. La rétention des vues : un bug, corrigé dans les deux modes

**Cause**, prouvée par une capture du tas (`memoire run --heap`, analyse des
chemins jusqu'aux racines) :

- `focus/ShownKeeper` et `focus/RevealFollower` rangeaient leur objet dans
  un `WeakHashMap<Vue, Objet>`.
- Or cet objet garde sa vue (la page, la rangée). La valeur retenait donc la
  clé, et l'entrée ne partait jamais.
- Avec elle restaient la vue, toute sa descendance (les vues retirées que
  `ViewGroup.mTransitioningViews` garde encore) et leurs images.

| AVD 2 Go, normal, après 3 tours d'endurance | Vues vivantes (après GC) | Vues détachées |
|---|---|---|
| Avant | 4 623 | **2 794** (dont 1 973 par `ShownKeeper`, 574 par `RevealFollower`) |
| Après | 1 830 | **1** (la barre d'outils de react-native-screens) |

**Correction** : l'objet est tenu PAR sa vue, par une étiquette
(`focus/ViewOwned.kt`, ids dans `res/values/ids.xml`). La table des vues
connues n'a plus de valeur et ne retient plus rien. On garde le même objet par
vue et le même parcours dans `settleAll` : le comportement ne change pas.

**Règle** : jamais de `WeakHashMap<View, X>` dont la valeur garde la vue.

## 2. Ce que le niveau Lite change (`memory/LiteMemory.kt`)

Le niveau se décide dans le JS (tv-core `device/renderTier`) et revient au
natif par `TentacleDevice.report`. Au démarrage, on part de la décision du
lancement précédent (`RenderTierStore.lastTier`). En mode normal, chaque point
ci-dessous rend la valeur d'origine.

| Levier | Lite | Normal |
|---|---|---|
| Cache des images décodées (Fresco) | 24 Mo, dont 8 Mo hors usage, relu toutes les 30 s | budget de Fresco (¼ de `getMemoryClass`, soit 48 Mo) |
| Décodage des JPEG | 720 px au plus de côté (affiches, vignettes) en RGB_565 ; fonds et héros en ARGB_8888 ; PNG intouchés | `decodeJpeg` d'origine |
| Écrans recouverts (patch `CoveredScreens`) | une fois caché : `INVISIBLE`, les vues restent attachées, Fresco relâche les images | gardés attachés, images en usage |
| `onTrimMemory` (RUNNING_LOW, CRITICAL, UI_HIDDEN et au-delà) | caches d'images vidés, puis un ramassage Java au plus toutes les 5 s | rien |
| Sous le lecteur (`useReleaseHiddenImages`) | 1,2 s après l'ouverture, caches d'images vidés ; l'interface garde ses vues et son focus | rien |
| Fonds plein écran (fiche, chargement et fin du lecteur) | 960 px de large (tv-core `backdropWidthFor`) | 1920 |

Le héros de l'accueil garde son image en 1280 : c'est l'œuvre au premier plan,
pas un fond.

**Le journal** : `adb logcat -s TentacleLite`. Il donne le niveau, le premier
JPEG décodé en RGB_565, et l'état du cache à chaque purge (nombre d'images,
Mo, part en usage, plafond).

## 3. Mesures

Toutes sur l'app de mesure, faux backend nav-golden, charge du Mac sous 20.

### AVD 2 Go : 6 tours d'endurance (rangées, fiche, Films)

| | Repos | Tour 3 | Tour 6 | Après RUNNING_CRITICAL |
|---|---|---|---|---|
| Avant, normal | 257 Mo · natif 129 · 1 811 vues | 367 · 4 735 vues | **436** · natif 235 · **8 442 vues** | 402 |
| Après, Lite | 245 · natif 107 | 312 | **333** · natif 149 · 2 858 vues (1 830 après GC) | **288** |
| Après, normal | 268 · natif 127 | 357 | **371** · natif 178 · 2 858 vues (1 830 après GC) | 331 |

Au tour 6, les objets `View` comptés sans GC repassent de 2 858 à 1 830 à
chaque ramassage : ils ne s'accumulent plus. Le PSS se stabilise vers
330-340 Mo à partir du 4e tour.

### AVD 1 Go

Sur cet AVD, l'app est tuée par le lowmemorykiller au premier plan
(« direct reclaim and thrashing »), avant comme après. Le système lui-même ne
laisse que 50 à 160 Mo : Google Play Services y est tué et relancé en boucle,
et même le lanceur meurt.

Deux passes en alternance, 6 tours d'endurance (chaque tour : rangées, fiche,
Films). On compte les tours réussis avant la mort.

| Version | Repos (PSS) | Tours réussis (passe a / b) |
|---|---|---|
| Avant, normal | 164-177 Mo | 2 / 1 (une 3e passe : morte au repos) |
| L6 seul, Lite | 155-174 Mo | 3 / 2 |
| L6 + L5b (montage borné), Lite | **122-178 Mo** | **6 sur 6, sans mort** / 5 |

La combinaison L6 + L5b est la première qui tienne le parcours entier sur cet
AVD. Ce n'est pas encore « aucune mort » à coup sûr : la passe b est morte au
6e tour, à l'ouverture d'une fiche.

### Ce que l'app fait au repos (mesuré, rien de modifié)

Accueil, 120 s puis 330 s sans une touche, AVD 2 Go :

- **Réseau** : aucune requête de fond en 5,5 min, hors images du héros. Un
  seul WebSocket reste ouvert (`/api/ws`).
- **Au lancement** : 4 `Playback/BitrateTest` (la mesure du débit), puis
  ~30 requêtes de données.
- **Processeur** : environ 4,4 % d'un cœur du Mac pour le fil UI, autant pour
  le RenderThread, 2,5 % pour le JS. C'est presque entièrement la **rotation
  du héros** : une salve d'environ 40 images toutes les 8 s, avec à chaque
  fois ~320 composants React rendus et 30 vues créées. Rapporté à un A53
  (×10 à 15), cela fait une part réelle d'un cœur de la box au repos. Relevé
  pour L5 (point chaud n° 10 de BASELINE.md).
- **WebView** : la bibliothèque Chromium (Trichrome, ~13 Mo de RSS) est
  chargée par le gestionnaire de cookies de React Native
  (`ForwardingCookieHandler`). C'est une piste, non touchée.

## 4. Ce qui reste à prouver sur un vrai appareil

- **La Shield** (passe courte, mode normal) : la fin de la rétention. On
  attend un PSS qui ne dépasse plus ~350 Mo en dix minutes, au lieu de
  490-600. **Non faite** : l'adb réseau de la Shield est coupé, à faire en L7.
- Le budget réel d'une box à 1-2 Go (`isLowRamDevice`, lmkd du constructeur,
  services Google allégés). L'AVD 1 Go n'en est qu'une caricature.
- La mémoire graphique, qui vaut 0 à l'émulateur.
