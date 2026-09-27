# La fin d'un média — le banc élargi (28.09.2026, 267 titres)

Suite de `SEGMENTS-LABO-FIN.md`. Le premier labo avait réglé l'analyse sur 102
titres, où elle ne commettait plus que 4 fautes. Sur 165 titres NOUVEAUX, variés
exprès, elle en commettait une sur quatre : c'est ce que ce document mesure, ce
qui a été corrigé, et ce qui ne l'est pas.

## Le corpus

267 titres : les 102 du premier labo, et 165 nouveaux — 83 films, 82 épisodes.

- **Films** : Pixar et Disney (Cars 1-2, Toy Story 1-2, Là-haut, WALL·E, Soul,
  Élémentaire, Les Indestructibles), DreamWorks (Shrek 1, 3, 4, Le Robot sauvage),
  horreur (La Nonne 1-2, Scream 7, Sinister, The Thing, 28 Ans plus tard),
  comédies (Paul, Ted, American Pie 2, Projet X, Jackass), animés (Chainsaw Man,
  Demon Slayer, L'Attaque des titans, Rascal), et une trentaine de films sans
  aucune scène (Matrix, Dune, Harry Potter 1, Le Hobbit 3, Mission : Impossible 8…).
  Plusieurs scènes : Don't Look Up (2), Jumpers (2), Jackass (2).
- **Épisodes** : One Piece sur treize saisons (des débuts à Elbaf, avec et sans
  ending), Naruto, Bleach, Black Clover, Hunter x Hunter, Fullmetal Alchemist,
  Demon Slayer, Jujutsu Kaisen, L'attaque des Titans, Dr. Stone, Frieren, Spy x
  Family… ; sitcoms (Brooklyn Nine-Nine, How I Met Your Mother, Malcolm, Les
  Griffin, South Park, BoJack, Smiling Friends) ; séries (The Boys, Invincible,
  Stranger Things, Breaking Bad, Game of Thrones, The Last of Us, Fallout,
  Daredevil, Ça : Bienvenue à Derry…) ; Rick et Morty.

La vérité terrain des nouveaux titres a été établie par dix-sept étiqueteurs
suivant un même guide (définitions ci-dessous), sur planches-contact (une
vignette toutes les 10 s) puis en pleine définition : chaque début de générique
et de scène est calé à ±2 s sur le flux statique (ffmpeg, sans session de
lecture). **Les vignettes trickplay montrent l'image de 3 à 5 s APRÈS leur
horodatage** (mesuré sur une vingtaine de fichiers) : un bord lu sur les seules
planches est en avance d'autant.

**Définitions.** Le générique commence au premier crédit (ou au premier plan d'un
générique conçu comme tel) ; des cartons d'épilogue avant lui sont du film. Une
**scène** est de la fiction nouvelle, plein cadre, sans texte de générique
par-dessus : scène mi- ou post-générique, partie C d'un animé, omake. **Ne sont
PAS des scènes** : bêtisier, making-of, photos, archives, générique illustré,
images du film encadrées à côté des noms, logos, cartons, et l'**aperçu du
prochain épisode**. Les scènes de moins de 10 s (hors d'atteinte des vignettes)
sont comptées à part.

**Réglage et validation.** Un tiers des nouveaux titres (28 films, 27 épisodes,
tirés au sort par catégorie) a été mis de côté AVANT tout réglage. Deux d'entre
eux ont dû être examinés en cours de route (Frère des ours, One Piece S17E90) : la
validation n'est donc pas tout à fait aveugle.

## Le juge (v2)

Pour chaque scène de la vérité : **vue** (un générique qui promet une scène finit
entre 35 s avant et 12 s après son début — le bouton y mène), **seule** (aucun
générique ne la précède, elle se joue d'elle-même), **sans bouton** (défaut
léger : elle se joue, mais après plus de 45 s de générique qu'on ne peut pas
passer, ou le bouton atterrit trop tôt), **perdue** (sautée, sous un générique,
ou amputée de plus de 12 s). Un titre est **en faute** s'il perd une scène, en
invente une (un bouton vers un logo, un bêtisier, un aperçu), ou pose le
générique plus de 30 s dans le film.

## Avant / après

Code de départ : main 1d9f8fe3 (serveur 1.20.0). Code d'arrivée : la branche du
chantier.

| Catégorie | Titres | En faute | Scènes | Avec bouton | Sans bouton | Perdues | Inventées | Générique dans le film |
|---|---|---|---|---|---|---|---|---|
| Films sans scène | 94 | 17 → **8** | — | — | — | — | 15 → **7** | 5 → 2 |
| Films à une scène | 47 | 5 → **4** | 47 | 29 → **34** | 12 → 7 | 3 → 3 | 3 → 2 | 1 → 1 |
| Films à 2 scènes et plus | 19 | 1 → 1 | 42 | 22 → **28** | 14 → 8 | 1 → 1 | 0 → 0 | 0 → 0 |
| Épisodes animés avec scène | 12 | 2 → 2 | 12 | 7 → 7 | 5 → 4 | 0 → 1 | 2 → 1 | 0 → 0 |
| Épisodes animés sans scène | 41 | 13 → **1** | — | — | — | — | 13 → **1** | 2 → 1 |
| Épisodes de séries avec scène | 19 | 1 → 1 | 19 | 14 → 14 | 0 → 0 | 1 → 1 | 0 → 0 | 0 → 0 |
| Épisodes de séries sans scène | 35 | 3 → 3 | — | — | — | — | 3 → 3 | 0 → 0 |
| **Total** | **267** | **42 → 20** (15,7 % → 7,5 %) | 120 | **72 → 83** | 31 → 19 | 5 → 6 | **36 → 14** | 8 → 4 |

Réglage (212 titres) : 33 → 14 fautes (6,6 %). Validation (55) : 9 → 6 (10,9 %).
One Piece : 12 épisodes de l'animé, 10 en faute → 1.

Horodatages : le début du générique tombe à 2 s près en médiane (3 s avant) ;
les boutons atterrissent 3 s avant la scène en médiane, entre 27 s avant et 7 s
après (avant : entre 33 s avant et 7 s après). Reste une queue de générique vu
en retard (p90 : 2 min 10) — les génériques illustrés sans scène derrière, qu'on
ne remonte pas exprès (voir `tailIllustrated.ts`).

## Ce qui a été corrigé, et pourquoi (une étape = un commit)

1. **Le générique illustré** (`tailIllustrated.ts`) — Marvel, Pixar, Sony :
   une à trois minutes de générique « conçu », des images en musique, puis la
   scène mi-générique, puis le défilement. Il était lu comme du film : la scène
   se jouait d'elle-même après deux minutes sans bouton. Une plage parlée collée
   au défilement, précédée d'au moins une minute de musique, le révèle. Garde-fou
   mesuré : sans scène derrière, remonter à travers la musique posait le générique
   dans le film 6 fois sur 25 ; un chapitre NOMMÉ générique posé plus tard dément
   la règle (« L'Incroyable Hulk ») — « End Titles » rejoint les noms reconnus.
2. **L'aperçu du prochain épisode** (`tailPreview.ts`) — mesuré sur 35 aperçus
   et 23 vraies scènes finales : 4 à 35 s de voix jusqu'au bout, après un ending
   fait d'IMAGES en musique ; les scènes finales occidentales suivent des cartons
   sur noir, les parties C durent plus de 40 s. Le verdict porte l'aperçu : un
   générique de fournisseur qui s'arrête juste avant lui court jusqu'au bout.
3. **Les logos de fin** (`tailLogos.ts`) — la lampe Pixar, le « N » de Netflix
   finissent sur un fond clair uni ; une seule des 62 vraies scènes finales du
   banc finit ainsi (longue et très parlée). Le son ne tranche pas : le shawarma
   d'« Avengers » est muet, les bruitages de la lampe passent pour de la parole.
4. **Le marqueur posé dans le film** — l'analyse savait qu'il tombait dans le
   dialogue ; le verdict le dément désormais même sans scène (`overrides`), sauf
   s'il promet une réplique derrière lui (« La Nonne 2 » : un générique sonorisé,
   puis les Warren). One Piece sans ending : l'aperçu ancré sur le marqueur.
5. **Une voix dans la chanson du générique illustré** ne coupe plus son bloc —
   jusqu'à la minute seulement (« Super Mario Galaxy » : sa fin est musicale aussi).
6. **La voix chantée d'un ending suivi de l'aperçu** n'est pas une scène.
7. **Le château Disney du centenaire** (40 s) est un logo.
8. **Des cartons clairs sous une voix** ne révèlent pas de générique illustré.
9. Le verdict rangé passe en version 6 (aperçu, démenti) : les anciens sont refaits.

## Les pistes FERMÉES ce chantier

- **Réapprendre le modèle parole / musique** sur les régions du nouveau banc
  (endings chantés, défilements, scènes, aperçus : 22 000 s de plus). Il gagne
  3 points à la seconde en validation croisée (87,2 % contre 83,7 % sur les
  nouvelles régions ; endings 87 → 90 %) mais DÉGRADE le banc (réglage 16 → 22
  fautes, validation 7 → 8 ; Frieren, Sinister, Super Mario Bros) : les règles
  sont calées sur le premier modèle. Fermé tant qu'on ne les recale pas toutes.
- **La pulsation** pour distinguer la chanson d'un générique de la musique de
  fin d'un film : médiane 0,35 contre 0,20, mais aucune séparation titre par
  titre (des fins de film pop à 0,45, le générique d'« Avengers » à 0,19).
- **Un détecteur de texte sur l'image**, par vignette : 24 mesures (bandes de
  texte bornées, étendue horizontale, tiers de l'image, texte clair sur sombre)
  séparent mal le générique posé sur une image du film — AUC 0,80, et 15 % des
  vignettes de générique rattrapées à 93 % de précision. À 320 px, un nom sur
  une image ne se distingue pas d'une texture.
- **Les images encadrées à côté des noms** (un tiers de l'image noir et uni,
  un autre porteur d'image) : 0,6 % des vignettes de film comme de générique.
- **Franchir, en remontant, une plage d'image en musique entre deux crédits**
  (« Vaiana 2 », le parchemin) : aucun effet sur le banc.
- **Rejoindre le défilement à travers une scène précédée d'une minute de
  cartons** : une fausse scène de plus (« Invincible » S1E8), rien de gagné.
- **Une vignette de musique isolée DANS la scène du générique illustré** :
  « Captain Marvel » reperd son bouton, rien de gagné.

## Ce qui reste raté, et pourquoi (20 titres)

- **Scènes trop courtes pour les vignettes** (10 à 13 s) : « Game Night »,
  « Teenage Sex and Death at Camp Miasma », « Smiling Friends » S2E3.
- **Bêtisiers et extraits sous le générique, parlés** : « Baywatch » (plein
  cadre), « Toy Story 2 » (en encadré), « Tetris » et « #Chef » (encadrés),
  « Jennifer's Body » (montage sous les noms), « 28 Ans plus tard » (des éclats
  d'images du film que les vignettes saisissent).
- **Une chanson entendue comme de la parole** : « Shrek 4 » (sur le parchemin),
  « Demon Slayer » (film : le générique entier, et un marqueur Jellyfin posé au
  milieu de la scène).
- **Logos de production qui parlent, après des cartons** (séries) : « Stranger
  Things » S4E9, « Marvel's Daredevil » S1E1, « Alien: Earth » S1E1 — trop
  proches, au son comme à l'image, du gag final d'un « Rick et Morty ».
- **Épilogues** : « Paul » (entrecoupé de cartons), « M3GAN 2.0 » (en musique,
  marqué par Jellyfin), « Anaconda » (cartons d'épilogue, scène avant les crédits).
- **Omakes collés à l'aperçu** (le prix connu de la règle) : « Demon Slayer »
  S5E3, « Black Clover » S1E20.
- **One Piece S17E90** : un marqueur Jellyfin couvre six minutes d'épisode dont
  quelques vignettes sombres texturées passent pour des cartons.

Scènes encore **sans bouton** (défaut léger, 19 sur 120) : surtout des génériques
illustrés que la règle ne reconnaît pas — chanson entendue comme de la parole
(« No Way Home »), scène entrecoupée de musique (« Deadpool 2 », « Cruella »,
« Les Gardiens de la Galaxie 3 »), scène de cinq minutes (« Sinners »),
générique sur parchemin entre la scène et le défilement (« Vaiana 2 »).

## Recette

Banc hors dépôt, `~/.cache/tentacle-test/tail-lab/` : `LABEL-GUIDE.md` (le guide
des étiqueteurs), `sheet.py` (planches), `frame.py` (images pleine définition),
`gt_*.txt` (vérité ; `gt_newf_val.txt` et `gt_neweps_val.txt` = validation),
`runall.sh <préfixe>` (le code du worktree sur les cinq jeux), `report.sh` et
`compare.py <avant> <après>` (tableaux), `judge.py` (le juge v2), `dbg3.ts` (la
frise d'un titre, vérité, marqueurs et chapitres en regard), `baseline/` (le code
de départ, via `LAB_SRC`). La clé Jellyfin du banc vit dans `jf.json` (0600),
supprimé en fin de chantier.
