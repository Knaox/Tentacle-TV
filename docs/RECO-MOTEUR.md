# Le moteur de « Pour vous » — ce qu'il fait, ses règles, et comment le mesurer

Ce carnet décrit le MOTEUR (backend, `apps/backend/src/services/reco/`) : d'où
viennent les titres, comment ils sont notés, ce qui les écarte, comment la page
est assemblée. Ce qui sort de « Pour vous » après un geste (retrait au lâcher,
potentiels de Ma liste) est dans `docs/RECO-POUR-VOUS.md`. Le contrat de la page
(raisons `why`, correspondance `match`, titre « à la une ») est
`packages/shared/src/reco/recoPageTypes.ts`, recopié octet pour octet dans le
backend (test miroir).

Le principe : **le goût d'un compte se lit sur ce qu'il ADORE et ce qu'il
REFUSE, titre par titre** — jamais sur la popularité seule. Le grand public
reste servi à qui le regarde (la calibration le dit), il n'est imposé à
personne.

## 1. Le chemin d'une génération

```
signaux ─► ancres ─► profil ─► graines + voisins ─► sources ─► score ─► enrichissement ─► pool (1000)
                                                                                            │
                                     page servie ◄─ instantané de page ◄─ rangées ◄─────────┘
```

1. **Ancres** (`anchors.ts`, `anchorSignals.ts`) : un titre par signal fort —
   favori, j'aime, note, visionnage (heures), refus « Ne plus me proposer »
   (poids négatif). Un titre seulement dans Ma liste n'est PAS une ancre (cf.
   potentiels).
2. **Profil** (`profileCompute.ts`) : facettes TF-IDF pondérées (genres,
   mots-clés, auteurs, acteurs, studios, décennie, langue, univers, saga).
3. **Graines** (`poolTaste.ts`, `candidates/seeds.ts`) : les ancres aimées les
   plus DISTINCTIVES, interrogées sur TMDB (recommandations, similaires) ; les
   voisins collaboratifs des ancres viennent du cache.
4. **Sources** (`poolSources.ts`), dans cet ordre (le plafond d'assemblage
   coupe les dernières) : bibliothèque non vue, graines, voisins, animés
   (`animeSource`), personnes aimées, **auteurs** (`creatorSource`), **Vigie**
   (`vigieDiscover` + `vigieSource`), découverte TMDB.
5. **Score** (`scoring/tasteStrategy.ts`, termes purs dans `tasteTerms.ts`),
   puis enrichissement du haut (`poolEnrichment.ts` : fiches TMDB, 60 appels au
   plus par génération), re-score, filtres, et la **correspondance** par rang.
6. **Rangées** (`rowBuilder.ts`, filtres purs dans `rowFilters.ts`) et **page**
   (`pageBuilder.ts`, `pageRows.ts`, servie par `pageService.ts`).

## 2. Les sources, et pourquoi

| Source | Ce qu'elle apporte | Pourquoi |
|---|---|---|
| Bibliothèque | tout le non-vu (3000 au plus) | la seule source sans TMDB ni Vigie |
| Graines | recommandations TMDB des titres aimés les plus distinctifs | la parenté « vue par les spectateurs » |
| Voisins | recommandations en cache des ancres | dès la passe rapide, sans réseau |
| Animés | découverte TMDB de l'univers, si le compte en regarde | l'animé récent n'est pas dans les recommandations des classiques |
| Personnes | autres titres des acteurs aimés (explicitement ou trois titres adorés) | les rangées « Avec … » |
| **Auteurs** | œuvres des créateurs de séries et réalisateurs de ce qu'il adore, **dès un titre** | une série adorée mène aux autres séries de ses créateurs (Fargo → Legion, Noah Hawley), que TMDB ne recommande pas toujours |
| **Découverte de Vigie** | `/discover` de Jellyseerr RÉGLÉ PAR LE GOÛT : mots-clés, animé récent (langue d'origine), genres par monde dans son époque, chaînes, studios, votes et note minimaux — seize requêtes au plus, en cache six heures | deux pages de popularité ne montraient jamais ce qui lui ressemble ; Jellyseerr applique ses filtres hors bibliothèque, et le cœur ne lit jamais les tables de l'extension |
| Découverte TMDB | genres et décennies du profil | le reste du monde, en dernier |

Vigie absente (plugin non installé, table manquante) : ses sources rendent une
liste vide, sans erreur. Un auteur muet, une liste TMDB en échec : la source
suivante continue.

## 3. Le score d'un titre

`total = 0,5 proximité + 0,2 graines + 0,08 profil + 0,25 qualité
+ 0,2 récence × appétit + 0,3 calibration + 0,2 personnes adorées
− 0,45 refus − 0,45 aversion (univers ou format) − 0,5 thèmes évités
− 0,35 sous la barre`

Chaque composante est saturée sur le panier du compte (quantile 90) : les
poids disent ce qu'ils pèsent.

- **Proximité** : similarité TF-IDF aux titres aimés, UN PAR UN (les cinq
  plus proches), pas au profil moyen — un fan d'un thriller allemand et d'une comédie animée
  n'aime pas leur moyenne. Chaque ancre citée porte sa `similarity` (la
  parenté de contenu, sans son poids).
- **Refus** : ressemblance aux titres refusés (« Ne plus me proposer »),
  pesée par ce qui EXPLIQUE le refus (`refusalShare`) : même saga, entière ;
  autre format, moitié ; autre décennie, trois quarts (deux et plus : moitié).
  Un shōnen récent de douze épisodes ne paie pas un fleuve refusé vingt ans
  plus tôt comme le paie un fleuve de la même décennie.
- **Calibration** (`calibration.ts`) : la notoriété et l'époque de ce que le
  compte regarde, dans les deux sens — remplace la popularité brute.
- **Aversion d'univers** (`aversion.ts`) : un univers très offert par la
  bibliothèque mais jamais regardé (animé, animation familiale, franchises)
  est évité ; un refus compte contre son univers. Un titre prend l'aversion de
  son MONDE le plus regardé (un Ghibli familial chez une famille : 0) ; la
  franchise ne compte que hors de tout monde. L'animation familiale se
  reconnaît au genre « Famille » ou à son studio (DreamWorks, Pixar, Disney… :
  TMDB ne pose pas toujours le genre sur les séries), et dès la liste.
- **Aversion de FORMAT** (`formatAversion`) : un feuilleton-fleuve (cent
  épisodes et plus, ou dix ans d'antenne : `format:long-running`, cf.
  `universes.ts`) n'est pénalisé que si le compte en a REFUSÉ au moins deux ;
  ce qu'il en adore la tempère : quatre refusés contre deux adorés valent
  4 / 7. La facette ne rapproche rien (multiplicateur nul).
- **Thèmes évités** (`themeAversion.ts`) : un thème dense jamais regardé
  (l'isekai d'une saison) ne pénalise qu'un titre peu voté.
- **Barre de qualité** (`lovedTaste.ts`) : le quart le moins bien noté de ce
  qu'il adore, moins 0,3 ; l'univers animé a la sienne : les votes, et
  l'ÉPOQUE — le quantile 0,15 des années des animés qu'il regarde et adore
  (jamais le seul plus ancien), écart graduel plein quatre ans avant.
- **Personnes adorées** : un acteur dans trois titres adorés, un auteur dans
  deux — et **dans leur registre** : la personne ne compte que si deux titres
  adorés au moins partagent un genre avec le candidat (trois films d'action adorés ne
  font pas aimer le drame romantique du même acteur). **Une voix d'animation n'est pas un
  rôle** : un dessin animé adoré ne fait pas aimer qui y prête sa voix.

## 4. Ce qui écarte un titre

- **Contenu pour adultes** (`universes.ts`, `isExplicitMeta`,
  `isBlockedExplicit`) : seule la pornographie explicite est bloquée — le
  drapeau « adult » de TMDB, les mots-clés « hentai » et « pornography », et une
  liste FERMÉE de titres X que TMDB ne marque pas (`EXPLICIT_TITLES` : Redo of
  Healer) —, et seulement HORS bibliothèque.
  Le contenu sexuel n'est pas filtré (ecchi, drames qui montrent des
  violences) ; la bibliothèque ne se filtre jamais (l'administrateur l'a
  choisie) ; Jellyseerr applique ses propres filtres à ce qu'il propose.
  « Vos acteurs » écarte toujours les personnes marquées « adult ».
- **Sans note ou moins de 50 votes** (`hasEvidence`) : ne remplit aucune
  rangée. Seul un titre de la bibliothèque sans fiche TMDB, noté par
  Jellyfin, passe.
- **Inaffichable** : sans titre ni image.
- **Déjà vu, refusé, demandé** : exclusions de service (`candidates/exclusions.ts`).

## 5. La correspondance (`match`)

Le rang dans le pool du compte (95 en tête, 50 en queue), **plafonné par la
proximité aux goûts** : `min(rang, 60 + 35 × min(1, proximité / 0,5))`. Un
titre classé haut par sa seule notoriété (une procédurale du catalogue) ne
s'annonce plus à 88 %. « À la une » exige 70 et un visuel large.

## 6. Les rangées

- **Pour vous**, **Dans votre bibliothèque**, **Animés pour vous** (part
  d'animé ≥ seuil), **À découvrir** (Vigie).
- **Films pour vous** (`forYouMovies`, capacité `reco.moviesRow`) : les
  meilleurs films, deuxième rangée, à thème (`?themes=1`) — sans aucun titre de
  « Pour vous » ; au service, les rangées suivantes perdent ses films.
- **Parce que vous avez aimé X** (`isRealKin`) : seulement les titres dont la
  raison CITE X (X parmi les deux premiers titres aimés qui portent le score),
  avec une parenté de contenu réelle (similarité ≥ 0,12, proximité ≥ 0,2),
  du même monde (animé, animation, prises de vues réelles — jamais WALL·E
  derrière un film en prises de vues réelles), deux titres d'une saga au plus, trois d'une
  franchise. Une graine dont les parents sont surtout des franchises ne fait
  pas de rangée. Tirage quotidien pondéré par la force des graines.
- **Avec / De {personne}** (rangées à thème, `?themes=1`) : les personnes
  adorées, titres de leur registre seulement.
- **Exploration** : un pas de côté, jamais une saga que le profil ne suit pas.
- **Rangées globales** (tendances, pouls du serveur, meilleurs de la
  bibliothèque, communauté) : filtrées par le goût (`gateGlobalRow`).

**La page** (`pageBuilder.ts`) : un titre n'apparaît qu'UNE fois. Les rangées
à thème se construisent en dernier, à leur place, sans reprendre aucun titre
déjà montré : servies ou non, la page n'a ni doublon ni trou. Une rangée de
moins de six titres n'est pas servie.

## 7. La langue des titres

Les titres hors bibliothèque suivent la langue des métadonnées de Jellyfin
(`titleLanguage.ts` : `PreferredMetadataLanguage` + `MetadataCountryCode`,
relue au plus toutes les six heures). Toutes les listes TMDB du moteur la
demandent ; le catalogue de Vigie fournit ses titres traduits ; à la fusion de
deux sources, le titre localisé l'emporte (`titleLocalized`). Une fiche TMDB
en cache reste en anglais : un titre qui n'arrive QUE par elle peut le rester.

## 8. Le banc

Hors ligne, rejouable, jamais lancé par `pnpm test` :

```bash
cd apps/backend
pnpm bench:reco capture <id Jellyfin d'un compte de TEST>   # relève la bibliothèque
pnpm bench:reco run <étiquette> [--offline] [--personas <dossier>] [persona…]   # rapports : data/reco-bench/reports/<étiquette>/
pnpm bench:reco find <texte>                               # où est un titre (rang, source, score)
```

- Le VRAI moteur (profil, pool, page) tourne pour chaque **persona**
  (`test/reco-bench/personas/*.json` : historique, attendus, à éviter), sur la
  bibliothèque relevée et le cache TMDB local ; TMDB est rejoué depuis une
  bande (`data/reco-bench/tmdb-tape`, `--offline` n'en sort pas).
- **Personas privés** : le goût réel d'une personne ne se publie pas. Ses
  personas vivent HORS du dépôt, dans un dossier que le banc lit en plus des
  siens : `--personas <dossier>` ou la variable `RECO_BENCH_PRIVATE_PERSONAS`
  (même format JSON). Le banc tourne avec les seuls personas du dépôt, ou avec
  ce dossier en plus ; il compte alors aussi dans la population.
- **Vigie** est émulée par la MÊME découverte réglée par le goût
  (`vigieDiscoverQueries`), demandée à TMDB sous ses noms (`tmdbDiscoverParams`,
  Jellyseerr relaie TMDB), plus les listes de popularité qu'il met en avant.
- Le pouls du serveur et la communauté se calculent sur la POPULATION des
  personas, jamais sur de vrais comptes.
- Mesures (`bench/benchMetrics.ts`) : intrus du top 20 et de la page, part des
  attendus présents, divergence de popularité, nouveauté, diversité.
- Le jour est figé (`BENCH_DAY`) : deux passages se comparent.

Un réglage ne se garde que si le banc le confirme sur TOUS les personas : un
gain pour un compte exigeant qui coûte à une famille n'est pas un gain.
