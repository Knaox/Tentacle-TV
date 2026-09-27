# La fin d'un média, à l'image et au son — relevés du labo (27.09.2026)

Ce document fixe ce que le labo du 27 septembre a MESURÉ sur la fin de
102 médias réels — 77 films, 25 épisodes —, ce qui en a été retenu dans le code
(`apps/backend/src/services/tailAnalysis/`, `playback/tailVerdict.ts`), les
pièges payés, et les pistes FERMÉES — pour que personne ne les re-creuse de
bonne foi. Il prend la suite de `SEGMENTS-LABO-TRICKPLAY.md` (vignettes seules,
films Marvel) et de `SEGMENTS-LABO-AUDIO.md` (voisins de saison, épisodes).

La demande : que l'analyse marche sur les FILMS, qu'elle dise s'il y a une
scène après le générique — mi-générique comme post-générique —, qu'elle
corrige les métadonnées existantes quand elles sont fausses, et qu'elle
n'enregistre RIEN quand elle ne trouve rien.

## Corpus et juge

Trois jeux, vérité terrain établie à l'œil sur planches-contact (une vignette
toutes les 10 s) : début du générique, et chaque scène qui le suit.

- **Réglage** — 51 films, 56 scènes : Marvel (Iron Man → Brave New World),
  Deadpool 1-3, Spider-Man (Amazing, Spider-Verse ×2), Fast & Furious ×3,
  Pixar et Disney (Toy Story 3-4, Monstres & Cie, Cars 3, Vaiana 2, Zootopie 2,
  Les Nouveaux Héros), Nolan (Inception, Interstellar, The Dark Knight,
  Oppenheimer), Pirates 3, Harry Potter 2, Super Mario Bros, Sinners…
- **Validation** — 26 films, 9 scènes, JAMAIS regardés pendant le réglage ni
  l'apprentissage : Palm Springs, Game Night, The Fall Guy, Ted 2, Baywatch,
  Joker, Parasite, La La Land, Toy Story 5, Super Mario Galaxy, M3GAN 2.0,
  Les Indestructibles 2…
- **Épisodes** — 25, 16 scènes : Rick et Morty (12), Spy x Family (5),
  Jujutsu Kaisen, Solo Leveling, Frieren, Invincible, Daredevil : Born Again.

Le juge (`evalgt.py` du banc) : une scène « a son bouton » quand un générique
se termine entre 35 s avant et 12 s après son début — arriver un peu tôt coûte
quelques secondes de générique, arriver tard ampute la scène. Une scène
« avant le générique » se joue d'elle-même : rien ne la saute. Sont des
FAUTES : une scène **sautée** ou **sous un générique** (couverte par un
générique : passer le générique la fait perdre), une **fausse scène** (un
bouton qui promet ce qui n'existe pas), et un **générique posé dans le film**
(début plus de 30 s avant le vrai : le saut automatique des génériques de film,
actif par défaut, ampute la fin du film).

## L'état d'avant (main 56caadfb)

L'analyse des vignettes ne tournait que quand AUCUN fournisseur ne disait rien
de crédible, et ne voyait qu'« image sombre et terne » : une scène de nuit
presque noire passait pour un générique, un défilement assez dense pour
éclaircir l'image passait pour une scène. Le « rien trouvé » était rangé en
base, comme les empreintes audio de chaque épisode.

| Jeu | oui/non juste | scènes avec bouton | + avant le générique | sautées | sous un générique | fausses scènes | générique dans le film |
|---|---|---|---|---|---|---|---|
| Réglage — 51 films, 56 scènes | 37 → **47** | 24 → **39** | 18 → 16 | 3 → **0** | 9 → **0** | 8 → **0** | 2 → **0** |
| Validation — 26 films, 9 scènes | 19 → **22** | 3 → 3 | 5 → 5 | 1 → 1 | 0 → 0 | 5 → **2** | 2 → **1** |
| Épisodes — 25, 16 scènes | 19 → **25** | 9 → **16** | 5 → 0 | 0 → 0 | 1 → **0** | 1 → **0** | 0 → 0 |

Les FAUTES passent de 32 à 4. Ce qui reste, sur la validation seulement : la
scène de 13 s de « Game Night » (95:45, trop courte pour la parole) sautée
avec son générique, le bêtisier de « Baywatch » pris pour une scène, les logos
parlés de « Toy Story 5 », et le marqueur Jellyfin de « M3GAN 2.0 » posé dans
l'épilogue en musique (112:32) — les trois derniers étaient déjà faux avant.
La validation ne gagne pas de bouton : de ses neuf scènes, cinq se jouent avant
le générique et n'en ont pas besoin.

Ce que ça change, titre par titre :

- **sans métadonnées, la scène gagne son bouton** : « Rick et Morty » S1E4,
  S1E6, S2E3, S4E3, S4E5 (aucun générique connu), « Les Nouveaux Héros » ;
- **un générique Jellyfin qui avalait la scène** s'arrête avant elle :
  « Ultron » (Thanos, 133:05), « Fast & Furious 9 » (139:18), « Narnia »
  (132:08), « Into the Spider-Verse » (115:28), « Rick et Morty » S2E6 (20:58) ;
  « Avengers » gagne un second bouton (Thanos, 135:08, que « aller à la scène »
  sautait pour atterrir au shawarma) ;
- **un repère posé au mauvais endroit** : « Deadpool » (99:53, dans le baiser
  final), « Spy x Family » S1E1 (le bouton menait à 23:02, en pleine scène qui
  commence à 22:38) ;
- **des génériques posés en plein film** : « Les Gardiens de la Galaxie 3 »
  (110:40 : cinquante secondes de film sautées d'office), « Parasite » (126:30) ;
- **des fausses scènes retirées** : « Endgame » (178:00), « Toy Story 3 »,
  « Monstres & Cie », « Cars 3 », « Zootopie 2 », « Supergirl », « Blade
  Runner 2049 », « La La Land », « Les Indestructibles 2 ».

## Les vignettes : sept classes

Les vignettes trickplay (320 px, une toutes les 10 s) ne disent pas ce qu'est
un générique : elles disent si l'image porte du TEXTE, et sur quel fond
(`tailCells.ts`). Quatre mesures par vignette, sur tous ses pixels :

- **noir** : part des pixels de luminance < 24 ;
- **saturation** : écart moyen max − min des canaux ;
- **rangées** : part des lignes de pixels qui portent au moins 4 % de
  transitions nettes (écart de luminance ≥ 50 entre voisins). C'est LA mesure :
  un défilement en porte 0,20 à 0,55, une scène sombre zéro ;
- **modal** : part des pixels à ±10 de la luminance médiane — un fond uni.

| Classe | Règle | Ce que c'est |
|---|---|---|
| `T` | rangées ≥ 0,15 et noir ≥ 0,5 | défilement sur fond sombre (« Endgame » : noir 0,56) |
| `L` | rangées ≥ 0,15 et modal ≥ 0,45 | texte sur fond clair ou coloré (violet des « Nouveaux Héros ») |
| `C` | noir ≥ 0,9, rangées ≥ 0,02, modal ≥ 0,85 | carton sur noir, toute couleur (jaune de « Joker ») |
| `K` | noir ≥ 0,9, rangées < 0,02, saturation ≤ 1 | noir pur |
| `D` | noir ≥ 0,55 et saturation < 30 | image sombre — une nuit garde de la couleur (Thanos : 4 à 9) |
| `U` | modal ≥ 0,85 | aplat (cartons rouges de « Deadpool ») |
| `E` | le reste | image |

`L` est ambigu par nature : un dessin animé en aplats cernés de noir (« Rick et
Morty ») y ressemble trait pour trait. C'est le SON qui tranche
(`tailTimeline.ts`) : un aplat sous un dialogue est une image.

## Le son : parole ou musique

La question n'est pas « y a-t-il du son » mais « est-ce de la musique » : un
générique se joue en musique, une scène en paroles et en bruitages. L'extrait
court du début probable du générique jusqu'au bout du fichier (vingt minutes au
plus), transcodé par Jellyfin en MP3 mono 64 kbit/s — le même chemin, la même
politesse que l'analyse des voisins —, décodé par ffmpeg en PCM 16 kHz.

Treize mesures par seconde (`audioFeatures.ts`), chacune gardée pour une raison
mesurée : la pulsation (`beat`, autocorrélation des attaques entre 0,3 et
1,5 s — sépare le rap du générique de « Deadpool », 0,37 à 0,61, d'un dialogue,
0,10 à 0,26), la tenue des notes (`persist`, un pic du spectre encore là 64 ms
plus tard), les creux et la vie de l'enveloppe (`ler`, `pauses`, `envstd`,
`mod4` : la parole respire), et cinq mesures de timbre qui nuancent.

Le modèle (`speechModel.ts`) : une régression logistique sur ces treize mesures
et leur contexte (moyenne et écart-type sur ±3 s), 39 entrées. Appris sur
24 401 secondes non muettes de 44 films du jeu de réglage — 19 328 de musique
(les défilements), 5 073 de parole (les scènes et les fins de film) —, classes
équilibrées, L2 = 0,01. **Validé film par film** (chaque film tour à tour hors
de l'apprentissage) : 83,7 % des secondes justes ; 14,8 % de la musique prise
pour de la parole, 22,2 % de la parole prise pour de la musique — avant le
lissage, qui absorbe les secondes isolées. Le portage TypeScript rend les mêmes
nombres que le labo Python (83,5 %), à l'arrondi près.

La frise : `S` parole (ou bruitages : tout ce qui n'est pas de la musique), `M`
musique, `Q` silence (< −55 dBFS), `?` indécis. Chaque seconde prend la classe
majoritaire de ±4 s autour d'elle.

Coût mesuré : dix minutes d'audio, c'est 1,1 s de calcul (dont 3 ms de modèle)
sur le poste du labo ; l'extrait pèse 5 à 7 Mo et Jellyfin le transcode à
environ 130 fois le temps réel.

## L'ossature, puis les scènes

**Le défilement** (`tailSkeleton.ts`) : les blocs de vignettes de texte (`T`,
`L`, `C` ; un noir ou une vignette étrangère ne les coupent pas) d'au moins
20 s. Le corps du générique est le DERNIER bloc, s'il finit à moins de cinq
minutes du bout, plus ceux qui le précèdent de près : moins de 90 s d'IMAGE
entre eux (le noir ne compte pas), ou moins de cinq minutes s'ils sont longs et
denses. Un bloc de moins d'une minute ne le rejoint qu'à travers du noir ; un
bloc de texte clair seul, jamais.

**Le début du générique** : un marqueur de fournisseur qui tombe au début d'un
bloc du défilement ; sinon le dernier marqueur avant le défilement, s'il n'est
pas du film (quarante secondes de parole sans un texte à l'écran, c'est la fin
du film) ; sinon en REMONTANT depuis le défilement : cartons, texte, aplats et
noirs sont du générique, et une plage parlée prise en sandwich entre deux
crédits ne l'arrête pas. Un marqueur tombé dans la dernière réplique avance
jusqu'à sa fin.

**Les scènes** (`tailScenes.ts`) :

1. la **parole** — une plage `S` d'au moins 15 s, sans texte dessous, sur de
   l'image (dans le défilement, plus d'image que de texte) ; avant le
   défilement, après une minute de générique ou deux vignettes de crédits ;
   dans l'ending court d'un épisode, seulement après des cartons sur noir ;
2. l'**image après le défilement** — une plage `E`/`D`, sauf les faux amis :
   logo musical collé au bout, carton muet de vingt secondes au plus qui court
   jusqu'au dernier instant, courte plage musicale, long défilement coloré ;
   courte et sombre, elle doit être parlée ; ouverte en musique puis parlée,
   la scène commence avec la parole ;
3. le **sandwich parlé** — une plage d'image d'au moins 40 s entre deux
   vignettes de générique sombre, où l'on parle.

Les bords : une scène commence à la dernière vignette de crédits qui la
précède (30 s de recul au plus, recalé sur la grille), ou avec sa parole
quand elle sort du noir.

**Le verdict** (`tailVerdict.ts`) dessine les génériques AUTOUR des scènes :
chaque générique suivi d'une scène a son bouton, et un film à deux scènes en a
deux. Il remplace les génériques des fournisseurs dès qu'il a trouvé une scène,
ou quand aucun fournisseur n'en donnait. Sans scène trouvée, il ne dément un
fournisseur que si sa « scène » tombe en plein défilement.

## Ce qui ne se range plus

- La fin de média n'écrit une ligne (`media_frame_analysis`, version 5) que
  quand elle a trouvé un début de générique ; le « rien » refroidit un jour en
  mémoire, une panne une heure.
- L'audio des voisins n'écrit plus de verdict vide : le « rien » est retenu en
  mémoire un jour, avec la clé des voisins comparés (revérifiés passé ce jour).
- Les empreintes audio des épisodes vivent en mémoire (96 épisodes, ≈ 2 Mo) :
  la table `media_audio_fingerprint` est supprimée par `core-init.sql`.
- Au démarrage, les lignes « rien » d'avant et les versions périmées sont
  purgées.

## Les pièges payés, et leur parade

| Piège | Titre | Parade |
|---|---|---|
| Une ville de nuit, lumières piquées sur du noir, forme 70 s de « texte » vingt-cinq minutes avant le générique | Iron Man 2, 111:40 | on n'agrège au défilement que les blocs proches, ou longs et denses |
| Une scène de nuit presque noire (noir 0,99, saturation 2,4) prise pour du générique suivi d'une « scène » : le saut automatique des génériques de film en sautait cinquante secondes | Les Gardiens de la Galaxie 3, 110:40 | les rangées de texte, pas le noir, disent le générique |
| Un défilement si dense qu'il éclaircit l'image (noir 0,56) pris pour une scène | Endgame | idem |
| Le marqueur Jellyfin posé dans le baiser final | Deadpool, 99:53 | quarante secondes de parole sans texte : c'est du film |
| Le générique Jellyfin court jusqu'au bout et avale la scène mi-générique | Ultron (Thanos, 133:05), Fast & Furious 9 (139:18) | le verdict remplace les génériques dès qu'il voit une scène |
| Des cartons de vingt secondes, trop courts pour un « défilement » | Rick et Morty | un bloc de texte compte dès 20 s et deux vignettes |
| Les dessins animés en aplats cernés pris pour du texte clair | Rick et Morty | `L` sous un dialogue devient une image |
| Les voix de l'ending prises pour une scène | Frieren, Spy x Family | dans l'ending court d'un épisode, la parole ne compte qu'après des cartons |
| Le rap du générique pris pour une scène | Deadpool | pulsation et tenue des notes dans le modèle |
| Un carton jaune pris pour une image | Joker | `C` ne regarde pas la saturation |
| Des photos entre deux pans du défilement, en musique | Les Gardiens 3 (145:40), Zootopie 2 (99:00) | le sandwich doit être parlé |
| Un logo en musique collé au bout | Toy Story 3, Monstres & Cie | logo : près du bout, court, musical, sans parole |
| Un carton muet de vingt secondes au bout | Zootopie 2, 107:20 | carton muet |
| Une scène courte et sombre, à peine parlée | Harry Potter 2, 160:28 | court et sombre : il suffit qu'on y parle |
| Une scène qui sort du noir deux secondes après la fin du défilement | Super Mario Bros (Yoshi), 91:55 | elle commence avec sa parole |
| Trois minutes de noir (un défilement trop fin pour les vignettes) coupaient le générique en deux : plus aucun bouton | Parasite | l'écart entre deux blocs se compte en image, pas en noir |
| Une ville de nuit, 30 s, vingt secondes avant les cartons | The Amazing Spider-Man, 127:00 | un bloc court ne rejoint le défilement qu'à travers du noir |
| Le montage en musique qui clôt l'épisode, dessin animé cerné pris pour du texte clair | Rick et Morty S1E6, 18:00 | un bloc de texte clair seul ne rejoint jamais le défilement |
| Un carton de l'épisode trente secondes avant l'ending | Jujutsu Kaisen S1E3, 20:30 | le marqueur Jellyfin posé au début d'un bloc du générique l'emporte |
| L'ending animé en musique, puis la scène, d'un seul tenant à l'image | Spy x Family S1E7 | ouverte en musique puis parlée : la scène commence avec la parole |
| … mais une scène peut porter de la musique en son milieu | Rick et Morty S1E10 | on ne coupe que ce qui S'OUVRE en musique |
| La chanson du générique sur des cartons, une vignette noire entre deux | Joker | dans le défilement, l'image doit l'emporter sur le texte |

## Les pistes FERMÉES, et les limites connues

- **Classer en noir le bruit de compression d'un noir** (saturation 1 à 2 sur
  un fond uni à 98 %, les noirs de « Joker ») : la vignette sombre qui ouvre la
  scène de « Harry Potter 2 » (160:20) y passait, la scène avec. Joker se règle
  par la parole, pas par la classe.
- **Exiger une vignette claire sous une scène du défilement** : la scène de la
  prison de « The Amazing Spider-Man » (129:18) est toute en `D`. Remplacé par
  « plus d'image que de texte ».
- **Écarter un marqueur de fournisseur suivi d'une minute d'image sans un nom**
  (l'épilogue en musique de « M3GAN 2.0 ») : les crédits illustrés
  d'« Ultron » et de « Fast & Furious 9 » n'ont pas un nom lisible à 320 px,
  et leurs scènes mi-génériques retombaient sous le générique. Fermé ; M3GAN
  reste faux, comme avant.
- **Régler seuil par seuil sur les titres qui échouent** : le prototype 7
  atteignait 47/51 oui/non justes sur le jeu de réglage, mais 20/26 et 2 scènes
  sur 9 sur la validation. Sur-ajusté. Les règles retenues se justifient
  chacune par un phénomène, jamais par un titre.
- **Le volume seul** (un générique plus fort, ou plus faible) : fermé dès le
  labo audio (`SEGMENTS-LABO-AUDIO.md`), confirmé ici — un générique n'est pas
  plus fort, il est plus MUSICAL.
- **Une scène sous le défilement lui-même** (les scènes de « Toy Story 3 »
  sous les crédits) : le texte recouvre l'image, rien ne permet de les isoler.
  Fermé.
- **Les logos longs ou parlés** : le château Disney de « Vaiana 2 » dure plus
  d'une minute, les logos de « Toy Story 5 » parlent. Ils restent des fausses
  scènes connues.
- **Le générique en écran partagé** (« The Fall Guy » : bêtisier à côté des
  noms) : ni texte sur fond sombre ni aplat. Non traité.
- **Une scène musicale courte collée au bout** (sans parole, moins de 30 s) :
  indiscernable d'un logo — c'est le prix de zéro fausse scène sur les logos.
- **Une scène de moins de 15 s** (« Game Night », 95:45, 13 s) : sous le seuil
  de la parole, elle reste sous le générique.
- **Un bêtisier plein cadre entre deux pans du générique** (« Baywatch »,
  116:52) : parlé, sur de l'image, entre des crédits — c'est une scène pour
  l'analyse. Le bouton y mène ; la vérité terrain dit « pas de scène ».

## Recette du banc

Le banc vit hors dépôt, dans `~/.cache/tentacle-test/tail-lab/` : `lab.ts`
(mesures des vignettes et de l'audio, mises en cache), `before.ts` (le code de
main 56caadfb, voisins de saison compris), `run.ts` (le code du dépôt, versé
dans le VRAI résolveur), `evalgt.py` (le juge), `trainset.ts` + `train.py
--write` (les secondes étiquetées, l'apprentissage, et l'écriture de
`speechModelWeights.ts`). La clé Jellyfin du banc vit dans un fichier 0600,
supprimé en fin de chantier.

⚠️ Changer une mesure de `audioFeatures.ts` sans réapprendre, c'est donner au
modèle des nombres qu'il ne sait pas lire : `trainset.ts` puis `train.py
--write`, et rejouer les trois jeux.
