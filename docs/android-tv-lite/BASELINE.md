# Mode Lite — la mesure de départ (L1, 07/10)

Ce que coûte l'app Android TV **telle qu'elle est** (mode normal, rien
d'optimisé), écran par écran, sur la Shield et sur les appareils contraints
du banc ; ce que coûte chaque effet, coupé un par un ; et, pour chaque point
chaud, l'équivalent Lite proposé. Rappel de la règle de Damien : **disposition
et navigation identiques** — seuls les effets, les animations, le montage, les
images et la mémoire changent.

APK mesurée : `lite/l1-baseline` sur dev 610ca53a0, app de MESURE
(`com.tentacletv.mobile.perf`, `-PtentaclePerfApp=1`), release, profil de base
compilé, faux backend nav-golden derrière le relais d'images (tailles de
Jellyfin). Aucun compte réel.

## En bref

1. **La mémoire est LE problème d'une box faible.** Sur la Shield, l'app pèse
   **~300 Mo au repos** (PSS) et **~510-600 Mo après 10 min** de navigation ;
   le tas natif (les images décodées) passe de 111 à 275 Mo, et les objets
   `View` vivants de 1 800 à **9 700** (les vues attachées restent ~1 800 : des
   vues détachées mais retenues). Sur l'AVD **1 Go**, l'app est **tuée par le
   lowmemorykiller** (premier plan, `oom_adj 0`, RSS ~250 Mo) dès qu'on ouvre
   « Films », trois fois sur trois, puis dans la grille « Animés ».
2. **Le mouvement de Reanimated est l'effet le plus cher.** Coupé, le focus
   d'une rangée passe de 26 % à 3 % d'images ratées sur la Shield (fil UI
   −55 %), la fiche de 39 % à 11 %. Viennent ensuite l'habit du focus
   (agrandissement + ombre : 26 → 9,5 %), le fond vivant, les ombres, le
   verre, les dégradés (chacun ~26 → 18-19 %), le fondu de page (fiche
   39 → 31 %). Les flous (halos en masque natif) ne coûtent plus rien.
3. **Les montages d'un bloc** font les pires images : démarrage (1 808 vues,
   blocages jusqu'à 316 ms), ouverture de « Films » (1 715 vues, 166 ms),
   fiche d'une série (3 501 vues attachées, 462 Mo).

## Conditions

| Appareil | Système | Ce qui est mesuré | Charge du Mac |
|---|---|---|---|
| NVIDIA Shield TV Pro (Tegra X1+, 3 Go) | Android 11 | tout : images, mémoire (graphique comprise), effets, 10 min | 4-117 (sans effet sur l'appareil ; notée) |
| AVD `Lite_API31_1G` (1 Go, 2 cœurs, sans frein) | Android TV 12 | démarrage, mémoire, survie | 9-132 (passe 1), 7-12 (passes 2-3) |
| AVD `Lite_API31_2G` (2 Go, 4 cœurs) — passes de **L0** | Android TV 12 | parcours complet, sans frein et `duty:25` | 6-25 |

Outils : `apps/tv/harness/android-perf/baseline.mjs` (écrans, effets,
10 min) et `lite.mjs parcours` (L0). Images « ratées » : au-delà de 16,7 ms
(définition « legacy », la seule comparable entre Android 9-11 et 12) ;
« blocage » : fil UI pris 48 ms ou plus. Effets : propriété
`debug.tentacle.fx`, lue par l'app de MESURE seulement (dans l'app livrée,
rien ne se coupe ; Apple TV : `measuredEffects.ios.ts` ne coupe rien).

Incidents de banc, réglés en route : l'adb réseau de la Shield tombe toutes
les ~10 min cette nuit (sans redémarrage) et la reconnexion perdait le
`adb reverse` du relais — le banc rétablit les deux ; un faux backend NEUF
sert son premier catalogue en plus de 10 s, et la mise en place des saisons
partait alors de la barre des filtres (`--external` : faux backend déjà
lancé). Aucune touche hors de l'app de mesure (garde de L0).

## La Shield, mode normal — écran par écran

Deux passes par écran (moyennes ; « pire » = le pire des passes). Mémoire
relevée juste après le geste. « GPU » = `Other mtrack` de meminfo (les
textures de la Tegra, que le résumé « Graphics » ne compte pas : il n'y met
que l'EGL, 12 Mo constants).

| Écran (geste) | Images | Ratées | p95 pire | Pire image | Blocages (pire) | Vues créées / pas | Vues attachées | PSS | Java | Natif | GPU |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Démarrage à froid → accueil prêt | 112 | 35 % | 313 ms | 349 ms | 8,5 (316 ms) | 1 808 | 1 813 | 277 Mo | 18 | 91 | 57 |
| Accueil : focus d'une carte (12 pas) | 415 | 21-26 % | 23 ms | 35 ms | 0 | 18 | 1 836 | 290-302 Mo | 24 | 105-112 | 57 |
| Accueil : défilement tenu | 205 | 60 % | 47 ms | 67 ms | 0,5 (50) | 396 | 1 822 | 304 Mo | 23 | 107 | 61 |
| Accueil : rail (3 dépliages) | 204 | 64 % | 64 ms | 68 ms | 0,5 (50) | 52 | 1 822 | 299 Mo | 20 | 107 | 57 |
| Accueil : rotation du héros (×2) | 126 | 31 % | 35 ms | 43 ms | 0 | 322 | 1 827 | 325 Mo | 21 | 123 | 68 |
| Bibliothèque : ouvrir « Films » | 81 | 61 % | 157 ms | 188 ms | 7,5 (166) | **1 715** | 2 969 | 366 Mo | 28 | 140 | 75 |
| Bibliothèque : grille tenue | 229 | 70 % | 38 ms | 47 ms | 0 | 141 | 2 975 | 376 Mo | 31 | 145 | 75 |
| Fiche (entrée, 3 sections, Retour) | 277-309 | 37-39 % | 48-66 ms | 123-151 ms | 1-1,5 (150) | 74 | 1 813 | 340 Mo | 26 | 123 | 78 |
| Saisons et épisodes (« Bleach ») | 595 | 30 % | 29 ms | 85 ms | 2 (66) | 39 | **3 501** | **462 Mo** | 43 | 174 | **112** |
| Recherche (3 lettres) | 30 | 30-40 % | 57 ms | 62 ms | 0 | 175 | 2 392 | 321 Mo | 26 | 121 | 57 |
| Réglages (onglets, panneau) | 417 | 20 % | 141 ms | 141 ms | 6,5 (100) | 82 | 2 329 | 325 Mo | 21 | 126 | 58 |
| Habillage du lecteur (MP4) | 140 | 20-23 % | 34 ms | 37 ms | 0 | 7 | 1 889 | 354 Mo | 37 | 126 | 76 |

Temps processeur des fils, par geste (ms, moyenne de deux passes) — le fil
qui domine dit où agir :

| Écran | UI | JS (`mqt_js`) | Rendu (RenderThread) |
|---|---|---|---|
| Démarrage | 3 215 | **4 910** | 1 033 |
| Focus d'une carte | 2 009 | 1 449 | **3 789** |
| Défilement tenu | **2 367** | 1 647 | 1 921 |
| Rail | 1 691 | 1 559 | **1 899** |
| Ouvrir « Films » | 1 540 | **2 388** | 510 |
| Fiche | **2 392** | 1 879 | 2 067 |
| Saisons et épisodes | 2 941 | 2 338 | **5 366** |
| Réglages | 2 448 | 2 246 | **3 992** |

**Démarrage à froid** : première image de l'activité 593-623 ms, **accueil
prêt en 2,9-3,0 s** ; 67 validations React, 5 661 composants, 1 813 vues
d'un coup, le fil JS à 4,9 s de processeur.

**Images décodées** (relais du banc, 1re passe à cache vide, AVD 1 Go) : au
démarrage, 64 affiches (`Primary`) **380×562** (27 Mo décodés en ARGB),
13 vignettes 412×232 (5 Mo), 2 logos 400×140, un fond 412×232. Ailleurs : les
affiches des grilles à 267×400 (0,42 Mo chacune), les vignettes à 412×232,
les fonds du héros et de la fiche à **1280×720 (3,5 Mo chacun)**. Les
affiches 380×562 dépassent la hauteur du profil (`cardArtwork.posterHeight`
400) : une demande sans borne ou d'un autre composant — à identifier (L4).

## Mémoire : repos, 10 min, appareils contraints

| | Repos | Après navigation | Remarque |
|---|---|---|---|
| Shield (10 min : fiche, Films, saisons, rangées, recherche, réglages, accueil, grille) | PSS 309 Mo (natif 111, Java 29, GPU 57) | **PSS 487-596 Mo** (min. 9-10 : 487-508 ; repos après : 558) ; natif 239-278 ; GPU 49-98 ; Java 31-57 | même processus ; objets `View` vivants **1 813 → 9 673**, vues attachées ~1 800 |
| AVD 2 Go (L0, 3 tours d'endurance) | PSS 235 Mo, système dispo 684 Mo | 280 → 299 → 352 Mo ; vues attachées 2 142 → 3 374 → 4 718 | survit à `RUNNING_CRITICAL` (332 Mo) et à 464 Mo pris à côté |
| AVD 1 Go | PSS **157-205 Mo**, système dispo **47-56 Mo** | — | **tuée** (`lowmemorykiller`, premier plan, RSS 244-258 Mo, « thrashing ») à l'ouverture de « Films » (3 fois sur 3), puis dans la grille « Animés » et au focus de l'accueil |

`dumpsys meminfo` de la Shield au repos : PSS 305 Mo dont natif 116, Dalvik
14, fichiers mappés (`.apk`, `.dex`, `.so`, `.art`) ~53, GPU (`Other
mtrack`) 58, EGL 12, « Unknown » 33 (tas de Hermes, surtout). Le code mappé
et le minimum de Hermes et de GL font à eux seuls ~120-140 Mo : le reste se
joue sur les images décodées, les vues retenues et le JS.

## Le coût de chaque effet (Shield)

Chaque effet coupé SEUL (`debug.tentacle.fx`), en ALTERNANCE avec la
référence (rien de coupé), deux tours, deux gestes : le focus de 12 pas dans
« Reprendre » et la fiche (entrée, 3 sections, Retour). Charge du Mac 4-18.

| Effet coupé | Focus : ratées (réf. 25,7 %) | Focus : fil UI / rendu / cmd GPU | Fiche : ratées (réf. 38,6 %) | Fiche : p95 (réf. 66 ms) |
|---|---|---|---|---|
| **Mouvement** (ressorts et fondus de Reanimated) | **2,9 %** | **−55 %** / −27 % / −31 % | **11,0 %** | 48 ms |
| **Habit du focus** (agrandissement + ombre de la carte) | **9,5 %** | −13 % / −3 % / −5 % (JS −20 %) | 37,9 % | 54 ms |
| Fond vivant (lumières, halo ambiant, fondu au focus) | 18,3 % | −16 % / −12 % / −13 % | 35,0 % | 51 ms |
| Ombres portées (masques) | 17,7 % | +2 % / −7 % / −8 % | 35,2 % | 52 ms |
| Verre dessiné | 18,8 % | +1 % / −6 % / −7 % | 34,3 % | **47 ms** |
| Dégradés | 19,1 % | −2 % / −3 % / −4 % | 37,1 % | 51 ms |
| Fondu de page | 21,6 % | ±0 | **30,8 %** | 49 ms |
| Rotation du héros | 23,7 % | ±0 | 36,8 % | 47 ms |
| Flous (halos d'œuvre) | 24,9 % | ±0 | 39,3 % | 57 ms |

Lecture : les effets ne s'additionnent pas (un même geste ne rate une image
qu'une fois) ; l'écart d'une passe à l'autre de la référence est de ±3 points.
Mouvement coupé, le geste rend aussi MOINS d'images (309 au lieu de 415) :
plus rien n'anime entre deux pas. Aucun effet ne change la mémoire de plus de
±12 Mo (PSS 290-307 Mo au focus, 331-343 à la fiche).
**Bandes-annonces** : aucune ne se lit d'elle-même dans l'app (relevé du code,
07/10) — rien à couper. La rotation du héros (fondu toutes les 8 s) coûte
surtout par ses MONTAGES : 322 vues créées par rotation, 31 % d'images
ratées pendant le geste « héros ».

## Points chauds, classés par impact mesuré

Classement : d'abord ce qui fait TUER l'app (une box à 1-2 Go), puis ce qui
fait rater le plus d'images sur la Shield, puis le reste. Chaque équivalent
Lite garde la disposition, la navigation et l'identité (fond #080812, accent
#8B5CF6, DM Sans).

| # | Point chaud | Écrans | Mesure | Équivalent Lite proposé |
|---|---|---|---|---|
| 1 | **Mémoire qui monte et ne redescend pas** (images décodées, vues retenues) | tous ; pire : saisons, grilles, 10 min | Shield 309 → 510-600 Mo en 10 min, natif ×2,5, objets `View` ×5 ; 1 Go : tuée à « Films » | cache d'images Fresco plafonné (mémoire ET disque) et purgé sur `onTrimMemory` ; les écrans recouverts NON gardés en Lite (le patch `CoveredScreens` les garde : mesurer s'il retient les vues) ; trouver la rétention des `View` (L4) ; un seul fond plein écran décodé |
| 2 | **Mouvement de Reanimated** (ressorts, fondus, recul) | accueil, rail, fiche, saisons | focus 26 → 3 % ; fiche 39 → 11 % ; fil UI −55 % | durées courtes et courbes simples, sans ressort ; au plus UNE animation lourde à la fois ; ce qui peut l'être sur le driver natif (opacité, translation) ; positions posées sans transition quand le geste est tenu |
| 3 | **Montages d'un bloc** | démarrage, « Films », fiche d'une série, rotation du héros | 1 808 vues au démarrage (blocages 316 ms) ; 1 715 à « Films » (166 ms) ; 3 501 attachées aux saisons | grilles virtualisées (fenêtre réduite, rendu initial d'un écran, layout fixe, recyclage) ; rangées de l'accueil montées à la demande ; épisodes et onglets de saisons en liste virtualisée |
| 4 | **Habit du focus** (agrandissement ×1,08 + ombre + recul des voisines) | toutes les cartes | 26 → 9,5 % au focus | un focus SANS agrandissement : liseré d'accent 3-4 px et légende plus claire, très lisible à 3 m ; ni parallaxe ni zoom multicouche ; voisines non reculées |
| 5 | **Fond vivant** | accueil, fiche | 26 → 18 % ; fil UI −16 %, rendu −12 % | un fond STATIQUE teinté de la palette de l'œuvre, changé d'un seul fondu court (ou sans fondu) quand l'œuvre change, jamais à chaque pas |
| 6 | **Ombres portées** | cartes, panneaux, boutons | 26 → 18 % ; rendu −7 % | bordure fine (blanc 8-12 %) à la place de l'ombre |
| 7 | **Verre dessiné** | rail, pilules, panneaux, réglages | 26 → 19 % ; p95 de la fiche 66 → 47 ms | aplat semi-opaque (le ton du verre « enrichi », sans reflet ni liseré dégradé) |
| 8 | **Dégradés** | voiles, bords, boutons | 26 → 19 % | dégradés statiques simples (deux arrêts), aucun dégradé animé |
| 9 | **Fondu de page** (320 ms, courbe d'UIKit) | changements de page | fiche 39 → 31 % | fondu court (≤ 150 ms) ou coupe nette, un seul écran animé |
| 10 | **Rotation du héros** | accueil | 31 % pendant la rotation ; 322 vues montées par rotation | rotation plus espacée, fondu de l'IMAGE seule (texte posé), image suivante préparée hors écran |
| 11 | **Images au-delà du besoin** | démarrage, fiche | 64 affiches 380×562 au démarrage ; fonds 1280×720 | toutes les images à la taille rendue (affiche 400 de haut au plus, fonds 960×540 en Lite) ; placeholders unis |
| 12 | Flous (halos d'œuvre) | héros, fiche | ±0 sur la Shield (masque natif) | gardés si la mémoire le permet ; sinon le halo remplacé par la teinte du fond statique |

Écran par écran, ce qui domine :

- **Accueil** : mouvement (focus et défilement), habit du focus, fond vivant ;
  montage au démarrage. Défilement tenu à 60 % d'images ratées sur la Shield
  (fil UI) : positions posées sans ressort en Lite.
- **Bibliothèque** : montage de la grille (1 715 vues, 166 ms) ; défilement
  tenu à 70 % ; 75 Mo de GPU. Virtualisation d'abord.
- **Fiche** : arrivée du contenu (blocage ~150 ms), mouvement, verre ; fond
  1280×720.
- **Saisons et épisodes** : 3 501 vues attachées, 462 Mo, 112 Mo de GPU, le
  RenderThread à 5,4 s : liste des épisodes virtualisée, fond unique.
- **Recherche** : 175 vues créées par frappe ; résultats recyclés.
- **Réglages** : blocages à l'ouverture d'un onglet (100 ms), verre et
  RenderThread à 4 s : aplats.
- **Habillage du lecteur** : déjà sobre (20 % d'images ratées, rien au-dessus
  de 37 ms) ; en Lite, libérer l'UI derrière le lecteur (mémoire, L4).

## Objectifs chiffrés — à confirmer par Damien

Proposés au départ, et ce que les mesures en disent :

| Objectif | Proposé | Avis de L1 |
|---|---|---|
| Images ratées en Lite | < 10 % | tenable pour les gestes (focus, défilement) : le mouvement coupé à lui seul donne 3 % sur la Shield. Sur la box (A53 ~2× plus lent qu'un A57), viser **< 10 % au focus, < 20 % au défilement tenu** |
| Aucune image au-dessus de | 100 ms | tenable PENDANT un geste ; pas sur un changement de page tant qu'un montage d'un bloc existe (Films 188 ms, démarrage 349 ms sur la Shield). Proposé : **0 image > 100 ms pendant un geste, aucune > 250 ms sur un changement de page** |
| Mémoire Lite au repos | < 160 Mo | ambitieux : ~140 Mo de PSS sont fixes (code, Hermes, GL) ; l'AVD 1 Go est à 157-205 Mo en mode normal. Proposé : **< 170 Mo**, et surtout **aucune mort sur l'AVD 1 Go tout le parcours** |
| Mémoire Lite après 10 min | < 220 Mo | indispensable (la Shield normale monte à 500-600) : exige le plafond du cache d'images ET la fin de la rétention des vues. Garder **< 220 Mo, pente nulle après 5 min** |
| Démarrage à froid | < 4 s | Shield normal 2,9-3,0 s ; AVD 2 Go freiné `duty:25` : 2,9-8,0 s. Sur la box, ~2× la Shield : il faut réduire le montage initial. Garder **< 4 s jusqu'à l'accueil prêt** sur la box |
| Shield en mode normal | ≤ 2 % de dégradation | garder ; le banc `baseline.mjs screens` rejoué avant/après, en alternance |

## Ce que l'émulateur ne peut pas dire

- La **mémoire graphique** : `Graphics : 0` à l'émulateur (GPU de l'hôte). La
  Shield en tient 57-112 Mo (`Other mtrack`) : à relever sur la box.
- Le **GPU** (VideoCore V contre Metal du Mac) : remplissage, envoi des
  textures, flous et dégradés coûtent autre chose ; les durées d'images de
  l'émulateur (92-99 % ratées, phase « sync ») ne prédisent rien.
- **`isLowRamDevice`**, le tas d'une box (`heapgrowthlimit` 128m souvent),
  le lowmemorykiller et la zram d'un constructeur, le lanceur d'opérateur.
- Le **processeur** réel : le frein `duty:25` approche un A53 en moyenne, pas
  en nature ; et la base varie de × 3,8 avec la charge du Mac.
- Les **décodeurs** : rien sur la lecture.

## Restes

1. **Rétention des vues** (objets `View` 1,8 k → 9,7 k en 10 min sur la Shield,
   vues attachées 2,1 k → 4,7 k chez L0) et natif qui double : à attribuer
   (L4) — captures de tas, écrans recouverts gardés (`CoveredScreens`).
2. Les affiches 380×562 du démarrage : qui les demande sans borne.
3. Effets mesurés sur deux gestes seulement (focus, fiche) : les rejouer sur
   « Films », saisons et réglages quand le Lite sera là (`baseline.mjs effects
   --only page-films,saisons-episodes,reglages`).
4. Box net+ réelle : tout ce tableau à rejouer dessus (adb Wi-Fi), mode normal
   puis Lite ; mesure du budget avant le lowmemorykiller.
5. Le parcours complet sur l'AVD 1 Go n'est pas jouable en mode normal (tué) :
   ce sera le premier critère du Lite.

## Reproduire

```bash
cd apps/tv/android && TENTACLE_TV_REDESIGN=1 ./gradlew assembleRelease assembleDebug -x lint \
  -PtentaclePerfApp=1 -PreactNativeArchitectures=arm64-v8a
cd ../harness/android-perf
export ANDROID_SERIAL=<shield>:5555 PERF_PORT=3137 PERF_BACKEND_PORT=3135
node baseline.mjs screens --apk <release> --debug-apk <debug> --tag shield-ecrans --rounds 2
# saisons : faux backend DÉJÀ lancé (un neuf sert son catalogue trop lentement)
node baseline.mjs screens --keep-session --external --warmup --tag shield-ecrans-b --only grille,saisons-episodes,reglages
node baseline.mjs effects --keep-session --external --tag shield-effets --rounds 2 --only focus-rangee,fiche \
  --fx blur,glass,shadows,gradients,ambient,focusScale,motion,pageFade,heroRotation
node baseline.mjs soak --keep-session --external --tag shield-soak --minutes 10
node lite.mjs parcours run Lite_API31_1G --apk … --debug-apk … --tag base-1g     # (L0)
```

Résultats : `~/Library/Caches/tentacle-android-perf/baseline/*.json` et
`…/lite/<date>-<tag>/`. Le lecteur se mesure en DERNIER (une lecture
interrompue rouvre la fiche au lancement suivant).
