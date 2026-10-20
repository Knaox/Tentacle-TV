# L'ouverture du démarrage (Apple TV, Android TV, mobile, iPad)

> Le logo s'assemble pendant que l'app charge, appuie sur lecture (« ta »),
> son écran s'allume (« dum ») — et cet écran EST l'accueil, déjà prêt —, puis
> la caméra plonge jusqu'à l'échelle 1. Il n'y a pas de transition : on arrive
> DANS l'accueil. Conception : page `/survey/` du site (dépôt « Tentacle Web »,
> `design-system/tentacle-tv-site/pages/survey.md`) ; ici, son portage.

## Quand elle se joue

Règles : shared `brandIntro/bootIntro.ts` (`decideBootIntro`, `bootIntroOutcome`)
et `brandIntro/bootIntroOnce.ts` (`bootIntroTurn`, la mémoire du processus) —
tv-core `boot/` les réexporte pour la TV. Décision de
Damien du 2026-10-18, après « Chambre » (sa TV passée aux profils ne la voyait
jamais : la règle d'alors la réservait à l'accueil).

- **À CHAQUE démarrage à froid de l'app, d'elle-même** — aucun geste, aucun
  appui attendu (une app native n'a pas de règle d'autolecture : seule
  l'attente des DONNÉES existe) —, **quel que soit le premier écran** :
  l'accueil, « Qui regarde ? » (et son code PIN), le jumelage d'une app neuve,
  la préconfiguration de la barre, le code PIN conseillé, la photo, un écran
  hors ligne, la migration de la base, « accès suspendu », la fiche d'une
  lecture relancée. L'écran du poulpe s'allume sur CET écran-là, et la plongée y
  entre. Elle part dès le montage de l'app, avant même la relecture du stockage.
- **Une seule fois dans la vie d'un processus** : jamais après le choix du
  profil, le jumelage ou le code PIN, ni au retour d'arrière-plan, ni à un
  changement de profil, ni à un rechargement de l'arbre React ou du JavaScript.
  La mémoire est NATIVE (`TentacleBootSound.claimIntro`, un drapeau que rien
  ne recharge ; repli : celle du module JavaScript).
- **Jamais** : sur une plateforme sans le trait `brandIntro` (elle garde
  `BootView` ; Android TV l'a depuis le 2026-10-19), ni avec le mouvement réduit
  (tvOS › Accessibilité ; Android : animations coupées dans les options pour les
  développeurs ou l'accessibilité — le premier
  écran directement ; l'écran de lancement, l'encre seule, reste, et la mascotte
  d'attente n'y paraît en fondu que si le démarrage traîne, 400 ms).
- **Elle camoufle le chargement** : l'app se monte DANS l'écran du poulpe dès
  qu'elle est prête. Si le premier écran n'est pas prêt au moment d'appuyer
  (1 160 ms), le poulpe attend sur son bouton lecture, qui scintille (il bat,
  une onde en part, quatre étincelles, un clin d'œil) ; « ta », « dum » et la
  plongée partent dès qu'il l'est : l'accueil montré d'un bloc (tv-core
  `homeLoading`), la rangée de « Qui regarde ? » (les deux le disent à la porte,
  `useReportScreenToBootIntro`) ; tout autre écran dès qu'il est monté ; un
  écran en échec, hors ligne ou bloqué aussitôt (il dit lui-même ce qu'il en
  est). Tout prêt : d'une traite, 3,01 s. Au bout de 8 s d'attente, on plonge
  quand même dans l'écran qui dit qu'il charge.
- **Elle ne renonce jamais.** Un premier écran qui en ouvre un autre (« Qui
  regarde ? » qui ouvre seul le profil retenu, puis l'accueil ; la relance qui
  ouvre une fiche) : l'ouverture suit, l'écran du poulpe montre le dernier.

## Où vit quoi

| Pièce | Fichier |
|---|---|
| Courbes, géométrie (tirée des constantes générées du logo), caméra, chorégraphie (règle WAAPI : remplissages, transformation et opacité à part), attente, partition du son ; quand la jouer (une fois par processus), quand partir ; tableaux pour l'image (60 par seconde) ; plaques nettes ; heure du son ; fenêtre allumée aux proportions de l'appareil, logo intact (`introLit`) | `packages/shared/src/brandIntro/` (`@tentacle-tv/shared/brandIntro` ; tv-core `boot/` le réexporte) |
| Synthèse Web Audio (web et bureau, script de rendu) | `@tentacle-tv/shared/brandIntro/synth` (`introSynth.ts`) |
| La vue (calques, horloge Reanimated, écran qui montre l'app), le déroulé (`useBootIntroRun`), la porte du premier écran, l'adaptateur du son | `packages/brand-intro-native/` (`@tentacle-tv/brand-intro-native`, TV et mobile) |
| Le branchement TV (décision au montage, primitives, réglage du son) | `apps/tv/src/redesignWiring/boot/` |
| Le branchement mobile (décision, enveloppe, rapport de route, réglages d'appareil) | `apps/mobile/src/bootIntro/` |
| Le son natif (UN code, compilé par les deux apps) | `apps/tv/ios/TentacleTV/TentacleBootSound.m` ; Android `apps/tv/android/app/src/main/java/com/tentacletv/boot/` |
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
  `IntroScreenPlane` (paquet `brand-intro-native`) — une découpe arrondie (l'intérieur du cadre, plus grand
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

## Android TV

- **Le même fichier** : `build.gradle` ajoute `apps/tv/assets/sound` aux assets
  de l'APK (`assets/boot-tadum.m4a`), aucune copie. Décodé d'avance en PCM
  (`BootSoundDecoder`) : un MediaCodec brut ne retire pas l'amorce de l'encodeur
  (2112 images, lue dans l'`iTunSMPB` du fichier) — on la retire, sinon le
  « ta » tomberait 44 ms tard.
- **Calé sur la SORTIE, pas sur `play()`** (`BootSoundStream`) : un AudioTrack
  statique lancé à l'heure sortait 130 à 200 ms trop tard à l'émulateur
  (`getLatency()` en annonçait 10). Le flux est ouvert dès la préparation et
  joue du silence ; l'heure demandée (horloge de Choreographer, `System.nanoTime`,
  celle de Reanimated) devient un numéro d'image d'après `getTimestamp`, et le
  fichier est écrit à ce numéro. Mode faible latence, aucune demande de focus
  audio (une musique en cours se mélange, comme « ambient »).
- **L'avance de la sortie** : la Shield écrit ≈ 360 ms au-delà de ce qui sort.
  Demandé 260 ms avant (160 après l'attente), le fichier perdait son début — la
  vague ET le « ta » (123 ms sautés, mesuré). Le natif la mesure à la
  préparation (`outputLeadMs`) ; tv-core `bootSoundLeads` en tire quand demander
  le son et la reprise après l'attente. L'Apple TV ne mesure rien : avances
  d'avant.
- **Une fois par processus** : drapeau natif (`claimIntro`) — la relance de
  l'interface du mode Lite et le retour d'arrière-plan ne la rejouent pas.
- **Les coins arrondis** : sur Android, `overflow: "hidden"` + `borderRadius`
  rognait en RECTANGLE — cadre et écran du poulpe carrés (retour de Damien du
  19/10). Ils passent par `redesign/render/RoundClip` : sur Android la vue
  native `TentacleRoundClip` (`render/TentacleRoundClip.kt`), rognée par son
  contour (`clipToOutline`), la vue arrondie de RN sur Apple TV. Le cercle du
  « dum » (une vue ronde transformée) se rognait déjà bien.
- **« Son au démarrage »** se lit APRÈS le préchargement du stockage
  (`readBootSoundSetting`) : l'ouverture se monte avant, et le cache
  d'AsyncStorage d'Android rendait le défaut (allumé) — le son partait réglage
  coupé. L'Apple TV lit `Settings`, synchrone.
- **La fenêtre de lancement** est à l'encre (`@color/boot_ink`, #0D0B13), plus
  au noir.
- Journal : `adb logcat -s TentacleBootSound` (amorce, avance de la sortie,
  départ, début sauté, écart mesuré).

### Mesures (2026-10-19)

| | Émulateur (API 31, release) | Shield (Android 11, release) |
|---|---|---|
| Accueil, « Qui regarde ? » | l'ouverture se joue, une fois par processus, coins arrondis | essayée par Damien (coins carrés, corrigés depuis) |
| Mouvement réduit (animations de transition à 0) | l'encre, puis le premier écran ; aucun son | — |
| « Son au démarrage » coupé | l'ouverture, aucun son | — |
| Avance de la sortie | non datée en 500 ms, dérive (600 – 800 ms) : sans valeur | 364 ms |
| Début du fichier sauté | — | 123 ms avant `bootSoundLeads`, 0 après |
| Écart du « ta » à l'image (d'après la sortie) | ±0,2 ms | −0,6 ms |

L'audio de l'émulateur ne suit pas le temps réel : n'y juger que l'image.

## Mobile et iPad (2026-10-20)

- **La même ouverture**, par le même paquet et le même déroulé
  (`useBootIntroRun`) : à chaque démarrage à froid, une fois par processus
  (le drapeau natif `claimIntro` : ni le retour d'arrière-plan, ni un
  changement de profil, ni un rechargement du JavaScript ne la rejouent),
  jamais avec « Réduire les animations » du système, ni le réglage d'appareil
  « Animation d'ouverture » coupé.
- **Le logo INTACT, seule la fenêtre allumée prend la forme de l'appareil**
  (shared `introLit`, retour de Damien du 2026-10-21 sur un vrai téléphone) :
  le poulpe garde ses proportions exactes sur tout écran — mise à l'échelle
  UNIFORME par la caméra, centré, jamais redessiné. L'ancien `fitIntroArt`
  (écran du logo allongé au rapport du téléphone, bras étirés) le
  « dénaturait » : retiré. Dans la vitre de l'écran de télévision du logo,
  c'est la FENÊTRE ALLUMÉE (`geometry.lit`, `introLitWindow`) qui prend le
  rapport de la fenêtre : la plus grande qui tienne avec 3 unités de vitre
  autour, centrée, coins arrondis à 10 % de son petit côté — une colonne sur
  un téléphone en portrait, une bande en paysage, presque toute la vitre sur
  l'iPad. La vitre reste autour (elle ne s'efface plus sous le cercle) ; la
  plongée s'arrête quand la fenêtre allumée recouvre l'écran de l'appareil
  (`coverZoom(…, geometry.lit)`). Sur la TV, `lit` = l'intérieur : rien ne
  change. Test : `introLit.test.ts` (le dessin ne dépend jamais du format ;
  aucun `scaleY` hors du clin d'œil ; la caméra n'a qu'un zoom).
- **La zone sûre** : le logo de départ se centre dans la zone sûre (encoche,
  Dynamic Island, barre d'accueil), et sa hauteur s'y tient ; à l'arrivée,
  l'écran couvre la fenêtre ENTIÈRE (l'app gère sa zone sûre elle-même).
  Fenêtre et zone sûre sont figées au montage ; arrivé, l'écran passe en plein
  cadre : un iPad qu'on tourne, l'app suit sans changer d'arbre.
- **Le premier écran, LITTÉRALEMENT** (retour de Damien du 2026-10-21 : la
  caméra plongeait dans le catalogue, puis « Qui regarde ? » ou la connexion
  le remplaçaient sous les yeux). Règle pure `mobileBootArrival`
  (`bootIntroRules.ts`), lue par `BootIntroRouteReporter` :
  - rien tant que l'app relit son stockage, ni tant qu'une GARDE va remplacer
    la route (`resolveAuthRoute` : choix du serveur à la première ouverture,
    connexion ; garde du hors ligne) — l'accueil monté par défaut n'est pas
    le premier écran d'une app neuve ;
  - les RECOUVREMENTS DU PREMIER ÉCRAN (`BOOT_FIRST_SCREEN_OVERLAYS`, par
    priorité : migration, accès suspendu, « Qui regarde ? » et son code,
    premier lancement du profil) se déclarent au registre du démarrage
    (`src/startup/`, clé `access` ajoutée). Tant que l'un est `pending` (n'a
    pas tranché) ou `active` sans être encore À L'ÉCRAN, le poulpe attend sur
    son bouton (`pending` de shared `bootIntroOutcome`, 8 s au plus) ; à
    l'écran, la route est `overlay:<clé>` et la plongée se fait dans lui
    (migration et accès suspendu : aussitôt, `blocked`) ;
  - sinon le chemin expo-router ; l'accueil (`/`) dit quand il est prêt ; le
    hors ligne plonge aussitôt.
- **Ce qui est né pendant l'ouverture vit DANS l'écran** : une `Modal` ou une
  `FullWindowOverlay` est une fenêtre native, posée PAR-DESSUS l'ouverture.
  `BootAwareModal` (« Qui regarde ? », carte du premier lancement) et
  `BootAwareOverlay` (migration, accès suspendu) choisissent UNE fois, à leur
  naissance : nés pendant l'ouverture, une vue plein écran dans l'arbre de
  l'app (au-dessus de la pile, Retour d'Android avalé) pour toute leur vie ;
  nés après, la fenêtre native d'avant. Ils se déclarent « à l'écran »
  (`bootOverlays.ts`). `FamilyLaunchHosts` est donc monté dès l'app prête,
  sans attendre l'arrivée ; l'affiche de la Famille, les avatars et le code
  PIN conseillé l'attendent toujours (`useBootIntroLanded`) — un premier
  écran ne doit jamais être une modale native.
- **Fluidité mesurée, pas regardée** (exigence de Damien, 21/10) : l'horloge note chaque image
  sur le fil d'interface (shared `introFrames` : fréquence, images perdues, pire écart, par
  phase) ; le mobile écrit le bilan de la dernière ouverture sous la clé AsyncStorage
  `tentacle_debug_boot_intro_frames` (lisible en Release dans le conteneur de l'app), avec la
  CHRONOLOGIE du démarrage (`markBoot` : début du JS, stockage relu, app prête, premier écran…)
  et chaque trou de plus de 50 ms, à la même échelle. Constats (Release, simulateur 60 Hz) :
  - le démarrage de l'app fige le fil d'interface (montage, ~0,5 s) : le poulpe reste sur
    l'ENCRE, immobile, tant que l'app n'est pas prête et que 6 images régulières d'affilée
    n'ont pas passé — 1,5 s au plus (shared `introStart`, jumeau worklet) ;
  - le halo flouté du héros (`HeroAmbilightFilter`, <Filter> SVG rendu par CoreImage sur le fil
    principal) attend l'arrivée (`useDeferredMount` + `useBootIntroLanded`) ;
  - « Qui regarde ? » attend que l'accueil qu'il cache soit posé.
  Résultat : 0 image perdue, pire écart 17 ms, iPhone et iPad, accueil et « Qui regarde ? »
  (12/12 ; avant : 30 à 75 perdues, jusqu'à 0,7 s). Encre ≈ 1,2–1,4 s, lancement → arrivée
  ≈ 4,8–5 s. 120 Hz : pas mesurable au simulateur (CADisableMinimumFrameDurationOnPhone posé,
  Reanimated demande 120 i/s). Android : pas mesuré.
- **Le son** : le MÊME code natif que la TV, compilé par le projet mobile —
  iOS par une référence du projet Xcode (`TentacleBootSound.m`, la ressource
  `boot-tadum.m4a`), Android par `sourceSets` (`com.tentacletv.boot`, et le
  fichier dans les assets) ; aucune copie. iOS : catégorie « ambient » (le
  commutateur silencieux le tait, une musique en cours n'est pas coupée).
  Android : aucun focus audio ; le mode silencieux le tait, le vibreur non (il ne
  tait pas le média sur Android : le volume média décide).
  Réglage d'appareil « Son au démarrage » (`tentacle_boot_sound`) ; « Animation
  d'ouverture » (`tentacle_boot_intro`) ; lus sur le disque AVANT l'hydratation
  du stockage (la décision précède tout), libellés `preferences.bootIntro*`.
- **L'écran de lancement** est l'encre seule (#0D0B13) : storyboard iOS sans
  image, icône transparente d'Android 12+, fenêtre de l'app à l'encre.
- **La racine attend la décision** (quelques millisecondes) avant de se dire
  prête : la navigation n'est jamais montée hors de l'écran du poulpe.

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

- Android TV : la fluidité de la plongée mesurée sur la Shield (le mode de
  mesure `debug.tentacle.perf`), et sur un appareil Lite.
- Le web, le bureau : le même pur et la même partition (plan :
  `docs/OUVERTURE-SON-PLAN.md` du dossier principal).
- Mobile : essais iPhone et iPad (portrait, paysage, encoche), Android (coins
  arrondis de la découpe en nouvelle architecture, avance de la sortie),
  ressenti du poulpe à l'écran de téléphone (étirement des bras) — non vus à
  l'image au 2026-10-20.
- `LaunchLogo` (brand/tvos.py, Images.xcassets) n'est plus affiché par l'écran
  de lancement (l'encre seule) : à retirer du générateur si l'on n'y revient pas.
- Le reflet qui balaie le bouton pendant l'attente (site : un masque à la forme
  du triangle) n'est pas porté : il demanderait un masque animé.
