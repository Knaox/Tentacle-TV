# Refonte de l'UI TV — carnet de chantier

Branche `refonte/tv-ui`. Toute l'interface de `apps/tv` (Apple TV d'abord),
façon Netflix sur Apple TV, construite comme des VUES dans
`apps/tv/src/redesign/` — des props en entrée, des callbacks en sortie — et
montée dans le banc UI (`apps/tv/harness/ui-bench`) sans compte, sans
navigation de l'app, sans lecteur. L'app actuelle ne les importe pas encore.

## Où en est-on

| Étape | État |
|---|---|
| 1. Référence | La maquette « Accueil streaming Apple TV » (fournie le 2026-09-30), le CSS du bureau, et **pas de violet**. |
| 2. Inventaire des écrans et composants | Ci-dessous. |
| 3. Banc UI | Prêt. Instantané RÉEL du compte Knaoxtest : 1 433 éléments, 2 324 images (catalogues, genres, saisons, sagas, reco…). |
| 4. Jetons TV repris du bureau | `TV_STAGE`, `TV_TYPE`, `TV_ACCENT` (`packages/theme/src/tokens/tvStage.ts`). |
| 5. Briques | Faites — planche « Briques » (`bench:ui planche briques --focus`). |
| 6. Écrans | **Tous faits** (2026-09-30) : jumelage, accueil, fiche, bibliothèque, Ma liste / Favoris, recherche, parcourir, Pour vous, réglages, lecteur, feuille d'actions, bande-annonce, surimpressions — 184 scènes au banc. |
| 7. Branchement | En cours, écran par écran. Le socle est posé (`apps/tv/src/redesignWiring/`, ci-dessous) : aiguillage, magasin de focus, cadre des écrans avec navigation, modèles de carte et de héros, Inter dans l'app tvOS. Branchés sur Apple TV : jumelage (conditions d'utilisation retirées), réglages, surimpressions (démarrage, hors ligne, jumelage expiré, messages, erreur et chargement d'un écran), fiche, bande-annonce, feuille d'actions, lecteur, accueil, navigation et « Pour vous ». |

## La direction retenue

- **La maquette** : navigation de verre flottante à gauche (repliée : les
  pictogrammes ; ouverte : les libellés, sur un fond dense, sous un voile),
  carte héros arrondie dont la LUMIÈRE déborde (halo à la marque, nuancée
  par l'image), grandes vignettes 16:9, textes très grands. Le contenu du
  héros est calé en BAS, à 72 du bord comme de la gauche : calé en haut, sa
  hauteur variable poussait les boutons contre le bord.
- **Le bureau** : fonds noirs (#000 → #070710), textes blancs translucides,
  pilule primaire blanche texte noir, verre neutre, élévation en deux
  calques, Inter.
- **La marque, violet → rose, en touches** (retours des 2026-09-30 et
  2026-10-01, qui remplacent le « sans violet » du départ) :
  - toute action de lecture ÉCRITE (héros, fiche, « Lire maintenant »,
    ligne de la feuille) et « Demander » prennent le dégradé du bureau
    (`BrandGradient`, `TV_ACCENT.gradient`) ; la pilule s'ALLUME au focus
    (`BrandPill` : liseré, reflet, lueur serrée), sans lueur au repos — même
    gabarit que « Plus d'infos », et jamais de voile blanc (il la rendait
    pastel et le texte tombait sous 3:1) ; le rond « Lire » du plateau reste
    discret, comme au bureau ;
  - les barres de progression portent le dégradé sur le LU : le rose arrive
    à la tête de lecture, comme au bureau (`--progress-fill`) ;
  - étoiles, échelle de note, pastilles et surtitres : le rose ;
  - le HALO est la seule lumière qui porte la marque (`brandLight` : teintes
    bornées dans l'arc violet → rose, l'œuvre ne fait que les nuancer) — et
    discret : 0,28 sur le héros, 0,3 est un plafond (« plus discret,
    vraiment ») ;
  - le FOND VIVANT garde la lumière de l'œuvre, ses violets ramenés au neutre
    (« le violet moche en fond, c'est très dommage… c'était très beau
    avant »). Jamais un fond violet.
- **Focus Apple TV, sans contour** : agrandissement, soulèvement, reflet ; le
  verre focalisé devient blanc, texte noir ; les voisines reculent.
- **La carte qui se redresse** (`MorphCard`) : 16:9 au repos, affiche 2:3 au
  focus, en fondu, sans recalcul de mise en page. L'affiche DESCEND (sur la
  légende, qui s'efface) : elle ne monte jamais sur le titre de la rangée.
- **Le survol des cartes, gardé** (demandé le 2026-09-30) : au focus, une
  carte montre le plateau du bureau, posé sur elle (`cards/tray/`) — voile,
  la note perso AFFICHÉE (demi-étoiles comprises), capsule du modèle partagé
  (`cardTrayEntries` ; `externalCardActionEntries` hors bibliothèque,
  « Demander » au dégradé de la marque), bulle de ce que fera OK ; l'épingle
  Ma liste · j'aime · vu reste visible. Centré sur une affiche (et sur
  l'affiche de la carte qui se redresse), dans le coin bas-droit d'une
  vignette 16:9 ; rien au centre. Télécommande (posée par le câblage, port du
  focus) : BAS entre par l'action primaire, GAUCHE/DROITE parcourent, HAUT
  remonte à la carte, Menu revient à la carte ; OK sur la carte et l'appui
  long (la feuille) ne changent pas. Au banc : « Briques · Plateau ».
- **Noter : une échelle VERTICALE** (demandé le 2026-09-30, remplace les cinq
  étoiles entières) : « Noter », dans la feuille comme sur la fiche, ouvre
  `RatingScale` — HAUT / BAS aux valeurs du bureau (½ à 5 étoiles, 1 à 10), la
  valeur visée en grand, « Retirer la note » au bout, OK valide, Menu revient ;
  entrée sur la note posée, sinon 6 (jamais un bout, qu'un OK réflexe
  validerait). Le plateau n'en montre que la valeur. Au banc : « Feuille ·
  Échelle… », « Fiche · « Noter » ».
- **Maintenir OK, dit la carte** : une carte horizontale (OK y lit :
  Reprendre, Prochains épisodes, épisodes de la fiche…) qui s'ouvre par
  l'appui long le dit à son focus, sous sa légende — « Maintenir OK : plus
  d'options » (`CardHoldHint`), 350 ms après le focus, jamais quand le focus
  est dans le plateau.
- **Un logo noir cède au texte** : `isLogoLegibleOnDark(blurHash)` — un logo
  dont l'empreinte est noire de part en part ne se lit pas sur la scène ; le
  câblage écrit alors le titre (le banc le fait déjà).

## Le socle du branchement (`apps/tv/src/redesignWiring/`)

- **Aiguillage** (`redesignGate.ts`) : `REDESIGN_ACTIVE` vaut vrai sur tvOS,
  faux sur Android TV. L'écran le lit à son niveau : `REDESIGN_ACTIVE ?
  <XRedesign /> : <LegacyXScreen />`, l'ancien corps restant dans son fichier.
  `REDESIGN_ROUTES` liste les routes qui rendent leur propre navigation : le
  rail actuel (`TVNavChrome`) s'y efface.
- **Focus** (`focus/focusStore.ts`) : un magasin par écran, branché sur le
  port (`FocusBindingProvider bind={store.binder}`). Il donne `node`,
  `handle`, `bind`, `claim` (bascule tvOS, nœud relu à chaque étape),
  `focusedKey`, `lastFocusedKey`, et deux abonnements : `subscribe` pour le
  focus, `subscribeNodes` pour les nœuds.
- **Écran avec navigation** (`screen/`) : `useRedesignScreen({ railKey,
  entryKey, onBack?, onReselect? })` fournit la `nav` de la vue et son
  magasin. `<RedesignScreen screen>` pose le port, Menu (du contenu vers la
  navigation, puis recul, et UIKit quitte à la racine) et les deux ponts
  tvOS entre navigation et contenu : le moteur de focus ne vise qu'une cible
  alignée. `useEntryFocus` sert seul aux écrans sans navigation : il pose
  l'entrée (`hasTVPreferredFocus` dès le premier rendu, lâchée au premier
  focus de contenu) et le retour sur la dernière clé de contenu.
- **Cartes et héros** (`cards/`, `hero/`) : `useCardModels` / `useCardLists`
  (modèles STABLES, marqueurs résolus au niveau de la liste),
  `paletteOfItem`, `heroModelOf`, `metaOf`, `legibleLogoOf`.

## Voir le résultat, sans navigateur

- **Dans Simulator.app** : fenêtre « Banc UI TV (Claude) ». Le catalogue liste
  toutes les scènes par écran ; flèches, Entrée, Échap (Menu). Lecture/Pause
  fige le focus sur l'élément suivant d'une scène.
- **En planches** : `pnpm --filter @tentacle-tv/tv bench:ui planche <écran>
  [--focus] [--lang=fr,en] [--glass=on,off]` → PNG dans
  `apps/tv/harness/ui-bench/out/`, lisibles dans le panneau de fichiers.
- Démarrer : `bench:ui up` (Metro 8094 + relais 8093, à laisser tourner), puis
  `bench:ui sim`. Détails : `apps/tv/harness/ui-bench/README.md`.

## Règles de la refonte (rappel)

- Une vue n'importe ni `@tentacle-tv/api-client`, ni `@react-navigation/*`, ni
  le lecteur, ni le stockage, ni aucune logique de focus (guides,
  `nextFocus*`, `hasTVPreferredFocus`, Retour, restauration) — **le lint le
  refuse** (`eslint.config.js`, bloc « refonte de l'UI TV »), comme tout import
  relatif qui sort de `redesign/`.
- L'état visuel du focus passe par `useFocusVisual(focusKey)`
  (`redesign/focus/focusPreview.tsx`) : focus natif dans l'app, figé au banc.
- Le focus de l'INTÉGRATION passe par un seul port,
  `redesign/focus/focusBinding.tsx` : `FocusBindingProvider` répond, clé par
  clé, par une ref, des props natives (`hasTVPreferredFocus`, `nextFocus*`…),
  la garde anti-clic fantôme et l'observation du focus. Un besoin nouveau
  s'y ajoute ; jamais de variante par écran.
- Un GROUPE d'éléments (habillage du lecteur, panneau, rangée) se nomme par
  `FocusGroup focusKey` (`redesign/focus/FocusGroup.tsx`) : une View simple
  tant que personne ne lie la clé ; l'intégration peut lui donner un
  `container` STABLE (guide de focus : mémoire, piège, destinations).
- Le Liquid Glass passe par `LiquidGlassProvider` / `useLiquidGlassEnabled`
  (`redesign/glass/liquidGlassMode.tsx`), clé `tentacle_liquid_glass`,
  activé par défaut. Le verre lui-même ne se dessine qu'à un endroit,
  `GlassSurface` : natif sur tvOS 26, simulé ailleurs (ci-dessous).

## Le verre natif (tvOS 26)

`GlassSurface` monte en couche de fond la vue native `TentacleGlassView`
(`ios/TentacleTV/TentacleGlassView.m`) : un `UIVisualEffectView` porteur d'un
`UIGlassEffect`, sous les enfants, sans rien changer à son contrat. Trois
rendus, décidés par `useGlassRendering()` :

| Rendu | Quand | Ce qu'on voit |
|---|---|---|
| `native` | Liquid Glass activé, tvOS 26 | Le verre du système : flou, réfraction, liseré spéculaire. `regular` → style régulier, `strong` → régulier assombri (teinte noire 0,3), `clear` → style clair. |
| `simulated` | Liquid Glass activé, tvOS 17–18 | Le voile blanc, le reflet et le liseré dessinés — le repli. |
| `enriched` | Liquid Glass coupé | Le verre enrichi du bureau. |

- **Disponibilité** : la constante `supported` de la vue (tvOS 26 et la classe
  présente), lue une fois par `redesign/glass/nativeGlass.ts`. Android TV et un
  binaire plus ancien n'ont pas la vue : simulation, sans bruit. Les classes
  tvOS 26 sont liées en faible (`nm -m` : `weak external`) — un tvOS 17–18
  charge l'app sans elles.
- **Au banc** : `glass on` (natif), `glass sim` (le repli, montré sur tvOS 26),
  `glass off` ; `planche … --glass=on,sim,off`. La scène `banc/focus` dit quel
  verre est rendu. Groupes « Verre » (à l'œil) et « Mesure » (au compteur).
- **Dans l'app** (simulateur tvOS 26.2) : la vue est enregistrée
  (`getViewManagerConfig` → `supported: true`) ; le jumelage et les réglages
  refondus rendent leur verre en natif. L'interrupteur de Réglages ›
  Apparence (`liquidGlassStore`, clé `tentacle_liquid_glass`) le fait passer
  natif ↔ enrichi à chaud, et le choix survit à la relance.

### Mesuré (`bench:ui gpu`, simulateur tvOS 26.2)

Temps GPU des services de rendu du simulateur, en ms par seconde ; deux tours
de 8 à 10 s par cas, en alternance.

| Cas | Sans verre | Natif | Simulé | Enrichi |
|---|---|---|---|---|
| Écran fixe (`verre/image`) | — | 0 | 0 | — |
| Image qui glisse sous six verres (`mesure/verre`) | 51 | 208 | 85 | 83 |
| Les mêmes, sous une opacité 0 (`mesure/cache`) | 51 | 60 | 45 | 57 |
| Accueil, focus qui parcourt « Reprendre » | — | 47,6 | 41,5 | 41,3 |
| Lecteur, focus sur les boutons du transport | — | 11,5 | 9,4 | 9,1 |

Ce qu'on en tire :
- **À l'arrêt, rien** : le verre natif ne s'anime pas seul.
- **Masqué, rien** : sous une opacité 0, Core Animation l'écarte (dans le
  bruit). Contrairement au `backdrop-filter` du web, un fondu à 0 suffit — les
  pilules et la navigation, qui fondent leur verre au focus, n'ont rien à
  démonter.
- **Un fondu passe** : sous un parent à 0,75 ou 0,5, le verre garde son flou
  et se mélange au fond (`verre/fondu`) — l'avertissement d'UIKit sur
  l'opacité ne se vérifie pas ici.
- **Il se paie quand ce qu'il couvre BOUGE** : +15 à +22 % sur les parcours
  réels, deux fois et demie la simulation au pire cas. Le cas à surveiller :
  l'habillage du lecteur sur une vidéo qui DÉFILE (le banc n'a qu'une image
  fixe) — à mesurer sur l'Apple TV lors du branchement du lecteur.
- **Le rendu** : plus sombre que la simulation sur fond sombre, liseré qui
  prend la couleur de l'œuvre. Lisible partout (planches comparatives). Les
  feuilles posées sur un fond fumé presque opaque (filtres, actions) y
  paraissent presque noires : ce fond date d'avant le flou natif.

## Branchement — fiche, bande-annonce, feuille (Apple TV)

Branche `refonte/tv-fiche`. Le câblage vit dans `redesignWiring/detail/`,
`redesignWiring/trailer/`, `redesignWiring/sheet/` ; Android TV garde ses
écrans (`LegacyMediaDetailScreen`, `LegacyTrailerScreen`, `TVCardActionSheet`).

- **Guides d'entrée** (`redesignWiring/focus/entryGuide.tsx`) : le conteneur
  d'un `FocusGroup` qui renvoie le focus ARRIVANT d'ailleurs vers le dernier
  élément visité du groupe, sinon vers son entrée. Sans eux, mesuré au banc
  par XCUITest : BAS depuis « Reprendre » visait l'onglet SOUS le bouton
  (« Saison 8 ») au lieu de la saison affichée, puis l'épisode sous l'onglet
  au lieu de celui à reprendre ; HAUT depuis la droite de l'écran ne
  rejoignait jamais l'en-tête (rien au-dessus ne chevauche — d'où le groupe
  `detail:header`, le premier écran en pleine largeur). `destinations` doit
  TOUJOURS être un tableau : sans lui tvOS rend le contenu du guide
  inatteignable.
- **Feuille** : dans une `Modal` (Menu par `onRequestClose`), entrée sur la
  première action, garde anti-clic fantôme sur ses actions et sa croix (elle
  s'ouvre sous un OK encore enfoncé). « Noter » y ouvre l'échelle à la place
  de la liste, entrée sur la note posée sinon 6 par le verrou de
  `useChoiceEntry` ; OK note et revient sur « Noter » (même verrou), Menu y
  revient sans rien changer. « Noter » sur la fiche ouvre la même feuille
  réduite à son échelle : OK note et ferme, Menu ferme.
- **Bande-annonce** : le lecteur est monté dès le chargement (la vue ne le
  montait qu'en lecture : il ne pouvait pas charger), et le chrome suit
  `chromeDimmed` seul — « Fermer », seul focalisable, garde le focus : le
  câblage rallume au moindre geste.

---

## Inventaire — les écrans

Chaque écran listé ici aura ses scènes au banc, un état par scène. « À créer »
= l'app actuelle n'a pas cet état ; la refonte le dessine, son branchement
sera une tâche.

### 0. Conditions d'utilisation — SUPPRIMÉ

`DisclaimerScreen` : aucune vue. Son choix de langue FR/EN passe sur le
jumelage. Retiré du flux d'Apple TV (`AppNavigator`) ; Android TV le garde,
avec sa clé `disclaimer_accepted`.

### 1. Jumelage (`PairCode`)

Automate en 5 étapes, toutes gardées :
- **Accueil** : logo, titre, sous-titre, « Afficher le code de jumelage »,
  « Configurer manuellement », **choix de langue FR/EN** (repris de l'écran
  supprimé).
- **Code relais** : chargement · erreur (Réessayer, Configurer manuellement) ·
  code actif (6 cases, instructions, « expire dans m:ss » + barre) · code
  expiré (Générer un nouveau code) · Annuler.
- **Serveur manuel** : champ URL (clavier système), vérification en cours,
  5 erreurs (URL invalide, délai, API absente, HTTP n, injoignable), Retour,
  indice télécommande.
- **Code serveur** : mêmes états que le relais + « Changer de serveur ».
- **Succès** : pastille animée, « Bienvenue, {nom} », ouverture de l'accueil.

### 2. Accueil (`Home`)

- **Héros plein cadre** : 1 à 5 titres (reprise, sinon mis en avant),
  rotation ; logo sinon titre ; « S01E02 · Nom » pour un épisode ; année ·
  note · durée · genres ; puces qualité/langues ; barre de reprise ; accroche
  sinon synopsis ; Lecture/Reprendre, Plus d'infos ; indicateurs.
- **Rangées**, dans l'ordre de la mise en page du compte : Reprendre ·
  Prochains épisodes · Déjà vu (vignettes 16:9, OK = lecture) · Ma liste ·
  Favoris · Derniers ajouts par bibliothèque (lots « +N épisodes ») ·
  rangées reco (`reco:forYou`, `inLibrary`, `anime`, `trending`…), dont la
  première porte la pastille du filtre de plateformes.
- **États** : chargement · erreur de connexion (Réessayer, Rejumeler) ·
  partiel (sans héros, rangées vides absentes) · **vide (à créer)** · fond
  ambiant teinté par l'œuvre focalisée.

### 3. Fiche média (`MediaDetail`)

- **Variantes** : film · série (saisons, bouton résolu Reprendre SxEy /
  Lecture SxEy, masqué si terminée) · épisode (image 16:9, puce « Série —
  S1E2 › ») · collection (pas de Lecture, « Contenu de la collection »).
- **En haut** : fond plein cadre, logo (sinon titre), métadonnées, puces,
  genres, synopsis ; boutons Lecture/Reprendre **avec progression**,
  bande-annonce, Ma liste, favori, vu, **note (à créer sur la fiche : elle
  n'existe aujourd'hui que dans la feuille)**.
- **Rappel bandes-annonces** : UNE phrase non focalisable, sous condition.
- **En descendant** : saisons et épisodes · extras (du titre, de la série, par
  saison ; vidéo retirée grisée « Indisponible ») · distribution et équipe ·
  saga (« 8 films · 6 dans la bibliothèque · 2 vus », « Volet N · Cette
  fiche ») · titres similaires.
- **États à créer** : chargement, erreur (aujourd'hui : page noire vide).

### 4. Saisons et épisodes (fiche et panneau du lecteur)

- Onglets de saisons : active · en cours (point) · vue (coche) · nombre
  d'épisodes ; jusqu'à 12+ saisons.
- Grandes vignettes d'épisode : numéro, titre, durée, date, résumé,
  progression, vu, puces qualité ; badge Reprendre / À suivre / Épisode
  actuel / En cours de visionnage.
- États : chargement (lignes fantômes), saison de 60 épisodes, épisode sans
  image, reprise à 90 %.

### 5. Bibliothèque (`Library`) — filtres façon Netflix

- En-tête : bannière de la bibliothèque (image au hasard), nom.
- **Filtres gardés** : statut (Tous / Non vus / En cours) · Favoris · Tri
  (Derniers ajouts, Titre A→Z, Année, Meilleures notes + ordre) · Genres
  (multiple) · Années (de–à) · Note minimum (0–10, pas 0,5) · Plateformes
  (11 familles) · compteur de résultats.
- **Refonte** : pastilles en haut, chacune ouvre une grande liste en
  surimpression ; filtres actifs visibles, retirés d'un geste ; « Tout
  effacer ».
- États : chargement · pagination · vide · vide filtré · liste ouverte ·
  **erreur (à créer : affichée comme vide aujourd'hui)**.

### 6. Recherche (`Search`) et Parcourir (`SearchBrowse`)

- **Recherche** : champ en haut, clavier en grille à gauche (A–Z, 0–9,
  espace, effacer, vider), suggestions, résultats à droite ; dictée SYSTÈME
  tvOS seulement (micro interdit ; touche micro Android gardée).
- États : repos (recherches récentes, genres) · saisie · chargement ·
  résultats (meilleur résultat titre ou personne, films, séries, collections,
  personnes, épisodes, genres et studios) · correction / partiel /
  indexation · réponse périmée · aucun résultat.
- **Parcourir** (personne, genre, studio) : en-tête (portrait, libellé, nom,
  « N titres », tri) + grille ; chargement, erreur, vide.

### 7. Pour vous (`Recommendations`)

- Héros « Notre meilleure suggestion · raison » ; ligne d'état (désactivé,
  démarrage à froid, en préparation, vide) ; étagères (Pour vous, Parce que
  vous avez aimé X, Avec Y, Tendances, Animés…) ; pastille du filtre de
  plateformes ; badge « Découverte » ; raison au focus.
- États : chargement · **erreur (à créer : page vide aujourd'hui)**.

### 8. Ma liste et Favoris

- Titre, grille complète ; chargement ; vide (icône, titre, indice,
  « Parcourir les bibliothèques ») ; **erreur (à créer)**.

### 9. Réglages

- Onglets : **Compte** (portrait, nom, serveur, « Changer de serveur » et
  « Déconnexion » à double appui, texte d'oubli) · **Lecture** (mode du
  lecteur : Par défaut / Me proposer / Faire tout seul (+ Personnalisé) ;
  Android : décodage tunnelisé, fréquence ; langue de l'interface ;
  préférences par bibliothèque : audio, mode et langue des sous-titres,
  réinitialiser → liste de choix) · **À propos** (logo, version, serveur,
  compte, appareil, description, fonctionnalités, licence).
- **Nouveau** : l'interrupteur Liquid Glass (même sens que bureau et mobile).

### 10. Bande-annonce (`Trailer`)

Lecture, chargement (nom), indisponible, bouton Fermer (s'estompe après
3 s, revient au focus).

### 11. Lecteur — l'habillage seulement

Sur de faux états au banc, moteur jamais chargé :
- écran de chargement (résolution avec étape PrismCore, échec + Réessayer,
  démarrage + Retour) ;
- OSD : haut (Retour, titre, SxEy · nom), barre (temps, tampon, lu,
  pastille, durée), transport (précédent, −10 s, lecture/pause, +30 s,
  défilement, suivant, épisodes, réglages) ; pause ; mise en mémoire tampon ;
- défilement plein écran (vignette, temps visé, écart, vitesse ×2/×4/×8,
  « OK · Lire ici », « Retour · Annuler ») ; badge de saut ±N s ;
- pilule de saut (intro, résumé, aperçu, post-générique, fin : manuelle, auto
  avec décompte + Masquer, en sourdine) et « Épisode suivant » ;
- carte « À suivre » du générique (décompte, lecture auto) et affiche de fin
  plein écran ;
- panneau des épisodes ; réglages (pistes audio, sous-titres, qualité :
  Original — 4K, paliers, puces DV/HDR/Atmos/Mb/s, Auto) ;
- rechargement doux (image figée), badge « qualité réduite », bandeau
  d'erreur, sous-titres en calque ; passages connus (intro, résumé, générique)
  qui COUPENT la frise, comme des chapitres.

**Branché sur Apple TV** (`redesignWiring/player/`, branche
`refonte/tv-lecteur`). `PlayerScreen` garde UNE orchestration et aiguille son
seul rendu : `LegacyPlayerStage` (Android TV, inchangé) ou
`PlayerRedesignStage` — même moteur (`TVPlayerEngine`), même fond, et
`PlayerChromeView` par-dessus. Le focus passe par le port : la mémoire
partagée de l'habillage (`useOverlayFocus`), la pilule (`useSkipPillFocus`),
les guides de l'habillage actuel posés sur les groupes des vues
(`player:osd`, `player:timeline`, `player:skip-island`, `upnext:actions`,
`end:actions`, `tracks:panel`, `episodes:panel|header|seasons`). Choix
propres à tvOS : le panneau des pistes s'ouvre DANS l'habillage (plus de
route modale ; Menu le referme par `usePreventRemove`) ; les pastilles de la
source ne se montrent qu'en lecture directe ; la liste des épisodes est
virtualisée.

### 12. Feuille d'actions (appui long)

Variantes affiche / vignette / reco. En-tête (image, titre, sous-titre,
fermer) ; actions dans l'ordre du modèle partagé : Lire/Reprendre (+ SxEy ou
position), Noter (la note posée en complément), Ma liste, favori, vu, Plus
d'infos (toute carte de la bibliothèque, affiche comprise), Ne plus me
proposer, Toutes les plateformes ; « Noter » ouvre l'échelle verticale de la
note (½ à 5 étoiles, retrait au bout) ; « Demander » de Vigie pour un titre
hors bibliothèque (voir questions).

## Inventaire — ce qui s'affiche par-dessus

- **Hors ligne** : plein écran bloquant (pieuvre qui pleure, titre, message,
  Réessayer, Se déconnecter).
- **Jumelage expiré** : bandeau non focalisable, en haut, au rose de la
  marque.
- **Messages de session** (administrateur) : 2 au plus, en haut à droite,
  barre qui se vide.
- **Erreur d'écran** (ErrorBoundary) : aujourd'hui en anglais en dur → clés
  i18n nouvelles.
- **Démarrage** (spinner) et **chargement d'un écran** (squelette).
- **Liste de choix** des réglages (modale).

## Inventaire — les briques communes

Carte (affiche 2:3, vignette 16:9, carte horizontale → verticale au focus,
reco, personne, extra, lot « +N », volet de saga) · plateau du focus (note
affichée, capsule, bulle) · « Maintenir OK » des cartes horizontales · échelle
de la note · marqueurs (note globale,
note perso, pastille Ma liste · favori · vu, progression, « Découverte »,
puces qualité/langues — pastilles, pas de drapeaux) · bouton (primaire,
secondaire, rond, pilule) · pastille · rangée (titre ≥ 34 + accessoire) ·
héros (halo à la marque) · fond vivant (lumière de l'œuvre, violets ramenés au neutre) · navigation à
gauche (repliée : icônes ; ouverte : libellés sous voile ; toutes les entrées :
Rechercher, Accueil, Pour vous, Ma liste, Favoris, chaque bibliothèque, Tout
afficher, Réglages ; masquage par appui long) · logo en haut à droite ·
onglets · feuille · panneau · clavier · squelettes · états vides et d'erreur ·
`GlassSurface`.

## Données — ce qui existe, ce qui manque

Présent : tout ce que listent les écrans ci-dessus (champs Jellyfin via le
proxy, notes `/api/ratings`, reco `/api/reco/page`, sagas, recherche, mise en
page de l'accueil). Images : Primary, Thumb, Backdrop, Logo (pas de Banner).

Manquant ou non transmis aujourd'hui (le branchement le demandera) :
- la note sur la fiche (la donnée existe, `useCardRatingTarget`, jamais montée) ;
- les titres hors bibliothèque sur TV (reco, recherche) : filtrés — d'où
  aucun « Demander » ;
- ~~lecteur : durée des décomptes, réglage « lecture auto », segments de la
  barre~~ — réglés au branchement : `countdownTotals` mesure les anneaux, la
  suite n'annonce d'échéance que si la lecture auto la lancera, et les
  segments du serveur coupent la frise.

## Constats hors UI — tâches proposées

- Android : « Adapter la fréquence d'affichage » n'est pas relu au démarrage.
- Réglages, « Oublier ce jumelage » : le texte (`pairing:tvOublierTexte`) dit
  que l'application se fermera ; sur la TV, elle rouvre le jumelage.
- Filtre de plateformes de la TV : le catalogue est chargé sans studios ni
  identifiants TMDB, le filtre ne peut rien trouver.

Bandes noires : au simulateur, la vue racine couvre bien 1920×1080 (captures
du banc bord à bord), l'écran de lancement existe et aucune marge de zone sûre
n'est lue. Les bandes viennent de la mise en page actuelle (fond #000,
marges du cadre et de la bannière) ; la refonte va bord à bord. Reste à
confirmer sur l'Apple TV (tâche d'appareil, de jour).

## Pièges payés au branchement

- **Une vue plein écran posée SUR le contenu bloque le focus tvOS**, même
  transparente, même en `pointerEvents="box-none"` : le moteur n'entre plus
  dans ce qui est dessous (hors listes défilantes). `NavRail` en posait une
  (sa couche et son voile) : la couche se réduit à la barre, le voile n'existe
  que barre ouverte. À ne pas refaire dans une vue.
- **Aucune préférence de focus ne traverse une `Modal`** :
  `hasTVPreferredFocus`, `requestTVFocus` et les réclamations visent la racine
  React (`RCTTVView.rootView`), introuvable depuis le contrôleur d'une modale
  — tvOS y focalise l'élément du haut. Pour entrer ailleurs, ne laisser
  focalisable QUE la cible à l'ouverture (`isTVSelectable: false` sur les
  autres, par le port), puis tout libérer au premier focus
  (`redesignWiring/settings/settingsFocus.tsx`, `useChoiceEntry`).
- Sur tvOS, c'est `isTVSelectable` qui rend une vue focalisable
  (`RCTTVView.canBecomeFocused`), pas `focusable`.
- **Un focalisable RECOUVERT par ce qui dessine n'est plus proposé** par la
  recherche géométrique de tvOS : la cible des cartes posée SOUS leur image
  opaque, et plus une carte n'était atteignable. La cible se pose au-dessus,
  sans rendu, et s'arrête au-dessus du plateau ouvert (`trayReach`).
- **Le Metro du banc, lancé depuis un worktree de `.claude/`, n'a pas vu les
  modifications** (2026-09-30, pas de watchman sur ce Mac) : ni `launch` ni
  un nouveau bundle ne les prenaient. Relancer `bench:ui up`, puis `launch` ;
  `list` montre le catalogue réellement servi.
- Menu depuis le contenu d'un écran POUSSÉ (les réglages) dépile l'écran : le
  geste natif de la pile passe avant l'intercepteur de `RedesignScreen`, qui
  n'ouvre la navigation qu'à la racine.

## Recette de A à Z — ce que l'utilisateur veut éprouver (2026-09-30)

Au simulateur Apple TV, dans l'app réelle, une fois tous les branchements
fusionnés :

- naviguer de carte en carte partout : rangées, grilles, affiches qui se
  redressent, BAS / HAUT entre rangées ;
- sur chaque carte, un appui MAINTENU ouvre la feuille, comme le survol du
  bureau : noter (échelle VERTICALE parcourue HAUT / BAS, aux valeurs du
  bureau), voir les infos, Ma liste, j'aime, vu ;
- au focus, le plateau de la carte montre aussi l'ÉPINGLE des états (Ma liste
  · j'aime · vu) ;
- les cartes horizontales (Reprendre, Prochains épisodes…) disent qu'un appui
  maintenu permet de les gérer ;
- la navigation se DÉPLIE au focus et montre ses libellés ;
- la marque se voit sans crier : boutons de lecture, barres de progression et
  étoiles au violet → rose, halos doux aux couleurs de la marque.

## Questions ouvertes

1. Le focus sans contour (agrandissement, reflet, verre qui blanchit) : le
   garder partout, ou un anneau discret là où l'agrandissement ne se voit pas
   (pastilles de filtre, étoiles) ?
2. « Demander » de Vigie sur TV : montrer les titres hors bibliothèque
   (reco, recherche) avec leur « Demander », ou garder la TV sur la
   bibliothèque seule ? Le plateau sait déjà le rendre (scène « Plateau —
   hors bibliothèque ») ; c'est le câblage qui filtre.
3. Libellé du bouton de lecture : « Lire » (cartes, feuille) ou « Lecture »
   (fiche, héros) — un seul partout ?
4. Le plateau entré par BAS : changer de rangée coûte alors deux BAS (carte →
   plateau → rangée suivante). À éprouver à la télécommande, au simulateur ;
   si c'est trop, une autre entrée se choisit au câblage, la vue ne bouge pas.
