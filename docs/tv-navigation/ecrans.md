# Écrans — la navigation propre à chaque écran (Apple TV, chemin refondu)

Relevé de la tâche T7 du lot « Extraction de la navigation Apple TV »
(2026-10-03), fait sur le SHA de référence **84f3cedd0** (le main d'origine,
avant toute extraction). Il dit, écran par écran, ce que la télécommande y
fait AUJOURD'HUI : l'entrée du focus, les voisins particuliers, les gestes, le
clavier système, les bords, le Retour propre à l'écran. C'est le cahier des
charges de l'extraction : après elle, chaque règle ci-dessous reste vraie, à
l'identique — les scénarios dorés (`apps/tv/harness/nav-golden/scenarios/ecrans/`)
citent ses identifiants (`FI-3`, `RE-7`…).

Ce qui n'est PAS ici, parce qu'une autre tâche le porte (arbitrages du
coordinateur, `.claude/nav-lot/STATUS.md`) :

| Couche | Tâche | Ce que les écrans en reçoivent |
|---|---|---|
| Intentions, traduction tvOS, entrée native | T1 | le vocabulaire des gestes |
| Règle des sections, primitive d'entrée de section, guides d'entrée, verrous, `useEntryFocus` | T3 | HAUT / BAS d'une section à l'autre, l'arrivée et le retour sur un écran |
| Pile du Retour (`resolveBack`, `useBackLayer(s)`), rail, croix Retour (`useBackFocus`), suite de fiches (`detailMove`), accessoire et fenêtre des demandes | T4 | Menu, la croix, le rail et ses raccourcis |
| Lecteur | T5 | — |
| Grand panneau, cartes, appui maintenu → quel panneau (`panels/cardHold`), double appui, feuille des saisons, panneau d'un titre absent, `useChoiceEntry` (la règle), surimpressions | T6 | l'appui maintenu sur une carte, l'entrée d'une liste en Modal, la confirmation à double appui |

Vocabulaire : une **clé** (`detail:primary`, `grid:0`…) nomme une cible du
magasin de focus de l'écran ; **réclamer** = `focus.claim(clé)` (le focus y
va, dès que la cible est montée) ; un **groupe** (`FocusGroup`) peut recevoir
un guide (mémoire, entrée, destination) ; une **section** (`FocusSection`)
suit la règle de voisinage de T3.

---

## 1. La fiche (`MediaDetail`)

**Fichiers** — câblage `apps/tv/src/redesignWiring/detail/`
(`MediaDetailRedesign`, `useDetailGuides`, `useDetailActions`,
`useOpenDetail`, modèles) ; vue `apps/tv/src/redesign/screens/detail/`
(`DetailView`, `DetailActions`, `DetailHeader`, `SeasonTabs`, `EpisodeRail`,
`DetailSections`, `SagaRow`, `CastRow`, `ExtrasRow`). Pas de rail : un écran
poussé, `useFocusStore` + `FocusBindingProvider`.

### Entrée et états

- **FI-1** L'entrée (`entryKeyOf`, `MediaDetailRedesign.tsx`) :

  | État | Entrée |
  |---|---|
  | erreur de la fiche | `status:primary` (« Réessayer ») |
  | chargement (`header` ou `actions` absents) | aucune — seule la croix est focalisable, et verrouillée |
  | une pilule de lecture | `detail:primary` |
  | sinon une bande-annonce | `detail:trailer` |
  | sinon | `detail:list` (Ma liste) |

  La pilule existe pour un film, un épisode, une série non terminée (« Lecture
  S1 · E1 », « Reprendre S2 · E5 », « Lecture » tant que l'état se résout) ;
  jamais pour une collection ni une série terminée (`playModelOf`).
- **FI-2** `useEntryFocus(focus, entryKey)` (T3) : la préférence de l'entrée
  pendant l'arrivée, close au premier focus de contenu ; au RETOUR sur la
  fiche (lecteur, bande-annonce, autre fiche dépilés), la dernière clé de
  contenu encore montée, sinon l'entrée.
- **FI-3** La croix (`useBackFocus(focus, { backKey: "detail:back", barKey:
  "detail:top", entryKey })`, T4) : JAMAIS l'entrée ; verrouillée jusqu'au
  premier focus posé ailleurs ; HAUT depuis toute la page l'atteint par sa
  bande `detail:top` ; BAS depuis elle → la dernière cible de contenu, sinon
  l'entrée.
- **FI-4** La pilule de lecture qui DISPARAÎT (série qui se révèle terminée,
  apprise après l'arrivée) : si la dernière clé focalisée était
  `detail:primary`, la fiche réclame la nouvelle entrée (`detail:trailer` ou
  `detail:list`).

### Sections et voisins particuliers

Ordre vertical : `detail:header` (l'en-tête, révélé page tout en haut, mode
`start`), puis, présentes ou non, `detail:collection`, `detail:seasons`,
`detail:episodes`, `detail:cast`, `detail:extras`, `detail:saga`,
`detail:similar` — chacune ancrée à `SECTION_ANCHOR_TOP` (`DetailSection`,
mode `anchor`). HAUT / BAS : la règle commune (T3), plus deux entrées propres
à la fiche (`useDetailGuides`, liées une fois au premier rendu) — la règle
pure de T7, appliquée par la primitive d'entrée de section de T3 :

- **FI-5** `detail:seasons` entre TOUJOURS par l'onglet de la saison AFFICHÉE :
  `season:<index de selectedSeasonId>` (aucune entrée si la saison affichée
  n'est pas dans la bande). Le focus d'un onglet ne change pas la saison (il
  précharge ses épisodes, `onFocusSeason`) ; seul OK la choisit.
- **FI-6** `detail:episodes` entre par l'épisode À REPRENDRE —
  `episode:<anchorIndex ?? 0>` (aucune entrée sans épisode) — à sa PREMIÈRE
  entrée de la visite : armée à l'arrivée, DÉSARMÉE au premier focus d'une clé
  `episode:*`, RÉARMÉE à chaque changement de `selectedSeasonId` ; ensuite la
  règle commune (au plus proche).
- **FI-7** Les rangées `detail:seasons`, `detail:episodes`, `detail:cast`,
  `detail:extras`, `detail:saga`, `detail:collection`, `detail:similar`
  retiennent le focus à leurs BOUTS (`trapFocusLeft` / `trapFocusRight`) : de
  côté, rien à atteindre — la fiche n'a pas de rail.
- **FI-8** `anchorIndex` (`useDetailEpisodes`) : l'épisode ouvert (fiche d'un
  épisode, badge « Épisode actuel »), sinon celui de l'état de visionnage
  d'une série non terminée (« Reprendre » s'il est entamé, sinon « À
  suivre »), sinon 0. La saison affichée d'une série : celle de l'épisode à
  reprendre, ATTENDUE (pas de saison provisoire), ou celle de la route
  (`seasonId`, carte regroupée des « Derniers ajouts »). La bande se cale UNE
  fois, à l'arrivée, sur la saison affichée (`SeasonTabs.place`) ; la rangée
  des épisodes s'ouvre calée sur l'ancre (`initialScrollIndex`).
- **FI-9** Les onglets GRISÉS des saisons manquantes
  (`season:<nombre d'onglets + i>`, garde Vigie ouverte, `useSeriesGapTabs`)
  prolongent la bande : DROITE depuis le dernier onglet y mène.

### Gestes

- **FI-10** OK et appui maintenu, par cible :

  | Cible | OK | Appui maintenu |
  |---|---|---|
  | `detail:primary` | lecture : l'item ; une série → l'épisode résolu (série terminée : rien ; état encore inconnu : résolu au geste, `useResolvePlayTarget`) — route `Player` | — |
  | `detail:trailer` | bande-annonce locale → `Player` ; YouTube → `Trailer` (`url`, `name`, `itemId`) | — |
  | `detail:list`, `detail:favorite`, `detail:watched` | bascules (`useCardToggles`) | — |
  | `detail:rate` | le grand panneau réduit à la note (T6, `ActionSheetRedesign mode="rate"`) | — |
  | `detail:series` (pastille d'un épisode) | la fiche de la série (`openTitle`) | — |
  | `season:<i>` | choisit la saison | — |
  | `season:<n+i>` (grisé) | VI-2 | — |
  | `episode:<i>` | lecture de l'épisode (`Player`) | panneau de la vignette (T6) |
  | `cast:<i>` | la page de la personne (`openPerson`) | — |
  | `extra:<i>` | locale → `Player` ; YouTube → `Trailer` | — |
  | `saga:<i>` | « Cette fiche » : rien ; volet de la bibliothèque → sa fiche ; volet ABSENT → VI-1 (garde ouverte), sinon l'avis « pas dans votre bibliothèque » | absent, garde ouverte : panneau du titre absent (T6) ; sinon le panneau d'affiche (T6) |
  | `collection:<i>`, `similar:<i>` | la fiche | le panneau d'affiche (T6) |
  | `status:primary` | `refetch` | — |
  | `detail:back` | `goBack` | — |

  Quel panneau ouvre l'appui maintenu : la règle de T6 (`panels/cardHold`) ;
  cette colonne sert à vérifier qu'elle couvre la fiche à l'identique.
- **FI-11** Toute fiche ou personne ouverte d'ICI passe par la suite de fiches
  (`useOpenDetail` → `detailMove`, T4) : même page → `stay` ; la page juste
  dessous → `back` ; une saison ou un épisode de la série courante → `push` ;
  sinon → `replace` (une fiche ouverte depuis une fiche la REMPLACE).
- **FI-12** Raccourcis : AUCUN au SHA de référence — ni Lecture/Pause, ni
  appui maintenu sur les boutons de l'en-tête. (Le seul raccourci
  Lecture/Pause hors lecteur est celui de la feuille des saisons, T6.)

### Retour

- **FI-13** Page poussée : la portée recule (`BackScope`, T4) — aucune couche
  propre à la fiche. Une feuille ouverte (panneau, saisons, note) a sa couche
  « menu » (T6) ; refermée, le focus revient à ce qui l'avait ouverte
  (restauration de tvOS après une Modal).

Effets du focus qui ne sont pas de la navigation (restent à l'écran) : le
préchargement des épisodes au focus d'un onglet ; la qualité d'une vignette
d'épisode au focus tenu (T6).

---

## 2. La recherche (`Search`)

**Fichiers** — câblage `redesignWiring/search/` (`SearchRedesign`,
`useSystemKeyboard`, `HiddenSearchInput`, `useSearchInput`,
`useSearchResults`, `searchModels`) ; vue `redesign/screens/search/` ;
partagés avec Android TV, NON modifiés : `components/search/useSearchSubmit.ts`,
`components/search/searchBarReturn.ts` ; tv-core `search/`
(`searchSubmitAnswer`, `SEARCH_SUBMIT_WAIT_MS`, `tvSearchSections`,
`tvSearchNotice` — importés aussi par webOS).

### Entrée et colonnes

- **RE-1** Écran du rail : `useRedesignScreen({ railKey: "Search", entryKey:
  "key:A" })` — l'arrivée va sur la PREMIÈRE TOUCHE du clavier à l'écran, pas
  sur le champ.
- **RE-2** Deux colonnes, chacune un groupe qui MÉMORISE (`AutoFocusGuide`,
  liés au premier rendu) : `search:input` (le champ `search:field`, le clavier
  `key:A`…`key:0`, `key:space`, `key:delete`, `key:clear`, les suggestions
  `suggestion:<i>`) et `search:results`. Aller aux résultats mène au premier
  élément à la première visite, puis au dernier visité ; revenir rend la
  dernière touche.
- **RE-3** Résultats : une section par rangée (`section:top`,
  `section:movies`…, mode `nearest`). Clés : `top`, `<rangée>:<i>` (`movies`,
  `series`, `collections`, `episodes`, `absent`), `people:<i>`, `facets:<i>`.
  Au repos et sans résultat : `section:recent` (`recent:<i>`) et
  `section:genre` (`genre:<i>`).

### Le clavier système et la dictée

- **RE-4** `search:field` est un BOUTON : OK focalise le vrai champ, hors
  écran (`HiddenSearchInput`, jamais candidat du moteur de focus), ce qui
  monte le clavier plein écran de tvOS et sa dictée (maintenir le micro de la
  Siri Remote). Aucun micro pour l'app, jamais de bouton micro sur tvOS. Ce
  qui est tapé, dicté ou validé revient à la saisie, débattue 150 ms.
- **RE-5** « Rechercher » (validation) : `searchSubmitAnswer` (tv-core) sur
  `typed`, `debounced`, `current`, `fetching`, `failed`, `sections` →
  `results` / `none` / `pending`. Quand le clavier est PARTI (la barre a repris
  le focus, ou filet de 800 ms après sa fermeture) : `results` → le focus au
  PREMIER résultat — `top`, sinon `<1re rangée>:0` (la rangée « À demander »
  comprise quand elle est seule) ; `pending` → la réponse qui arrive dans les
  3 s (`SEARCH_SUBMIT_WAIT_MS`) y mène encore, tant qu'aucune touche n'a été
  pressée depuis ; `none` ou trop tard → le focus reste où tvOS le rend (la
  barre).
- **RE-6** Menu ferme le clavier SANS valider : le focus à la première touche
  `key:A` — sauf si une validation date de moins d'1 s (la fermeture en est
  la suite).

### Retours à la recherche

- **RE-7** Depuis une étagère (Parcourir, ouverte par un résultat personne,
  genre, studio, ou un genre du repos) : `markBrowsing` arme le retour ; à
  chaque `transitionEnd` d'arrivée (non `closing`) pendant 1,5 s, la barre
  `search:field` est réclamée — deux fois, la seconde 400 ms plus tard (tvOS
  rend d'abord sa dernière cible quand le focus est dans le rail).
- **RE-8** « Rechercher » choisi dans le rail : depuis la recherche, la barre
  (les mêmes deux réclamations, `registerSearchBar`) ; depuis Parcourir,
  recule (`returnToSearchBar`, appelé par `useRailActions`, T4).
- **RE-9** Lecteur, fiche dépilés : la dernière clé de contenu
  (`useEntryFocus`, T3).

### Gestes

- **RE-10** OK et appui maintenu, par cible :

  | Cible | OK | Appui maintenu |
  |---|---|---|
  | `key:*` | la lettre, l'espace, effacer, vider | — |
  | `suggestion:<i>`, `recent:<i>` | remplace la saisie | — |
  | `genre:<i>` (repos) | Parcourir le genre, SANS mémoriser | — |
  | `top` | personne → Parcourir ; titre → sa fiche — mémorise | — |
  | `people:<i>`, `facets:<i>` | Parcourir, mémorise | — |
  | `episodes:<i>` | LECTURE (`Player`), mémorise | panneau de la vignette (T6) |
  | `movies` / `series` / `collections:<i>` | la fiche (EMPILÉE), mémorise | panneau d'affiche (T6) |
  | `absent:<i>` | série incomplète de la bibliothèque → VI-3 ; titre absent → VI-1 — mémorise | série incomplète → le panneau de LA SÉRIE (titre de la bibliothèque) ; titre absent → panneau du titre absent (T6) |

- **RE-11** « Mémoriser » = la requête débattue (≥ 2 caractères) entre dans
  les recherches récentes, seulement à la SÉLECTION d'un résultat.

### Retour

- **RE-12** Page du rail (T4) : Retour ouvre le rail, puis Réglages, puis
  quitte. Le clavier système ouvert reçoit Menu lui-même (RE-6).

Effet du focus qui n'est pas de la navigation : la lumière du fond suit la
carte focalisée ; revenir sur `top` ou dans la saisie la rend au meilleur
résultat.

---

## 3. Parcourir (`SearchBrowse`)

**Fichiers** — `redesignWiring/browse/BrowseRedesign.tsx`,
`redesign/screens/browse/` ; la grille § 4.

- **PA-1** Page POUSSÉE qui montre le rail (`railKey: "Search"`). Entrée :
  `status:primary` (erreur) · `grid:0` (affiches) · sinon `browse:back` (la
  croix — chargement ou vide : seule action, donc jamais verrouillée).
- **PA-2** Croix : `useBackFocus(focus, { backKey: "browse:back", barKey:
  "browse:header", entryKey })` (T4) ; `browse:header` est l'en-tête de la
  page (en tête de la grille), ou, en erreur, une bande en haut.
- **PA-3** Reprise : tant qu'aucune affiche (`grid:*`) n'a eu le focus et que
  la croix l'a, l'arrivée des affiches réclame `grid:0` ; une erreur arrivée
  après un chargement réclame `status:primary`.
- **PA-4** « Rechercher » rechoisi dans le rail : recule (`returnToSearchBar`
  passe avant `onReselect: goBack`). Retour : page poussée → recule, rail
  ouvert ou non (`BackScope`).
- **PA-5** OK sur une affiche → la fiche, qui REMPLACE la page d'une personne
  (suite de fiches) et s'EMPILE sur celle d'un genre ou d'un studio.

---

## 4. Les grilles (bibliothèque, Ma liste, Favoris, Parcourir)

**Fichiers** — `redesignWiring/grid/usePosterGrid.tsx`,
`redesign/screens/library/PosterGrid.tsx`.

- **GR-1** Clés `grid:<i>` ; une SECTION par ligne (`grid:line:<n>`), six
  colonnes.
- **GR-2** Révélation : la PREMIÈRE ligne en mode `start` (la page remonte
  tout en haut, titre et filtres — y compris au bout d'une remontée maintenue
  ou d'un glisser vif), les autres `nearest`.
- **GR-3** Bords : la dernière ligne n'a rien sous elle (BAS ne fait rien) ;
  une colonne que la dernière ligne n'atteint pas descend sur sa dernière
  affiche (règle T3) ; à droite d'une ligne, rien ; à gauche, le rail (ponts,
  T4). Aucun piège déclaré.
- **GR-4** Pagination : la page suivante est demandée à TROIS écrans de la fin
  (`onEndReachedThreshold: 3`) ; deux lignes d'avance montées de chaque côté
  (`drawDistance: 1100`), pour que la règle des sections trouve toujours la
  ligne suivante ; pas de barre d'index du défilement rapide
  (`showsScrollIndex: false`).
- **GR-5** OK → la fiche (`useOpenDetail` : remplace sur la page d'une
  personne, s'empile ailleurs) ; appui maintenu → le panneau d'affiche (T6) ;
  focus → la lumière du fond (l'affiche focalisée, sinon la première).

---

## 5. La bibliothèque (`Library`)

**Fichiers** — `redesignWiring/library/` (`LibraryRedesign`,
`useLibraryFilterBar`, `useLibrarySheets`, `libraryFilterSheets`,
`libraryFilterModel`, `useLibraryPrefetch`, `gridCatalogParams`,
`useLibraryCatalogState`) ; vue `redesign/screens/library/` ; partagé avec
Android TV, NON modifié : `hooks/useLibraryFilters.ts` (filtres et leur
mémoire de session).

### Entrée

- **BI-1** `railKey: "Library_<id>"`, entrée : `status:primary` (erreur) ·
  `pill:status` (chargement) · `grid:0` (affiches) · `empty:primary` (« Tout
  effacer » des filtres trop serrés) · sinon `pill:status`.
- **BI-2** Premier chargement : la pastille de tête tient le focus ; les
  affiches arrivées, `grid:0` est réclamée — si le focus est TOUJOURS sur
  `pill:status` et que personne n'a bougé (un focus hors rail sur une autre
  clé annule).

### Groupes et voisins

- **BI-3** `filters` (la barre, pleine largeur) : guide qui mémorise
  (`AutoFocusGuide`) — HAUT depuis toute la grille y mène. Deux sections,
  révélées en mode `start` : `filters:pills` (`pill:status`,
  `pill:favorites`, `pill:sort`, `pill:genres`, `pill:years`, `pill:rating`,
  `pill:platforms`…) et `filters:active` (`active:<i>`, `active:clear`).
- **BI-4** `library:empty` : guide d'entrée → `empty:primary` (BAS depuis
  n'importe quelle pastille, même loin au-dessus).

### Gestes de la barre

- **BI-5**

  | Geste | Effet | Focus |
  |---|---|---|
  | OK sur `pill:favorites` | bascule le filtre Favoris | reste |
  | OK sur une autre pastille | ouvre sa grande liste (Modal) | BI-7 |
  | OK sur `active:<i>` (retirer) | retire ce filtre | réclame `active:<min(max(0, i), restants − 1)>` ; plus aucun filtre → `pill:<critère du filtre retiré>` (`genre:*` → `genres`, `platform:*` → `platforms`) |
  | OK sur `active:clear` ou « Tout effacer » | tous les filtres par défaut | depuis `empty:primary` → `grid:0`, sinon `pill:status` |

### Les grandes listes (dans une Modal)

- **BI-6** Toutes les clés focalisables d'une liste (`sheetFocusKeys`) :
  options (`sheet:option:<i>`), ordres (`sheet:order:<i>`), bornes
  (`sheet:from|to:prev|next`), décennies (`sheet:preset:<i>`), paliers
  (`sheet:stop:<i>`), puis `sheet:clear` (s'il y a un « Effacer ») et
  `sheet:apply`.
- **BI-7** L'entrée, figée à l'ouverture (`sheetEntryKey`) : ce qui est
  retenu — `choice` : `sheet:option:<option cochée, sinon 0>` ; `sort` :
  `sheet:option:<critère retenu, sinon 0>` ; `years` : le préréglage
  retenu, `sheet:preset:<i>` — « Toutes les années » (0) tant qu'aucun
  intervalle n'est posé, sinon la décennie —, et `sheet:from:prev` pour un
  intervalle sur mesure ; `rating` :
  `sheet:stop:<palier retenu, sinon 0>`. Seule l'entrée est focalisable à
  l'ouverture (`useChoiceEntry`, règle T6). Cocher en série ne déplace pas le
  focus.
- **BI-8** `sheet:footer` : guide d'entrée → `sheet:apply` (« Voir N
  titres ») — BAS depuis n'importe quelle colonne.
- **BI-9** « Effacer » (`sheet:clear`) disparaît sous le doigt : l'entrée est
  recalculée sur la liste effacée et reverrouillée (le premier choix).
- **BI-10** Fermer : Menu (couche « menu » ; la Modal le reçoit par
  `onRequestClose`) ou « Voir N titres » ; une fois la liste effacée
  (`onExited`), la pastille qui l'avait ouverte est réclamée
  (`pill:<critère>`).

### Le rail précharge

- **BI-11** Le focus qui TIENT 300 ms sur une entrée `nav:Library_<id>` du
  rail (tout écran du rail) précharge la première page de la grille — les
  paramètres EXACTS de l'écran, filtres retenus compris — puis les 12
  premières affiches (cache HTTP). Un focus parti avant 300 ms n'envoie rien.

### Retour

- **BI-12** Page du rail (T4) ; une liste ouverte : la ferme (BI-10).

---

## 6. Ma liste et Favoris (`Watchlist`, `Favorites`)

**Fichiers** — `redesignWiring/collection/CollectionRedesign.tsx`,
`redesign/screens/collection/CollectionView.tsx` ; la grille § 4.

- **CO-1** Entrée : `status:primary` (erreur) · `empty:primary` (vide :
  « Parcourir les bibliothèques ») · `grid:0` · sinon rien (chargement).
- **CO-2** Le vide (`empty:primary`) et l'erreur (`status:secondary`, « Retour
  à l'accueil ») mènent à l'accueil (`railNavigate("Home")` : la pile remise à
  l'accueil). Retour : page du rail (T4).

---

## 7. Les réglages (`Settings`)

**Fichiers** — `redesignWiring/settings/` (`SettingsRedesign`,
`settingsFocus.tsx` hors `useChoiceEntry`, `ChoiceModal`,
`useNavigationSettings`, `useSettingsModel`) ; vue
`redesign/screens/settings/`.

- **RG-1** Entrée : `settings:tab:<onglet>` — l'onglet de la route (`tab`, ex.
  « Réglages de la navigation » depuis le menu d'une entrée du rail), sinon
  `account`. Onglets : `account`, `playback`, `appearance`, `navigation`,
  `about`.
- **RG-2** `settings:tabs` (la colonne) : guide à DESTINATION de l'onglet
  AFFICHÉ — GAUCHE depuis le panneau revient dessus, jamais sur celui qu'on
  survolait ; il descend jusqu'au bas du panneau (GAUCHE depuis un bouton plus
  bas que le dernier onglet le rencontre encore).
- **RG-3** `settings:panel` : guide qui MÉMORISE (`AutoFocusGuide`) — DROITE
  depuis un onglet y rentre là où on l'avait laissé (le premier élément à la
  première visite ; « À propos » n'a rien de focalisable : le focus reste à
  l'onglet).
- **RG-4** `settings:lines` : une section LISTE (règle T3 : HAUT et BAS à la
  ligne voisine, au plus proche).
- **RG-5** OK sur un onglet le montre ; le focus seul ne change pas d'onglet.

### Compte : double appui (vue `AccountPanel`)

- **RG-6** « Changer de serveur » (`settings:changeServer`) et « Déjumeler cet
  appareil » (`settings:logout`) : le PREMIER OK arme (« Confirmer — … »), le
  SECOND exécute, quitter le bouton (perte du focus) désarme ; armer l'un
  désarme l'autre. État local à la vue (`initialArmed` au banc). La règle
  pure est écrite par T6 (elle sert aussi le voile hors ligne) ; T7
  l'applique ici.

### Navigation : déplacer une entrée (`useNavigationSettings`)

- **RG-7** Lignes `settings:nav:<i>` (OK = soulever / poser), pastilles
  `settings:nav:<i>:visibility` (OK = afficher / masquer),
  `settings:nav:showAll`, `settings:nav:resetOrder`.
- **RG-8** OK sur une ligne la SOULÈVE : les pastilles et les deux boutons se
  verrouillent (infocalisables) ; HAUT / BAS déplacent le focus de ligne en
  ligne et l'entrée soulevée suit (`moveRailKeyTo`, ordre en cours, rendu par
  position) ; OK sur la ligne soulevée la POSE (ordre enregistré) ; quitter
  les lignes (GAUCHE vers les onglets) la pose aussi ; démonter l'écran
  annule. Rien n'est enregistré avant la pose.
- **RG-9** Retour pendant un déplacement l'ANNULE (couche « menu ») : l'entrée
  revient à sa case et le focus avec elle (`claimAfterRestore` : une reprise
  si tvOS le rend ailleurs dans les 900 ms).
- **RG-10** « Tout afficher » et « Ordre par défaut » disparaissent sous le
  focus : `settings:nav:0` est réclamée.

### Liste de choix (`ChoiceModal`)

- **RG-11** Une Modal (`FadingModal`) : clés `settings:choice:<i>`, entrée sur
  la valeur retenue (`useChoiceEntry`, T6), Menu ferme (couche « menu » +
  `onRequestClose`), le focus retrouve la tuile qui l'avait ouverte.

### Retour

- **RG-12** Page du rail : sur Réglages, la règle du rail dit « déjà sur
  Réglages → quitte » (T4) ; un déplacement en cours, ou une liste ouverte,
  passe avant (RG-9, RG-11).

---

## 8. Le jumelage (`PairCode`)

**Fichiers** — `redesignWiring/pairing/` (`PairingRedesign`, `pairingModel`,
`loginFocus`) ; vue `redesign/screens/pairing/` ; partagés avec Android TV,
NON modifiés : `hooks/usePairingFlow.ts`, `hooks/usePairingCode.ts`.

### Entrée

- **JU-1** Entrée par étape (`entryKeyOf`), RÉCLAMÉE à chaque changement :

  | Étape | Entrée |
  |---|---|
  | accueil | `pairing:showCode` |
  | code du relais : chargement ou actif | `pairing:back` (la croix, seule action) |
  | code (relais ou serveur) en erreur | `pairing:retry` |
  | code expiré | `pairing:regenerate` |
  | code du serveur actif ou en chargement | `pairing:changeServer` |
  | serveur saisi à la main | `pairing:url` |
  | identifiants | `pairing:username` ; après un refus : `pairing:password` |
  | succès | aucune (l'accueil de l'app s'ouvre seul, `replace("Home")`) |

- **JU-2** Croix : `useBackFocus(store, { backKey: "pairing:back", barKey:
  "pairing:top", entryKey, arrival: step.kind })` (T4) — reverrouillée à
  chaque nouvelle étape.
- **JU-3** Groupes qui mémorisent (`AutoFocusGuide`) : `pairing:side` et
  `pairing:card` (GAUCHE / DROITE passent de la colonne à la carte de l'écran
  du code), `pairing:actions` (BAS depuis le mot de passe entre par « Se
  connecter », `pairing:signIn`, pas par le recours `pairing:useCode`).
- **JU-4** Refus de connexion (`useLoginErrorFocus`) : si `pairing:username`
  reprend le focus dans les 1,2 s qui suivent (tvOS rend le focus au champ
  dont le clavier se retire), `pairing:password` est réclamé UNE fois.

### Clavier (vue)

- **JU-5** OK sur un champ (`pairing:url`, `pairing:username`,
  `pairing:password`) ouvre le clavier système : `blur()` puis `focus()` du
  `TextInput` invisible (un clavier qui n'a pas paru laisse le champ
  « focalisé » pour React Native).
- **JU-6** « Se connecter » : identifiant vide → ouvre son clavier ; mot de
  passe vide → ouvre le sien ; sinon envoie. Valider un clavier n'envoie que
  si les DEUX champs sont remplis ; sinon il se ferme (BAS mène au champ
  suivant). Aucun enchaînement automatique d'un clavier à l'autre. Serveur :
  valider le clavier de l'adresse vérifie le serveur (`pairing:check` aussi).

### Retour

- **JU-7** Couche « page » (`exitOf`) : `relayCode`, `manualServer` →
  l'accueil ; `manualLogin` → le serveur ; `manualCode` → les identifiants.
  Accueil et succès : aucune couche — UIKit QUITTE l'application (règle
  tvOS). Le jumelage n'est JAMAIS une page poussée : tout chemin qui y mène
  remet la pile à `PairCode` seul (`auth/unpair.ts` : déjumelage depuis les
  réglages ou le voile hors ligne ; `AppNavigator` au démarrage).

---

## 9. Vigie hors feuilles (demander depuis la recherche, la saga, la fiche)

**Fichiers** — `redesignWiring/vigie/` SAUF `AbsentSheetRedesign`,
`SeasonsSheetRedesign`, `seasonsSheetModel` (T6) et `RequestsEntry`,
`RequestsPanel` (T4). Tout passe par la garde `useVigieGate` : fermée, aucune
de ces fonctions n'existe (la saga dit « pas disponible », la recherche n'a
pas de rangée « À demander », la fiche pas d'onglet grisé).

- **VI-1** OK sur un titre ABSENT (`useTitleRequests.open`) :
  1. une demande du COMPTE pour ce titre existe → l'avis de son état +
     « suivez sur votre téléphone » (jamais une seconde demande) ;
  2. arrivé depuis peu (`useArrivals`) → l'avis « Disponible » ;
  3. sinon l'état du titre est lu (cache 60 s) : offre `direct` → la demande
     en UN geste (avec l'origine de la TV), puis l'avis « Demande envoyée » ;
     offre `open` sur une série dont l'extension sait dire les saisons → la
     feuille des saisons (T6) ; un badge → son avis ; sinon « pas
     disponible » ; une erreur → « La demande n'a pas abouti. » ;
  4. une demande déjà en vol pour ce titre : rien (pas de double envoi).
  Le focus ne bouge pas (un avis n'est jamais focalisable).
- **VI-2** OK sur un onglet grisé de la fiche (`useSeriesGapTabs`) : saison
  demandable (et non couverte par une demande du compte) → demandée seule
  (`requestSeasons(…, [n])`), l'onglet passe « En attente » SANS que le focus
  bouge (même `Chip`) ; sinon l'avis de son état + l'invite au téléphone.
- **VI-3** OK sur une série incomplète de « À demander » (`openSearchGap`) :
  des saisons à demander → la feuille des saisons de la série (entrée sur la
  première à cocher, T6) ; plus rien mais une demande du compte → son avis.
- **VI-4** Appui maintenu sur un titre absent → son panneau (T6) ;
  « Demander » depuis ce panneau : le panneau se ferme, puis le geste d'OK
  (VI-1) part 320 ms plus tard (une Modal présentée pendant le retrait de la
  précédente ne paraît pas).

Les relectures en direct (`useLiveRefresh` : seulement à l'écran, app au
premier plan, titre qui avance) ne sont pas de la navigation.

---

## 10. La bande-annonce (`Trailer`)

**Fichiers** — `redesignWiring/trailer/` (`TrailerRedesign`,
`useIdleChrome`) ; vue `redesign/screens/trailer/TrailerView.tsx`.

- **BA-1** Une seule cible : la croix `trailer:close`, l'entrée
  (`hasTVPreferredFocus`, seule action), toujours focalisée.
- **BA-2** Le chrome s'estompe 3 s après le début de la LECTURE (rien ne
  s'estompe en chargement ni en indisponible) ; le MOINDRE évènement de la
  télécommande (appui, glisser, pan — `useRemoteEvents`, écran devant
  seulement) le rallume et relance les 3 s.
- **BA-3** Indisponible : la fiche est rendue d'elle-même au bout de 4 s
  (écran devant) ; la fin de la vidéo aussi (`onEnded`). OK sur la croix :
  `goBack`. Retour : page poussée → recule (`BackScope`).
- **BA-4** Revenue, la fiche rend le focus à `detail:trailer` (FI-2 : dernière
  clé de contenu).

---

## 11. `items/useItemsByIds`

Données seulement (les items d'une page de recommandations par lots de 50) :
aucune navigation.

---

## Délais propres aux écrans

Tous dans tv-core depuis la phase B ; l'applicateur ne fait que compter.

| Délai | Valeur | tv-core |
|---|---|---|
| Frappe débattue | 150 ms | (donnée, pas navigation : `useSearchInput`) |
| Les deux poses de la barre | 0 puis 400 ms | `search/searchShelfReturn` (`SEARCH_BAR_CLAIMS_MS`) |
| Fenêtre du retour d'une étagère | 1,5 s | `search/searchShelfReturn` (`SEARCH_SHELF_RETURN_MS`) |
| Filet « clavier parti » | 800 ms | `search/searchSubmitFlow` (`KEYBOARD_GONE_MS`) |
| Fermeture suite d'une validation | 1 s | `search/searchSubmitFlow` (`CLOSE_AFTER_SUBMIT_MS`) |
| Réponse qui emmène encore le focus | 3 s | `search/searchSubmit` (`SEARCH_SUBMIT_WAIT_MS`) |
| Préchargement d'une bibliothèque | 300 ms de focus, 12 affiches | `focus/libraryFocus` (`LIBRARY_PREFETCH_DWELL_MS`, `LIBRARY_PREFETCH_POSTERS`) |
| Refus de connexion → mot de passe | 1,2 s | `focus/pairingFocus` (`LOGIN_ERROR_RESTORE_MS`) |
| Reprise après restauration (réglages) | 900 ms | T3 (`focus/restoreClaim`) |
| Chrome de la bande-annonce | 3 s | `player/trailerChrome` (`TRAILER_IDLE_MS`) |
| Indisponible → fiche | 4 s | `player/trailerChrome` (`TRAILER_UNAVAILABLE_RETURN_MS`) |
| Panneau absent → geste d'OK | 320 ms | T6 (`panels/panelLifecycle`, `MODAL_GAP_MS`) |

---

## Où vivent les règles (phase B, faite)

Règles PURES dans tv-core, testées par vitest ; l'applicateur tvOS
(`apps/tv/src/platform/tvos/screens/<écran>`) ne fait que les poser — réclamer,
lier un guide, poser l'entrée d'une section, verrouiller, ouvrir le clavier,
compter une attente dont la durée vient de tv-core. Le câblage
(`redesignWiring/`) garde les données et la composition.

| Règles | tv-core | Applicateur tvOS |
|---|---|---|
| FI-1, FI-4 à FI-8 | `focus/detailFocus` (`detailEntryKey`, `detailEntryAfterPlayLost`, `detailSeasonEntryKey`, `detailEpisodeAnchorKey`, `detailAnchorIndex`, `DETAIL_ROWS`, `DETAIL_ROW_EDGES`) ; l'entrée « première visite » de T3 (`focus/sectionEntry`) | `screens/detail.ts` (`useDetailFocus`) |
| FI-10 | `nav/screenTargets` (`detailPlayPress`) ; OK sur une carte : `cards/cardPress` (T3) ; l'appui maintenu : `cards/cardHold` (T6) ; la suite de fiches : `nav/detailChain` (T4) | `useDetailActions` |
| RE-1 à RE-8, RE-11 | `search/searchFocus` (clés, entrée, première touche après Menu, premier résultat, meilleur résultat, recherches récentes), `search/searchSubmitFlow` (`searchSubmitStep`), `search/searchShelfReturn` (`shelfReturnStep`, `SEARCH_BAR_CLAIMS_MS`) | `screens/search.ts` (`useSearchGroups`, `useSearchKeyboard`) |
| RE-10 | `cards/cardPress`, `cards/cardHold` | `SearchRedesign` |
| PA-1 à PA-3, GR-1 à GR-4, CO-1 | `focus/gridFocus` | `screens/browse.ts` ; la vue `PosterGrid` lit `gridLineReveal`, `GRID_END_REACHED_SCREENS` |
| GR-5 | `cards/cardPress`, `cards/cardHold` | `usePosterGrid` |
| BI-1 à BI-11 | `focus/libraryFocus` (dont `filterSheetEntryKey`, `filterSheetFocusKeys`, `libraryPrefetchTarget`, `LIBRARY_PREFETCH_DWELL_MS`) ; l'entrée d'une liste en Modal : `panels/choiceEntry` (T6) | `screens/library.ts` |
| RG-1 à RG-5, RG-10, RG-11 | `focus/settingsFocus` | `screens/settings.tsx` |
| RG-6 | `panels/confirmPress` (T6) | la vue `AccountPanel` |
| RG-7 à RG-9 | `nav/arrange` (T4 : `startArrange`, `arrangeOnFocus`, `rowsArrangeReading`, `rowsSelectWhileArranging`) | `screens/settings.tsx` (`useNavSettingsFocus`) |
| JU-1, JU-4 | `focus/pairingFocus` | `screens/pairing.ts` |
| JU-6 | `session/loginForm` | la vue `LoginStep` ; l'ouverture native du clavier : `screens/pairing.ts` (`openPairingKeyboard`, fourni par `KeyboardOpenerProvider`) |
| JU-7 | `nav/screenBack` (`pairingBackAction`) | `PairingRedesign` (une couche « page », `useBackLayer`) |
| BA-1 à BA-3 | `player/trailerChrome` (dont `trailerWakes` : toute intention SAUF Retour) | `screens/trailer.ts` |
| VI-1 à VI-4 | `titles/absentActions` ; `MODAL_GAP_MS` : `panels/panelLifecycle` (T6) | `useTitleRequests`, `useSeriesGapTabs`, `openSearchGap` |

Disparus : `redesignWiring/detail/useDetailGuides.ts`,
`redesignWiring/search/useSystemKeyboard.ts`,
`redesignWiring/settings/settingsFocus.tsx`, `redesignWiring/pairing/loginFocus.ts`,
`redesignWiring/trailer/useIdleChrome.ts` — et leurs exceptions de la garde
(`eslint/tvNavigationExceptions.mjs`) : plus aucune pour T7.

Ce qui reste NATIF ou à l'adaptateur, par nature : le `TextInput` hors écran
de la recherche et sa `focus()`, le `blur()` puis `focus()` d'un champ du
jumelage, `requestTVFocus` / `claim`, les guides `TVFocusGuideView`, l'entrée
native d'une section (`tvEntry`), `isTVSelectable`, `transitionEnd`, les Modal.
`screens/trailer/TrailerWebView.ios.tsx` garde son `focusable={false}` :
exception permanente « rendu » (décision du coordinateur).

## À retirer au portage Android TV

Copies TEMPORAIRES : la règle passe dans tv-core pour Apple TV, l'ancien
chemin partagé reste tel quel tant qu'Android TV n'est pas porté.

| Ancien chemin (gardé pour Android TV) | Remplacé sur Apple TV par | Note |
|---|---|---|
| `components/search/useSearchSubmit.ts` — le déroulé de la validation écrit en ligne, presses lues par `useTVRemote` | tv-core `search/searchSubmitFlow.ts` (`searchSubmitStep`), appliqué par `platform/tvos/screens/search.ts` (presses : `move` · `select` de l'entrée unique) | même règle, à l'identique (tests) ; Android TV : rendre le crochet mince sur `searchSubmitStep` à son portage |

---

## Constats (relevés, NON corrigés — règle du lot : zéro changement)

1. **Aucun raccourci Lecture/Pause sur les cartes de la fiche** (ni ailleurs
   hors lecteur et feuille des saisons) au SHA de référence.
2. Le menu Année inatteignable des filtres (`TVYearMenu`, ancien chemin
   Android TV) : hors du chemin refondu, laissé tel quel.
3. **Le jumelage n'est jamais une page poussée** (B1, relevé par T4) : le
   commentaire de `PairingRedesign.tsx` et `docs/TV-REFONTE.md` (« recule
   d'une page quand le jumelage a été ouvert depuis les réglages ») décrivent
   un cas qui n'existe pas — Menu sur l'accueil du jumelage quitte toujours.
   Comportement gardé ; le commentaire de `PairingRedesign.tsx` est corrigé
   (phase B) ; la ligne du carnet (`docs/TV-REFONTE.md`, « Le Retour ») est
   l'écart B1 tenu par T4 (`retour-rail.md`).

4. **Menu sur le clavier système de la recherche quitte l'application**, au
   simulateur, à la référence, aux deux passages (`recherche-menu-ferme-clavier`,
   `app: background`) — RE-6 dit : le clavier se ferme, le focus va à la
   première touche. Le même Menu sur le clavier d'un champ du jumelage le
   ferme bien. Gardé tel quel (scénario en relevé) ; passage sur l'appareil
   pour départager le simulateur et l'app.

(La liste s'allonge à l'enregistrement des scénarios.)

---

## Scénarios dorés

Dans `apps/tv/harness/nav-golden/scenarios/ecrans/`, au format du banc (celui
de T6 : `do`, `expect`, `settleMs`, `why`), chacun citant les règles qu'il
couvre (`rules`) ; enregistrés sur 84f3cedd0, rejoués en `verify` après
l'extraction. La couverture : `README.md` du dossier.
