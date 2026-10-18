# L'ouverture du démarrage (Apple TV)

> Le logo s'assemble pendant que l'app charge, appuie sur lecture (« ta »),
> son écran s'allume (« dum ») — et cet écran EST l'accueil, déjà prêt —, puis
> la caméra plonge jusqu'à l'échelle 1. Il n'y a pas de transition : on arrive
> DANS l'accueil. Conception : page `/survey/` du site (dépôt « Tentacle Web »,
> `design-system/tentacle-tv-site/pages/survey.md`) ; ici, son portage.

## Quand elle se joue

Règle : tv-core `boot/bootIntro.ts` (`decideBootIntro`, `bootIntroOutcome`).

- **À chaque démarrage À FROID qui mène à l'accueil**, sur une plateforme qui a
  le trait `brandIntro` (Apple TV seulement ; Android TV garde `BootView`).
- **Jamais** : mouvement réduit (tvOS › Accessibilité), jumelage, « Qui
  regarde ? » (profil et code PIN), une fenêtre du démarrage due (code PIN
  conseillé, barre, photo), une lecture interrompue à relancer (la fiche
  s'ouvre). Le retour d'arrière-plan n'est pas un démarrage : rien ne se rejoue.
  Sans ouverture, l'écran de lancement (l'encre seule) reste, et la mascotte
  d'attente n'y paraît en fondu que si le démarrage traîne (400 ms).
- **Elle camoufle le chargement** : l'app se monte DANS l'écran du poulpe dès
  qu'elle est prête. Si l'accueil n'est pas prêt au moment d'appuyer
  (1 160 ms), le poulpe attend sur son bouton lecture, qui scintille (il bat,
  une onde en part, quatre étincelles, un clin d'œil) ; « ta », « dum » et la
  plongée partent dès que l'accueil s'est montré d'un bloc (tv-core
  `homeLoading`). Tout prêt : d'une traite, 3,01 s. Au bout de 8 s d'attente,
  on plonge quand même dans l'accueil qui dit qu'il charge.
- **Elle renonce** (rideau de l'encre, 160 + 280 ms, sans ta-dum) devant le
  voile hors ligne, une migration de la base, « accès suspendu », un accueil en
  échec, ou une navigation qui quitte l'accueil. L'app y paraît à l'identité.

## Où vit quoi

| Pièce | Fichier |
|---|---|
| Courbes, géométrie (tirée des constantes générées du logo), caméra, chorégraphie (règle WAAPI : remplissages, transformation et opacité à part), attente, partition du son | `packages/shared/src/brandIntro/` (`@tentacle-tv/shared/brandIntro`) |
| Synthèse Web Audio (web et bureau, script de rendu) | `@tentacle-tv/shared/brandIntro/synth` (`introSynth.ts`) |
| Quand la jouer, attendre, renoncer ; tableaux pour l'image (60 par seconde) ; plaques nettes ; heure du son | `packages/tv-core/src/boot/` |
| La vue (calques, horloge Reanimated, écran qui montre l'app) | `apps/tv/src/redesign/boot/` |
| Le branchement (décision, porte de l'accueil, son, renoncement) | `apps/tv/src/redesignWiring/boot/` |
| Le son natif | `apps/tv/ios/TentacleTV/TentacleBootSound.m`, adaptateur `platform/tvos/bootSound/` |
| Le fichier du son (dérivé) | `apps/tv/assets/sound/boot-tadum.m4a` |

## Le rendu : net, fluide, sans peser sur le démarrage

- **Rien que des transformations et des opacités.** Chaque pièce du logo est un
  `Svg` à part, rastérisé UNE fois ; l'horloge (`useIntroClock`) tourne sur le
  fil d'interface (Reanimated, `useFrameCallback`) et lit des tableaux
  précalculés — ni courbe, ni caméra, ni JavaScript du démarrage par image.
- **La scène en trois couches**, dans l'ordre du logo : sous l'écran (nuit,
  lueur, bras arrière, tête, cadre), l'écran (l'APP elle-même), sur l'écran
  (visage, onde, bouton, étincelles, chapeau, bras avant). La caméra est une
  transformation de chaque couche autour du centre de la fenêtre.
- **L'écran est l'app** : l'arbre de l'app est monté dans
  `IntroScreenPlane` — une découpe arrondie (l'intérieur du cadre, plus grand
  que la fenêtre à l'arrivée), un cercle qui l'ouvre (une vue ronde agrandie,
  son contenu réduit d'autant, sur le même pivot). À l'arrivée tout vaut
  l'identité et la découpe se retire : les vues de l'app ne changent JAMAIS
  d'arbre (rien ne se remonte, le focus reste où il est).
- **Net à toute échelle** : le cadre et la vitre sont des dégradés natifs
  (bords arrondis découpés par Core Animation) ; les pièces sont rastérisées
  2 fois plus grandes que leur place, et la tête, le visage, le chapeau et les
  bras arrière ont une PLAQUE 5 fois plus grande qui prend le relais, d'une
  image, quand la caméra atteint √10 fois son zoom de départ (tv-core
  `plateSwapAt`) ; au-delà de ×2 de réduction, le filtre linéaire de Core
  Animation crénèle. Les lumières (lueur, éclair) sont des dégradés doux,
  dessinés petits et agrandis.
- **Une image qui traîne avant le son** (le fil d'interface pris par le
  montage de l'accueil) est absorbée en pause plutôt que sautée ; une fois le
  son programmé, l'horloge suit le temps réel.

## Le son

- **Une seule source** : la partition (`introScore.ts`) et la synthèse
  (`introSynth.ts`), portées du site. Le natif lit un FICHIER DÉRIVÉ :
  `pnpm --filter @tentacle-tv/tv sound:intro` sert la synthèse à Chrome sans
  tête (TypeScript dépouillé par Node), qui la joue dans un
  `OfflineAudioContext`, puis met la crête à −9 dBFS, écrit un WAV 24 bits et
  l'encode en AAC 160 kb/s par `afconvert` ; il redécode le fichier et
  vérifie crête et calage. Tirage des bruits FIXE : le fichier se régénère à
  l'identique. Relevé du 2026-10-18 : synthèse −9,17 dBFS (celle du site),
  AAC −9,02 dBFS, début calé à 0,2 ms près, 4,84 s, 49 Ko. Jamais retouché à la
  main.
- **Calé à l'image** : le fichier commence par la vague, 40 ms avant le
  « ta ». L'horloge de l'image le demande 260 ms d'avance (ou, après
  l'attente, reprend 120 ms après la décision) en donnant l'heure exacte du
  départ dans l'horloge des images (CADisplayLink) ; `TentacleBootSound`
  (AVAudioPlayer décodé d'avance) la tient par `playAtTime:`, latence de sortie
  retirée ; un départ en retard saute le début du fichier au lieu de décaler le
  « ta ».
- **Catégorie « ambient »** (seulement si personne n'en a choisi une) : une
  musique déjà en cours n'est pas coupée ; rendue au défaut au `dispose`, 5 s
  après l'arrivée, si un lecteur n'en a pas posé une autre entre-temps.
- **Réglage d'appareil** « Son au démarrage » (Réglages › Apparence ›
  Ouverture), clé `tentacle_tv_boot_sound`, allumé par défaut. Aucune capacité
  serveur : fonction purement client.

## Vérifier

- Banc UI : scènes `ouverture/*` (l'horloge figée à chaque étape, l'accueil du
  banc dans l'écran ; `ouverture/attente` scintille, `ouverture/jouee` la joue).
- App réelle : `nav-golden.mjs up --slot n`, puis un démarrage à froid
  (`start`) et des captures `xcrun simctl io <udid> screenshot` en rafale
  (`recordVideo` ne marche pas sur tvOS).

## Mesures (2026-10-18, simulateur Apple TV 4K 1080p, build Debug, faux backend du banc)

| | Avant (72de16225) | Après |
|---|---|---|
| Accueil prêt (focus sur « Reprendre ») | 2,7 – 3,4 s | 2,95 – 3,2 s (préparatifs allégés : aucun retard mesurable) |
| Accueil vu, dans l'écran du poulpe (« dum ») | — | ≈ 0,5 s après qu'il est prêt |
| Accueil à l'échelle 1, utilisable | 3,2 – 3,5 s | 4,4 – 5,0 s (la plongée, ≈ 1,5 s après le « dum ») |
| Fil d'interface pendant l'attente, l'appui et la plongée | — | 59,6 – 59,8 i/s, 1 à 2 images perdues sur 300 |

En Debug, le paquet JS se charge depuis Metro : l'ouverture ne commence
qu'à ≈ 1,8 s. Sur l'appareil (Release), elle part bien plus tôt : un accueil
prêt avant l'appui (1,16 s) donne l'arrivée à ≈ 3 s de l'ouverture. Le banc
nav-golden (accueil, héros, jumelage : 11 scénarios) reste identique à sa
référence. L'ouverture ne rallonge l'attente que de sa traîne : appui, allumage
et plongée, ≈ 2 s après que l'accueil est prêt.

## Restes

- Android TV : le trait `brandIntro` à vrai, le jumeau `bootSound.android.ts`
  (le même fichier dérivé, dans `res/raw`), et la mesure sur la Shield.
- Le web, le bureau, le mobile : le même pur et la même partition (plan :
  `docs/OUVERTURE-SON-PLAN.md` du dossier principal).
- `LaunchLogo` (brand/tvos.py, Images.xcassets) n'est plus affiché par l'écran
  de lancement (l'encre seule) : à retirer du générateur si l'on n'y revient pas.
- Le reflet qui balaie le bouton pendant l'attente (site : un masque à la forme
  du triangle) n'est pas porté : il demanderait un masque animé.
