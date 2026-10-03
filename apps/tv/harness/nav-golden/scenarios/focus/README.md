# Scénarios de référence — focus, sections et rangées (T3)

Les scénarios du domaine « focus » (`docs/tv-navigation/focus.md`, dont ils
citent les identifiants dans `covers`). Écrits AVANT le banc de T2, dans le
format le plus probable — des données pures — et à aligner sur le sien à sa
fusion. Ils s'enregistrent sur le SHA de référence `84f3cedd0` (`record`),
puis doivent repasser à l'identique après l'extraction (`verify`).

## Format (provisoire)

Un fichier JSON par scénario :

| Champ | Sens |
|---|---|
| `id` | `focus/<nom>` — unique dans le banc |
| `title` | ce que le scénario éprouve, en une phrase |
| `covers` | les identifiants du relevé (`R3`, `H2`…) |
| `fixture` | le jeu de données du faux serveur (ci-dessous) |
| `start` | l'écran de départ ; `cold` : relance à froid de l'app |
| `steps` | les gestes et les relevés, dans l'ordre |
| `expect` | ce que l'enregistrement de référence doit montrer (à relire au `record`) |

Les gestes reprennent le vocabulaire de l'agent `../../atv-remote` : `up`,
`down`, `left`, `right`, `select`, `menu`, `play`, `hold:<s>` (OK maintenu),
`holddown:<s>` / `holdup:<s>` (flèche maintenue), `wait:<s>`. Les relevés :

| Relevé | Ce qu'il lit |
|---|---|
| `focus` | l'élément focalisé natif : libellé et cadre (agent XCUITest) |
| `probe:focusKey` | la clé focalisée du magasin de l'écran devant (CDP) |
| `probe:heroId` | l'identifiant du titre affiché par le héros (CDP) |
| `probe:scrollY` | le défilement vertical de la page devant (CDP) |
| `probe:route` | la route du dessus de la pile |

## Jeux de données

- **`home-standard`** — l'accueil : au moins 3 reprises (le héros tourne), et
  dans la mise en page du compte, dans cet ordre : `resume` (16:9, 3 à 4
  cartes), une rangée recommandée `reco:*` filtrée par plateformes (8 cartes ou
  plus, la pastille du filtre posée), `library:<films>` (10 cartes ou plus),
  `watchlist` (UNE carte — la rangée courte sous une longue), puis 3 rangées
  au moins pour la rafale. Fiches des titres servies (art du héros, fiche).
- **`foryou-standard`** — « Pour vous » : une tête (fiche servie), 3 étagères
  ou plus, la première filtrée par plateformes.

Aucun scénario ne note un titre, ne lance une lecture, ni ne retire le filtre
(OK sur `filter:remove` est interdit : il écrirait les préférences).

## Couverture

| Comportement | Où |
|---|---|
| A1-A6 entrée d'écran, retour | `home-entry`, `home-return-from-detail`, `foryou-entry-and-shelves` |
| R1-R6, R11 sections, voisins | `home-rows-down-up`, `home-row-end-nearest`, `home-filter-chip`, `foryou-entry-and-shelves` |
| V2, V4, V6 révélation | `home-rows-down-up` (`probe:scrollY` à chaque pas) |
| V7, V8 rafale | `home-burst` |
| X1-X4, H3 au-delà du bord | `home-hero-beyond-edge` |
| H2 rotation, H5 appui maintenu | `home-hero-rotation` |
| H6 héros de « Pour vous » | `foryou-entry-and-shelves` |
| W1-W4 rangées | tous les scénarios de l'accueil |
| C1 (`claimAfterRestore`) | scénarios de T4 (déplacement annulé dans le rail) et T7 (réglages › navigation) |
| G1 (`createEntryGuide`) | scénarios de T6 (panneaux) et T7 (bibliothèque) |
| K1 (`useKeepFocusWithin`) | scénario du voile hors ligne (T6, surimpressions) |
| E1-E3 entrée de section | scénarios de la fiche (T7) |

Ce qu'un appui ne sait pas montrer — le glisser du pavé (X1 par `swipe`), le
pan, la parallaxe — se relit sur l'Apple TV « Chambre ».
