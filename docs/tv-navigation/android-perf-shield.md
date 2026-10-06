# Fluidité d'Android TV sur la vraie Shield (lot A7, 2026-10-05)

Suite de [android-perf.md](android-perf.md) (le mode de mesure, le banc,
l'émulateur). NVIDIA Shield TV Pro (Tegra X1+, 3 Go, Android 11), en adb
réseau, release signée par la clé debug et installée sans Metro. Ici, les
durées se lisent telles quelles : c'est l'appareil des utilisateurs.

## La procédure

On ne mesure JAMAIS sur l'app installée de l'utilisateur : son jumelage, son
compte, son profil (un PIN arrête l'app sur « Qui regarde ? »). Le banc pose
à côté une app de MESURE, branchée sur le faux backend nav-golden :

```bash
adb connect <adresse>:5555          # Options pour les développeurs → Débogage réseau
cd apps/tv/android
ANDROID_HOME=~/Library/Android/sdk ./gradlew assembleRelease -x lint \
  -PtentaclePerfApp=1 -PreactNativeArchitectures=arm64-v8a
#  → com.tentacletv.mobile.perf, « Tentacle (mesure) », profilable, clé debug
ANDROID_SERIAL=<adresse>:5555 PERF_PACKAGE=com.tentacletv.mobile.perf \
  node apps/tv/harness/android-perf/bench.mjs ab --a avant.apk --tag-a avant \
  --b apres.apk --tag-b apres --debug-apk debug.apk --only fiche,lancement --rounds 2
```

- `assertDisposable` (banc) refuse d'installer, d'effacer ou d'écrire une
  session dans une autre app que celle de mesure, hors émulateur.
- `--keep-session` : la session du faux backend est déjà écrite. `serve`
  tient le faux backend et le relais d'images pour un essai à la main
  (touches : `Keys.java` par `app_process` ; vidéo : `screenrecord`, puis la
  luminance image par image par `ffprobe … signalstats`).
- `-PtentacleProfileable=1` : la release normale, profilable (traces).
- Trace : `atrace` au tampon de 16 Mo au plus (32 Mo échoue sans rien dire) ;
  `setprop debug.hwui.skia_atrace_enabled true` pour les appels Skia.
- **Jamais simpleperf** sur une Shield (build `user`) : en arrière-plan, il
  laisse un orphelin que plus rien ne peut tuer ; au premier plan avec
  `--call-graph dwarf`, il a fait tomber l'app, puis `system_server`.
- Une lecture interrompue par le banc laisse le marqueur de la relance à
  froid : le démarrage suivant rouvre la fiche du titre (voulu). Les
  scénarios de lecture se jouent donc en dernier.

## Ce qui a été mesuré

Avant : a5f4a28e2 (fin d'A6) avec le mode de mesure ; après : la branche
`lot-atv/a7`. Release de mesure, faux backend, deux passes par version,
sur la Shield. « Images ratées » : au-delà de 16,7 ms ; « p95 pire » : le
pire 95ᵉ centile des fenêtres du geste ; blocages : fil UI pris 48 ms ou
plus (moyenne des passes).

| Geste | images ratées | p95 pire (ms) | blocages ≥ 48 ms | pire blocage (ms) |
|---|---|---|---|---|
| Démarrage à froid | prêt en 2 964 → 2 994 ms | — | 10 → 12 | 400 → 300 |
| Focus d'une carte (12 pas) | 100 % → 58 % | 44 → 29 | 0 → 0,5 | — → 50 |
| Rangée tenue | 100 % → 74 % | 59 → 38 | 4 → 2 | 66 → 149 |
| Accueil pas à pas | 98 % → 44 % | 48 → 28 | 0 → 0,5 | — → 150 |
| Accueil tenu | 100 % → 69 % | 74 → 39 | 7 → 0 | 66 → — |
| Rail (3 dépliages) | 99 % → 62 % | 63 → 47 | 0,5 → 0 | 49 → — |
| Héros (2 rotations) | 99 % → 96 % | 51 → 187 | 0 → 0,5 | — → 166 |
| Grand panneau | 100 % → 84 % | 151 → 76 | 3,5 → 3 | 133 → 199 |
| Fiche (entrée) | 53 % → 56 % | 234 → 174 | 5 → 3,5 | 233 → 200 |
| Recherche (frappe) | 38 % → 40 % | 63 → 58 | 0 → 0 | — → — |
| Lecteur | 57 % → 28 % | 443 → 177 | 1 → 0,5 | 433 → 149 |
| Grille tenue | 88 % → 73 % | 50 → 36 | 0 → 0 | — → — |

Les changements de page, en A/B sur la Shield (trois passes alternées pour
les deux premiers) :

| Geste | Avant → après |
|---|---|
| Retour d'une fiche à l'accueil (écrans recouverts gardés) | blocages 5 → 1 par passe, p95 171 → 48 ms |
| Lancer une vidéo puis Retour (même correctif) | blocages 4,3 → 2,3, pire 200 → 166 ms |
| Aller-retour sur une fiche (fondu de l'Apple TV) | images ratées 73 → 59 % ; creux sombre du Retour (luminance 79 → 58 → 84) → monotone (79 → 84,7) |
| Ouvrir « Films » par le rail | inchangé : p95 ~150 ms, 1 715 vues créées d'un bloc (reste à faire) |

## Ce qui a été fait, et pourquoi ça ne se voit pas

| Correctif | Ce qu'il change | Pourquoi c'est invisible |
|---|---|---|
| Dessin élagué hors de l'écran (`DrawCulling`, sections et pistes natives, profil `cullOffscreen`) | une section ou une piste de cartes ne met plus dans sa liste d'affichage ce qui est à plus de 240 points de l'écran : le RenderThread ne prépare et ne rejoue plus trois nœuds sur quatre (`clipChildren` faux partout, HWUI ne pouvait rien écarter) | rien de ce qui est écarté ne pouvait paraître ; les vues restent montées, mesurées, focalisables, et reviennent dans l'image même où elles approchent |
| Écrans recouverts gardés attachés (patch react-native-screens, `CoveredScreens`) | l'accueil sous une fiche ou sous le lecteur n'est plus retiré : au Retour, plus de ~1 800 vues rattachées et réenregistrées d'un coup (150 à 170 ms de fil UI) ; caché, il n'est plus dessiné ; retiré de la pile, il part sans animation | même écran, mêmes fondus ; focus bloqué et accessibilité retirée tant qu'il est recouvert |
| Le fondu de page de l'Apple TV (`IosFade`, même patch) | 320 ms de la courbe d'UIKit ; l'écran qui part s'efface par-dessus l'autre, à 1 d'emblée (Android effaçait l'un pendant que l'autre paraissait, en 150 ms : un creux sombre) ; temps borné à 34 ms par image | c'est celui de l'Apple TV : pour deux écrans opaques, « le nouveau paraît par-dessus » et « l'ancien s'efface par-dessus » font la même image |
| Le lecteur sans contrôleur media3 (`tentacle_exo_player`) | `PlayerView` ne construit plus son `PlayerControlView` (des dizaines de vues jamais montrées) au lancement d'une vidéo | l'habillage du lecteur est celui de React, qui ne change pas |
| La fiche monte les cartes de ses rangées par parts (`useStagedRow`) | casting, extras, saga, similaires : deux cartes par image, la rangée parcourue d'abord | ce qui se monte est sous le bord de l'écran |
| Le recul des voisines joué par la piste native (`RowRecede.kt`, profil `nativeRecede`) | à chaque pas vertical, une vingtaine de cartes animées par Reanimated (évaluées, converties, appliquées) → un `ObjectAnimator` d'opacité par cadre | même opacité, même durée, même courbe (jetons du thème), reprise d'où elle en est quand un pas l'interrompt |
| Fondus robustes aux blocages (`withSteadyTiming`, profil `steadyMotion`) | une animation de Reanimated avance d'au plus deux images par image : un montage qui retient le fil UI ne la fait plus sauter | mêmes courbes, mêmes durées, mêmes valeurs quand rien ne bloque |
| L'indicateur d'activité de tvOS (`TentacleSpinnerView`, tv-core `render/activitySpinner`) | les chargements montraient le cercle de Material : ils montrent les huit gélules de l'Apple TV, à ses cadences (relevées au simulateur) | c'est celui de l'Apple TV |
| La barre du décompte de l'avance rapide d'un seul tenant (`ScrubCountdown`, tv-core `scrubCountdown` : `run`) | sous « l'avance rapide sera annulée dans 5… », la barre se vidait par à-coups, relancée à chaque seconde : une glissade par course, jusqu'à l'échéance | même pilule, même texte, même durée |
| L'accueil attend l'image de son premier héros (tv-core `homeLoading`, 1,5 s au plus) | les deux plateformes : le héros n'arrive plus après les rangées | l'accueil se montre d'un bloc, comme prévu |
| Un focus de la plateforme dans le rail à l'arrivée ne l'ouvre pas (tv-core `railHeldByArrival`) | les deux plateformes : après « Qui regarde ? », le rail ne se déplie plus pour se replier aussitôt | l'entrée de l'écran prend le focus, comme prévu |

## Ce qui reste au-dessus de 16,7 ms, et pourquoi

- **Les gestes de l'accueil** (focus d'une carte, rangée et accueil tenus,
  rail) : encore 44 à 74 % d'images au-delà de 16,7 ms, p95 de 28 à 47 ms.
  Deux postes, mesurés : l'ÉMISSION des commandes du RenderThread, 8 à
  11 ms par image sur les cœurs A57 de la Shield (cadencés entre 1,1 et
  2 GHz) — le contenu visible, plus le fond vivant, dont le fondu de lumière
  (600 ms à chaque pas) abîme tout l'écran : tout se redessine — ; et le fil
  UI de Reanimated, 4 à 8 ms par image (5 à 15 vues mises à jour par image).
  Le GPU, lui, tient (5 à 11 ms).
- **Ouvrir « Films »** : 1 715 vues créées d'un bloc (p95 ~150 ms), et
  autant détruites en revenant à l'accueil (~150 ms) : la grille des
  bibliothèques n'est pas encore montée par échelons, comme les rangées.
- **La fiche** : un blocage de 160 à 200 ms quand son contenu arrive
  (en-tête, image de fond, premières sections).
- **Lancer une vidéo** : ~166 ms de montage du lecteur.
- **Le démarrage** : accueil prêt en ~3 s, une dizaine de blocages jusqu'à
  300 ms pendant le montage de l'accueil.
- **Le décompte de l'avance rapide** : un ralentissement par moments
  (l'émission passe à ~15 ms), jamais reproduit sous trace — sans doute la
  composition de SurfaceFlinger avec la vidéo.
- **Le héros** : un blocage isolé de 166 ms pendant une rotation, dans une
  passe sur deux.

## Démarrage du lecteur et rangées (lot 06/10, T2)

Faux backend du banc, app de mesure, trois MKV 1080p à 23,976 i/s (son 5.1
AC-3 ou E-AC-3, HDR10 pour le dernier : jeux `lecteur/flux-*`). Deux outils :
`startup.mjs` (OK sur « Reprendre », écran filmé + journal `TntStart`) et
`rowMotion.mjs` (décalage de la rangée entre deux images du film).

**Le démarrage** (ms depuis OK ; « visible » : la vidéo paraît dans le film,
qui retarde de ~0,55 s sur l'écran) :

| | première image | prêt | lecture | son sorti | visible − son |
|---|---|---|---|---|---|
| avant (6 lectures) | 1 630-1 985 | 1 723-2 112 | = prêt | 1 829-2 386 | 717 à 1 042 |
| après (3 lectures) | 1 754-1 806 | 1 772-1 834 | prêt + ~100 | 2 071-2 127 | 354 à 437 |

Avant : le moteur jouait dès son « prêt » ; l'écran de chargement attendait
la progression suivante — le son sortait sous l'écran de chargement, la vidéo
paraissait déjà partie. Après : la première image est posée en pause, l'écran
se lève avec la lecture ; l'image reste figée ~0,2 s (le passthrough vers
l'ampli), puis le mouvement et le son partent ensemble. Lever l'écran au
signal « le son avance » (`onAudioPositionAdvancing`) a été essayé puis
annulé : il arrive ~120 ms après la vraie sortie du son, le son précédait
alors l'image (une avance se perçoit dès ~45 ms, un retard pas avant ~125).

**Les rangées** (changements de sens d'un aller-retour tenu ; une tenue en
compte UN) : avant 17, sauts de 260 à 320 px en une image ; après 1, de 20 à
56 px par image. Pas isolés : avant, un saut de 300 px au départ ; après,
64 px au plus.

Pièges de la Shield, la nuit : elle se rendort entre deux lectures, et son
adb réseau tombe avec — `startup.mjs` la réveille et rétablit le relais avant
chaque lecture ; une APK de 160 Mo s'installe rarement d'une traite. Une
lecture interrompue rouvre la FICHE au démarrage suivant (voulu).
