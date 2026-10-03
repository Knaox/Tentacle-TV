# Panneaux, cartes et appui maintenu (Apple TV) — relevé T6

Lot « Extraction de la navigation Apple TV », tâche T6. Relevé fait sur le SHA
de RÉFÉRENCE `84f3cedd0` (main d'origine) : tout ce qui suit décrit ce que fait
l'app AUJOURD'HUI, bizarreries comprises. L'extraction (phase B) ne change aucun
comportement ; les bizarreries sont listées à la fin (§ 6), jamais corrigées.

Le contrat commun (intentions, traduction tvOS, adaptateur) est celui de
`docs/TV-NAVIGATION.md` (T1). Ce document dit, pour les panneaux et les cartes,
QUELLE décision vivait OÙ (§ 1-3, le relevé au SHA de référence) et où elle
vit désormais (§ 4).

## 1. Le périmètre

| Fichier | Ce qu'il fait | Décide ? |
|---|---|---|
| `apps/tv/src/components/cards/actions/useTVCardActions.tsx` | Les trois ouvertures du panneau (`openPoster`, `openLandscape`, `openReco`) et le panneau à rendre DANS l'écran ; carte tenue (`useRecoCardHold`) tant qu'il est ouvert | oui (cible, aiguillage Apple TV / Android TV) |
| `apps/tv/src/components/cards/actions/cardSheetTarget.ts` | La cible de l'appui maintenu : média (affiche / vignette) ou reco | oui (variante, item Jellyfin) |
| `redesignWiring/sheet/ActionSheetRedesign.tsx` | Le cycle du panneau : attente de l'entrée, `Modal`, couche « menu » du Retour, sortie, mode `rate` | oui |
| `redesignWiring/sheet/sheetFocus.ts` | Entrée, verrous, guides des trois groupes, garde anti-clic fantôme | oui (le cœur) |
| `redesignWiring/sheet/sheetRows.ts` | L'ordre des pictos | oui (pur) |
| `redesignWiring/sheet/useSheetModel.ts`, `sheetHeader.ts` | Le modèle de la vue (en-tête, pictos, note) | modèle |
| `redesignWiring/cards/useCardActions.ts` | Ce que fait chaque picto, la note, ce qui ferme le panneau | oui (gestes) |
| `redesignWiring/settings/settingsFocus.tsx:81` `useChoiceEntry` | Le verrou d'entrée des listes en `Modal` (règle à T6, fichier à T7 : ré-export) | oui |
| `redesignWiring/focus/focusLocks.ts` | Appliquer un verrou (`isTVSelectable`) | application |
| `redesign/focus/FocusTarget.tsx:108` | Appliquer la garde anti-clic fantôme ; `delayLongPress` | application |
| `redesign/screens/sheet/*` | La vue du panneau : en-tête, note, échelle, pictos | vue (une règle d'affichage du focus : § 3.9) |
| `redesign/cards/*` | Les cartes : ossature focalisable, indication de l'appui maintenu | vue (temps de dévoilement) |
| `redesignWiring/vigie/AbsentSheetRedesign.tsx` | Le panneau d'un titre absent | oui |
| `redesignWiring/vigie/SeasonsSheetRedesign.tsx`, `seasonsSheetModel.ts`, `redesign/screens/requests/SeasonsSheet.tsx` | La feuille des saisons, ses raccourcis (règles déjà dans tv-core `titles/seasonsShortcut`) | oui |
| `redesignWiring/overlays/*`, `redesign/screens/overlays/*`, `redesign/screens/shared/StatusPanel.tsx` | Voile hors ligne (et sa confirmation à double appui), erreur d'écran, avis brefs, silhouettes | oui (voile, confirmation) |
| `redesignWiring/detail/MediaDetailRedesign.tsx:92-106` | « Noter » : la cible de la note (T7 ; la règle de cible est à T6) | oui |

Hors périmètre, cités parce qu'ils appellent ce qui précède : les écrans qui
routent l'appui maintenu (T3 accueil / Pour vous / héros, T7 fiche, recherche,
grilles), la pile du Retour (T4 : `useBackLayer`), la fenêtre « Mes demandes »
(T4, qui reprend la règle d'entrée), le menu d'une entrée du rail (T4), le
lecteur (T5 : sa garde anti-clic fantôme). Android TV (`TVCardActionSheet`) et
webOS (`CardActionSheetTv`) : intouchés.

## 2. La mécanique native (RN-tvOS 0.80, ancienne architecture)

Lu dans `apps/tv/node_modules/react-native` (0.80.1-0) — c'est ce que
l'adaptateur tvOS doit continuer d'appliquer tel quel.

- **Chaque cible focalisable** (`RCTTVView` avec `isTVSelectable`) porte son
  `RCTTVRemoteSelectHandler` : un reconnaisseur d'appui (durée 0) — début :
  `onPressIn` natif ; fin : `onPressOut` puis l'événement `select` (`keyAction`
  up) — et un reconnaisseur d'appui LONG (0,5 s) — début : il DÉSACTIVE le
  premier et émet `longSelect` (down) ; fin : `onPressOut`, `longSelect` (up),
  réactivation. Un appui produit donc toujours un seul `pressIn` et un seul
  `pressOut`, sur la vue où l'appui a COMMENCÉ.
- **L'appui maintenu des cartes est mesuré en JS** : `Pressability`
  (`tvPressEventHandlers`) arme au `pressIn` une minuterie de `delayLongPress`
  — `LONG_PRESS_THRESHOLD_MS` = **550 ms** (tv-core `input/longPress`), posé par
  `FocusTarget` — qui appelle `onLongPress` TOUCHE ENCORE ENFONCÉE ; au
  `pressOut`, `onPress` n'est pas appelé si l'appui long est parti. Le
  `longSelect` natif (0,5 s) n'ouvre rien : seuls les écouteurs de
  `TVEventHandler` (`redesignWiring/remote/remoteEvents.ts`) le voient
  (`press`, `long: true`, phases `down`/`up`).
- **Le panneau s'ouvre sous un OK encore enfoncé.** Le relâchement arrive à la
  carte (sa vue a reçu le début) ; un élément du panneau, focalisé entre-temps,
  ne doit RIEN valider sur ce relâchement : la garde anti-clic fantôme (§ 3.8)
  n'accepte un OK que s'il a COMMENCÉ sur l'élément.
- **Dans une `Modal`, aucune préférence de focus n'est honorée**
  (`hasTVPreferredFocus`, `requestTVFocus`, `claim` remontent vers une
  `rootView` nil ; les `nextFocus*` échouent aussi) : tvOS focalise l'élément
  du HAUT. D'où le verrou d'entrée (§ 3.4). `focusable: false` ne fait rien
  sur tvOS : seul `isTVSelectable` compte.
- **Retirer la `Modal` rend le focus à ce qui l'avait ouverte** (le contrôleur
  présentateur restaure son focus) : la carte, « Noter », l'aperçu des
  demandes. Aucun code ne le demande — c'est une APPLICATION native de la
  règle « le focus revient à l'origine ».
- **Une `Modal` présentée dans le même rendu que le retrait de la précédente
  ne paraît pas** : il faut un écart (`MODAL_GAP_MS` = 320 ms,
  `useTitleRequests`).
- **Opacité plancher** (`SWAP_FLOOR`) : un panneau à opacité 0 est tenu pour
  caché par tvOS, qui chercherait le focus ailleurs pendant une entrée ou une
  sortie.
- **Menu dans une `Modal`** va à `onRequestClose` (son contrôleur), pas au
  `BackScope` de l'écran.

## 3. Les comportements de référence

### 3.1 L'appui maintenu d'une carte ouvre le grand panneau

- **Le geste** : OK tenu 550 ms sur une carte qui a un `onLongPress`. Rien sur
  la carte elle-même : OK court fait l'action principale (la fiche d'une
  affiche, la lecture d'une vignette), l'appui maintenu ouvre le panneau.
- **Ce qu'il ouvre**, selon la surface (aiguillage aujourd'hui dans chaque
  écran — T3 / T7 —, cible et variante dans `useTVCardActions`) :

| Surface | Carte | Panneau |
|---|---|---|
| Accueil | Reprendre, Prochains épisodes, Déjà vu (16:9) | média, `landscape` |
| Accueil | Ma liste, Favoris, derniers ajouts, bibliothèques (affiches) | média, `poster` |
| Accueil | étagère de recommandations | `reco` |
| Accueil, héros | ses boutons (Lire / Plus d'infos / Ma liste) | média : `landscape` si le héros vient de « Reprendre », sinon `poster` |
| Pour vous | toutes les cartes | `reco` |
| Recherche | section `episodes` | média, `landscape` |
| Recherche | section `absent`, série de la bibliothèque à compléter | média, `poster` (la SÉRIE de la bibliothèque) |
| Recherche | section `absent`, titre absent | panneau d'un titre absent (§ 3.11) |
| Recherche | autres sections | média, `poster` |
| Fiche | épisode | média, `landscape` |
| Fiche | volet de saga présent | média, `poster` |
| Fiche | volet de saga absent, garde Vigie ouverte (`holdable`) | panneau d'un titre absent |
| Fiche | volet de saga absent, garde fermée | RIEN (pas d'`onLongPress`, pas d'indication) |
| Fiche | similaires, collection | média, `poster` |
| Grilles : bibliothèque, collection, Ma liste, Favoris, Parcourir | affiche | média, `poster` |

- **L'indication** « Maintenir OK : plus d'options » (`CardHoldHint`) paraît
  sous la légende de toute carte focalisée qui a un `onLongPress`, 350 ms après
  le focus (`HOLD_HINT_DWELL_MS`), sous la raison d'une reco (250 ms,
  `FOCUS_NOTE_DWELL_MS`) ; sous les boutons du héros, de même. Démontée au
  repos.
- **Monté DANS l'écran**, jamais à la racine : la `Modal` se présente depuis
  le contrôleur de l'écran, et le focus revient à la carte (§ 2).
- **Carte tenue** : tant que le panneau est ouvert, la carte visée est tenue
  (`useRecoCardHold`) — un titre jugé ne quitte « Pour vous » qu'au lâcher.

### 3.2 Le cycle du panneau

`ActionSheetRedesign` (`SheetBody`) :

1. **Ouvert** (`setTarget`) : la couche « menu » du Retour est ACTIVE tout de
   suite (`useBackLayer("menu", !closing, …)`) — un Retour parti avant que le
   panneau ne paraisse l'annule.
2. **Attente de l'entrée** : la `Modal` n'est PRÉSENTÉE (`visible`) qu'une fois
   l'entrée décidée (§ 3.3), parce que plus rien ne déplace le focus dans une
   `Modal` présentée. Filet : 1 200 ms (`ENTRY_WAIT_MS`) → le premier picto.
3. **Présenté** : verrous posés (§ 3.4), le panneau SURGIT (voile en fondu,
   panneau 0,94 → 1 sur ressort).
4. **Fermer** — Menu (`onRequestClose`), la croix, une action qui QUITTE
   (lire, la fiche, « Ne plus me proposer », « Toutes les plateformes »), OK
   sur un cran en mode `rate` : `closing` → la sortie se joue (voile et panneau),
   les cibles restent focalisables (opacité plancher) ; à la fin du voile,
   `onClosed` → `onClose` → la cible retombe → la `Modal` se retire → tvOS rend
   le focus à l'origine. Une action qui navigue pousse son écran PENDANT la
   sortie.
5. **Mode `rate`** (« Noter ») : pas de pictos (`withActions: false` : la
   lecture ne se résout pas), l'échelle seule ; OK sur un cran note et ferme.
6. **Reco** : les réglages reco (`useRecoSettings`) disent si un filtre de
   plateformes est actif ; ils ne retardent pas l'entrée.

### 3.3 L'entrée

`sheetEntryOf(rating, actions)` (`sheetFocus.ts:50`), décidée UNE fois puis
figée (`useRef`) — noter ne déplace pas le focus :

- note en cours de résolution (`rating.pending` : la fiche complète, la liste
  des notes, la série d'un épisode) → `null`, on attend ;
- une note possible → le cran de la note posée, sinon **5** (`RATING_ENTRY` :
  jamais un bout de l'échelle, qu'un OK réflexe validerait) —
  `sheet:scale:<n>` ;
- pas de note possible → le premier picto (`sheet:action:<kind>`) ; aucun
  picto → la croix (`sheet:close`) ;
- le filet écoulé sans décision → le premier picto (ou la croix).

« Note possible » (`useCardActions`) : la cible de note est connue, en
résolution, OU la fiche complète est encore en route (« pas encore su » n'est
pas « non notable »). `pending` = cible inconnue OU liste des notes pas là.

### 3.4 Les cibles infocalisables jusqu'au premier focus

`useChoiceEntry(focus, keys, entryKey)` — commun au panneau, à la feuille des
saisons, aux listes de choix des réglages et aux listes de filtres (T7) :

- à chaque nouvelle entrée (comparée pendant le RENDU, avant que la liste ne
  se rende) : déverrouille l'ancien lot, verrouille toutes les clés SAUF
  l'entrée (`isTVSelectable: false` par la liaison de la clé ET par
  `setNativeProps` sur un nœud déjà monté) ;
- entrée `null` : rien de verrouillé ;
- libération : au premier focus POSÉ sur l'entrée (abonnement au magasin), ou
  au filet de 800 ms (`RELEASE_AFTER_MS`) — une seule fois ; tout est
  déverrouillé et un compteur `releases` s'incrémente (le panneau redessine
  ses cibles : nouvelle identité de `bind`) ;
- une nouvelle entrée, liste ouverte (l'élément focalisé a disparu) :
  verrouille de nouveau — tvOS, qui cherche un focus, n'en trouve qu'un.

Panneau : clés = 10 crans + retrait + pictos + croix.

### 3.5 Les guides des trois groupes

Trois groupes PLEINE LARGEUR (rien n'est aligné d'une rangée à l'autre : croix
dans le coin, cran visé au centre, pictos centrés ; le moteur de tvOS ne vise
que ce qui CHEVAUCHE). Chacun est un guide d'entrée (`createEntryGuide`), lié
avant son premier rendu, qui vise de nouveau après chaque rendu :

| Groupe | Cible du guide | Mémoire |
|---|---|---|
| `sheet:header` | la croix — SEULEMENT une fois le verrou levé (avant : aucune destination, le guide se déclare non focalisable) | non |
| `sheet:scale` | le cran RETENU : la note posée (la note courante, relue au geste), sinon 5 — jamais le cran sur le chemin | non |
| `sheet:actions` | le dernier picto visité (encore monté), sinon le premier | oui |

### 3.6 Se déplacer dans le panneau

Géométrie native + guides (rien n'est intercepté en JS) :

| Depuis | Geste | Va sur |
|---|---|---|
| un cran | GAUCHE / DROITE | le cran voisin (la règle se recentre sur lui) ; DROITE bute sur « Retirer la note » (s'il est paru), sinon sur 10 ; GAUCHE bute sur 1 |
| un cran ou le retrait | HAUT | la croix |
| la croix | BAS | le cran retenu (avec échelle), sinon le picto retenu |
| un cran | BAS | le picto retenu (dernier visité, sinon le premier) |
| un picto | HAUT | le cran retenu ; sans échelle, la croix |
| un picto | GAUCHE / DROITE | le picto voisin ; butée aux bouts |
| la croix | HAUT, GAUCHE, DROITE | rien (piège de la `Modal`) |
| un picto | BAS | rien |

### 3.7 OK dans le panneau

| Sur | Effet | Le panneau |
|---|---|---|
| un cran (`actions`) | pose la note (1 à 10, demi-étoiles) | reste ouvert, focus inchangé, le point rose suit, « Retirer la note » paraît |
| un cran (`rate`) | pose la note | se ferme |
| « Retirer la note », note posée | retire la note | reste ouvert ; le cran reste à sa place (éteint) |
| « Retirer la note », plus de note | rien | reste ouvert |
| un cran pendant `pending` | rien (crans désactivés) | — |
| Ma liste, favori, vu | bascule (libellé et glyphe basculent sous les yeux) | reste ouvert |
| Lire | résout la lecture (l'épisode d'une série au geste) ; rien à lire → la fiche | se ferme, puis lecteur / fiche |
| Plus d'infos | la fiche (une fiche ouverte depuis une fiche la REMPLACE) | se ferme |
| Ne plus me proposer (reco) | refus envoyé | se ferme |
| Toutes les plateformes (reco) | filtre vidé | se ferme |
| Demander, garder hors ligne (carte) | rien sur un téléviseur | — |
| la croix | — | se ferme |

### 3.8 La garde anti-clic fantôme

- **Règle** : un OK ne compte sur un élément gardé que s'il a COMMENCÉ dessus
  (`onPressIn` vu depuis son dernier focus) ; le flou efface l'appui commencé ;
  chaque OK accepté le consomme.
- **Appliquée** par `FocusTarget` (`phantomPressGuard` de la liaison).
- **Clés gardées** : `sheet:scale:*`, `sheet:action:*`, `sheet:close`
  (`GUARDED`, `sheetFocus.ts:47`) — aussi le panneau d'un titre absent, qui
  reprend `useSheetFocus`. Ailleurs (hors T6) : la croix de « Mes demandes »,
  les actions du menu d'une entrée du rail, les boutons du lecteur.
- **Pas gardés** : la feuille des saisons (elle s'ouvre sur un OK RELÂCHÉ),
  les listes de choix et de filtres.

### 3.9 L'échelle : ce qu'elle montre du focus

- **Visée** (`RatingPanel`) : le cran focalisé (`onAim(cran, true)`) ; au flou,
  la visée tombe seulement si c'était elle (`now === next ? null : now`).
- **Centre** : la visée, sinon la note posée, sinon 5 ; le retrait visé → son
  index (après le 10). La règle glisse (`translateX`, 220 ms) pour poser ce
  centre au milieu de la fenêtre ; les crans pâlissent avec la distance
  (1 ; 0,72 ; 0,5 ; 0,34 ; 0,2 ; au-delà, 0).
- **Retrait** : paraît dès qu'une note existe et RESTE (une note retirée depuis
  l'ouverture ne fait pas disparaître le cran qui a le focus).
- **Grande valeur** : « … » en attente ; « — » au retrait visé ou sans note ;
  sinon la visée, ou la note posée.
- **Ligne** : vide en attente ; « Retirer votre note » au retrait visé ;
  « Noter N sur 10 » pour une visée différente de la note ; « Votre note
  actuelle » ; « Pas encore noté ».

### 3.10 « Noter » de la fiche

- Le bouton `detail:rate` n'existe que si le titre se note (`actions.rating`).
- OK l'ouvre : `ActionSheetRedesign` en mode `rate`, monté dans la fiche (hors
  du panneau des cartes) ; cible = l'item de la fiche, variante `landscape`
  pour un ÉPISODE (sa note propre), `poster` sinon (la note de la série, d'un
  film, d'une collection).
- Entrée, guides, garde : ceux du panneau (§ 3.3-3.8) — sans pictos, BAS ne
  mène nulle part depuis l'échelle.
- OK sur un cran note et ferme ; Menu et la croix ferment ; le focus revient à
  « Noter ».

### 3.11 Le panneau d'un titre absent (Vigie)

`AbsentSheetRedesign` (garde Vigie ouverte) : la vue du grand panneau, sans
note. En-tête : affiche, titre, année · état (demande du compte : son affiche
arrive en direct). Pictos : « Demander » quand l'extension l'offre et que le
compte ne l'a pas déjà fait ; sinon aucun.

- Présenté une fois l'état du titre SU, ou au filet de 900 ms ; entrée = le
  premier picto (Demander), sinon la croix ; verrous, guides et garde de
  `useSheetFocus` (sans échelle).
- Couche « menu » du Retour active TOUJOURS (même pendant sa sortie).
- « Demander » : referme (sortie jouée), PUIS — après `onClose` — le geste
  d'OK sur le titre, 320 ms plus tard (`MODAL_GAP_MS`) : demande directe, ou
  la feuille des saisons d'une série.

### 3.12 La feuille des saisons (Vigie)

`SeasonsSheetRedesign` dans une `FadingModal` :

- **Présentée** une fois les saisons SUES — et, pour une série de la
  bibliothèque, ses saisons présentes —, ou à l'échec, ou au filet de 1 500 ms.
- **Entrée** (figée) : la saison choisie (`focus`, l'onglet grisé de la fiche,
  cochée d'avance) si elle se demande, sinon la première à cocher, sinon la
  pilule du pied (`sheet:apply`).
- **Clés** : `sheet:season:all` (dès deux saisons à demander), les saisons à
  cocher `sheet:season:<n>`, `sheet:apply` — verrouillées sauf l'entrée
  (`useChoiceEntry`). Les saisons déjà demandées ou dans la bibliothèque ne
  prennent pas le focus.
- **BAS depuis n'importe quelle ligne** → le pied (`sheet:footer`, guide
  d'entrée vers `sheet:apply`).
- **OK** : coche / décoche ; sur « Toutes », coche tout ou décoche tout ; sur
  la pilule : « Demander N saisons » (ce qui est coché) ou « Fermer ».
- **Lecture/Pause** (appui SIMPLE, jamais l'appui maintenu), feuille présentée
  et pas en sortie : demande `shortcutSeasons` (tv-core) — tout depuis
  « Toutes », sinon ce qui est coché, sinon la saison focalisée ; rien sur une
  saison qui ne se demande pas ou sur la pilule sans rien de coché.
- **Une demande** à la fois ; elle referme la feuille, et la réponse (« Demande
  envoyée », ou pourquoi pas) est dite à la fin de la sortie.
- **Menu** : ferme (sortie en un fondu) ; pas encore présentée → ferme tout de
  suite. Couche « menu » active hors sortie.

### 3.13 Les confirmations à double appui

Voile hors ligne : « Déjumeler cet appareil » (`offline:unpair`). Même règle
dans le compte des réglages (T7, `AccountPanel`) :

- premier OK : ARME (libellé « Confirmer le déjumelage », une ligne dit ce
  qui va se passer) ;
- second OK, toujours dessus : exécute (et désarme) ;
- quitter le bouton (flou) : désarme.

### 3.14 Les surimpressions

- **Voile hors ligne** (`OfflineRedesign`, monté hors des écrans) : le focus
  entre sur « Réessayer » (`offline:retry`) ; le groupe `offline:panel` est un
  PIÈGE (quatre directions) ; si un écran d'en dessous réclame le focus, il
  est ramené (après 50 ms) sur la dernière clé du voile qui l'a tenu. Menu
  n'est JAMAIS intercepté : l'application quitte (règle d'App Review).
- **Erreur d'écran** (`ScreenErrorRedesign`) : entrée sur « Réessayer »
  (`screenError:retry`), jamais sur la croix ; HAUT mène à la croix
  (`screenError:back`, `useBackFocus` — T4), BAS en revient ; sans pile, pas
  de croix ; à la racine de l'app, Réessayer seul.
- **Avis brefs** (`showNotice`), bandeau du jumelage expiré, messages de
  l'administrateur : jamais focalisables.
- **`StatusPanel`** : chargement / erreur / vide ; `status:primary`,
  `status:secondary` ; l'entrée sur `status:primary` est décidée par l'écran.

## 4. Ce qui est dans tv-core, ce qui reste à l'adaptateur

### Le rangement

- **`cards/`** (domaine existant, T6) — l'appui maintenu, le grand panneau,
  son échelle et la garde anti-clic fantôme.
- **`titles/`** (domaine existant) — la feuille des saisons de Vigie, à côté
  de son raccourci (`seasonsShortcut`).
- **`panels/`** (dossier NEUF) — ce qui ne relève d'aucun domaine seul : le
  verrou d'entrée d'une `Modal` sert au grand panneau (`cards/`), à la
  feuille des saisons (`titles/`) ET aux listes de choix et de filtres des
  écrans (T7) ; le cycle et le Retour d'un panneau en `Modal` valent pour les
  trois panneaux ; la confirmation à double appui sert au voile hors ligne et
  aux réglages ; le focus des surimpressions (voile, erreur d'écran) n'est ni
  une carte ni une navigation.
- **`platform/tvos/panels/`** — les applicateurs : `useChoiceEntry`
  (`isTVSelectable` avant le rendu, libération au premier focus ou au filet),
  `useSheetFocus` (les `TVFocusGuideView` des trois groupes, la garde posée
  sur les clés que désigne tv-core).

### L'API (figée)

Tout s'importe de `@tentacle-tv/tv-core`.

**L'appui maintenu d'une carte** — `cards/cardHold.ts`, à appliquer par T3
(accueil, héros, « Pour vous ») et T7 (fiche, recherche, grilles) :

```ts
type HoldPanel =
  | { kind: "media"; variant: "poster" | "landscape" }
  | { kind: "reco" }
  | { kind: "absent" };

type HomeRowKind = "resume" | "nextUp" | "watched" | "watchlist" | "favorites" | "library" | "reco";
type DetailCardKind = "episode" | "sagaPresent" | "sagaAbsent" | "similar" | "collection";
type SearchCardKind = "episode" | "title" | "librarySeries" | "absentTitle";

type HoldSource =
  | { surface: "homeRow"; row: HomeRowKind }
  | { surface: "hero"; fromResume: boolean }
  | { surface: "forYou" }
  | { surface: "search"; card: SearchCardKind }
  | { surface: "detail"; card: DetailCardKind; requestable?: boolean }
  | { surface: "grid" };

function holdPanelOf(source: HoldSource): HoldPanel | null;   // null : pas d'appui maintenu
function rateTargetVariant(itemType: string): "poster" | "landscape"; // « Noter » de la fiche
type SheetMode = "actions" | "rate";
function sheetShowsActions(mode: SheetMode): boolean;
function ratingClosesSheet(mode: SheetMode): boolean;
```

Branchement attendu dans un écran : `holdPanelOf(...)` choisit l'ouverture de
`useTVCardActions` — `media` → `openPoster(item)` / `openLandscape(item)`,
`reco` → `openReco(reco)`, `absent` → `requests.hold(title)`, `null` → pas
d'`onLongPress` (donc pas d'indication « Maintenir OK »). `useTVCardActions`
(partagé avec Android TV) ne change pas.

**Le grand panneau** — `cards/sheetKeys.ts`, `cards/sheetEntry.ts`,
`cards/sheetActions.ts`, `cards/ratingRuler.ts`, `cards/pressGuard.ts` :

| Export | Ce qu'il décide |
|---|---|
| `RATING_SCORES`, `RATING_ENTRY`, `SHEET_CLOSE_KEY`, `SHEET_HEADER_GROUP`, `SHEET_SCALE_GROUP`, `SHEET_ACTIONS_GROUP`, `scaleFocusKey`, `SCALE_FOCUS_KEYS`, `sheetActionKey`, `isScaleKey`, `isActionKey`, `scaleAimOf` | les clés et les valeurs de l'échelle |
| `isSheetGuardedKey(key)` | les cibles sous la garde anti-clic fantôme |
| `sheetRatingOf(facts)` | la note du panneau : posée, en attente, ou rien à noter |
| `sheetEntryOf`, `sheetEntryNow(rating, actions, waited)`, `firstPictoOf`, `SHEET_ENTRY_WAIT_MS` | l'entrée et son filet |
| `absentSheetEntry(actions, known, waited)`, `ABSENT_SHEET_ENTRY_WAIT_MS` | l'entrée du panneau d'un titre absent |
| `sheetLockKeys(actions)` | les cibles verrouillées jusqu'au premier focus |
| `sheetHeaderTarget(entered)`, `sheetScaleTarget(rating)`, `sheetActionsTarget(actions)`, `SHEET_GUIDE_MEMORY` | la cible et la mémoire de chaque guide |
| `sheetActionEntries(input)`, `SheetActionKind` | l'ordre des pictos et leurs libellés (clés i18n) |
| `rulerAimAfter`, `rulerCenterIndex`, `RULER_REMOVE_INDEX`, `rulerRemovable`, `rulerReading`, `rulerStep` | la visée, le centre, le retrait, ce que dit le panneau, GAUCHE / DROITE |
| `createPressGuard()` | la garde d'un élément (`pressIn`, `blur`, `press(guarded)`) |

**Les panneaux en `Modal`** — `panels/` :

| Export | Ce qu'il décide |
|---|---|
| `createChoiceEntry()`, `CHOICE_ENTRY_RELEASE_MS` | le verrou d'entrée (`enter`, `focused`, `timedOut`) |
| `panelBackLayers(panel, closing)` (`BackLayerSpec<"close">[]`), `panelPresented(entry)`, `closesAtOnce(panel, presented)`, `MODAL_GAP_MS` | le cycle et le Retour d'un panneau |
| `confirmPress(armed, action)`, `confirmBlur(armed, action)` | la confirmation à double appui (T7 l'applique dans `AccountPanel`) |
| `OFFLINE_VEIL`, `OFFLINE_VEIL_KEYS`, `OFFLINE_VEIL_FOCUS`, `SCREEN_ERROR_FOCUS` | le focus du voile hors ligne et de l'erreur d'un écran |

**La feuille des saisons** — `titles/seasonsSheet.ts` : `SEASONS_ALL_KEY`,
`seasonFocusKey`, `SEASONS_APPLY_KEY`, `SEASONS_FOOTER_GROUP`,
`SEASONS_SHEET_ENTRY_WAIT_MS`, `seasonsSheetKeys`, `seasonsSheetEntry`,
`seasonsSheetReady`, `seasonsSheetFocusOf`, `isSeasonsFooterKey`,
`toggleSeason`, `checkedSeasons`, `canSubmitSeasons`, et
`seasonsSheetIntent(intent, …)` — la décision du contexte « panel » de
l'entrée unique, qui PREND Lecture/Pause (l'appui simple seulement).

### Ce que l'adaptateur tvOS garde

- la `Modal` (Menu par `withMenuIntent`, puis la fermeture ; la restauration
  native du focus à l'origine) ;
- `useChoiceEntry`, `useSheetFocus` (`platform/tvos/panels/`) ;
- `FocusTarget` : le `Pressable` (`delayLongPress` = `LONG_PRESS_THRESHOLD_MS`
  de `input/longPress`, T1) et la machine de garde par `usePressGuard` ;
- les minuteries des filets (les durées viennent de tv-core) ;
- les effets des pictos (`useCardActions` : lire, basculer, la fiche, le
  refus, le filtre) — des appels à l'api-client, pas des décisions de
  navigation.

### À retirer au portage Android TV

Aucune copie temporaire : `useTVCardActions.tsx` et `cardSheetTarget.ts`
(partagés avec Android TV) ne sont pas touchés ; `TVCardActionSheet` et
`CardActionSheetTv` (webOS) gardent leur logique. Au portage, Android TV lira
les mêmes règles (`cards/`, `panels/`) et n'écrira que son applicateur.

## 5. Les preuves : banc de traces et scénarios de référence

**Le banc de traces** (`apps/tv/harness/panels-trace/`, React sans DOM, sans
simulateur) monte les vrais modules de 84f3cedd0 et de l'arbre courant sur les
mêmes doublures et compare neuf unités : le verrou d'entrée, le focus du grand
panneau (garde, verrous, cible des trois guides), la garde anti-clic fantôme,
les pictos (96 combinaisons), l'échelle, le double appui du voile, les actions
d'une carte, le cycle du grand panneau dans la portée du Retour, et la feuille
des saisons (présentation, verrous, cocher, Lecture/Pause, Menu, filet).
`node apps/tv/harness/panels-trace/bench.mjs verify` : identiques. Il a
trouvé un écart de forme (les pictos du salon portaient `detail: null`),
corrigé. Contre-épreuve faite (README du banc).

**Les scénarios du simulateur** (`apps/tv/harness/nav-golden/scenarios/panneaux-cartes/`,
format du banc T2, enregistrés sur 84f3cedd0, rejoués en `verify`) :

| Fichier | Scénarios |
|---|---|
| `scenarios.json` | pc-01 à pc-15 : l'appui maintenu sur une affiche (Films), la vignette de Reprendre, une reco, un épisode, le héros, une cellule de grille ; l'entrée à 5, sur la note posée (jeu `film-note-7`), sur le premier picto (jeu `film-non-notable`) ; les guides, les butées, la croix, Menu ; une bascule et une note qui laissent le panneau ouvert ; « Plus d'infos » ; « Noter » de la fiche (Retour, OK qui note et ferme) ; l'appui court |
| `voile.json` | pc-16 : le voile hors ligne — entrée, piège, double appui armé puis désarmé (jamais confirmé) |
| `fixtures.mjs` | `film-note-7`, `film-non-notable` (« The Uprising », premier des derniers ajouts de Films) |

Enregistrés sur 84f3cedd0 en deux passages stables, puis `verify` sur l'arbre
courant : 16 identiques (7 min 53 s). Sur l'Apple TV « Chambre » (AppleTV14,1,
tvOS 26.6, app de test `com.tentacle.mobile.navtest`, faux backend par l'IP
du Mac, `verify --device`) : 14 identiques aux références du simulateur
(6 min 46 s) — l'appui maintenu RÉEL, la garde anti-clic fantôme (aucune
écriture au relâchement), Menu et le focus rendu à la carte compris. pc-07 et
pc-11 n'y ont pas été joués : ils valident une note, et la règle des essais
sur l'appareil est de n'en valider aucune. L'app de l'utilisateur
(`com.tentacle.mobile`) est restée intacte, vérifiée avant et après.

**De 21 scénarios provisoires à 16.** La première liste (phase A, avant le
format du banc) en comptait 21. Seize se jouent ; cinq sont tombés, tous
du côté de Vigie, faute de données dans le jeu figé du banc :

| Provisoire | Ce qu'il éprouvait | Pourquoi il est tombé | Ce qui le couvre |
|---|---|---|---|
| pc-15 | volet absent d'une saga, Vigie ouverte : panneau d'un titre absent | aucune saga à volet ABSENT dans l'instantané (les sagas y sont complètes ou vides) | `absentSheetEntry` (tests tv-core) et l'applicateur commun `useSheetFocus` (banc de traces, `sheetFocus`) |
| pc-16 | volet absent, Vigie fermée : pas d'appui maintenu | même raison | `holdPanelOf` (`sagaAbsent` sans `requestable` → rien, tests tv-core) |
| pc-17 | panneau d'un titre absent : « Demander » referme puis demande | la rangée « À demander » de la recherche exige une saisie au clavier système et des résultats Vigie que le faux backend ne rend pas de façon stable | `absentSheetEntry`, `MODAL_GAP_MS` (tests tv-core) ; aucune trace du panneau absent lui-même — reste à éprouver si le banc gagne un jeu de titres absents |
| pc-18 | feuille des saisons : entrée, OK coche, « Toutes », BAS vers le pied, Retour | même raison (série absente de la recherche) | banc de traces, unité `seasons` (présentation, verrous, cocher, « Toutes », Menu, fermeture avant présentation, filet) |
| pc-19 | feuille des saisons : Lecture/Pause demande | même raison | banc de traces, unité `seasons` (Lecture/Pause par l'entrée unique, maintien ignoré) |

Les autres ont été gardés, renumérotés : l'ancien pc-20 (voile) est pc-16,
l'ancien pc-21 (appui court) est pc-15 ; pc-09 (reco) ne vérifie plus
« Toutes les plateformes », que le faux backend ne déclenche pas (constat 7)
— l'ordre des pictos sous un filtre l'est au banc de traces (`sheetRows`). Le panneau d'un titre absent et la
feuille des saisons (Vigie) ne sont éprouvés qu'au banc de traces : le jeu de
données du banc ne porte ni saga à volet absent ni recherche « À demander »
stable.

## 6. Constats (relevés, NON corrigés)

1. **Retour pendant l'attente de l'entrée** (`ActionSheetRedesign`) : la
   fermeture ne part qu'à la décision de l'entrée (note sue, ou filet de
   1,2 s) — la `Modal` est alors PRÉSENTÉE, invisible (panneau jamais montré,
   opacité plancher), puis retirée au rendu suivant. La feuille des saisons,
   elle, ferme tout de suite dans ce cas. Confirmé par le banc de traces
   (`actionSheet`, « Menu par la portée pendant l'attente » : Modal présentée
   en sortie, puis `onClose`).
2. **« Lire » qui disparaît sous le focus** (lu dans le code, à éprouver) :
   le bouton d'une SÉRIE est là pendant la résolution de son épisode
   (`useCardSheetPlay`) et disparaît si elle se révèle terminée. L'entrée étant
   figée, rien ne reverrouille : si le focus était sur « Lire » (série sans
   note possible), tvOS choisit seul la cible suivante dans la `Modal`.
3. **Filet écoulé pendant `pending`** (lu dans le code, à éprouver) :
   l'entrée tombe sur le premier picto, les crans restent désactivés
   (`disabled` pendant `pending`) ; le guide de l'échelle vise alors le cran 5,
   infocalisable, tant que la note n'est pas sue.
4. **Panneau d'un titre absent : couche « menu » active même pendant sa
   sortie** (`useBackLayer("menu", true, …)`), quand le grand panneau la
   coupe (`!closing`) ; un Retour pendant la sortie relance une fermeture déjà
   en cours (sans effet visible).
5. **« Noter » sur un titre que rien ne note** n'existe pas (bouton absent),
   mais le mode `rate` sans note possible ouvrirait un panneau avec la croix
   seule (entrée sur la croix).
6. **Un appui maintenu peut être pris pour un appui court quand le fil JS est
   chargé** (vu au banc, référence 84f3cedd0, machine à ~60 de charge) : le
   seuil de 550 ms est une minuterie JS de `Pressability`, et le relâchement
   natif (1,2 s plus tard) l'a devancée — sur un épisode de la fiche, la
   lecture s'est lancée au lieu du panneau. Le `longSelect` natif (0,5 s),
   lui, ne se trompe pas. Le scénario pc-12 maintient 2 s pour rester
   déterministe.
7. **Faux backend du banc** : `GET /api/preferences/reco` rend
   `{ providers: [] }`, que l'app lit comme `data.providerFilter` — une
   `TypeError` dans la console à chaque lecture des réglages reco (sans
   effet sur les scénarios : « Toutes les plateformes » n'y paraît pas).
