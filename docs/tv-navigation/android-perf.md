# Fluidité d'Android TV — mesurer, et vérifier les 60 i/s sur la Shield (lot A6)

Android TV rend la refonte de l'Apple TV à l'identique : mêmes vues, mêmes
animations (durées, courbes, amplitudes — `motion/motion.ts`, jetons
`TV_MOTION`). Ce que ce lot a changé, c'est COMMENT c'est rendu sur Android,
jamais CE QUI est rendu : rien ne disparaît, rien ne se voit autrement.
Cible : NVIDIA Shield TV Pro (Tegra X1+, Android 11), interface rendue en
1080p, 60 Hz.

## 1. Le mode de mesure de l'app

Éteint par défaut, il s'allume sans rien reconstruire, sur n'importe quelle
build — celle du Play Store comprise :

```bash
adb connect <adresse-de-la-shield>:5555        # Options pour les développeurs → Débogage réseau
adb shell setprop debug.tentacle.perf 1        # puis relancer l'app
adb logcat -s TentaclePerf                     # le journal « [perf] »
adb shell setprop debug.tentacle.perf 0        # l'éteindre (un redémarrage l'éteint aussi)
```

Chaque FENÊTRE d'images — tout ce qu'un geste ou une animation a fait
dessiner, jusqu'à 300 ms de repos — s'écrit en une ligne :

```
[perf] écran:Home + tenu:bas ×23 — 212 images, 0 ratée, 0 grave · durée p50 6,1 · p95 9,8 · max 13,0 ms
       · fil UI p95 4,2 (animations p95 1,9) · rendu p95 3,7 ms · React : 31 validations, 410 composants, 96 vues créées, 220 mises à jour
```

- **ratée** : une image qui a pris plus d'un intervalle d'affichage (16,7 ms
  à 60 Hz) — une saccade ; **grave** : plus de deux ; « (N par le
  processeur) » : celles dont le travail du processeur seul (fil UI et
  synchronisation, sans le GPU) dépasse l'intervalle — le JSON en donne
  aussi le compte au-delà de 2, 4 et 8 ms (`cpuOver`). Sur Android 11 (la
  Shield), une image ratée au sens du journal l'est aussi pour `gfxinfo` ;
  sur Android 12 et plus, `gfxinfo` juge à l'échéance d'affichage et en
  compte moins ;
- **durée** : de la vsync visée à l'image rendue (FrameMetrics) ;
- **fil UI** : le fil principal (attente, entrée, animations — les opérations
  de React Native et de Reanimated —, mise en page, dessin) ; **rendu** : le
  RenderThread (synchronisation, dont l'envoi des textures, commandes GPU) ;
- **React** : ce que les rendus ont coûté pendant la fenêtre ;
- le nom : l'écran, puis les gestes (`flèche:bas`, `tenu:bas` = répétition
  d'une flèche tenue, `ok`, `maintien:select`, `retour`…) ; `(sans geste)` :
  une animation spontanée (rotation du héros, fondu du fond).

Les blocages du fil UI, toutes fenêtres comprises (une `Modal` — le grand
panneau, les feuilles — est une fenêtre à part) : `[perf] fil UI bloqué
120 ms (6 images sautées) — après « maintien:select »`.

Et les chargements : `[perf] démarrage — « accueil » prêt 2 840 ms après le
lancement du processus`, `[perf] chargement — « fiche » prêt 410 ms après
l'arrivée sur « MediaDetail »`.

Éteint, le mode ne coûte rien : une propriété lue une fois au lancement,
aucun écouteur, aucun fil, et le JS s'arrête au drapeau.

## 2. Les seuils attendus sur la Shield

| Geste | Attendu |
|---|---|
| Focus d'une carte (un appui) | 0 image ratée |
| Croix maintenue (rangée, accueil, grille) | 0 ratée hors de la première image d'une rangée qui entre ; ≤ 1 % sinon |
| Rail qui se déplie, héros qui tourne, fond qui change | 0 ratée |
| Grand panneau, feuilles (ouverture) | ≤ 1 ratée à l'ouverture (création de la fenêtre), 0 ensuite |
| Écran poussé (fiche) | ≤ 2 ratées pendant le fondu |
| Démarrage | accueil prêt en moins de ~3 s depuis le lancement |

## 3. Les outils d'Android, en complément

**Barres de profil GPU à l'écran** — Options pour les développeurs → « Rendu
HWUI du profil » → « À l'écran sous forme de barres » (ou
`adb shell setprop debug.hwui.profile visual_bars`, puis relancer l'app ;
`false` pour l'éteindre). La ligne verte = 16 ms : une barre qui la dépasse
est une image ratée. Le bas des barres (vert foncé et clair) est le fil UI ;
le haut (rouge, orange) le RenderThread et le GPU.

**gfxinfo** — le décompte d'Android, pour un geste :

```bash
adb shell dumpsys gfxinfo com.tentacletv.mobile reset
# … le geste …
adb shell dumpsys gfxinfo com.tentacletv.mobile | grep -E "Janky|percentile|Number"
```

**Perfetto** — la trace complète (fils, textures envoyées, tranches React
Native) :

```bash
adb shell perfetto -o /data/misc/perfetto-traces/tentacle.pftrace -t 10s sched freq gfx view input am wm
adb pull /data/misc/perfetto-traces/tentacle.pftrace
```

puis https://ui.perfetto.dev. À regarder : le RenderThread (« Upload WxH
Texture » : une image envoyée au GPU ; « DrawFrame »), le fil principal
(« Choreographer#doFrame » ; « animation » : les opérations de React Native),
le fil `mqt_js` (le JS).

## 4. Le banc (`apps/tv/harness/android-perf`)

Chaque animation rejouée sur l'émulateur ou une Shield, mesurée par le mode
de mesure et le temps processeur de chaque fil, avant/après : voir son
README. Sur l'émulateur, la durée brute d'une image ne dit rien de la Shield
(l'envoi d'une texture y traverse le tuyau de l'émulation) : ce qui se
compare, c'est le TRAVAIL.

## 5. Ce que le banc a mesuré (émulateur, 2026-10-05)

Émulateur Android TV 12 (API 31, arm64) sur Apple M4, GPU du Mac par la
traduction GL → Metal ; release signée, compilée par son profil comme
l'installerait le Play Store ; faux backend nav-golden, images retaillées
comme Jellyfin. Les deux versions en ALTERNANCE (avant, après, après,
avant), chacune échauffée, et l'émulateur sur les cœurs ÉCONOMES du Mac le
temps de chaque mesure (`--slow`) : l'Apple M4 n'a que quatre cœurs de
performance, et quand d'autres sessions compilaient, le même geste coûtait
deux à trois fois plus d'une passe à l'autre. Sur ses cœurs économes,
l'émulateur va encore ~3 fois plus vite qu'un cœur de la Shield : un
travail de 5 ms ici en vaut ~15 là-bas. On compare donc le TRAVAIL — les
images ratées de l'émulateur ne disent rien de la Shield (son « échange »
de tampons, le GPU du Mac à travers le tuyau de l'émulation, tient ~9 ms
par image ; `gfxinfo`, qui juge à l'échéance d'affichage, n'y compte
aucune image ratée, avant comme après).

Avant (main du 05/10 + mode de mesure) → après (le lot, correctif Reanimated
compris), passe C, deux passes alternées par version. Fil UI par image :
entrée + animations + mise en page + dessin ; blocages : le fil UI pris
48 ms ou plus.

| Geste | fil UI/image (ms) | blocages | pire blocage (ms) | composants/geste | GC (ms) |
|---|---|---|---|---|---|
| Démarrage à froid | 7,9 → 18,7 ¹ | 11 → 26 ¹ | 1 049 → 449 | 8 807 → 7 149 | 135 → 225 |
| Focus d'une carte (12 pas) | 7,1 → 6,4 | 19 → 1 | 199 → 66 | 178 → 163 | 128 → 68 |
| Rangée tenue | 11,2 → 10,5 | 9,5 → 3 | 349 → 116 | 2 352 → 2 133 | 151 → 78 |
| Accueil pas à pas | 8,4 → 9,0 | 3,5 → 3 | 83 → 66 | 208 → 196 | 126 → 61 |
| Accueil tenu | 13,3 → 13,2 | 10 → 11,5 | 133 → 66 | 1 161 → 1 060 | 120 → 46 |
| Rail (3 dépliages) | 13,9 → 13,0 | 7,5 → 5 | 83 → 66 | 728 → 747 | 68 → 57 |
| Héros (2 rotations) | 2,5 → 4,7 ² | 1,5 → 3 | 66 → 216 | 429 → 437 | 28 → 0 |
| Grand panneau | 5,1 → 6,9 ² | 3 → 4 | 149 → 149 | 514 → 514 | 14 → 19 |
| Fiche (entrée) | 25,6 → 8,4 | 23 → 7 | 3 633 → 183 | 249 → 249 | 129 → 120 |
| Recherche (frappe) | 6,7 → 5,9 | 0,5 → 0 | 49 → 0 | 521 → 312 | 60 → 66 |
| Lecteur | 4,8 → 5,0 | 1 → 0,5 | 116 → 49 | 167 → 134 | 0 → 62 |
| Grille tenue | 14,5 → 7,8 | 14,5 → 0 | 349 → 0 | 1 283 → 1 223 | 373 → 121 |

Cette passe a tourné sur un Mac chargé (l'émulateur ~2,5 fois plus lent
qu'au calme) : seuls les grands écarts y sont sûrs — la fiche, la grille,
les blocages des gestes tenus, le ramasse-miettes divisé par deux. Au
calme (passe A, mêmes correctifs sauf les derniers) : démarrage, pire
blocage 233 → 83 ms et accueil prêt 686 → 484 ms ; fiche, blocages 4 → 0,5 ;
recherche, 522 → 316 composants par frappe.

¹ Parts de quatre cartes qui s'empilaient sur un émulateur ralenti : d'où
le rythme des parts et les parts de deux cartes (`STAGING_PACE`), venus
après cette passe. ² Le bruit de la passe : la même base y varie du simple
au double (héros 1,6 à 3,5 ms), le même travail React (composants, vues
créées) des deux côtés.

Les derniers correctifs — le rythme de l'échelonnement, recul et focus en
deux styles, la pilule du rail, l'échelle de note — n'ont pas eu de passe
complète à eux : ils retirent des mises à jour par image (comptées par le
mode de mesure, « Reanimated : N vues… ») sans rien changer à l'écran. À
vérifier sur la Shield par le journal `[perf]`.

### Ce qui reste au-dessus de 16,7 ms (projection)

Au calme, l'émulateur va ~8 fois plus vite qu'un cœur de la Shield. Projeté :

- **le focus d'une carte** : ~2 ms de fil UI par image au calme, ~15 ms sur
  la Shield — à la limite, tenu ;
- **l'accueil tenu** (5,3 à 5,9 ms au calme, ~45 ms projetés) et **le
  dépliage du rail** (4,4 ms, ~35 ms) : au-dessus. Le poste, c'est
  Reanimated — ~25 vues mises à jour par image, chacune convertie par JNI et
  appliquée par le gestionnaire de vues. Les derniers correctifs en retirent
  près de la moitié (recul sans transformation, libellés invisibles du rail) ;
  le reste est le dessin de la refonte lui-même ;
- **le démarrage** : ~0,7 s jusqu'à l'accueil prêt au calme, de l'ordre de
  5 s sur la Shield, puis l'échelonnement (~2 s) ;
- **l'ouverture du grand panneau** : ~240 vues montées d'un coup, dont des
  pictogrammes SVG que react-native-svg rastérise en logiciel sur Android.

### Le premier poste du fil UI pendant une animation : Reanimated

Une trace des pas du focus (atrace, version finale) : sur le fil principal,
`Choreographer#doFrame` coûte en moyenne 2,2 ms par image sur le M4, dont
1,4 ms de phase « animation » — où React Native n'explique que ~0,1 ms (ses
opérations d'interface) : le reste est le rappel d'images de Reanimated, qui
ne trace rien. Pour chaque vue animée et à chaque image, il évalue le style
sur son runtime d'interface, renvoie l'objet de style ENTIER dès qu'une
valeur change (`shallowEqual` : un tableau `transform` neuf n'est jamais
égal), le convertit en tables Java par JNI, en alloue deux autres (natives)
même vides, puis l'applique par le gestionnaire de vues (une transformation
se décompose en matrice). D'où :

- ne rien animer d'inutile : `Reveal` sans montée n'envoie plus de
  translation nulle, un seul ressort par carte (cadre et légende), la pilule
  de focus du rail n'existe qu'avec le focus ;
- ne jamais mêler dans un style deux mouvements indépendants : le recul
  d'une carte (son opacité) renvoyait sa transformation à chaque image, un
  cran de l'échelle de note qui pâlit aussi — deux styles sur la même vue ;
- alléger l'application elle-même (`patches/react-native-reanimated@3.19.5.patch`) ;
- et compter : le mode de mesure dit les vues mises à jour par image
  (« Reanimated : N vues… par image »).

## 6. Ce qui a été fait, et pourquoi ça ne se voit pas

Tout passe par le profil de rendu de tv-core (`render/renderProfile.ts`) ou
ne change que la manière de rendre : l'Apple TV ne bouge pas.

| Correctif | Ce qu'il change | Pourquoi c'est invisible |
|---|---|---|
| Images des cartes à leur taille d'affichage (`cardArtwork` : 412 / 400 sur Android, 640 / 480 sur Apple TV) | 59 % de pixels en moins par vignette, 31 % par affiche : moins à décoder, à garder, à envoyer au GPU | l'interface est rendue en 1080p : la plus grande carte, agrandie par le focus, fait 410 × 231 ; le GPU ne réduit plus l'image qu'à peine au lieu d'un tiers |
| Images de la fiche, du grand panneau, de la recherche et des bibliothèques à l'échelle de l'interface (`imageScale` : 1 sur Android, 2 sur Apple TV ; `imagePixels` compte le zoom du focus) | logos, vignettes d'épisodes, portraits, en-têtes demandés à leur taille d'affichage au lieu du double : un quart des pixels à décoder, garder et envoyer au GPU | l'interface d'Android est rendue en 1080p : l'image au double y était réduite de moitié par le GPU ; ce qui grandit au focus est demandé à sa taille agrandie |
| Textures envoyées dès le décodage (Fresco `prepareToDraw`) | l'envoi au GPU quitte l'image qui la dessine pour une tâche du RenderThread entre deux images | mêmes pixels, même moment d'apparition |
| Rangées montées par échelons (`stagedRows`, tv-core `render/rowStaging`) | l'accueil et « Pour vous » ne créent plus ~2 450 vues d'un bloc : la première rangée d'emblée (un écran de large), puis deux cartes par image À L'HEURE — après une image en retard, on attend la suivante (`STAGING_PACE`) — : la tête de chaque rangée, puis les queues ; la rangée qui prend le focus passe devant | ce qui se monte après est hors de l'écran ; la rangée parcourue ne manque jamais de cartes sous le pouce |
| Cartes de rangée aux gestionnaires stables (`RowCard`) | une rangée qui s'allonge ou change ne redessine plus ses cartes | même rendu, mêmes appels |
| Rangées de résultats de la recherche aux gestionnaires stables (`ResultRow`) | une frappe ne redessine plus que les rangées qui changent | mêmes rangées, mêmes appels |
| Lumière du fond hors du rendu de l'écran (`ambientSource`) | un pas du focus ne redessine que le fond vivant, plus l'écran câblé et ses crochets | même lumière, au même moment |
| Mise en page sans redessin hors du banc UI (`useForcedFocusReveal`) | l'arrivée des rangées ne redessine plus la page à chaque section | l'outil ne sert qu'au banc |
| Révélation sans montée (`Reveal`, `rise` nul) | un fondu n'envoie plus au natif, à chaque image, une translation nulle (décomposée en matrice par le gestionnaire de vues) | une translation de 0 ne déplace rien |
| Un seul ressort de focus par carte (`MediaCard` le prête à `CardFrame`) | le cadre et la légende suivaient deux ressorts identiques (mêmes réglages, même départ) : une animation par carte au lieu de deux | les deux valaient la même chose à chaque image |
| Recul et focus en deux styles (`CardFrame`, `PeopleRow`, `RulerCell`) | une carte qui recule, un cran qui pâlit n'envoient plus que leur opacité — avant, leur transformation repartait avec à chaque image (une trentaine de cartes par pas vertical sur l'accueil) | même vue, mêmes valeurs, dans la même image |
| Pilule de focus du rail montée avec le focus (`NavItem`, `useFocusDressing`) | chaque entrée montait au repos sa pilule blanche invisible, avec un second pictogramme SVG et, rail ouvert, un second libellé qui glissait à chaque image | au repos elle valait zéro ; elle naît avec le focus, s'éteint avec son retour |
| Application des styles animés allégée (Reanimated, `patches/react-native-reanimated@3.19.5.patch`) | pour chaque vue animée et à chaque image : plus deux tables natives allouées pour rien, et la transformation copiée une fois en structures Java au lieu d'une copie native relue par JNI | les mêmes valeurs, appliquées aux mêmes vues, dans la même image |
| Profil de base étendu (Kotlin, AndroidX, OkHttp) | ce code est compilé d'avance au lieu d'être interprété au premier défilement | du code compilé plus tôt |

Laissé de côté, et pourquoi : R8 (réduction du code Java/Kotlin) — les
rappels JNI de libmpv et la réflexion de React Native le rendent risqué pour
le lecteur, pour un gain surtout de taille ; le verre en direct — le profil
d'Android le dessine déjà sans flou (A2).

## 7. Sur la vraie Shield (lot A7)

Mesures, procédure et correctifs sur la Shield elle-même :
[android-perf-shield.md](android-perf-shield.md).
