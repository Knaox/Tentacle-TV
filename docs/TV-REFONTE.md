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
| 7. Branchement | En cours, écran par écran. Le socle est posé (`apps/tv/src/redesignWiring/`, ci-dessous) : aiguillage, magasin de focus, cadre des écrans avec navigation, modèles de carte et de héros, Inter dans l'app tvOS. Branchés sur Apple TV : jumelage (conditions d'utilisation retirées), réglages, surimpressions (démarrage, hors ligne, jumelage expiré, messages, erreur et chargement d'un écran), fiche, bande-annonce, feuille d'actions, lecteur, accueil, navigation, « Pour vous », bibliothèques, Ma liste, Favoris, Parcourir et recherche. |
| 8. Mouvement (Apple TV) | Fait (2026-10-01) : jetons `TV_MOTION`, module `redesign/motion/`, mesuré au banc — « Le mouvement (Apple TV) » ci-dessous. |
| 9. Pavé tactile (Apple TV) | Fait (2026-10-01) : parallaxe au pouce, héros qui tourne seul et à la main — « Le pavé tactile (Apple TV) » ci-dessous. |
| 10. La croix Retour (Apple TV) | Faite (2026-10-01) : un seul bouton Retour, une croix, en haut à gauche de ce qu'elle referme, jamais en entrée d'une fiche — « La croix Retour (Apple TV) » ci-dessous. |
| 11. Jumelage par identifiants (Apple TV) | Fait (2026-10-01) : après le serveur saisi à la main, l'identifiant et le mot de passe — le chemin des relecteurs d'App Store Connect ; Menu recule d'une étape — « Le jumelage par identifiants (Apple TV) » ci-dessous. |
| 12. Le Retour (Apple TV) | Fait (2026-10-02) : une pile de couches, menu > surimpression > page > rail > sortie ; plus aucun écran qui paraît quand un menu se ferme ; le rail se referme sur la page choisie — « Le Retour (Apple TV) » ci-dessous. |
| 13. Rail compact (Apple TV) | Fait (2026-10-02) : le bloc des pages épouse ses entrées et se centre, le profil reste ancré en bas avec la place de l'élément des demandes, largeur ouverte sur l'intitulé le plus long — « Le rail compact (Apple TV) » ci-dessous. |
| 14. Demandes en cours (Apple TV) | Faites (2026-10-02) : l'aperçu des demandes Vigie dans le bloc du profil, la fenêtre en lecture seule, le camembert — rien sans Vigie à jour et un compte qui a le droit de demander — « Les demandes en cours (Apple TV) » ci-dessous. |
| 15. Lumière des fonds et marque (Apple TV) | Fait (2026-10-02) : un fond d'encre éclairé par l'œuvre focalisée, la carte focalisée dans sa propre lumière, la marque du coin calée et éclairée (retirée depuis : n° 22) — « La lumière des fonds et la marque (Apple TV) » ci-dessous. |
| 16. Les rangées (Apple TV) | Fait (2026-10-02) : HAUT / BAS vers la section voisine, l'élément au centre le plus proche — partout ; la page qui suit le focus en UN mouvement — « Les rangées (Apple TV) » ci-dessous. |
| 17. Le logo de l'app (Apple TV) | Fait (2026-10-02) : l'icône en quatre couches (fond, lumière, poulpe, bras avant), le Top Shelf dans le même monde, le lancement = la première image de l'app, plus de noir au démarrage — « Le logo de l'app : icône, Top Shelf, lancement (Apple TV) » ci-dessous. |
| 18. Saisons manquantes (Apple TV, bureau, mobile) | Fait (2026-10-02) : une série de la bibliothèque à qui il manque des saisons les offre depuis la recherche — en tête de « À demander » et en onglets grisés sur sa fiche (Apple TV), « Demander » au plateau et dans la barre (bureau), dans la feuille d'appui long (mobile) — « Les saisons manquantes » ci-dessous. |
| 19. Bibliothèques rapides (Apple TV) | Fait (2026-10-02) : champs minimaux, pages de 60 demandées tôt, lignes recyclées, cartes allégées, préchargement depuis la navigation — ouverture ~0,5 s, 3 fois plus de lignes en flèche maintenue, RAM −54 % — « Les bibliothèques rapides (Apple TV) » ci-dessous. |
| 20. Les demandes en direct (Apple TV) | Fait (2026-10-02) : l'affiche d'une demande, grise, qui reprend sa couleur au prorata de l'avancement, le camembert au centre — partout où une demande se montre ; la fraîcheur de Vigie (10 s, une seconde à l'écran), seulement à l'écran — « Les demandes en direct (Apple TV) » ci-dessous. |
| 21. Retour sans clignotement, suite de fiches (Apple TV) | Fait (2026-10-02) : tout menu fermé par Retour s'efface d'un seul fondu (panneaux du lecteur, menus en Modal), le rail reste déplié sous une Modal ouverte depuis lui ; une fiche ouverte depuis une autre fiche la remplace, un seul Retour ramène avant la première — « Le Retour (Apple TV) » ci-dessous. |
| 22. Le logo dans l'app (Apple TV) | Fait (2026-10-03) : AUCUN logo dans l'interface, au choix de l'utilisateur entre trois propositions — le coin et son halo retirés de tous les écrans ; la marque vit dans l'icône, le Top Shelf, le démarrage et les illustrations — « Le logo dans l'app : aucun (Apple TV) » ci-dessous. |
| 23. Saut de 30 s, validation en 5 s (Apple TV, Android TV) | Fait (2026-10-03) : → +30 s, ← −10 s, les boutons de l'habillage font pareil ; une seule règle pour toutes les entrées — la cible posée, « Lecture dans 5 s », OK lit, Retour annule, rien en pause ; plus d'abandon à 7 s — « Saut de 30 s et validation en 5 s » ci-dessous. |
| 24. Badges de qualité au focus (Apple TV) | Fait (2026-10-03) : « 4K · VISION · ATMOS » dans l'image, en bas à droite, sur la rangée de la note, quand le focus a tenu 300 ms ; la qualité lue au focus, un titre à la fois (jamais les flux dans les grilles) ; la fiche dit la même chose — « Les badges de qualité au focus (Apple TV) » ci-dessous. |

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
  - toute action de lecture (héros, fiche, « Lire maintenant », picto du
    grand panneau) et « Demander » prennent le dégradé du bureau
    (`BrandGradient`, `TV_ACCENT.gradient`) ; la pilule s'ALLUME au focus
    (`BrandPill` : liseré, reflet, lueur serrée), sans lueur au repos — même
    gabarit que « Plus d'infos », et jamais de voile blanc (il la rendait
    pastel et le texte tombait sous 3:1) ;
  - la note perso et la pastille « +N » portent le dégradé aussi, comme au
    bureau (`CardRatingBadge`, `PosterTile`) ;
  - les barres de progression portent le dégradé sur le LU : le rose arrive
    à la tête de lecture, comme au bureau (`--progress-fill`) ;
  - étoiles, échelle de note, épingle et surtitres : le rose ;
  - le HALO est la seule lumière qui porte la marque (`brandLight` : teintes
    bornées dans l'arc violet → rose, l'œuvre ne fait que les nuancer) — et
    discret : 0,28 sur le héros, 0,3 est un plafond (« plus discret,
    vraiment ») ;
  - le FOND VIVANT garde la lumière de l'œuvre, ses violets ramenés au neutre
    (« le violet moche en fond, c'est très dommage… c'était très beau
    avant »). Jamais un fond violet — mais jamais un grand noir non plus
    (2026-10-02) : une encre à peine teintée, éclairée par l'œuvre, et la
    carte focalisée dans sa propre lumière ;
  - AUCUN logo dans l'interface (2026-10-02, choix de l'utilisateur après un
    coin « mal intégré », au halo « moche ») : la marque vit dans l'icône, le
    Top Shelf, le démarrage et les illustrations.
- **Focus Apple TV, sans contour** : agrandissement, soulèvement, reflet ; le
  verre focalisé devient blanc, texte noir ; les voisines reculent.
- **Des affiches, sauf les rangées d'épisodes** (retours des 2026-10-01 et
  2026-10-02, « comme sur le bureau ») : « Reprendre la lecture »,
  « Prochains épisodes » et « Déjà vu » sont en vignettes 16:9, et OK y lance
  la lecture ; toutes les autres rangées et étagères sont en affiches 2:3, la
  raison d'une recommandation sous la légende de l'affiche focalisée
  (`CardFocusNote`).
- **La carte qui se redresse** (`MorphCard`) : 16:9 au repos, affiche 2:3 au
  focus, en fondu, sans recalcul de mise en page. L'affiche DESCEND (sur la
  légende, qui s'efface) : elle ne monte jamais sur le titre de la rangée.
  Plus montée par l'accueil ni « Pour vous » depuis le 2026-10-01.
- **Aucune action sur la carte, un GRAND PANNEAU à l'appui maintenu**
  (direction de l'utilisateur du 2026-10-01 : le plateau posé sur la carte
  était « trop peu visible », « ça ne se fait pas directement sur la card ») :
  au focus, la carte grandit et garde ses marqueurs (note, épingle Ma liste ·
  j'aime · vu, progression) ; l'appui maintenu ouvre un panneau centré
  (`screens/sheet/ActionSheetView`) — l'en-tête, les étoiles en grand,
  l'échelle HORIZONTALE de la note, puis les pictos dans l'ordre du modèle
  partagé : la lecture ou « Demander » au dégradé, Ma liste → favori → vu,
  « Plus d'infos » sur toute carte de la bibliothèque, « Ne plus me
  proposer », « Toutes les plateformes ». Chaque picto dit son geste sous son
  rond. Au banc : « Feuille d'actions ».
- **Noter : une échelle HORIZONTALE** (`RatingRuler`) : GAUCHE / DROITE aux
  valeurs du bureau (½ à 5 étoiles, 1 à 10), les valeurs défilent de droite à
  gauche, la valeur visée au CENTRE, les autres pâlissent avec la distance ;
  « Retirer la note » au bout. Le focus y entre PRÉ-FOCALISÉ à la note posée,
  sinon à 5/10 — jamais un bout, qu'un OK réflexe validerait. « Noter » de la
  fiche : le même panneau, réduit à la note. Mesuré au banc, focus natif
  (XCUITest) : chaque cran focalisé se centre, DROITE bute sur « Retirer la
  note », BAS descend aux pictos, HAUT remonte sur la note posée ; HAUT
  depuis l'échelle atteint la croix, BAS l'en ramène au cran retenu.
- **Maintenir OK, dit la carte** : sous la légende de TOUTE carte focalisée
  qui s'ouvre par l'appui maintenu — affiches, vignettes, grilles, épisodes,
  volets de saga —, « Maintenir OK : plus d'options » (`CardFocusFooter`, sous
  la raison d'une reco quand la carte en a une), 350 ms après le focus. Les
  grilles espacent leurs rangées de 52 pour la loger.
- **Un logo noir cède au texte** : `isLogoLegibleOnDark(blurHash)` — un logo
  dont l'empreinte est noire de part en part ne se lit pas sur la scène ; le
  câblage écrit alors le titre (le banc le fait déjà).
- **Rien ne recouvre le logo d'une vignette** : sur une carte sans Thumb, le
  logo passe AU-DESSUS de la pastille de note (`cardLogoBottom`, géométrie de
  `cardMarkerGeometry` : pied 12, ou 20 au-dessus de la barre de « Reprendre »,
  40 de haut, 12 d'écart) ; sans note, il garde sa place basse. Vignette 16:9
  et carte qui se redresse — banc « briques/logos » et « briques/logos-redresse ».

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
  magasin. `<RedesignScreen screen>` pose le port, ses couches du Retour (le
  rail, puis Réglages, puis la sortie — « Le Retour (Apple TV) ») et les
  deux ponts tvOS entre navigation et contenu : le moteur de focus ne vise
  qu'une cible alignée. `useEntryFocus` sert seul aux écrans sans navigation : il pose
  l'entrée (`hasTVPreferredFocus` dès le premier rendu, lâchée au premier
  focus de contenu) et le retour sur la dernière clé de contenu.
- **Cartes et héros** (`cards/`, `hero/`) : `useCardModels` / `useCardLists`
  (modèles STABLES, marqueurs résolus au niveau de la liste),
  `paletteOfItem`, `heroModelOf`, `metaOf`, `legibleLogoOf`.
- **Le Retour** (`back/BackScope.tsx`) : une portée par écran, posée par le
  navigateur ; tout ce qui a quelque chose à faire au Retour s'y inscrit
  (`useBackLayer`). Plus de `usePreventRemove` ni d'intercepteur par écran —
  « Le Retour (Apple TV) », plus bas.
- **La rangée focalisée entière à l'écran** : tvOS n'amène que la carte ;
  la SECTION native (`FocusSection`) amène la sienne — légende, raison,
  indication de l'appui long — au plus près, à 56 points des bords, en un
  seul mouvement, à la place du défilement de tvOS (« Les rangées (Apple
  TV) »). Au banc, le focus figé passe par `useForcedFocusReveal`.

## Tester la refonte

**Provisoire** — le lanceur (`apps/tv/harness/launcher/`) ne vit que le temps
de la refonte ; « Retirer le lanceur », plus bas, dit comment l'enlever. Trois
commandes, depuis la racine du dépôt. Au simulateur seulement : jamais
l'Apple TV du salon.

**L'app réelle, refondue**, au simulateur « Tentacle TV — refonte » :

```bash
pnpm tv:refonte
```

Elle dit ce qu'elle fait, dans cet ordre, et réutilise ce qui tourne déjà :

- **Backend de dev** : réutilisé s'il répond sur 3001, qui que l'ait lancé ;
  sinon `pnpm dev:backend`, depuis le dossier qui porte la configuration de la
  base (`apps/backend/data/database.json` — le dossier principal quand on
  lance d'un worktree).
- **Metro** : réutilisé s'il sert déjà CE dossier (le sien, ou `pnpm dev:tv`
  sur 8081) ; sinon lancé sur le premier port libre à partir de 8081.
- **Le simulateur « Tentacle TV — refonte »** : créé neuf la première fois
  (Apple TV 4K at 1080p, dernier tvOS d'Xcode) — jamais cloné : ni compte ni
  app d'un autre simulateur n'y passe.
- **L'app native** : reconstruite seulement si elle n'y est pas, ou si le
  NATIF a changé depuis (projet Xcode, dépendances et leurs correctifs,
  polices — une empreinte le dit) : build Xcode Debug, environ 8 min la
  première fois, moins d'une minute ensuite (27 s mesurées). Une retouche
  JavaScript ne reconstruit rien : elle se voit aussitôt.
- **`pod install`** ne passe que si les Pods manquent ou si leurs entrées ont
  changé (Podfile, Podfile.lock, dépendances, correctifs) : il régénère tout
  le projet Pods, et le build suivant recompile tout (7 min au lieu de 27 s).
  Hors du dossier principal, il retouche trois fichiers suivis sans rien y
  changer (sommes de contrôle liées au chemin du dossier, ordre de lignes,
  commentaires) : le lanceur les rétablit ; une vraie différence reste, et il
  la signale. `pnpm tv:refonte --rebuild` force `pod install` et le build.
- **Simulator.app au premier plan**, puis l'app, branchée sur ce Metro-là.

**Jumeler** — une fois, avec VOTRE compte ; le lanceur ne pose ni session ni
jeton, et le jumelage reste ensuite sur ce simulateur :

1. sur la TV, « Français » en bas de l'accueil (sur un simulateur neuf, l'app
   démarre en anglais : elle ne déclare que l'anglais à tvOS), puis
   « Configurer manuellement », adresse `http://localhost:3001` (le clavier du
   Mac tape dans la fenêtre du simulateur) ;
2. ouvrir `http://localhost:3001/pair-device` (le client web que sert le
   backend de dev), se connecter, saisir le code affiché par la TV.

Télécommande : flèches = pavé, Entrée = OK, Échap = Menu ; Window › Show
Apple TV Remote pour le reste.

**Le banc UI**, au simulateur « Tentacle TV — banc UI » : `bench:ui up` en
arrière-plan, puis `bench:ui sim`, sur des ports libres. La commande rend la
main quand l'app du banc a publié son catalogue : le banc est alors pilotable.

```bash
pnpm tv:banc
```

Les commandes du banc (son README) s'y passent telles quelles ; ses ports et
son simulateur sont retrouvés seuls :

```bash
pnpm tv:banc planche accueil --focus
```

**Tout éteindre** — le Metro, le banc et le backend lancés par le lanceur,
les deux simulateurs dédiés, et Simulator.app s'il ne montre plus aucun
appareil ; jamais ce qu'il n'a pas lancé lui-même (un backend réutilisé reste
en marche) :

```bash
pnpm tv:stop
```

Journaux (Metro, banc, backend, `pod install`, build) et état :
`~/Library/Caches/tentacle-tv-lanceur/`.

### Retirer le lanceur (à la fusion dans main)

Rien d'autre ne dépend de lui :

- supprimer le dossier `apps/tv/harness/launcher/` ;
- retirer du `package.json` racine les trois lignes `tv:refonte`, `tv:banc`
  et `tv:stop` ;
- retirer le bloc « En une commande » en tête de
  `apps/tv/harness/ui-bench/README.md` (jusqu'au trait `---`), et cette
  section-ci ;
- sur le Mac, si l'on veut : `~/Library/Caches/tentacle-tv-lanceur/`, et les
  deux simulateurs :

```bash
xcrun simctl delete "Tentacle TV — refonte"
```

```bash
xcrun simctl delete "Tentacle TV — banc UI"
```

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
  prend la couleur de l'œuvre. Lisible partout (planches comparatives).

### Les fonds sous le verre natif

Le verre dessiné ne floute rien : les vues posent dessous un fond sombre —
0,84 à 0,96 sous les feuilles et les panneaux, 0,5 sous les pastilles du
lecteur. Le verre natif, lui, floute, et fonce déjà ce qu'il couvre : ces
fonds le cachaient, feuilles et panneaux sortaient presque noirs. Une seule
règle, `redesign/glass/glassBacking.ts` : sous le verre natif,
`useNativeGlassBacking(ton)` remplace le fond dessiné d'une vue par celui du
ton de son verre. Simulé et enrichi ne bougent pas — planches avant/après
identiques au pixel près sur les huit groupes, hors roues de chargement.

Calibré au pire, sur du blanc pur, et vérifié sur la neige d'Interstellar
(scène `verre/lisibilite`). Contraste du texte blanc :

| Ton | Sous quoi | Sans fond (blanc pur) | Fond natif | Blanc pur | Neige |
|---|---|---|---|---|---|
| `strong` | feuilles, panneaux du lecteur, rail ouvert, « À suivre », erreur, messages, hors-ligne, bande-annonce | 6,7:1 | aucun | 6,7:1 (secondaire 4,8:1) | 7,5:1 |
| `regular` | badges du lecteur : saut, mémoire tampon, qualité, défilement | 4,1:1 | 0,1 | 4,7:1 | 6,1:1 |
| `clear` | boutons et pilules posés sur l'image | 1:1 | 0,55 | 3,1:1 | 4,6:1 |

- **Le verre clair ne fonce rien** (blanc sur blanc sans fond) : son fond ne
  s'allège pas, il passe même de 0,5 à 0,55 pour tenir 3:1 sur du blanc pur
  — il ne porte que des libellés gras et des pictogrammes.
- **Hors règle** : la carte du code du jumelage garde son fond dense. Il y
  empêche le halo de teinter le code — ce que le flou ne change pas (essayé :
  la carte vire au rose-violet).
- **Les feuilles restent sombres** : leur voile plein écran (0,58 à 0,86)
  domine désormais. Le verre s'y voit (teintes floutées de la page, liseré),
  mais c'est ce voile qu'il faudrait alléger en natif pour en voir plus.
- **Coût** : rien de plus. `mesure/fonds` (la règle) contre
  `mesure/fonds-dessines` (les fonds d'avant, sous le verre natif), quatre
  tours alternés de 8 s : 152 contre 156 ms/s de GPU, écart par tour de
  −8,5 à +2,5 — dans le bruit.

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
  inatteignable. Depuis le 2026-10-02, les sections de la fiche suivent la
  règle de voisinage commune (« Les rangées (Apple TV) ») : il n'en reste que
  deux entrées déclarées — la saison affichée, l'épisode à reprendre.
- **Panneau** (`ActionSheetRedesign`, son focus dans `sheetFocus.ts`) : dans
  une `Modal` (Menu par `onRequestClose` : ferme). Entrée sur l'échelle, à la
  note posée, sinon à 5/10 — décidée une fois la note CONNUE (liste des notes,
  série d'un épisode : l'échelle attend, « … »), puis figée —, par le verrou
  de `useChoiceEntry` ; sans note possible, sur le premier picto. Garde
  anti-clic fantôme sur l'échelle, les pictos et la croix : le panneau s'ouvre
  sous un OK encore enfoncé. Trois groupes PLEINE LARGEUR, chacun son guide
  d'entrée — rien n'y est aligné d'une rangée à l'autre :
  - `sheet:header` mène à la croix. Dans le coin haut-gauche du panneau (la
    règle de la croix Retour, plus bas), elle n'est au-dessus d'aucun cran ni
    d'aucun picto : HAUT depuis l'échelle ne l'atteignait pas (constat de
    l'utilisateur, « la croix n'est pas focalisable »). Désormais HAUT depuis
    l'échelle y va, et depuis les pictos PAR l'échelle (directement, sans
    échelle). Elle n'est une destination qu'une fois le verrou d'entrée levé ;
  - `sheet:scale` mène au cran retenu — la note posée, sinon 5 : HAUT depuis
    les pictos, BAS depuis la croix (même après être allé sur un autre cran,
    que la règle quitte en se recentrant) ;
  - `sheet:actions` entre par la lecture, puis par le dernier picto visité.

  OK sur la croix ferme et rend le focus à la carte (à « Noter », depuis la
  fiche) ; en mode « Noter », OK sur un cran note et ferme. Éprouvé dans
  l'app réelle (simulateur, compte de test : entrée, HAUT, BAS, OK sur la
  croix, Menu, sur une carte et sur « Noter ») et au banc, en focus natif, par
  les scènes « Câblée » de la feuille d'actions (`sheetWiredScenes.tsx` : la
  vue dans sa `Modal`, sous `useSheetFocus`) — en plus : la note posée, le
  titre non notable, OK sur un cran. D'une scène câblée à l'autre, passer par
  le catalogue (`menu`) : la `Modal` présentée dans le même rendu que le
  retrait de la précédente ne paraît pas. Une note posée en essai part chez
  TMDB (session invitée, synchronisation du serveur) : ce cas s'éprouve au
  banc.
- **Bande-annonce** : le lecteur est monté dès le chargement (la vue ne le
  montait qu'en lecture : il ne pouvait pas charger), et le chrome suit
  `chromeDimmed` seul — la croix Retour, seule focalisable, garde le focus :
  le câblage rallume au moindre geste, appui ou glisser sur le pavé
  (`useRemoteEvents`).
- **La bande-annonce finit toujours** (branche `refonte/tv-bande-annonce`,
  2026-10-01, après « les bandes-annonces ne se lancent pas ») : par sa
  première image, sa fin, ou « indisponible » — jamais un chargement sans
  fin ni une image figée sans rien dire. Le lecteur tvOS
  (`screens/trailer/TrailerWebView.ios.tsx`) borne la résolution à 45 s
  (`resolveTrailerStream`) ; son chien de garde (`useTrailerPlaybackWatch`)
  ne dit « lecture » qu'à la première image (`onReadyForDisplay`), conclut à
  l'échec sans image en 15 s ou sans progrès pendant 15 s (à la fin si l'on
  est au bout), montre une roue sur la dernière image au bout d'une seconde
  sans progrès (`waiting`), et se suspend en arrière-plan. La raison d'un
  échec part dans les traces de dev (`[TVDIAG] [trailer]`) et au serveur
  (`POST /api/trailers/report`) ; l'indisponible rend la fiche de lui-même
  au bout de 4 s (2026-10-02).
- **Fiables et rapides** (2026-10-02, `docs/BANDES-ANNONCES.md`) : la vraie
  cause était le sélecteur de format du serveur, qui exigeait un HLS muxé
  que YouTube ne sert presque plus, et ignorait le maître HLS du client
  `visionos`. Le serveur choisit désormais lui-même le flux, le RELAIE (les
  URL googlevideo sont liées à son adresse IP), garde un ouvrier yt-dlp
  chaud, et la fiche prépare la bande-annonce pendant qu'on la lit :
  32 lancements sur 32, première image en 0,29 s en médiane (avant : 2 sur
  20, échecs au bout de 13 à 23 s). Le paragraphe suivant est l'état d'avant.
- **Pourquoi elles ne se lançaient pas** : YouTube, pas l'app. Mesuré le
  2026-10-01 avec le yt-dlp du Mac (Homebrew 2026.06.09, hors de la mise à
  jour automatique qui ne tourne qu'en production) : le client `web_safari`
  est forcé en « SABR » (aucune HLS) le plus souvent, et le repli MP4 360p
  (format 18, client `ANDROID_VR`) répond 403 à toute plage qui dépasse son
  premier mégaoctet — yt-dlp lui-même ne peut pas le télécharger. Quand la
  HLS vient (une fois sur plusieurs), la vraie bande-annonce se lit,
  s'estompe et se ferme. Le serveur ne déclare plus lisible ce MP4 coupé : il
  sonde comme AVPlayer, par une plage ouverte (`isReadable`). Et l'écran dit
  ce qui se passe : « YouTube ne fournit pas cette bande-annonce pour
  l'instant » (question 5, plus bas).

## Branchement — bibliothèques, Ma liste, Favoris, Parcourir, recherche (Apple TV)

Branche `refonte/tv-grilles-suite`. Le câblage vit dans
`redesignWiring/library/`, `collection/`, `browse/`, `search/` et
`grid/usePosterGrid.tsx` (la grille d'affiches commune : cartes du socle,
légende = année, fiche à l'appui, feuille à l'appui long). Android TV garde
ses écrans ; les requêtes, les filtres et leur mémoire de session sont les
siens (`useLibraryFilters`, `catalogParams`).

- **Nouveaux états** : l'erreur de chargement (Réessayer, Retour à l'accueil)
  là où l'ancienne grille affichait une bibliothèque ou une collection vide ;
  le vide d'une collection offre une sortie (« Parcourir les
  bibliothèques »), celui des filtres trop serrés « Tout effacer ».
- **Filtre de plateformes** : posé, le catalogue se charge en une page aux
  champs complets (studios, identifiant TMDB) ; la vérification TMDB arrive
  ensuite — mesuré sur Films, Netflix : 2 titres, puis 77.
- **Listes de filtres** (dans une Modal, Menu les referme) : on y entre par ce
  qui est retenu, par le verrou de `useChoiceEntry` ; « Effacer », qui
  disparaît sous le doigt, rend le premier choix par le même verrou ; le pied
  (`sheet:footer`, pleine largeur) s'atteint par BAS depuis n'importe quelle
  colonne, entrée sur « Voir N titres ».
- **Groupes** : `filters` (la barre, pleine largeur : HAUT depuis toute la
  grille), `library:empty` (BAS depuis la barre jusqu'au bouton du vide),
  `browse:header` (HAUT depuis toute la première rangée jusqu'à Retour),
  `search:input` et `search:results` (chaque colonne garde sa place).
- **Recherche** : le champ est un bouton qui monte le clavier SYSTÈME, et sa
  dictée — jamais le micro. Seule la sélection d'un résultat mémorise la
  requête (parité Android TV). Au retour d'une étagère (Parcourir), la barre.

## Collection et « Demander » (Apple TV)

Branche `claude/gallant-cannon-80186f` (lot du 2026-10-01 soir, tâche 7), sur
le socle Vigie de la tâche 8 (`redesignWiring/vigie/useVigieGate`). Décisions
de l'utilisateur : des titres ABSENTS de la bibliothèque, grisés ; « Demander »
seulement quand le serveur déclare Vigie installé ET activé, et rien d'autre
— ni pages Vigie, ni le mot « Vigie », « plugin », « téléchargement ».

- **La carte d'un titre absent** (`card.absent`, `cards/AbsentArtwork`) : son
  affiche TMDB en niveaux de gris sous un voile qui s'allège au focus — sa
  lueur y est NEUTRE (`glowTone`, jamais la couleur d'une œuvre) —, et un
  badge au pied de l'image, là où les autres cartes portent leur note — « Pas
  dans la bibliothèque », ou l'état de sa demande. Sans affiche (serveur
  d'avant `posterPath`) : un cadre qui écrit titre et année. Le gris est
  NATIF (`GreyscaleImage` → `TentacleDesaturateView.m`) : une vue grise
  composée en `saturationBlendMode` par-dessus une `Image` ordinaire, sur le
  GPU — l'ancienne architecture n'a ni `filter` ni `mixBlendMode`. Repli,
  pour un binaire sans la vue : un filtre SVG (`FeColorMatrix` saturation 0),
  qui retenait le fil principal 50 à 75 ms PAR affiche (175 à 300 ms à
  l'arrivée d'une saga de quatre volets, mesuré au banc en JS de prod ; 34 ms
  au pire avec la vue native). Fichier natif : l'app doit être reconstruite.
- **La saga d'un film** : chaque volet montre sa miniature, même absent
  (`SagaPart.posterPath`, `/api/sagas` → TMDB `poster_path`), dans l'ordre de
  la saga. Sans Vigie, OK sur un volet absent dit « Ce titre n'est pas
  disponible dans votre bibliothèque. » (`showNotice`), aucun appui maintenu.
- **Les avis brefs** (`showNotice`, `NoticeToast`) : en haut à droite, dans le
  verre des messages de l'administrateur, jamais focalisables, effacés seuls
  (4 s ; 5,5 s avec une phrase de suite).
- **Garde Vigie ouverte** — trois entrées (et, depuis, les saisons manquantes d'une
  série de la bibliothèque : « Les saisons manquantes », plus bas), rien ailleurs
  (`redesignWiring/vigie/`) :
  - la COLLECTION (`useSagaAbsent`) : l'état de chaque volet absent (sa
    demande — `mine` du socle, « En attente », le camembert d'« En cours » —,
    sinon ce que dit l'extension, « Demandé » par un autre), « OK :
    demander » sous la carte focalisée ;
  - la RECHERCHE (`useSearchAbsent`) : une rangée « À demander » sous la
    bibliothèque, les mêmes cartes (route `search` de l'extension, celle qui
    sait demander) ; sans garde, la recherche reste la bibliothèque seule ;
  - la FEUILLE DES SAISONS (`SeasonsSheetRedesign`) : la grande liste des
    filtres, une ligne par saison — à cocher, ou son état (« Demandée ») ;
    « Fermer » tant que rien n'est coché, puis « Demander N saisons » au
    dégradé.
  OK (`useTitleRequests`) : déjà demandé par le compte → son état et « Pour
  suivre son état, ouvrez Tentacle sur votre téléphone. », jamais une seconde
  demande ; un film offert → la demande en UN geste, « Demande envoyée. » et
  la même invite, le titre en tête des demandes du compte (`withMyTitle`) ;
  une série → la feuille des saisons ; rien d'offert → l'état que dit
  l'extension, sinon « pas disponible ». L'appui maintenu : le grand panneau
  des cartes, sans plus (affiche, titre, année, état, « Demander » quand
  c'est offert). Panneau et feuille : couches « menu » du Retour.
- **Le contrat** (rétrocompatible, web et mobile inchangés) : `titles.seasons`
  (`GET seasons?key=tv:ID` → les saisons, leur état, si elles se demandent)
  et `POST request` avec `seasons: [1, 2]` — Vigie, branche
  `feat/tv-saisons` ; le cœur les relaie (`readTitlesMeta`,
  `TitleProvider.seasonsPath`, `useTitleSeasons`, `useRequestTitleSeasons`).
- **Éprouvé** : au banc, groupe « Titres absents » (`bench:ui planche
  absents --focus`) ; dans l'app réelle (simulateur, compte Knaoxtest) derrière un
  relais à soi devant 3001, qui imite Vigie et ne relaie AUCUNE écriture
  (chaque POST journalisé) : sans Vigie, compte bloqué, Vigie actif — saga
  (états, demande d'un film, panneau), recherche « marvel » (rangée, demande
  par le panneau), saisons (deux cochées, Menu ferme, le focus revient à la
  carte).
- **Pièges payés** : `readSagaResponse` (api-client) relisait les volets
  champ par champ et jetait `posterPath` — la TV ne voyait jamais l'affiche ;
  les écrans paresseux (`React.lazy`) d'une app de développement attendent
  leur paquet de Metro à la première ouverture (squelette de longues
  secondes sous charge, pas un gel).

## La navigation — beaucoup de bibliothèques (Apple TV)

Branche `refonte/tv-nav-bibliotheques`. La vue vit dans `redesign/nav/`, le
câblage dans `redesignWiring/nav/` et `screen/RailShortcuts.tsx`, la
politique partagée dans `packages/tv-core/src/nav/`.

- **Deux capsules** de verre, même largeur : le bloc des pages (Rechercher
  fixe en tête, puis la liste) et, en bas, le bloc du PROFIL (nom du compte,
  « Profil et réglages »). Toute la géométrie que lit le moteur de focus est
  la même repliée comme dépliée (`navGeometry.ts`). Depuis le 2026-10-02, les
  deux capsules ÉPOUSENT leur contenu : « Le rail compact », plus bas.
- **La liste défile** (`NavList`, une ScrollView native). Au pavé, c'est tvOS
  qui la fait défiler, et il tient LUI-MÊME l'entrée focalisée à 180 points
  des bords, dans les deux sens (mesuré au simulateur : deux entrées et demie
  visibles au-delà) ; il trouve les entrées hors de l'écran, et la ScrollView
  de react-native-tvos ne laisse pas le focus sortir de la liste avant son
  bout — flèche maintenue, on s'arrête sur la dernière entrée, jamais sur le
  profil. La vue ne défile elle-même que là où tvOS ne fait rien — repliée
  (l'entrée de la page courante), menu ouvert (l'entrée dont il parle),
  focus figé du banc — et à la même marge (`railRevealOffset`, tv-core).
- **Fondu et indicateur** : le fondu du côté où il y a plus estompe le DESSIN
  des entrées (opacité calculée sur le fil de l'interface), jamais un calque
  posé dessus — il masquerait les cibles au moteur de focus. L'indicateur de
  position (`railThumb`) ne fait que glisser. Au repos : 0 ms/s de GPU.
- **Rendue par POSITION** (`slot:<i>`) : réordonner change ce qu'affiche une
  case, jamais la vue native qui porte le focus — c'est ce qui permet au
  mode « déplacer » de suivre le focus sans réclamation.
- **Organiser** (`useRailArrange`) : l'appui long ouvre le menu d'une entrée
  (`NavMenuModal`, une Modal, entrée sur « Déplacer », garde anti-clic
  fantôme) — Déplacer, Monter, Descendre, Masquer, Tout afficher, Réglages
  de la navigation. Monter / Descendre enregistrent et laissent le menu
  ouvert (OK, OK, OK). Déplacer soulève l'entrée : HAUT / BAS la déplacent,
  OK la pose, Retour annule (une couche « menu » du Retour) ; Rechercher,
  Accueil, « Tout afficher »
  et le profil sont verrouillés le temps du déplacement, quitter le rail pose
  l'entrée, et l'ordre en cours n'est enregistré qu'à la pose.
- **Réglages › Navigation** (`NavigationPanel`, `useNavigationSettings`) :
  toutes les entrées organisables, masquées comprises ; OK soulève une ligne
  (même mécanique), sa pastille l'affiche ou la masque ; « Tout afficher » et
  « Ordre par défaut » quand ils ont à faire.
- **Les réglages vite** (`RailShortcuts`, guides du câblage) : la navigation
  BOUCLE (HAUT depuis Rechercher → profil, BAS depuis le profil →
  Rechercher) et GAUCHE depuis toute entrée mène au profil — « gauche,
  gauche » depuis le contenu. La Siri Remote n'émet pas la fin d'un appui
  maintenu sur une flèche : le guide s'arme après 450 ms, ou 1,1 s si l'on
  est arrivé dans une rafale (flèche maintenue) — mesuré : maintenu 1,2 s et
  2 s depuis une rangée, le focus s'arrête sur « Accueil ».
- **Le magasin partagé** (`railPinning.ts`, clé `tentacle_webos_rail`) gagne
  un champ `order`, facultatif : absent du JSON tant qu'on n'a rien déplacé
  (la forme d'avant, à l'octet près), `masquees` inchangé ; la LG et
  Android TV ne le lisent pas. `applyRailOrder` range, `moveRailKey` déplace
  d'un cran parmi les VISIBLES ; une bibliothèque nouvelle se range à la
  suite.
- **Mesuré dans l'app réelle** (simulateur tvOS 26.2, agent XCUITest, 3 vraies
  bibliothèques + 21 injectées dans le cache de requêtes par CDP) : 60,2 i/s
  sur le fil de l'interface en descente flèche maintenue (aucune image
  perdue), 59,7 en remontée ; 59,8 sur le fil JS. Masquer, déplacer, annuler,
  « Tout afficher » et l'onglet des réglages éprouvés au pavé ; l'ordre et
  les masquées survivent à la relance à froid.
- Au banc : 12 scènes « Navigation » (24 bibliothèques : repliée, dépliée en
  haut / au milieu / en bas, masquée, menu, déplacer, Réglages ›
  Navigation) — `bench:ui planche navigation/ --focus`.

## Le rail compact (Apple TV)

Retour de l'utilisateur après son essai (2026-10-01) : le rail était un grand
pavé de verre, vide sous trois bibliothèques. Il épouse désormais son contenu.
La vue reste dans `redesign/nav/`, la règle de colonne dans
`packages/tv-core/src/nav/railColumn.ts` (pure, testée).

- **Le bloc des pages** est haut comme ses entrées et CENTRÉ sur la hauteur de
  l'écran. Avec beaucoup de bibliothèques, il ne dépasse jamais la hauteur du
  rail d'avant (890 points) : sa liste défile, comme avant.
- **Le bloc du profil** reste ancré en bas, jamais caché ni poussé hors de
  l'écran. Il tient aussi, AU-DESSUS du profil, l'élément des demandes en
  cours (Vigie) quand il existe : `NavRailProps.accessory = { height, node }`
  (hauteur réservée, bornée à 240), qui lit l'état du rail par
  `useNavFrame()` (`expanded`, `openness`, `itemWidth`…). C'est toujours le
  bloc des pages qui cède : il remonte, garde l'écart de 14, puis rétrécit.
- **Replié** : une bande d'icônes en pilule de 88 points (contre 104), à
  44 du bord — la colonne des pictogrammes ne bouge pas (x = 88) ; le profil
  seul y est un rond. **Ouvert** : la largeur de l'intitulé le plus long —
  libellés en Inter gras (celui du focus), nom et seconde ligne du profil —,
  mesurée hors écran avec les polices exactes (`NavTextMeasure`), bornée de
  300 à 380 (`TV_STAGE.nav`). Le nom de l'utilisateur, ses bibliothèques et
  la langue la font varier ; tant que rien n'est mesuré, la plus grande.
- **La légende devient une bulle** de verre à droite du profil, rail ouvert
  seulement (`NavLegend`). Dans la colonne, sa ligne la plus longue
  (« Maintenir OK : organiser », 260 points) imposait 356 de large en
  français, et sa place réservée sous le bloc des pages le décentrait dès
  que l'élément des demandes était là. Variante écartée, gardée en planches :
  `apps/tv/harness/ui-bench/out/variantes/A-legende-dans-le-rail-*`.
- **Le mouvement** ne change pas de principe : le verre ouvert se révèle par
  une fenêtre coupée qui glisse (deux `translateX`), les libellés et la bulle
  paraissent en fondu ; au repli, ils s'effacent AVEC le verre (ils restaient
  plantés puis disparaissaient d'un coup). Rien d'autre que `transform` et
  `opacity` n'est animé.
- **La géométrie est publiée** (`onGeometry` → `RedesignScreenModel.railGeometry`) :
  les raccourcis (`RailShortcuts` : au-dessus du bloc des pages, sous le
  profil), le pont de sortie (`RailBridges` : après le rail ouvert, à sa
  largeur réelle) et le menu d'une entrée (`NavEntryMenu railWidth`) s'y
  posent. Leur logique ne change pas.
- Au banc : 8 scènes « Rail compact » — 3 et 15 bibliothèques, replié et
  ouvert, avec et sans l'élément des demandes (un gabarit du banc) :
  `bench:ui planche rail/ --focus --lang=fr,en`.

## Le mouvement (Apple TV)

Branche `refonte/tv-animations`. Les transitions et animations de la
refonte sont pour Apple TV SEULEMENT : `MOTION_ENABLED`
(`redesign/motion/motion.ts`) ; ailleurs, et avec « Réduire les
animations », tout se pose aussitôt à son état final. Tout tourne sur le
fil d'interface (worklets Reanimated) : aucun aller-retour JS pendant une
animation, aucune animation de mise en page.

- **Les jetons** : `TV_MOTION` (`packages/theme/src/tokens/tvMotion.ts`) —
  courbes, ressorts dans le vocabulaire d'Apple (réponse, amortissement →
  ressort physique par `springOf`), durées. Une sortie est plus brève que
  son entrée ; rien d'interface au-delà de 500 ms, hors fondus enchaînés et
  image qui se pose (tests du thème).
- **Le module** `redesign/motion/` : `motionTo` et ses préréglages (`focus`,
  `recede`, `press`, `reveal`, `veil`, `panel`, `unfold`, `page`, `hero`,
  `ambient`, `settle`, `imageIn`, `chrome`) ; `useMotion`, `usePresence`
  (sortie jouée avant démontage), `useEntrance` ; `useCrossfade` (deux
  emplacements), `useSwap` (sortie puis entrée), `useLayerPool` (une réserve
  de calques réutilisés) ; `Reveal` (après un temps d'arrêt), `Presented` ;
  `useOverlayArrival` (panneaux qui portent du focus) ; `useRowFocus` /
  `useRecede` ; `pressProgress` ; `useStagedMount`.

| Ce qui bouge | Comment |
|---|---|
| Focus des cartes, boutons, portraits | ressort `focus` (réponse 0,28, amortissement 0,8) ; les voisines reculent par une valeur partagée, sans rendu (`useRowFocus`) |
| Appui (OK enfoncé) | ×0,96, rebond au relâcher (`press`), tenu par `FocusTarget` ; une carte dont l'image est sœur de la cible le reçoit par `pressProgress` |
| Indications sous une carte | après un temps d'arrêt (`Reveal delayMs`) : un focus qui balaie n'en monte aucune |
| Halo d'un épisode | une fois le focus posé et « Maintenir OK » paru (`HALO_DWELL_MS`) |
| Héros qui tourne | image en fondu enchaîné, texte qui sort puis rentre, halo et fond vivant en réserves de calques |
| Fond vivant | la lumière suit la carte focalisée (`ambient`, réserve de cinq) |
| Navigation | capsule qui se déplie (`unfold` : une fenêtre et des translations), voile, menu d'entrée |
| Pages | fondu de la pile (`page.fadeMs`, 320 ms) ; en-tête de fiche qui entre ; image de fond qui se pose (`settle`) ; sections montées après l'entrée (`SectionStage`) |
| Grand panneau, feuilles | voile et panneau à l'échelle (`panel`), sortie jouée avant démontage |
| Lecteur | habillage (`chrome`), panneaux qui glissent, saut ±, défilement en fondu (la bulle monte en paraissant), « À suivre », écran de fin |

Pièges payés :

- Un focalisable à opacité ~0 est CACHÉ pour le moteur de focus de tvOS : il
  recalcule sa carte du focus et perd des images. Ce qui porte du focus
  pendant un fondu garde le plancher `SWAP_FLOOR` (0,02).
- Une animation de mise en page (`entering`) écrase l'opacité de sa vue — le
  halo s'affichait plein, quelle que soit sa force — et se fige dans un
  `Modal` : présences et fondus à la main (`usePresence`).
- Pas de vue plein écran par-dessus des focalisables, pas de focalisable
  gardé vivant le temps d'une sortie (ses guides retiennent le focus).
- Ce qui se DESSINE sur le processeur se paie au montage, sur le fil
  principal — quatre fois plus sur une Apple TV 4K (échelle 2) qu'au
  simulateur 1080p : `react-native-linear-gradient` peint à la taille de sa
  vue (`SoftGradient` dessine au huitième, le GPU agrandit) ; un flou SVG
  passe par Core Image et relit le GPU de façon synchrone (halo différé,
  réserve, dessin au quart) ; un dégradé radial SVG en grand coûte (disques
  de 128 pt agrandis).
- Un pas du focus ne redessine pas une rangée : l'index focalisé vit dans
  une valeur partagée. Une liste (`FlatList`) ne prend plus d'`extraData`
  pour un recul.
- L'arrivée d'une page se coupe : l'en-tête d'abord, le contenu des
  sections (sous le bord) après l'entrée, une section par image.

Mesuré au banc (JS de production, simulateur Apple TV 4K en 1080p, charge
du Mac sous 2 ; `bench:ui fps`, focus NATIF balayé) :

| Mouvement | Fil d'interface | Images perdues |
|---|---|---|
| Accueil, rangée Reprendre balayée toutes les 150 ms | 60 i/s | 0 |
| Fiche, épisodes balayés toutes les 300 ms | 60 i/s | 0 (avant : 49 sur 8 s) |
| Casting, saga, extras, personnes, balayés | 60 i/s | 0 |
| Héros qui tourne (après le premier tour) | 60 i/s | 0 |
| Navigation dépliée et repliée toutes les 1,2 s | 60 i/s | 0 |
| Lecteur : habillage, saut, panneau (toutes les 1,5 s) | 59,5 i/s | 4-5 sur 10,5 s, une à la fois (focus et verre natif à chaque bascule) |
| Fiche la plus lourde qui arrive (quatre arrivées) | pire à-coup 38-44 ms | 6-7 sur 10 s (avant : 16-19, à-coups de 90-95 ms) |

Le halo d'un épisode, dessiné une fois le focus posé, prend ~45 ms au fil
principal : rien ne bouge alors, rien ne se voit.

Pistes :

- Les ombres du verre surélevé (`GlassSurface elevated`) sont calculées au
  pixel : sur un fond translucide, React Native ne pose pas de `shadowPath`
  (l'avertissement « cannot calculate shadow efficiently » du mode
  développement). Sans elles, le dépli de la navigation coûte 12 à 20 % de
  GPU en moins ; une ombre en image étirable les remplacerait.
- Le halo de la meilleure réponse de la recherche (`SearchTopHit`) se
  redessine (Core Image) à chaque changement de meilleure réponse.
- ~~Parallaxe native~~ — faite : « Le pavé tactile (Apple TV) », ci-dessous.

## Le pavé tactile (Apple TV)

Branche `refonte/tv-pave-tactile`. Ce que la Siri Remote fait déjà d'elle-même,
et ce que la refonte y ajoute — Apple TV seulement.

- **Ce que tvOS fait seul** : le moteur de focus suit les glissers du pavé,
  avec élan, partout — rangées, grilles, navigation, réglages, clavier,
  saisons et épisodes, et l'échelle de note (chaque cran est focalisable :
  glisser y règle déjà la note). Rien n'y est ajouté.
- **La parallaxe au pouce** : posé ou glissé, le doigt incline et décale
  l'élément focalisé, comme dans les apps d'Apple. Ce sont des effets de
  mouvement natifs, que React Native tvOS pose sur la vue FOCALISÉE et que le
  moteur de focus pilote d'après le doigt : rien ne passe par le JS, rien ne
  se redessine. La vue décrit la FORME de ses cibles (`FocusTarget form`,
  facultative) ; le magasin du focus la traduit en `tvParallaxProperties`
  (`redesignWiring/remote/parallax.ts`, jetons `TV_MOTION.parallax`) :

| Forme | Où | Effet |
|---|---|---|
| `card` | affiches, vignettes, épisodes, casting, extras, volets d'une saga, personnes | 6 pt et 0,07 rad au bord du pavé |
| `row` | navigation, onglets et lignes des réglages, listes de choix, options des filtres, suggestions et champ de la recherche, meilleur résultat, champ du jumelage | 3 pt, sans inclinaison (à 1 000 pt de large, 0,05 rad tordait les bords de ±5 %) |
| sans forme | boutons, pastilles, ronds, touches, crans | le défaut de React Native : 2 pt, 0,05 rad |

  Jamais d'agrandissement natif (`magnification` à 1 : le focus et l'appui
  s'animent par Reanimated) ; « Réduire les animations » : aucune parallaxe.
  **Une carte rend son image DANS sa cible** (`redesign/cards/CardShell`) :
  la cible couvre image ET légende — rien ne la recouvre, tvOS amène toujours
  la carte entière à l'écran —, la légende est dessinée avant elle, dessous,
  hors de son sous-arbre : seule l'image suit le pouce, le texte ne
  s'incline jamais.
- **Le héros tourne seul**, en fondu, toutes les 8 s — même focalisé : les
  boutons ne se remontent pas, le focus ne bouge pas (`useHeroRotation`). Le
  minuteur repart à zéro à chaque geste (appui, glisser, pan, pas du focus) ;
  un appui maintenu sur OK le suspend ; rien ne tourne quand le héros n'est
  pas affiché (page qui n'est pas devant, héros défilé à plus de moitié —
  `HomeView` le dit —, application inactive) ; mouvement réduit : 16 s, sans
  fondu. **Et on le tourne à la main** : DROITE au-delà du dernier bouton —
  clic sur le bord du pavé ou glisser, là où le focus ne va nulle part, vers
  les points de la rotation — passe au titre suivant, en boucle
  (`remote/useBeyondEdge`). Le geste qui AMÈNE le focus sur le bord ne compte
  pas : le moteur de focus déplace le focus à l'enfoncement et l'appui ne
  s'annonce qu'au relâchement (~60 ms après) ; un glisser, à sa fin. Le focus
  doit tenir le bord depuis 400 ms. **L'appui maintenu sur un bouton du
  héros** ouvre le grand panneau du titre affiché, comme une carte (une
  reprise dans la variante de « Reprendre », sinon une affiche), et ne lance
  plus rien au relâchement ; le focus posé, « Maintenir OK : plus
  d'options » paraît sous les pilules. Panneau ouvert, la rotation attend ;
  fermé, le focus revient sur la pilule.
- **Le module commun** : `redesignWiring/remote/remoteEvents.ts` — UN
  abonnement à `TVEventHandler`, traduit en événements typés (`press` avec
  sa phase, `swipe`, `pan`) ; `lib/tvPanGesture.ts` — le pan continu à
  compteur (`acquirePanGesture`, `usePanGesture`), pour le lecteur ;
  `remote/useBeyondEdge.ts`.
- **Écarté** : le pan continu hors du lecteur — `enableTVPanGesture` pose UN
  reconnaisseur sur la vue racine, pour toute l'app, et coupe les glissers
  directionnels tant qu'il est posé (constat du lecteur) ; l'échelle de note
  au pan (le natif le fait, un pan casserait HAUT et BAS vers les pictos) ;
  l'index de lettres des très grandes bibliothèques, façon tvOS (une
  fonctionnalité, proposée à part).

Éprouvé au simulateur (app réelle, compte Knaoxtest, agent XCUITest) :

- toutes les cartes restent atteignables, rendu au repos inchangé : accueil
  (Reprendre en 16:9, affiches), Ma liste, bibliothèque Films, recherche
  (meilleur résultat, personnes, films, séries), fiche d'une série (saisons,
  épisodes, casting, extras, similaires), saga avec un volet hors
  bibliothèque ;
- effets natifs relus par LLDB sur la vue focalisée (`[[UIScreen
  mainScreen] focusedView].motionEffects`) : affiche — centre ±6, inclinaison
  0,07 ; onglet des réglages — ±3, inclinaison nulle ;
- l'inclinaison du bord du pavé posée à la main (même transformée) : l'image
  tourne, la légende reste droite ; un bouton de verre focalisé (blanc) se
  rend net incliné ;
- banc UI (la nouvelle ossature des cartes ; le banc n'a pas de port du
  focus, donc pas de parallaxe), JS de production, focus natif balayé toutes
  les 150 ms, Mac chargé par d'autres sessions (charge 20 à 40) : accueil et
  grille Films à 60 i/s sur le fil d'interface, 0 image perdue en quatre
  mesures (avant, même charge : 59,1 à 59,9 i/s, 1 à 7 perdues) — la
  parallaxe elle-même se joue dans Core Animation, hors des deux fils ;
- héros, titres relevés toutes les 200 ms : un titre toutes les 8 s au repos
  focus sur « Reprendre » ; aucun pendant 15 s de HAUT toutes les 3 s, ni
  pendant 11 s d'OK maintenu, ni héros défilé hors champ ; DROITE au-delà du
  bord : le suivant aussitôt, puis 8 s plus tard.

**Ce que le simulateur ne sait pas montrer** : un doigt sur le pavé.
`XCUIRemote` n'a que des appuis ; un chemin de pointeur synthétisé par XCTest
(`XCPointerEventPath`, accepté) n'atteint jamais la Siri Remote. La parallaxe
a donc été relue et posée, pas jouée au doigt. À éprouver sur l'Apple TV
(tâche de l'utilisateur) : l'amplitude ressentie (6 pt / 0,07 rad), le
glisser sur l'échelle de note et dans une longue grille, le héros tourné par
un glisser, et le pan du lecteur qui couperait les glissers directionnels.
À la main au simulateur : Window › Show Apple TV Remote, glisser sur sa
surface.

## Le lecteur — avance rapide et pilule de saut (Apple TV)

Branche `refonte/tv-lecteur-avance`. Retours de l'utilisateur sur l'app
réelle (2026-10-01) : l'avance rapide « pas super intuitive, copie Netflix » ;
« Passer l'intro » qui bloquait la remontée vers Retour.

**La référence.** Netflix sur Apple TV a utilisé le lecteur d'Apple
(`AVPlayerViewController`) jusqu'en mars 2026, puis un lecteur maison très
critiqué (un appui met en pause et ouvre un sélecteur d'images). On reproduit
le comportement historique, celui du lecteur d'Apple :

| Geste | Habillage caché, en lecture | En défilement |
|---|---|---|
| Appui ←/→ | saut de ±10 s, la lecture continue, la pastille cumule (+10, +20…) — **depuis le 2026-10-03 : +30 s / −10 s, la cible posée et décomptée 5 s** (« Saut de 30 s et validation en 5 s », plus bas) | le curseur bouge de 10 s (désormais +30 / −10) |
| Maintien ←/→ | le défilement s'ouvre aussitôt (0,5 s) et accélère, ×1 → ×2 → ×4 → ×8 (une marche par seconde), jusqu'au relâcher | idem, depuis le curseur |
| Glisser sur le pavé | le doigt EMPORTE le curseur (en lecture comme en pause) : fin s'il est lent, plus large s'il est vif, plafonné ; habillage CACHÉ, seulement après 600 ms de contact | idem, dès le premier pas ; doigt levé, la lecture repart à la cible au bout d'un décompte de 3 s (5 s depuis le 2026-10-03) |
| Simple toucher | réveille l'habillage (pas celui qui accompagne un clic) | relance le décompte |
| OK, ▶︎❙❙ | — | lit depuis la position visée |
| Menu | — | revient où l'on était, en pause si on y était |

Habillage visible, les flèches parcourent ses boutons ; le pavé, lui, défile
(les panneaux — épisodes, pistes, fin — le gardent pour leurs listes).
L'inactivité (7 s) annule un défilement oublié — décomptée à l'écran pendant
ses 3 dernières secondes (« Avance rapide au pavé — plus douce, plus sûre »,
plus bas). Remplacé le 2026-10-03 : plus d'abandon, une seule règle de
validation (« Saut de 30 s et validation en 5 s »).

- **La vue** (`ScrubOverlay`) : la vidéo reste figée où l'on était ; la frise
  est à sa place de l'habillage ; au-dessus du curseur visé, qui le suit, une
  bulle — la vignette trickplay cerclée de blanc, le temps visé en 60 pt et
  l'écart ; la vitesse sur la vignette. Fondu d'entrée et de sortie.
- **Le cerveau reste partagé** (Android TV le reçoit), sans `Platform.OS` : la
  couture `SCRUB_INPUT` (`hooks/scrubInput.ts`, `scrubInput.ios.ts`) dit
  seulement comment la plateforme émet les flèches. tvOS tranche lui-même
  entre appui (`left`, au relâchement) et maintien (`longLeft`, début à
  0,5 s, fin au relâcher, RIEN entre les deux : `holdMotor.hold`). Le saut
  n'appartient à la vidéo que fond focalisé (`BACKGROUND_FOCUS`, bus du
  lecteur) : sous la pilule ou la carte « À suivre », la flèche sert leur
  focus.
- **Le pavé** (`useScrubGestures.ios.ts`) : pan au compteur
  (`lib/tvPanGesture.ts`), zone morte de 60 pts horizontaux, gain en secondes
  par point selon la vitesse du doigt (`scrubGainFor`) — réglages dans
  `hooks/scrubTouchTuning.ts`, à reprendre à la Siri Remote réelle, le
  simulateur ne glisse pas (mesures faites par des pans injectés dans le
  runtime). Un pan annulé par tvOS n'émet aucune fin : 450 ms de silence le
  closent ; un doigt resté posé qui repart reprend un geste.
- **La pilule de saut** (« Passer l'intro / le résumé / l'aperçu », « Aller à
  l'épisode suivant ») : habillage visible et focus dans l'îlot, HAUT et
  GAUCHE mènent à Retour, BAS à lecture/pause (`playerFocusContainers`).
  L'habillage qui reparaît laisse le focus à la pilule qui le tient
  (`skipHoldsFocus`) : HAUT depuis la pilule réveille l'habillage, HAUT de
  nouveau mène à Retour. Éprouvé au pavé (agent XCUITest) sur Dark et One
  Piece, pilules manuelles et automatiques.
- **Android TV** (non éprouvé ici) : un appui ←/→ habillage caché saute de
  ±10 s au lieu de rallumer l'habillage ; un appui en défilement vaut 10 s ;
  Menu rend la pause d'avant ; la pilule garde le focus quand l'habillage
  reparaît.

Mesuré au simulateur, dans l'app réelle : maintien de 2,5 s → +19:00 sur un
épisode de 51 min (tics ×1, ×2, ×4), arrêt net au relâcher ; glisser lent de
150 pts → −60 s, vif de 500 pts → +12 min (gains d'avant le 2026-10-02 :
« avance beaucoup trop », retour de l'essai sur l'Apple TV).

### Avance rapide au pavé — plus douce, plus sûre (Apple TV)

Branche du lot du 2026-10-01 soir (retours de l'essai sur l'Apple TV) :
l'avance au pavé allait beaucoup trop loin, un frôlement déplaçait la
lecture, et l'on ne savait pas quand le défilement se fermerait.

- **Les gains, en largeurs de pavé** (`hooks/scrubTouchTuning.ts`, le seul
  endroit à retoucher) : le pan de tvOS compte depuis le centre et borne la
  translation à ±1920 points — toute la largeur du pavé ≈ 1920 points
  (`PAD_WIDTH_PT`). Glisser LENT de toute la largeur (≤ 1 largeur/s) :
  1 min 30 (`SLOW_FULL_SWIPE_SECONDS`, 21 points par seconde de vidéo : la
  précision à la seconde) ; VIF (≥ 4 largeurs/s) : 6 min, le plafond
  (`FAST_FULL_SWIPE_SECONDS`) ; entre les deux, une montée douce. Plus de
  dépendance à la durée. Avant : 16 min (lent) et 65 min (vif) pour un
  glisser complet sur un épisode de 51 min.
- **Habillage CACHÉ : 600 ms de contact** (`HIDDEN_ENGAGE_HOLD_MS`) avant
  qu'un glisser défile, comptées depuis le début du glisser (tvOS ne signale
  pas un doigt posé immobile), sans rattraper la course d'avant ni
  d'exception pour un geste franc ; un toucher plus bref réveille
  l'habillage. Habillage AFFICHÉ : inchangé — 60 points, 180 ms ou geste
  franc ; en pause, l'habillage masqué par Retour compte pour caché. Défilement déjà ouvert : le doigt reprend dès 12 points
  (`canEngage`, régime lu par `readTouchMode`).
- **Le décompte** (`hooks/scrubCountdown.ts`, pur ; `useScrubCountdown`) —
  remplacé le 2026-10-03 par une règle unique (section suivante) :
  - glisser au pavé, ENTRÉ EN LECTURE : doigt levé ou immobile 450 ms, la
    lecture repart à la position VISÉE au bout de 3 s
    (`RESUME_COUNTDOWN_MS`) — « ▶ Lecture dans 3 s ». Doigt reposé ou
    maintien : il attend ; tout autre geste le relance ; cible inchangée :
    reprise sans seek. OK lit tout de suite, Retour annule ;
  - partout ailleurs (flèches, maintien, bouton, pavé ENTRÉ EN PAUSE) :
    l'abandon de la machine à 7 s, inchangé, dit pendant ses 3 dernières
    secondes — « Reprise à 12:34 dans 3 s » (entré en lecture), « Retour à
    12:34 dans 3 s » (en pause). La machine de tv-core ne change pas : ses
    réarmements sont rapportés au décompte au même instant
    (`reportingActivity`). Seul le pavé arme la reprise : Android TV (sans
    pavé) et la LG gardent leur comportement.
- **La vue** (`ScrubCountdown`) : pilule de verre « strong » au bas de la
  vignette visée, juste au-dessus du temps et de l'écart (sans vignette :
  au-dessus du temps), hors du flux de la bulle ; barre au dégradé de la
  marque qui se vide en `transform`, posée à la seconde en mouvement réduit.
  Libellé blanc à 5,3:1 sur la neige d'Interstellar (3,6:1 en « regular »).
  Clés `player:scrubPlayIn`, `scrubResumeAtIn`, `scrubReturnAtIn`.
- **Au banc** : `lecteur/decompte-*` (planches, FR/EN) ; `lecteur-vivant/
  lecture|pause` — les VRAIS contrôles sur une horloge factice, pilotés par
  CDP (`__livePan`, `__liveKey`, `__live()`, `__liveLog`). Injecter depuis un
  minuteur du runtime (une évaluation CDP directe passe hors de la boucle de
  RN : les rendus que React 19 range en microtâche n'arrivent pas) ; pour
  Retour, émettre `back` (`menu` dépile la scène du banc).

Éprouvé au banc (pans et touches injectés) : frôlement de 300 ms habillage
caché → rien ne défile, l'habillage se réveille ; glisser lent de 1,6 s →
engage à 0,6 s, +24,5 s, « Lecture dans 3, 2, 1 s », seek à la cible ;
habillage affiché → engage à 0,3 s, OK lit aussitôt ; Retour → annule, aucun
seek ; en pause → aucune reprise, « Retour à … dans 3 s » puis abandon en
pause ; maintien 2 s (+16:30) puis relâché → « Reprise à … » puis retour à
l'origine ; doigt reposé → décompte caché, puis 3 s entières.

À essayer sur l'Apple TV (l'utilisateur) : la sensation des gains (lent,
vif), les 600 ms habillage caché (frôlement, télécommande ramassée, glisser
voulu), le décompte et sa lisibilité ; retoucher `scrubTouchTuning.ts` si
besoin.

### Saut de 30 s et validation en 5 s (Apple TV, Android TV)

Retour de l'essai sur l'Apple TV (2026-10-02, soir) : le raccourci DROITE en
lecture doit sauter de 30 s, pas de 10 ; 3 s pour valider l'avance rapide,
c'est court ; le bouton et le raccourci doivent se comporter pareil.

- **Les sauts** (`hooks/seekTuning.ts`, leur seule source) : → +30 s
  (`SKIP_FORWARD_SECONDS`), ← −10 s (`SKIP_BACK_SECONDS`) — appui habillage
  caché, appui en défilement, touche média isolée, boutons « −10 s » /
  « +30 s » de l'habillage et leurs libellés, banc compris.
- **Une seule règle de validation** (`hooks/scrubCountdown.ts`, réécrit ;
  `RESUME_COUNTDOWN_MS` = 5 s dans `seekTuning.ts`) pour toutes les
  entrées — pavé, flèches (appui et maintien), boutons de saut, bouton
  « Déplacement », touches média :
  - un appui ←/→ ou un bouton de saut POSE la cible, le défilement s'ouvrant
    s'il ne l'est pas (`jump`) ; chaque appui suivant la déplace encore ;
  - entré EN LECTURE : « ▶ Lecture dans 5 s », puis la lecture repart à la
    cible. Tout geste relance les 5 s ; un geste continu (doigt posé,
    maintien) les tient, et elles repartent en entier à son relâcher ; cible
    inchangée : reprise sans seek ;
  - OK (ou ▶︎❙❙) lit aussitôt depuis la cible ; Retour annule, sans seek ;
  - entré EN PAUSE : ni décompte ni abandon — la cible attend OK ou Retour.
- **Plus d'abandon à 7 s** dans `apps/tv` : `createScrubMachine({
  idleCancelMs: null })`, option de tv-core (la LG garde ses 7 s par
  défaut). « Reprise / Retour à 12:34 dans 3 s » et leurs clés disparaissent.
- **Le badge des sauts** : le cerveau émet toujours `skipFlash` à chaque
  saut, cumulé comme avant (+30 → +60) — l'écran d'Android TV
  (`TVSkipBadge`) le garde tel quel ; l'habillage Apple TV ne l'affiche plus
  (`SeekFlash` retiré) : la vue du défilement dit déjà l'écart.
- **Deux gardes ajustées** : le « select » jumeau n'est plus absorbé
  qu'après une entrée par un BOUTON de l'habillage (l'OK qui suit de près une
  flèche valide) ; `showOverlay` ne fait rien pendant le défilement — les
  deux écrans rallument l'habillage juste après un bouton de saut, qui
  l'ouvre désormais.
- **Android TV** (cerveau partagé, non éprouvé ici) : même comportement,
  aucun écran retouché. À reprendre avec lui : sa vue plein écran du
  défilement (`TVScrubFullscreen`) n'affiche pas le décompte, et
  `TVPlayerOverlay` écrit « -10s » / « +30s » en dur.
- **webOS** : inchangé — son propre cerveau (`playerKeysTv.ts`, +30 / −10
  recopiés, l'abandon à 7 s de la machine).

Éprouvé au banc « lecteur vivant » — appuis RÉELS par l'agent XCUITest
(moteur de focus natif, `onPress` du bouton), relevés par CDP, planches dans
`apps/tv/harness/ui-bench/out/saut-30/` (ignorées par git). La scène monte
désormais le fond focalisable et les gestes de l'habillage de l'app. → en
lecture : cible +0:30, « Lecture dans 5, 4, 3, 2, 1 s », seek à la cible à
5,4 s ; OK sur le bouton « +30 s » : identique (seek à 5,1 s), habillage
éteint pendant le défilement ; ← : −0:10, seek à 5,3 s ; deux → à 0,9 s :
+1:00, badge +30 → +60, décompte relancé ; glisser lent : +0:21, décompte au
doigt levé, seek à 7,2 s ; maintien 2 s : +10:30, décompte au relâcher ; OK à
2 s : seek aussitôt ; Retour : aucun seek, la lecture repart du départ ; en
pause : aucun décompte, la cible attend 10 s, puis OK lit depuis elle ;
Retour en pause : la pause reste, au départ.

À essayer sur l'Apple TV : → et ← en lecture, le bouton « +30 s », un
glisser, OK puis Retour pendant le décompte, la même chose en pause ; après
« +30 s » et la reprise, le focus doit revenir sur le bouton (mémoire de
l'habillage, que le banc ne monte pas).

## Le lecteur — quitter et reprendre (Apple TV, Android TV)

Branche `refonte/tv-lecteur-reprise`. Demande de l'utilisateur (2026-10-01) :
une lecture se quitte en quittant l'app, et se reprend instantanément au
retour.

| On quitte… | Ce que fait le lecteur | Au retour (mesuré au simulateur) |
|---|---|---|
| Centre de contrôle, Siri, sélecteur d'apps (`inactive`) | pause, position remontée, session GARDÉE (plus d'arrêt ni de transcodage tué) | focus sur Lecture ; OK → lecture |
| Accueil, veille, autre app (`background`) | pause, arrêt à la position finale — noté dans la file avant l'envoi | lecteur en pause à la position exacte, focus sur Lecture ; OK → image en 100-280 ms (film et épisode PrismCore, épisode MP4, transcodage 720p ; 20 s comme 4 min d'absence) |
| … et le serveur local de PrismCore est mort pendant la suspension | — | sondé au retour (600 ms), relancé PENDANT la pause : nouvelle session en 0,7-2,8 s, puis OK → image en 140-280 ms, pistes conservées |
| App tuée pendant son absence | — | relance : la FICHE — celle de la série pour un épisode —, « Reprendre » focalisé à la position d'arrêt (marqueur) ; jamais le lecteur |
| App morte à l'écran, lecteur ouvert | — | relance : la file rejoue la position notée (≤ 2 s avant la mort), puis la FICHE (de la série pour un épisode), « Reprendre » focalisé |
| Lecteur quitté (Retour, Menu, fin) | arrêt en arrière-plan, sortie instantanée | relance : l'accueil |

- **La présence** : une règle partagée, `presenceStep` (tv-core
  `playback/appPresence`), exécutée par `useTVPlaybackPresence`. Le focus du
  retour est NOMMÉ (`playpause`) : sans cible, tvOS le posait sur « Reculer de
  10 s » et OK reculait.
- **La relance du flux** : `restartStream({ at?, reason })` →
  "ok" | "failed" | "busy" (`usePlayerStreamPipeline`, contrat
  `hooks/streamRestart.ts`) — même forme (PrismCore rouvert, jamais le cache ;
  chemin serveur rejoué, URL marquée en lecture directe), rechargement doux
  (`holdForReload`, image figée), jamais l'écran de chargement ni le
  transcodage forcé. Servie au retour (raison « resume ») et à la reprise après
  coupure (« network », session « serveur ou Jellyfin coupé »).
- **Un AVPlayer neuf par session PrismCore** (`AVPlayerSurface`) :
  react-native-video ne fait que remplacer l'item, et sur un master à audio
  PONTÉ (Opus → AAC) l'item de remplacement ne recevait plus aucun segment.
- **La file persistée des rapports** (api-client `playbackOutbox`, branchée
  par `TVPlaybackOutbox`) : la position en cours (`live`, à chaque bord et
  ≤ 2 s) et l'arrêt (`stop`, noté avant l'envoi). Vidée au démarrage, au retour
  au premier plan et au socket rouvert ; jamais pour un titre revu depuis, le
  titre en cours, un autre compte ou un autre appareil. Le Retour et la fin de
  lecture n'attendent plus l'arrêt (il retenait la sortie jusqu'à ~3 min
  serveur muet). Éprouvée en vraie panne par « serveur ou Jellyfin coupé ».
- **La relance à froid** : marqueur `tentacle_playback_marker` tenu par le
  lecteur (`useTVPlaybackMarker`), règle `coldStartLanding` (tv-core
  `playback/coldStart`, frais 3 h), atterrissage `TVColdStartLanding` — file
  d'abord, puis l'item lu, puis sa FICHE ; 401/403 → rien (le déjumelage prend
  la main), serveur muet → la fiche quand même. JAMAIS le lecteur (décision du
  2026-10-01, après l'essai sur l'Apple TV) : un titre qui pose problème ferait
  replanter l'app à chaque ouverture. Un film ouvre sa fiche, un épisode celle
  de sa SÉRIE (`coldStartDetailId` ; le marqueur porte `seriesId`, pour un
  serveur muet), poussée sur l'accueil : Retour y ramène. La fiche de la série
  s'ouvre sur la saison de la reprise, l'épisode calé à gauche de sa rangée.
  Marqueur et file sont des données du compte (`ACCOUNT_STORAGE_KEYS`).
- **La position de la relance** : celle que la file rejoue (≤ 2 s avant la
  mort) ; l'app tuée pendant son absence, l'arrêt du marqueur — exact, noté
  lecteur en pause — quand Jellyfin dit plus ancien (`markerStopToAdopt`, la
  date gagne ; jamais un marqueur écrit à l'écran, en retard de 30 s au plus).
  Pour un épisode, il atteint aussi « Reprendre S1 · E5 » de la série :
  `seriesResumeAfterStop` (tv-core) corrige l'état de visionnage relu, posé
  avant d'ouvrir la fiche (`settleSeriesResume`) — un autre épisode entamé
  APRÈS l'arrêt (un autre appareil) garde le verdict du serveur.
- **Mesuré au simulateur (2026-10-02, `simctl terminate` en pleine lecture)** :
  film PrismCore tué à l'écran à 8 min → sa fiche, « Reprendre » focalisé,
  « Reste 1 h 33 min » (la file a rejoué 494 s ; le marqueur, en retard, en
  disait 479) ; épisode S2E5 tué à l'écran, puis pendant son absence → la
  fiche de la série, « Reprendre S2 · E5 » focalisé, saison 2, E5 calé
  (une flèche bas y descend) ; Menu → l'accueil ; retour sans fermeture → le
  lecteur en pause, focus sur Lecture. Arrêt non écrit simulé (marqueur à
  600 s, Jellyfin à 340 s) → « Reprendre S2 · E5 » à 42 %, réécrit chez
  Jellyfin par la garde à +20 s.
- **Le flux attend la fiche complète** : résolu avant elle, il lançait un
  transcodage à 0:00 aussitôt jeté (deux sur un AV1, qui calait).
- **30 s d'avance** AVPlayer sur les sources distantes (bouclage : 10 s).

Pièges payés :

- Le simulateur ne SUSPEND pas l'app en arrière-plan (le JS et le serveur
  local répondent après 4 min) : la mort du bouclage s'éprouve en arrêtant la
  session (`PrismBridge.stop`) pendant l'absence.
- Un simulateur mis en veille (centre de contrôle → Éteindre) ne se réveille
  plus sans Simulator.app (« System is asleeping - foreground app launch
  forbidden ») : l'entrée en veille se mesure, le réveil vaut un retour
  d'arrière-plan.
- Interstellar est lu par d'autres sessions sur Knaoxtest : ses positions
  bougent seules. Mesurer sur un titre que personne n'utilise.
- `holdForReload` n'était plus appelé : l'image figée d'un rechargement doux
  s'effaçait aussitôt. La relance l'utilise, et fait ignorer la progression du
  flux sortant.

### Essais sur l'Apple TV (tâche d'appareil, pas « Chambre »)

1. **Bouclage après une vraie suspension (E)** : film PrismCore, Accueil,
   2 min puis 30 min d'absence, retour. Metro : `[presence] retour : flux local
   vivant` ou `MORT → relance` ; OK doit reprendre en moins d'une seconde, à la
   seconde près, pistes intactes. Refaire avec un titre à audio ponté (DTS,
   TrueHD, Opus).
2. **Tampon du bouclage à 30 s** : remux 4K à 60-80 Mb/s, mémoire de l'app
   (Instruments) à 10 s puis 30 s d'avance ; étendre seulement si elle tient.
3. **Veille réelle** : centre de contrôle → Éteindre en pleine lecture,
   réveil après 1 min et après 1 h : lecteur en pause à la position (ou
   relance à froid si tvOS a tué l'app : la fiche).
4. **App tuée par tvOS** : lecture, Accueil, ouvrir des apps lourdes jusqu'à
   ce que Tentacle soit tuée, rouvrir : la fiche (celle de la série pour un
   épisode), « Reprendre » focalisé à la position ; Retour → l'accueil.
5. **Serveur coupé au démarrage** : couper le backend Tentacle (JAMAIS le
   Jellyfin partagé avec la prod), tuer l'app pendant une lecture, la rouvrir :
   la fiche, jamais un lecteur vide ; au retour du serveur, la file se vide.
6. **Android TV** (rien n'y est éprouvé) : Accueil puis retour (Lecture
   focalisé, reprise), app tuée puis relancée (la fiche, jamais le lecteur),
   Retour instantané, flux résolu après la fiche (plus de double démarrage
   MPV/ExoPlayer).

## Le lecteur — serveur ou Jellyfin coupé (Apple TV, Android TV)

Branche `refonte/tv-lecteur-hors-service` (2026-10-01). Demande de
l'utilisateur : si Tentacle ou Jellyfin ne répond plus, la lecture continue
sur ce qui est chargé, et le message du lecteur est un OUTIL, pas un
avertissement. Mesuré au simulateur avec des relais À MOI coupables à volonté
(devant le backend de dev et devant Jellyfin — jamais les vrais services) ;
streaming direct actif (vidéo et rapports vont droit à Jellyfin) sauf mention.

| Cas | Avant | Maintenant |
|---|---|---|
| Tentacle coupé, flux direct | le film continue, mais le voile « Oups, le serveur fait une pause ! » le RECOUVRE dès qu'une requête échoue (22 s mesurées), focus piégé, Menu quitte l'app | le film continue sans voile ; bandeau « Le serveur Tentacle ne répond plus — la lecture n'en dépend pas » 8 s (puis avec l'habillage) ; voile à la sortie du lecteur si la panne dure |
| Tentacle coupé, flux par le proxy | gel définitif | ~35 s sur ce qui est chargé, bandeau à compte à rebours, panneau, reprise seule 11 s après le retour |
| Jellyfin coupé, lecture directe (PrismCore) | ~45 s, puis gel définitif sur un indicateur — même après 70 s de coupure seulement | bandeau « encore 10 s chargées », panneau, reprise seule 4 s après le retour |
| Jellyfin coupé, transcodage | ~8 s, erreur -1004 en bandeau brut 8 s, gel définitif | ~31 s (30 s d'avance AVPlayer), erreur prise en charge, reprise seule 5 s après |
| Les deux coupés, épisode | gel, puis « Impossible de démarrer la lecture » plein écran, transcodage FORCÉ | panneau, reprise seule 6 s après, même forme |
| Saut de 5 min hors de ce qui est chargé, Jellyfin coupé | gel définitif, aucune erreur | attente dite en 5 s, reprise au point visé 4 s après le retour |
| Jellyfin coupé AVANT la lecture | « Vérifie le serveur ou réessaie », rien au retour | « Jellyfin ne répond pas. La lecture démarrera d'elle-même dès son retour. » — repart seule, à la bonne reprise |
| Tentacle coupé AVANT la lecture, flux direct, ouverture depuis l'accueil (Lovely Bones, reprise à 1:23) | 14,7 s d'attente, puis TRANSCODAGE depuis 0:00, sans pistes | lecture DIRECTE (PrismCore) à 1:23 en ~2,5 s — fiche du cache, ou lue en direct chez Jellyfin quand le cache n'a rien de jouable (55 ms) |
| Même chose en mode proxy (aucun jeton Jellyfin) | 14 s, puis échec | échec dit en ~2 s (« Tentacle ne répond pas »), puis reprise seule à 1:23 au retour de Tentacle |

- **La décision** est pure et commune (`decideRecovery`, tv-core
  `player/playbackRecovery`, 19 tests) : rien à dire tant que tout répond ;
  `degraded` quand un serveur manque mais que la lecture avance ; `waiting` à
  l'arrêt (4 s de grâce) ; relance dès que le chemin du flux répond ; `stuck`
  après deux relances vaines serveur joignable (« Baisser la qualité »).
- **Le crochet** `usePlaybackRecovery` est monté PAR le gestionnaire
  d'erreurs (`useTVErrorHandler`, aucune ligne de plus dans PlayerScreen) :
  toute erreur après le démarrage lui est confiée d'abord
  (`onSourceLost`) — ni de format, ni d'authentification. Il sonde le chemin
  du flux (`System/Info/Public`, Jellyfin en direct ou par le proxy : pas de
  réponse du proxy = Tentacle, 502 = Jellyfin), seulement en incident ou
  quand ce qui est chargé fond (au plus toutes les 30 s), et relance par
  `restartStream({ reason: "network" })`. L'ouverture ratée :
  `useStartupRecovery` (fiche relue, puis ouverture).
- **L'outil** (`PlaybackTrouble`, câblage `usePlaybackTrouble`) : bandeau en
  haut, jamais focalisable ; panneau au centre quand la lecture est arrêtée.
  Le panneau PARAÎT sans prendre le focus ; le premier appui l'ACTIVE
  (focus sur « Réessayer maintenant », sans déclencher d'action), l'habillage
  recule et la croix Retour paraît à sa place, en haut à gauche — elle
  referme le lecteur. Le groupe `trouble:screen` retient le focus sur tout
  l'écran, croix comprise (`ScreenTrap`, entrée « Réessayer maintenant »,
  sans `autoFocus`) ; la croix reste infocalisable tant que l'entrée n'a pas
  eu le focus (`useExitLocked`). Rien n'est aligné entre la croix et le
  panneau centré : un pont (`trouble:bridge`, toute la largeur entre eux, à
  sens lu sur le focus comme la frise) fait monter du panneau à la croix et
  redescendre de la croix à l'entrée — mesuré à l'agent XCUITest, HAUT ne
  menait nulle part sans lui. La restauration de l'habillage cède à la
  réclamation (`noteSkipFocusClaim`). Il part sans sortie jouée et rend le
  focus (habillage, sinon le fond).
- **La fiche du lecteur** (`usePlayerItem`, règles pures dans tv-core
  `player/playerItemFallback`) : celle du serveur, comme partout. Si elle
  tarde 1,5 s (tout de suite si Tentacle est déjà tenu pour hors ligne, ou
  si la requête a échoué) et qu'une sonde dit Tentacle muet
  (`tentacleAnswers`, n'importe quelle réponse du proxy suffit) : la version
  JOUABLE la plus fraîche du cache (rangées de l'accueil, épisodes, Ma
  liste — `findCachedMediaItem` rend la plus récente : le héros de
  l'accueil gardait une reprise périmée), sinon la fiche lue EN DIRECT chez
  Jellyfin (`fetchItemDirect`, jeton de l'appareil, forme documentée
  `/Items/{id}?userId=`, mêmes champs que `useMediaItem` —
  `MEDIA_ITEM_FIELDS`). Mode proxy : pas de lecture directe possible, le
  cache seul, sinon le comportement d'avant. Le serveur revenu, sa fiche
  reprend la main sans rouvrir le flux (même titre, même source). Pendant
  la panne, les pistes du fichier sont toutes là (menus complets) et le
  lecteur part sur sa piste PAR DÉFAUT : les préférences de langue (VFF, VO
  par bibliothèque) se résolvent sur Tentacle — elles ne s'appliquent pas en
  retard au milieu de la lecture.
- **La sortie audio passagèrement indisponible** (-66681,
  `kAudioQueueErr_CannotStart`, et sa famille : sortie changée, serveur
  audio ou services média redémarrés — HDMI, AirPlay, ampli rallumé) n'est
  plus prise pour un master refusé. Avant : forme muxée, puis TRANSCODAGE
  (relevé au simulateur par « Alléger » : la forme muxée ouverte 1 s après
  l'erreur a échoué à son tour, le périphérique étant encore absent). La
  règle est pure (`classifyAvPlayerError`, tv-core — code ET texte :
  AVFoundation enrobe parfois l'OSStatus dans un -11800) ; la surface en
  fait le marqueur `AUDIO_TRANSIENT`, et `useAudioErrorRetry` rejoue la
  MÊME forme (`restartStream`, raison `audio`) après 1,5 s, 4 s, 8 s, le
  lecteur tenu en rechargement pendant l'attente — à la position, ou à la
  reprise prévue avant la première image. Au-delà, le bandeau le dit
  (`player:audioOutputLostPlay`) — une autre forme ne rendrait pas la
  sortie — et propose le bon geste : l'appui sur Lecture (une bascule de
  `paused`, télécommande ou habillage, l'app au premier plan) relance le
  flux à la position, budget neuf. Mesuré (erreur injectée dans le vrai
  lecteur) : relance PrismCore à la même position en 1,5 s ; budget épuisé,
  lecteur figé → le message ; Lecture → relance à la position, bandeau
  effacé, la lecture repart.
- **Le producteur de PrismCore mort** : AVPlayer ne le dit jamais (il
  relance ses segments sans fin — mesuré par « calage »). Sur un arrêt du
  flux local, passé la grâce de 4 s, la reprise lit son état
  (`prismStatus(gen)`, `PrismBridge.status`) : mort (`failed`) → une relance
  NEUVE (`restartStream`, raison `remux`) ; remort au même endroit (moins de
  30 s de la mort précédente) → le chemin serveur à la position
  (transcodage forcé) et un bandeau honnête (« La lecture passe par le
  serveur — la lecture directe calait à ce passage »,
  `player:troubleServerTakesOver*`, hors de l'état de la reprise que
  l'ouverture du flux serveur remet à zéro). Vivant (source coupée, il
  réessaie) ou inconnu (session stoppée) : rien, c'est l'affaire de la
  sonde. Règle pure : `producerDeath` (tv-core, 7 tests). Éprouvé par une
  mort INJECTÉE (aucun titre connu ne la provoque) : relance neuve à
  207 s, la lecture reprend ; remort à 195 s → transcodage à 193 s, bandeau.
- **Le voile hors ligne** ne se pose plus sur `Player`, `PlayerSettings`,
  `Trailer` (App.tsx) ; la joignabilité confirmée se lit partout
  (`hooks/serverReachability`).
- Au banc : `bench:ui planche lecteur/panne --focus` (huit états).

Pièges payés :

- Le producteur de PrismCore MEURT à la première connexion refusée : FFmpeg
  ne retente pas un refus (`reconnect_on_network_error` éteint) et rien ne le
  relance — d'où la relance du flux, seule issue.
- Une erreur AVPlayer après le démarrage partait en « master refusé » →
  forme muxée → transcodage FORCÉ pour tout le titre (HDR perdu au retour).
- `fetchStreamingConfig` rendait « désactivé » sur une panne, et un
  PlaybackInfo direct en échec réseau verrouillait le direct pour TOUTE la
  session (`signalDirectBlocked`, pensé pour le CORS) : au retour, tout
  passait par le proxy jusqu'au redémarrage. Les deux corrigés dans
  api-client (une panne n'est pas un réglage).
- `useServerReachable` : un échec isolé laissait la série ouverte à vie ; une
  sonde de confirmation la conclut désormais.
- Le délai laissé au flux relancé part de son ÉMISSION : par le proxy,
  rouvrir PrismCore prend 5 s.
- Mon relais devant Jellyfin écoutait `127.0.0.1` : `AVPlayerSurface` prend
  toute URL `http://127.0.0.1` pour le bouclage de PrismCore. Viser
  `localhost`.

- L'app TV tourne en ANCIENNE architecture (racine non concurrente) : deux
  `setState` après un `await` ne sont PAS groupés. Le repli vers le serveur
  (`captureReloadTicks` puis `setForceTranscode`) rouvrait d'abord la
  session PrismCore en cache, morte, avant le transcodage : groupés par
  `unstable_batchedUpdates`.

**Décision — la config du direct n'est PAS persistée** (démarrage à froid
avec Tentacle coupé). Mesuré : l'accueil revient du cache persisté, la
config du direct manque ; ouvrir « Reprendre » donne en 0,5 s « Le serveur
Tentacle ne répond pas. La lecture démarrera d'elle-même dès son retour. »,
et la lecture part seule, à la bonne reprise, au retour de Tentacle. Ne pas
la réintroduire :
1. elle a existé (`tentacle_jellyfin_token`, `tentacle_jellyfin_url`) et a
   été retirée pour un jeton ou une URL d'un ANCIEN jumelage qui envoyait la
   lecture au mauvais serveur, ou avec un jeton mort (`DirectStreamingSync`) ;
2. « jamais un accès qui survit à une révocation » serait intenable :
   Tentacle coupé, la TV ne peut pas apprendre sa révocation ; seul le refus
   de Jellyfin la protège, et seulement si la révocation du jeton Jellyfin a
   abouti — persister étend la fenêtre à travers les redémarrages ;
3. le cas est rare (Tentacle coupé ET Jellyfin joignable AU LANCEMENT ; sur
   un même hôte, les deux tombent ensemble), et le voile hors ligne bloque
   de toute façon la navigation après une douzaine de secondes — le rendre
   jouable serait une décision de produit.

Reste : Android TV — logique commune (reprise seule, fiche du lecteur,
producteur sans objet), rien d'éprouvé ; son habillage garde son indicateur
(pas d'outil).

## Le lecteur natif — AVPlayer sans PrismCore (Apple TV)

Branche `refonte/tv-lecteur-natif` (2026-10-01). Demande de l'utilisateur :
avant son essai sur l'Apple TV, vérifier que le lecteur NATIF marche de bout
en bout — AVPlayer en lecture directe d'un fichier qu'il lit tel quel, et
AVPlayer sur le HLS préparé par Jellyfin (transcodage ou remux du serveur).
Banc : clone « Tentacle TV — natif (Claude) », compte Knaoxtest par jeton
d'appareil, Metro et relais À MOI (devant le backend de dev et devant le
Jellyfin partagé, jamais les vrais services coupés), CDP Hermes et agent
XCUITest. Jellyfin réel : 12.1.0.

| Parcours (film ET épisode) | Verdict |
|---|---|
| 1. Démarrage depuis la fiche, « Reprendre », la carte 16:9 — position, langues préférées | OK ; image en 1,6 s depuis une reprise (MOV HEVC 1080p) |
| … un MP4 HEVC étiqueté `hev1` (« On l'appelait Robin des Bois ») | CORRIGÉ — image NOIRE, son seul, aucune erreur ; passe par PrismCore |
| 2. Avance rapide : ±10 s, maintien, glisser, vignettes, OK, Menu, saut hors du tampon | OK ; saut hors tampon : image en 1,4 s (directe) |
| 3. Pistes audio et sous-titres en cours de lecture (texte en surimpression), croix des pistes | OK |
| 4. Passage d'intro et pilule, épisode suivant, affiche de fin et sa croix | OK |
| 5. Accueil puis retour, centre de contrôle | OK |
| … app tuée puis relancée | CORRIGÉ — l'écran d'ouverture restait sans fin ; relance en arrière quand Jellyfin perdait l'arrêt d'arrière-plan |
| 6. Rapports à Jellyfin : début, progression, arrêt, position vue ailleurs | CORRIGÉ — la fiche montrait « Lecture » ou repartait à 0:00 juste après la sortie (écritures de 12.1 en retard ou perdues) ; 400 du proxy sur « vu et à reprendre » |
| … une ouverture ratée ou quittée avant la première image | CORRIGÉ — elle effaçait la reprise (Lucifer S4E1 : 35:39 perdues) |
| … la file des rapports, serveur coupé | OK |
| 7. Flux refusé à l'ouverture | CORRIGÉ — chargement sans fin ; maintenant l'échec en 30 s, avec Réessayer |
| … erreur audio passagère, coupure du serveur en lecture (message-outil, reprise seule) | OK |
| 8. Transcodage (AV1) : « Baisser la qualité », reprise après coupure, sous-titres incrustés (PGS de Shelter, `SubtitleMethod=Encode`) | OK |
| HDR, Dolby Vision, Atmos, passthrough AC3/EAC3 | APPAREIL SEULEMENT |

Correctifs, dans l'ordre de la branche :
- **`hev1` → PrismCore** : `prismEligible` envoie à PrismCore tout HEVC dont
  l'étiquette n'est pas `hvc1`/`dvh1` (`hevcTagUnreadable`, shared) ; le
  profil tvOS exige l'étiquette (`avPlayerHevcTagCondition`, `IsRequired:
  true` — au pire un remux du serveur, vidéo copiée, jamais un réencodage).
- **La règle d'arrêt partagée** (web, bureau, mobile, TV — le web part avec
  le serveur) : `projectStop` calcule ce que Jellyfin écrira (MinResumePct 5,
  MaxResumePct lu, 300 s minimum) ; la fiche et les listes le montrent dès la
  sortie ; la garde des arrêts récents (2 min) re-patche toute relecture PLUS
  ANCIENNE que l'arrêt — LA DATE GAGNE : une lecture commencée depuis, ici ou
  ailleurs, fait tomber la garde ; une seule réparation à +20 s
  (lecture-modification-écriture), seulement si le désaccord tient, que sa
  date reste antérieure et que le titre ne joue pas. Défendu : entre 10 % et
  MaxResumePct − 5 points, titre ≥ 10 min.
- **Relance à froid** : le marqueur porte la position de l'arrêt ; adoptée si
  Jellyfin dit plus ancien (mesuré : arrêt d'arrière-plan accusé à 106 s,
  reprise restée à 89,8 s) — sur la fiche rouverte, jusque dans l'état de
  visionnage de la série pour un épisode.
- **Avant la première image**, rien ne s'écrit à 0 : début et arrêt partent
  de la position d'ouverture.
- **Flux refusé** : l'ouverture ratée tombe en échec (`openFailed`), avec
  Réessayer focalisé ; Réessayer relance le flux.

### Jellyfin 12.1 et nos arrêts (mesuré)

L'arrêt est accusé (2xx), puis écrit 4 à 60 s plus tard — ou jamais :
l'état final est alors l'instantané du DERNIER début. Cas relevés : Robin
2411 s, arrêt d'arrière-plan 106 s (resté à 89,8), Lucifer S1E13 680 s
(réparé par la garde, sans simulation), Shelter 640 s (écrit une minute plus
tard ; entre-temps la relecture disait 0:18 — sous la bande défendue, à
9,9 %). Limite assumée : un titre absent d'une réponse (« Reprendre » au
premier visionnage, rien encore écrit) n'y est pas inséré.

### Étiquettes HEVC sous 12.1 (mesuré)

Un 12.1.0 neuf ne renseigne plus `CodecTag` (session hev1). Le Jellyfin réel
le garde pour les fichiers scannés avant la migration : sur 7 857 titres
(Knaoxtest), 7 813 MKV — PrismCore de toute façon, par le conteneur —,
28 MP4/MOV dont 16 HEVC : 14 `hvc1`, 1 `hev1`, 1 sans étiquette (Undead
Unluck S0E1, un VRAI `hvc1` lu dans `stsd`). Sans étiquette, un hvc1 part
donc en PrismCore. A/B sur Lucifer S1E1 (MOV HEVC 10 bits `hvc1`, reprise à
1251 s puis saut à 2000 s, deux passes) :

| | Directe | PrismCore |
|---|---|---|
| Première image | 1615 / 1645 ms | 1937 / 1638 ms |
| Image après le saut | 1418 / 1378 ms | 1503 / 1643 ms |
| CPU de l'app (simulateur, décodage logiciel) | 37,6 / 36,8 % | 34,1 / 35,1 % |
| Disque (tmp/PrismCore-*) | 0 | 59 Mio au plus, vidé à la sortie (plafond 1 Gio) |
| Lu chez Jellyfin en 95 s | 95,5 / 93,2 Mio | 107,7 / 102,2 Mio |
| Avance d'AVPlayer en fin d'essai | ~75 s | ~13 s (le reste sur disque) |

Verdict : acceptable, pas de parade. Piste, le jour où une actualisation
complète videra la colonne : lire l'étiquette dans `stsd` par requêtes de
plage — 3 à 5 requêtes, moov en fin de fichier compris (sauter le mdat, lire
les premiers Ko du moov) ; au moins trois allers-retours de plus à chaque
ouverture sans étiquette.

### Constats non corrigés

- Changer de piste PENDANT un saut encore en vol relance le flux à la
  position d'AVANT le saut (`restartStream` lit `positionRef`, pas la cible
  du saut en attente) — fenêtre de 1 à 3 s en transcodage.
- Reprendre la qualité déjà choisie recharge le flux pour rien.
- `getStreamUrl` envoie le DeviceId de la graine, pas l'identité adoptée : le
  transcodage n'apparaît pas sous la session de la TV au tableau de bord
  (l'arrêt le tue quand même, par PlaySessionId).
- Après une relance du flux, `hasStarted` vaut un instant vrai à 0:00 avant
  le saut à la reprise.
- Une coupure qui ne fait rien échouer n'affiche aucun bandeau ; le socket
  rouvre après ~30 s de recul, la file attend jusque-là.
- Avertissement de dev « Missing queryFn for ['watchlist'] » (invalidation
  `refetchType: "all"` des clés d'arrêt).

### Essais sur l'Apple TV (tâche d'appareil)

1. HDR10, Dolby Vision (badge, critères d'affichage) et Atmos, en directe et
   par le serveur.
2. Passthrough : Cauchemar en cuisine S10E1 (AC3), S16E4 (EAC3).
3. Robin des Bois (`hev1`) : image par PrismCore, et le CPU de PrismCore sur
   un `hvc1` sans étiquette (Undead Unluck S0E1) — décodage matériel, seul le
   remux compte.
4. Vraie suspension, veille : lecteur en pause, à la position ; app tuée par
   tvOS : relance à froid sur la fiche, « Reprendre » à la position (marqueur).
5. Glisser sur le pavé tactile : gains réels.
6. 4K : tampon de 30 s et mémoire.
7. En production : arrêts perdus par Jellyfin 12.1 — la fiche, puis
   `[reprise] arrêt à N s réécrit chez Jellyfin` dans Metro.

## Le lecteur — onglet Réglages et transcodage lent (Apple TV)

Branche `claude/serene-sammet-bf5a89` (2026-10-01/02). Retours d'essai de
l'utilisateur sur l'Apple TV : la qualité se cachait sous « Pistes » ; et
« connexion trop lente » paraissait quand le SERVEUR transcodait lentement
(serveur peu puissant, changement de qualité) — la vidéo ne venait jamais.

**L'onglet « Réglages »** (EN « Settings ») :
- « Pistes » ne garde que l'audio et les sous-titres ; la pilule « Réglages »,
  juste après, ouvre la même feuille (`PlayerSheet`, commune aux deux) : la
  qualité — « Original » et ses pastilles, les paliers et leur débit,
  « Auto » quand le plafond a choisi — et, à côté, « Comment choisir ». Tout
  ce qui n'est pas un choix de piste y prendra place.
- L'écran ne tient toujours qu'un état (`showSettings`, celui d'Android TV et
  de sa route modale, inchangée) ; l'onglet, c'est la pilule pressée
  (`usePlayerSheet`). Clés `player:settings` (transport `options`),
  `settings:quality:<clé>`, `settings:close` ; groupes `settings:panel`,
  `settings:back`.
- Focus : entrée sur le palier retenu, GAUCHE vers la croix par la marge,
  Retour → le focus revient à la pilule. Le Retour est la couche « menu » de
  la pile du lecteur (`usePlayerBackLayers`, l'état `showSettings`, commun aux
  deux onglets) ; à la fermeture — à la fin du fondu de la feuille —,
  `usePanelReturnFocus` rend le focus à la pilule de l'onglet ouvert
  (`usePlayerSheet` → `opener`), jamais à « Pistes » quand c'est « Réglages »
  qui a ouvert.
- Éprouvé dans l'app réelle (clone « Banc UI TV — qualité (Claude) », faux
  serveur) : focus sur « Réglages » → entrée sur « Original » → Retour (pile
  du lecteur) → feuille refermée, focus sur « Réglages », lecture continue.
  Au banc : `planche lecteur/reglages --focus`, `lecteur/osd-reglages`,
  `lecteur/pistes`, `lecteur/transcodage`.

**Transcodage lent ≠ connexion lente** :

| Situation | Avant | Maintenant |
|---|---|---|
| Ouverture d'un transcodage lent | écran sans un mot ; sans premier segment au bout de ~40 s, AVPlayer abandonne l'élément (-12889) → « Impossible de démarrer » | dès 6 s, « Le transcodage peut prendre un peu plus de temps » ; la même session rechargée ; l'échec seulement après 2 min sans AUCUNE donnée (« aucune image n'est arrivée depuis deux minutes », Réessayer) |
| Arrêt en lecture, changement de qualité | « La vidéo arrive trop lentement », puis une session NEUVE à 12 s : le serveur repartait de zéro pendant que l'ancienne tournait encore — la vidéo ne venait jamais | la ligne discrète sous l'indicateur, jamais bloquante ; jamais de session neuve ; après 30 s sans données, la MÊME session rechargée ; 2 min sans rien → « Le transcodage n'avance plus » (Réessayer, Baisser la qualité) |
| Réseau MESURÉ sous le besoin du flux | — (la mesure était fausse, ci-dessous) | « La connexion est trop lente — réseau mesuré à X Mb/s : cette qualité en demande Y Mb/s », sans relance (elle n'y changerait rien) |
| Lecture directe qui cale, serveur joignable | « La vidéo arrive trop lentement » | « La vidéo se fait attendre », nouvel essai automatique (comme avant) |

- Les règles sont pures et communes (tv-core, testées) : `decideRecovery`
  (phase `transcoding`, causes `transcode`, `stall`, `slow` ;
  `NO_PROGRESS_MS`, `nudge` / `NUDGE_AFTER_MS`), `decideStartupWait`,
  `networkShortfall`, `isSegmentTimeout`. Exécutées par `usePlaybackRecovery`,
  `useStartupWait` et `useTranscodeReload`, le seul rechargeur :
  `restartStream({ keepSession: true, hold: false })` — même PlaySessionId,
  une marque de relance neuve, sans pause de rechargement.
- **Les données qui arrivent** se lisent chez AVPlayer : la sonde native
  `TentaclePlayerProbe` (lecture seule ; le `_player` de la vue
  react-native-video, la couche en repli) rend les octets reçus, la mémoire
  chargée et l'état d'AVPlayer. Sans elle (Android TV, natif plus ancien) :
  la position et la mémoire vues en lecture.

Mesuré au banc factice (faux Tentacle + faux Jellyfin, HLS généré localement,
« encodeur » à vitesse réglable — `apps/tv/harness/slow-transcode/`) :
- AVPlayer abandonne une requête de segment au bout de ~6 s (la durée cible)
  et la redemande ; sans premier segment au bout de ~40 s, -12889 ;
- plus lent que le temps réel, il ne démarre qu'avec ~36 s de vidéo en
  mémoire (`automaticallyWaitsToMinimizeStalling`, 30 s d'avance) : 80 s
  d'ouverture à ×0,6, sans le moindre signal au JS — d'où la sonde ;
- après un rechargement, il abandonne un segment lent UNE fois et ne le
  redemande plus — aucune erreur, « ToMinimizeStalls » sans fin, le serveur
  ayant produit la suite : d'où la relance douce à 30 s ;
- tenu en pause pendant un rechargement, il cesse de remplir sa mémoire après
  deux segments : d'où `hold: false` ;
- avec tout cela, à ×0,3 : première image à 2 min 23 sans échec ; en lecture,
  arrêts dits par la ligne discrète, reprises après relance douce, une seule
  session serveur de bout en bout ; transcodage mort : l'échec à 2 min.

**Le piège du `fetch` de React Native** : il ne se résout qu'une fois le corps
ENTIER reçu (4,9 s pour 3 Mo à 5 Mb/s, puis 0,2 s de conversion). La mesure
de débit chronométrée « à l'arrivée des en-têtes » ne voyait que la
conversion — « 115 Mb/s » sur tout réseau, un chiffre bas sur un appareil
lent : le plafond automatique de la TV décidait sur la vitesse du processeur.
Corrigé en OPT-IN (`bufferedFetch`, api-client : de la requête à la réponse
entière, moins la latence de deux petites requêtes), activé par la TV seule
(`TV_BITRATE_MEASURE`) : 5,02 Mb/s mesurés pour un témoin bridé à 5 Mb/s.

**Le piège du `project.pbxproj` partagé** : deux branches du lot avaient pris
les mêmes identifiants (`…A101`, `…A102`) pour deux fichiers natifs
différents (la sonde, `TentacleFocusSection.m`), chacun unique dans sa
branche. La fusion passe sans conflit ; Xcode ne garde qu'un des deux objets,
et l'autre sort du build en silence (« Removed stale file … .o »). Après une
fusion qui touche au projet, aucune définition ne doit sortir en double :

```bash
grep -E '^\s+[0-9A-F]{24} (/\*[^*]*\*/ )?= \{' apps/tv/ios/TentacleTV.xcodeproj/project.pbxproj | grep -oE '^\s+[0-9A-F]{24}' | sort | uniq -d
```

Et un fichier natif neuf prend des identifiants hors de la série
`AB12CD34EF5601234567…`, que chaque session prolonge.

### Constats non corrigés

- ~~react-native-video n'applique la position de départ qu'à `readyToPlay`~~ —
  corrigé (patch natif) : « Le lecteur — reprise après l'arrière-plan »,
  plus bas.
- Le mobile garde la mesure fausse (même `fetch`) : tâche à part.
- « Réessayer » après « Le transcodage n'avance plus » ouvre une session
  neuve (voulu : l'ancienne n'a rien produit en deux minutes).

### Essais sur l'Apple TV (tâche d'appareil)

1. Réglages : la pilule après « Pistes », la qualité changée, Menu referme et
   rend le focus à « Réglages » ; « Pistes » sans qualité.
2. Serveur peu puissant : un titre en 720p (transcodage), puis un changement
   de qualité en pleine lecture — la ligne discrète, jamais de panneau ni
   d'échec tant que ça avance ; Metro : `[recover] transcodage : … même
   session rechargée`, jamais deux sessions au tableau de bord de Jellyfin.
3. La mesure : `[cap] debit mesure N Mb/s` doit suivre le réseau réel
   (Wi-Fi, Ethernet) ; sur un réseau rapide, plus de « qualité réduite » ni
   de « La connexion est trop lente ».

## Le lecteur — reprise après l'arrière-plan, temps restant, portion chargée (Apple TV)

Tâche T1 du lot du 2026-10-02. Retours de l'essai : « si je quitte ma
lecture en sortant de l'app et que je reviens dessus, après quelques minutes
la lecture charge et ma TV n'arrive plus à seek » ; à droite de la frise, le
temps restant plutôt que la durée ; « je ne vois pas la barre de
préchargement ».

**La cause du blocage.** L'essai avait lieu sur l'Apple TV « Chambre », avec
une build du 2026-10-01 après-midi qui relançait à froid DIRECTEMENT dans le
lecteur, en pause. tvOS ayant tué l'app pendant l'absence, le retour ouvrait
un lecteur en pause qui n'émettait aucune progression : écran de chargement
sans fin, recherche sans effet. La tête ouvre la FICHE (« quitter et
reprendre », plus haut) — éprouvé au simulateur : lu jusqu'à 648 s, Accueil,
app tuée 30 s plus tard, relance → « arrêt du marqueur (648 s) préféré »,
fiche de la série, « Reprendre S2 · E3 » focalisé, lecture à 647 s, glisser
→ la cible.

**Le chemin chaud** (app suspendue puis revenue) : cinq défauts, trouvés en
recréant les conditions de l'appareil au simulateur, corrigés à la source.

| Défaut | Correctif |
|---|---|
| Une recherche faite PENDANT une réouverture du flux (bouclage mort au retour, relance après coupure) était perdue : la source rouverte repartait de la position d'avant, puis react-native-video recouvrait le saut par la position de départ. Mesuré : OK pendant la réouverture → lecture à 931 s, la cible perdue. | La relance prend la recherche pour cible (`useStreamRestart.noteSeek`) et lit la position à l'émission de l'URL (contrat `RestartAt`) ; la surface rejoue au chargement une recherche faite avant que sa source soit prête ; pendant un rechargement, la fenêtre de convergence d'un saut attend la source qui arrive. Même geste après : 1003 s, la cible. |
| Au retour, seul le SERVEUR de bouclage de PrismCore était sondé ; une playlist VOD est servie même producteur mort — AVPlayer redemandait ses segments sans fin, et toute recherche visait un segment que plus rien ne fabriquait. | Le retour lit aussi le producteur (`PrismBridge.status`) : mort, ou session close → relance pendant la pause (0,3 s mesurées, producteur déclaré mort par injection). |
| La sonde du bouclage concluait « mort » au-delà de 600 ms : sous charge, une réouverture pour rien, indicateur à l'écran. | Un bouclage mort refuse aussitôt la connexion ; un délai dépassé a une seconde chance (2,4 s). |
| Une relance par le serveur (PlaySessionId neuf) laissait tourner l'encodage de la session remplacée une minute : une session fantôme chez Jellyfin. | Arrêté (`DELETE /Videos/ActiveEncodings`) 3 s après l'émission de la nouvelle URL — mesuré sur Ted 2 : « ffmpeg tué », lecture reprise. |
| react-native-video ne posait la position de départ qu'à `readyToPlay` : AVPlayer chargeait depuis 0:00, et l'encodeur du serveur démarrait deux fois à chaque ouverture à une position (reprise, réouverture, qualité). | Patch natif (`patches/react-native-video@6.19.0.patch`) : la position est cherchée sur l'élément AVANT de le confier au lecteur. Banc du transcodage lent, reprise à 5:00 : avant, segments 0 puis 50 (premier segment utile à +4,7 s) ; après, 50 d'emblée (+2,25 s). |

**La matrice de preuves** — tête rebasée sur `refonte/tv-ui` (58408a131),
build Debug de la branche, simulateur à soi, compte Knaoxtest. Chaque cas :
45 s de lecture, Accueil, l'app GELÉE (`kill -STOP`) pendant l'absence comme
tvOS la suspend — au-delà de 5 min, le bouclage PrismCore repris
(`PrismBridge.stop`) comme tvOS reprend son socket —, dégel, puis glisser et
OK dans la PREMIÈRE seconde du retour. « Reprise après OK » : médiane des
relevés à la seconde (± 1 s). Lectures : `/Sessions` lu 20 s après, filtré
sur le DeviceId de l'appareil.

| Chemin | Absence | Quitté à | Au retour | Flux au retour | Glisser + OK dès le retour | Reprise après OK | Lectures Jellyfin de l'appareil |
|---|---|---|---|---|---|---|---|
| PrismCore (remux local) | 30 s | 18:36 | en pause, 18:37 | vivant | cible 19:05 honorée | < 1 s | 1 (DirectPlay) |
| Lecture directe | 30 s | 8:54 | en pause, 8:56 | sans objet | cible 9:25 honorée | < 1 s | 1 (DirectPlay) |
| Transcodage HLS | 30 s | 15:41 | en pause, 15:42 | sans objet | cible 16:10 honorée | < 1 s | 1 (Transcode) |
| PrismCore (remux local) | 6 min | 20:19 | en pause, 20:20 | MORT → relancé, à la cible 20:40 | cible 20:40 honorée | ≈ 2 s | 1 (DirectPlay) |
| Lecture directe | 6 min | 10:38 | en pause, 10:39 | sans objet | cible 11:07 honorée | < 1 s | 1 (DirectPlay) |
| Transcodage HLS | 6 min | 17:24 | en pause, 17:25 | sans objet | cible 17:54 honorée | ≈ 1 s | 1 (Transcode) |
| PrismCore (remux local) | 20 min | 21:54 | en pause, 21:55 | MORT → relancé, à la cible 22:23 | cible 22:23 honorée | ≈ 2 s | 1 (DirectPlay) |
| Lecture directe | 20 min | 12:21 | en pause, 12:22 | sans objet | cible 12:36 honorée | < 1 s | 1 (DirectPlay) |
| Transcodage HLS | 20 min | 19:06 | en pause, 19:07 | sans objet | cible 19:36 honorée | ≈ 2 s | 1 (Transcode) |

PrismCore lit sa source en lecture directe chez Jellyfin (« DirectPlay »).
En transcodage, la même PlaySessionId du départ au retour, même après
20 min : ni session neuve, ni fantôme. Le chemin froid (app tuée par tvOS
pendant l'absence) est plus haut, « La cause du blocage » : la fiche,
« Reprendre » à la position, recherche honorée.

**Le temps restant** (`formatRemaining`, `redesign/screens/player/formatClock.ts`) :
à droite de la frise, « −12:34 », « −1:02:15 », au signe moins typographique,
en secondes entières comme l'écoulé (écoulé + restant = durée) ; en
défilement et pendant le décompte avant reprise, celui de la cible visée.
Durée inconnue : rien. L'habillage d'Android TV garde la durée. Planche :
`apps/tv/harness/ui-bench/out/planche-temps-restant.png` (lecture, avance
×4, décompte « Lecture dans 3 s », décompte en pause).

**La portion chargée et la tête de lecture** (`OsdTimeline`) : la fin de la
plage chargée qui contient la position (react-native-video, à la seconde) —
déjà dessinée, mais en blanc 40 % sur une piste à 28 %, et cachée sous une
pastille de 26 points (±65 s d'un film de 2 h). Elle passe à 60 % (≈ 3:1
contre la piste), l'écart visé d'un défilement à 90 %, et la pastille devient
une tête de lecture FINE, comme le lecteur d'Apple : un trait blanc de
4 × 24 points dont le bord droit est la position — le chargé commence au
point qui suit. En défilement et pendant le décompte, la cible est le même
trait, plus haut (40 points), au rose de la marque. Les avances ne changent
pas : sur un film de 2 h, 1 min 30 de lecture directe font 19 points, 30 s
de transcodage 6, 10 s de PrismCore 2. Mesuré dans l'app (tête rebasée,
simulateur) : 69 s chargées en lecture directe (Lucifer S1 E3), 16 s en
PrismCore (S2 E3, au-delà du plafond indicatif de 10 s), 32 s en transcodage
(Ted 2) — toutes visibles à droite du trait. Planches :
`apps/tv/harness/ui-bench/out/planche-tete-lecture.png` (vues pleines,
avant/après), `planche-tete-lecture-frise.png` (frise agrandie) — scènes du
banc `lecteur/tete-*` — et `frises-reelles-tete-lecture.png` (l'app).

Bancs (rejouables, outils dans le bloc-notes de la session) :
- **Suspension** : `kill -STOP` / `-CONT` du processus de l'app (gelée comme
  par tvOS ; le simulateur, lui, ne suspend rien) ; **bouclage repris par
  tvOS** : `PrismBridge.stop(gen)` après le dégel ; **producteur mort** :
  l'export `prismStatus` remplacé à l'exécution (CDP) ; **source perdue** :
  le `onError` de `PlayerRedesignStage` appelé par CDP.
- **Recherche immédiate** : glisser synthétique (`onHWKeyEvent` « pan ») et
  OK dans la première seconde du retour.
- **Position de départ** : le banc du transcodage lent, titre repris à 5:00
  (copie du faux serveur), `/__log` dit le premier segment demandé.
- **Sessions Jellyfin** : `/Sessions` lu avec le jeton de l'appareil, filtré
  sur son DeviceId (d'autres sessions du lot partagent Knaoxtest).

Pièges payés :
- Un Fast Refresh pendant un essai REMONTE le lecteur : la lecture repart,
  en arrière-plan. Couper le rechargement à chaud
  (`NativeModules.DevSettings.setHotLoadingEnabled(false)`, persistant) et
  recharger à la main.
- `log show` ne garde pas les traces `[TVDIAG]` (niveau info) : pour les
  lire après coup, `log stream --level debug` PENDANT l'essai.
- `pnpm patch-commit` re-résout le lockfile au-delà du patch (vitest,
  jiti) : n'y garder que l'empreinte, vérifier par
  `pnpm install --frozen-lockfile`.
- Après un `pnpm install`, Metro perd des modules (« Unable to resolve ») :
  le redémarrer (vérifier par `lsof` que le nouveau tient le port) et
  préchauffer le paquet avant de relancer l'app (6 min sous un build Xcode).
  Jamais `--reset-cache` : le cache de Metro est commun à toutes les
  sessions (TMPDIR de l'utilisateur) — un cache privé passe par une config
  enveloppe hors dépôt.

### Constats non corrigés

- En PrismCore, la bande ne dit que les 10 s d'AVPlayer (2 points sur un
  film de 2 h) ; le producteur a pourtant jusqu'à 30 s d'avance sur le
  disque, où la recherche est aussi instantanée. Piste : exposer cette plage
  par `PrismBridge.status` — sans rien allonger.
- Défilement au pavé entré en lecture : passé le décompte de 3 s, la lecture
  repart seule ; un OK qui arrive juste après actionne Lecture/Pause, et met
  en pause.

### Essais sur l'Apple TV (l'utilisateur — l'app doit être reconstruite)

1. Accueil en pleine lecture, retour après 1 min puis 10 min : lecteur en
   pause à la position, Lecture repart en moins de 2 s ; glisser + OK dès le
   retour → la cible. Metro : `[presence] retour : flux local vivant`, ou
   `MORT → relance` / `producteur mort → relance` suivi de
   `[restart] → ok (cible déplacée …)`.
2. App tuée pendant l'absence (apps lourdes ouvertes) : la fiche,
   « Reprendre » à la position ; pas l'ancien écran de chargement.
3. Transcodage (palier 720p) : reprise à une position — l'image vient sans
   double attente ; une seule lecture au tableau de bord de Jellyfin.
4. Le temps restant ; la tête de lecture fine et, juste à sa droite, la
   portion chargée — nette en lecture directe, quelques points en
   transcodage et en PrismCore.

## Le jumelage par identifiants (Apple TV)

Branche `refonte/tv-jumelage-manuel` (2026-10-01). Constat : ni l'app publiée
ni la refonte n'avaient de champs identifiant et mot de passe — après
l'adresse du serveur, la TV n'affichait qu'un code à confirmer depuis un
autre appareil. Fermé à qui n'a qu'un compte de démonstration : les
relecteurs d'App Store Connect.

- **Le parcours** : accueil → « Configurer manuellement » → adresse →
  **identifiant et mot de passe** → succès → accueil de l'app. Le code du
  serveur reste le recours (« Jumeler avec un code »), avec sa croix vers les
  identifiants. Android TV garde son parcours (`usePairingFlow`, option
  `afterServer`) : ses étapes historiques n'ont pas de connexion.
- **Aucune route nouvelle** : `pairWithPassword` (`packages/tv-core/src/session/`)
  enchaîne `POST /api/auth/login` (le jeton Jellyfin de CONNEXION), `POST
  /api/pair/tv-token` porté par lui (le geste du web pour le relais), puis
  `POST /api/auth/logout` qui le rend. La TV sort JUMELÉE comme par un code :
  `paired_devices`, jeton d'appareil, déjumelage inchangé. Le serveur garde le
  jeton de connexion s'il est devenu celui de la TV (serveur d'avant le jeton
  propre, qui le recopie) — la route `logout` le savait déjà.
- **Sans cookie** (`auth/pairingTransport.ts`, `credentials: "omit"`) : la
  connexion pose un cookie, que le serveur lit AVANT l'en-tête ; gardé, il
  aurait authentifié la TV par le jeton de connexion, même déjumelée.
- **Le mot de passe** : vidé de l'état dès l'envoi, jamais rangé ni
  journalisé, seulement dans le corps de la connexion. Un refus garde
  l'identifiant et rend le focus au mot de passe.
- **Un message par refus** : identifiants faux (401), compte refusé par
  Jellyfin (400 — son 403 : désactivé, bloqué, accès distant ou horaire),
  trop de tentatives (429, cinq par minute), trop de jumelages (429, cinq par
  heure), Jellyfin injoignable (502/503), délai (15 s), serveur injoignable,
  erreur du serveur avec ou sans statut (`pairing:tvLogin*`).
- **Le clavier** : l'invite de chaque champ titre le clavier système
  (« Votre nom d'utilisateur », « Votre mot de passe ») ; un clavier ne
  s'ouvre que sur un APPUI — OK sur un champ, ou « Se connecter », qui ouvre
  le premier champ vide ; valider n'envoie que le formulaire complet, sinon
  BAS mène au champ suivant. Un enchaînement automatique de l'identifiant
  vers le mot de passe a été essayé puis RETIRÉ : il devait attendre une
  seconde (rien ne s'ouvre à 0,6 s, tout à 1 s, mesuré), et un geste fait
  pendant cette seconde était défait — le clavier « réapparaissait » (essai
  réel de l'utilisateur, reproduit).
- **Le focus** : entrée sur l'identifiant ; les deux boutons forment un
  guide (`pairing:actions`, BAS depuis le mot de passe entre par « Se
  connecter ») ; après un refus, le mot de passe — repris une fois si tvOS
  rend le focus au champ dont le clavier se retire (`loginFocus.ts`).
- **Menu** recule d'une étape, comme la croix (`MenuPressInterceptor`) : il
  QUITTAIT l'app depuis toute étape du jumelage (écran racine). Sur l'accueil
  du jumelage — la racine, sans étape précédente — et sur le succès, il reste
  à UIKit, qui QUITTE l'app vers l'écran d'accueil de tvOS : la règle que
  vérifie la revue Apple, rien ne le piège. Prouvé au simulateur :
  identifiants → serveur → accueil du jumelage → écran d'accueil de tvOS.
- **Éprouvé dans l'app réelle** (simulateur « Tentacle TV — jumelage
  (Claude) », backend de dev, agent XCUITest) : FR et EN, adresse
  injoignable (message, OK rouvre le clavier), identifiants faux (« essai »),
  serveur coupé et serveur muet pendant la connexion (relais à soi), code du
  serveur et sa croix, code du relais intact, Menu à chaque étape ; puis la
  connexion RÉUSSIE du compte de test, tapée par l'utilisateur : accueil du
  compte, jeton d'appareil, réglages « Compte jumelé », déjumelage depuis les
  réglages — et aucun cookie `tentacle_token` dans le conteneur de l'app. Au
  banc : groupe « Jumelage » (identifiants, chaque refus, code du serveur
  avec croix) et « Retour ».
- **Contre un vrai Jellyfin** (suite de compatibilité, `pairing.compat.ts`,
  la vraie `pairWithPassword`) : la TV reçoit SON jeton Jellyfin, le jeton
  de connexion meurt chez Jellyfin, le déjumelage la coupe partout ; un
  compte désactivé rend `accountRefused`. Verts sur 10.11.11 et 12.1.0
  (auth héritée coupée).
- **Pour la revue Apple** : Jellyfin bloque un compte non administrateur
  après trois mots de passe faux — régler le compte de démonstration à « -1 »
  (blocage désactivé), sinon trois fautes d'un relecteur le verrouillent.

## La croix Retour (Apple TV)

Branche `refonte/tv-retour-croix` (2026-10-01). Demande de l'utilisateur :
un bouton Retour en CROIX, « le même partout », « accessible sur toutes les
fiches », et jamais focalisé en premier sur une fiche, « SAUF quand y'a que
la possibilité de cliquer sur retour ».

- **Un seul bouton** : `BackButton` (`redesign/controls/BackButton.tsx`) —
  une croix sur un rond de verre, blanc au focus, « Retour » dessous
  (`common:back`), 60 points : la croix du grand panneau, devenue LA croix.
  Elle remplace toute pilule « Retour » et tout « Fermer » de la refonte :
  fiche (nouvelle), Parcourir, erreurs d'écran et de fiche (le panneau ne
  garde que « Réessayer »), jumelage (« Annuler » du relais, « Retour » du
  serveur manuel ; depuis, les identifiants et le code du serveur), bande-annonce, grand panneau, lecteur (ouverture,
  habillage, pistes, épisodes, affiche de fin). Les clés que d'autres guides
  visent ne changent pas (`sheet:close`, `player:back`, `loading:back`,
  `tracks:close`, `episodes:close`, `end:leave`, `trailer:close`,
  `browse:back`) ; nouvelles : `detail:back`, `screenError:back`,
  `pairing:back`.
- **La règle de position** (planche validée par l'utilisateur) : EN HAUT À
  GAUCHE de ce qu'elle referme. Sur un écran, à `BACK_TOP` (son centre sur la
  ligne de la marque, en haut à droite), sur le bord gauche du contenu — la
  colonne de la fiche, après la navigation quand elle est là ; dans un
  panneau, dans son coin. Deux écarts, payés par la géométrie du focus :
  l'habillage du lecteur la centre sur la ligne du titre ; les pistes la
  posent dans leur marge, à cheval sur la première ligne d'options — calée
  sur les titres, rien ne la chevauchait et GAUCHE depuis la première option
  ne la trouvait pas (mesuré).
- **Le lecteur** (ses guides, `playerFocusContainers`) : l'écran d'ouverture
  et l'affiche de fin sont des pièges d'écran (`loading:screen`,
  `end:screen`, `ScreenTrap`) — le focus n'en sort par aucune direction,
  croix comprise ; une destination vers leur entrée, jamais d'`autoFocus`
  (il entrerait par la croix). La croix de fin reste infocalisable tant que
  « Lire maintenant » n'a pas eu le focus (`useEndExitLocked`) ; HAUT y mène
  ensuite (alignées). La marge des pistes est un pont (`tracks:back`) :
  GAUCHE depuis toute la colonne Audio mène à leur croix.
- **Le focus** (`redesignWiring/focus/backFocus.tsx`, `useBackFocus`), hors
  lecteur et grand panneau, qui ont leurs guides :
  - JAMAIS l'entrée d'une fiche : à l'arrivée — et à chaque étape d'un
    automate (le jumelage) —, la croix reste infocalisable tant que le focus
    ne s'est pas posé ailleurs. Sans ce verrou, tvOS la choisit, cible la plus
    en haut à gauche, pendant le chargement de la fiche, et le premier focus
    de contenu clôt l'arrivée (`useEntryFocus`) : elle le gardait ;
  - SAUF seule action, où elle prend l'entrée : ouverture du lecteur
    (`loading:back`, logique du lecteur inchangée), code du relais affiché,
    bande-annonce (toujours), Parcourir en chargement ou vide ;
  - HAUT depuis n'importe où dessous : sa bande pleine largeur
    (`detail:top`, `screenError:top`, `pairing:top`, l'en-tête
    `browse:header`) rend le geste à la croix, une fois libre, et se désarme
    quand la navigation a le focus (sa capsule ouverte passe au-dessus) ;
  - BAS depuis la croix : `nextFocusDown` (le guide d'un point que
    `RCTTVView` pose sous elle), réglé à chaque focus vers la dernière cible
    de contenu, sinon l'entrée ;
  - la fiche : la bande précède l'en-tête sans le chevaucher et défile avec
    la page ; le guide de l'en-tête ne la retient pas — HAUT depuis une
    section revient sur la dernière action, jamais sur elle.
- **Éprouvé dans l'app réelle** (simulateur « Tentacle TV — retour (Claude) »,
  compte de test, agent XCUITest) : fiches film, film à saga (remontée depuis
  la saga), série (saisons, épisodes), épisode (par la pastille de la série),
  personne — entrée jamais sur la croix, HAUT y mène depuis l'action la plus
  à droite comme depuis les sections, BAS revient, OK et Menu reculent (focus
  rendu à la carte d'origine) ; grand panneau (entrée sur l'échelle, HAUT,
  BAS, OK) ; bande-annonce (la croix en entrée, OK, Menu) ; lecteur :
  ouverture (la croix en entrée), habillage (HAUT, BAS, OK quitte), épisodes
  (HAUT depuis les saisons, OK ferme), pistes (GAUCHE depuis la première
  comme depuis la deuxième piste audio, OK ferme), ouverture TENUE
  (`PrismBridge.start` suspendu par CDP, le temps de l'essai) : HAUT, BAS,
  GAUCHE, DROITE gardent la croix, OK sort ; erreur d'écran provoquée par CDP (`setState` de la
  frontière d'erreur), sur la fiche et sur une page à navigation (entrée sur
  Réessayer, HAUT, BAS, GAUCHE vers la navigation, OK) ; jumelage ouvert par
  la navigation, session intacte (serveur manuel : entrée sur le champ, HAUT,
  BAS, OK vers l'accueil, Menu). Au banc seulement : le code du relais (il
  aurait fallu demander un code au relais), la fiche d'une collection
  (aucune dans la bibliothèque de test) et l'affiche de fin (scène câblée,
  focus natif : la regarder pour de vrai marquerait l'épisode vu).
- **Au banc** : groupe « Retour », dix-neuf scènes — l'entrée puis la croix,
  ou la croix seule là où elle est la seule action
  (`bench:ui planche retour --focus`) — et deux scènes « Câblée » du lecteur
  (affiche de fin, ouverture), en focus natif sous ses guides.
- **Restes** : les listes de filtres et de choix n'ont pas de croix (Menu les
  ferme). « Retour à la fiche » du message-outil du lecteur est passé à la
  croix (même motif que l'affiche de fin, groupe `trouble:screen`).

## Le Retour (Apple TV)

Branche `claude/nervous-hopper-bd0124` (2026-10-02). Retours de l'essai de
l'utilisateur : choisir Accueil rouvrait le rail sur l'ancienne
bibliothèque ; un Retour qui ne devait fermer qu'un menu faisait paraître
un autre écran ; Retour changeait de règle d'une page à l'autre.

**La règle, une pile de couches** (`createBackLayers`, tv-core
`nav/backLayers`) : tout ce qui a quelque chose à faire au Retour est une
couche, consultée dans l'ordre menu > surimpression > page > rail ; la
première ACTIVE répond, la plus récemment activée à rang égal. Aucune
active : la plateforme — une page poussée recule, sinon UIKit quitte
l'application (la règle d'Apple).

| Où | Retour |
|---|---|
| Un menu ouvert : grand panneau, listes de filtres, liste de choix, menu d'une entrée du rail, déplacement, panneaux du lecteur | le ferme, rien d'autre |
| Page du rail, focus dans la page | le rail s'ouvre, sur l'entrée de la page |
| Page du rail, rail ouvert | le focus va sur « Profil et réglages » |
| … déjà sur Réglages | l'application quitte (écran d'accueil de tvOS) |
| Page poussée : fiche, personne, genre, bande-annonce, jumelage ouvert depuis les réglages | la page précédente, rail ouvert ou non |
| Une suite de fiches : similaires, saga, personne du casting, « Plus d'infos », filmographie | là où l'on était avant la PREMIÈRE fiche, focus sur la carte d'origine (chaque fiche ouverte depuis une fiche a remplacé la précédente) |
| Lecteur : un menu, puis l'habillage, puis rien | ferme le menu, puis masque l'habillage (la lecture continue ; en pause aussi), puis quitte la lecture |
| Lecteur, défilement | revient où l'on était (inchangé) |

- **Une portée par écran** (`redesignWiring/back/BackScope.tsx`), posée par
  le navigateur (`screenLayout`) autour de l'écran, de son erreur et de son
  chargement. C'est un `MenuPressInterceptor` dont `enabled` dit « une
  couche est active, ou la page est poussée » : sur tvOS, l'appui est pris ou
  laissé à UIKit dès qu'il commence — décidé d'AVANCE. S'inscrire :
  `useBackLayer(kind, active, onBack)`.
- **Menu ne dépile plus jamais un écran de lui-même** : `gestureEnabled:
  false` sur tous les écrans (Apple TV), et le patch de react-native-screens
  (`RNSNavigationController gestureRecognizerShouldBegin:`) refuse le geste
  Menu d'UIKit quand l'écran du dessus a `gestureEnabled: false` ou
  `preventNativeDismiss`. C'était la cause du flash : depuis tvOS 26, ce
  geste (`_backGestureRecognizer`, dont le contrôleur de navigation est le
  délégué — lu au débogueur) dépilait AVANT tout, `usePreventRemove`
  réempilait l'écran après coup, et celui du dessous paraissait 40 à 70 ms
  (filmé : bibliothèque → accueil, lecteur → fiche). Sans preneur, l'appui
  monte à UIKit, qui quitte — même avec des écrans empilés dessous (vérifié).
- **Une Modal** vit dans son contrôleur : son Menu va à `onRequestClose`. Elle
  inscrit quand même sa couche « menu » — le grand panneau dès l'appui
  maintenu : un Retour parti avant qu'il ne paraisse l'annule.
- **Choisir une page dans le rail** : la page d'arrivée prend son entrée,
  rail replié. L'accueil reste monté sous les autres pages du rail, et UIKit
  lui rendait au retour le focus qu'il avait en partant — l'entrée du rail :
  choisir Accueil rouvrait le rail sur l'ANCIENNE page. En quittant l'accueil
  par le rail, le focus repasse d'abord dans son contenu, dans le même geste
  (`focusNow`, `requestTVFocus` : la commande part avant la navigation) ;
  UIKit retient le contenu. À la prochaine ouverture (Retour ou GAUCHE), le
  rail se pose sur la page courante.
- **Le lecteur** (`player/usePlayerBackLayers.ts`) : les états passagers
  (`useTVPlayerBack` : défilement, carte « à suivre », passage automatique
  refusable, grâce de 600 ms), les panneaux des pistes et des épisodes,
  puis l'habillage À L'ÉCRAN (`osdShown`, la règle de la vue) ; en pause,
  `useOsdPin` le désépingle jusqu'au prochain geste. Les crochets partagés
  ne retiennent plus le bouton sur Apple TV (`holdsSystemBack`, vrai sur
  Android TV, qui ne change pas).
- **Une vue nouvelle** (onglet Réglages du lecteur, demandes en cours…) :
  `useBackLayer("menu", ouvert, fermer)` dans le composant qui tient l'état ;
  une Modal ajoute `onRequestClose={fermer}`. Jamais `usePreventRemove` ni
  d'intercepteur à soi ; une route poussée recule seule. Et elle SORT en un
  seul fondu : un menu en Modal passe par `FadingModal` (ou joue sa sortie
  avant de se retirer, comme le grand panneau) ; un panneau posé dans une
  vue reste monté le temps de sa sortie (`useExit`), focus compris. Une
  fiche qui en ouvre une autre passe par `useOpenDetail`.

Éprouvé dans l'app réelle (clone « Banc UI TV — retour (Claude) », compte de
test, agent XCUITest, `simctl io recordVideo` image par image) : accueil,
Retour ×3 (rail sur Accueil, Réglages, sortie) ; Ma liste empilée sur
l'accueil, Retour ×3 sans une image de l'accueil ; Animés → Accueil par le
rail (rail replié, « Reprendre ») ; liste de filtres, grand panneau, menu
d'une entrée du rail, déplacement annulé ; fiche → bibliothèque (fondu
natif, carte rendue) ; Parcourir, rail ouvert → page précédente ; lecteur :
pistes et épisodes (aucune image de la fiche), habillage masqué (la lecture
continue), pause, sortie ; défilement annulé.

Pièges payés :

- `simctl io recordVideo` sur tvOS : `--display=external`, sinon rien n'est
  écrit et SIGINT ne l'arrête pas. Lancer `simctl` lui-même (pas par
  `xcrun`) pour l'arrêter par son pid.
- Construire l'app depuis un worktree dont les Pods ont servi à une Release :
  le script Hermes « Replace Hermes for the right configuration » appelle
  `tar` sans guillemets et échoue sur « Projet - local » — après avoir VIDÉ
  `Pods/hermes-engine`. Extraire `hermes-ios-*-debug.tar.gz` à la main dans
  `Pods/hermes-engine` et écrire `Debug` dans
  `Pods/.last_build_configuration`.
- `simctl io recordVideo` sous une charge de 40 à 60 (huit sessions) : il
  écrit par rafales, ses horodatages se tassent (images à 2 ms d'écart) et
  un fondu en sortie douce paraît une coupe — juger sur le nombre d'images
  intermédiaires et le contenu, pas sur l'horodatage. Clore une transition
  aussi après dix images calmes.
- Un fondu en sortie douce (0,22 ; 1 ; 0,36 ; 1) est aux trois quarts fait en
  70 ms : pour un relais qui doit se voir, une durée commune et des courbes
  choisies pour que la somme des opacités ne retombe jamais sous le plein.
- Retoucher `redesign/motion/motion.ts` (ou un module sans composant) recharge
  tout le JS : l'app revient à l'accueil. Une salve d'appuis lancée à
  l'aveugle derrière part ailleurs — vérifier la pile et le focus avant
  chaque salve (le banc l'a payé : vingt « +30 s » sur une reprise).

### Sans clignotement : un seul fondu (2026-10-02)

Branche `claude/optimistic-albattani-75d697`. Retour de l'essai : « Le bouton
back provoque parfois un clignotement quand je clique pour retirer un menu
(surtout quand je suis dans le lecteur) ». La règle : à la fermeture d'un menu
par Retour, le menu s'efface en UN fondu, et rien d'autre ne se redessine —
ni l'habillage, ni le fond, ni une image noire, ni un focus qui passe ailleurs.

- **Le lecteur — la cause, filmée.** Pistes, Réglages et Épisodes se
  démontaient d'un coup, et l'habillage, à opacité nulle sous eux, repartait
  de rien : une ou deux images où la vidéo était à nu, plein éclat, entre le
  voile du panneau et celui de l'habillage. « Parfois » : visible en lecture
  sur une scène claire, noyé en pause sous le voile de la pause, plus ou
  moins long selon la charge. Le panneau refermé reste maintenant monté le
  temps de sa sortie (`useExit`, `PlayerChromeView`) et s'efface pendant que
  l'habillage revient DESSOUS, sur place (sans monter ni descendre) — le
  relais `handoff` (`TV_MOTION.player.handoffMs`, 240 ms) : ce qui arrive
  dessous se pose vite, ce qui part dessus s'attarde puis file ; le haut de
  l'habillage (son voile dense, le titre) a sa courbe à lui (`handoffTop`,
  symétrique), son voile ne devant pas se poser sous le voile léger d'un
  panneau avant qu'il soit parti.
- **Le focus reste dans le panneau pendant son fondu** (aucun geste n'y agit
  plus) : il s'efface d'un bloc, sa ligne retenue comme le reste ; à la fin,
  invisible (`SWAP_FLOOR`), `onPanelExited` rend le focus au bouton qui
  l'avait ouvert (« Pistes », « Réglages », « Épisodes ») avant qu'il ne se
  démonte — jamais un instant sans focus, jamais ailleurs. Rendu deux images
  après la fermeture (la règle d'avant), le focus quittait la ligne pendant
  que le panneau était encore là : elle passait par une barre grise vide.
- **Les menus en Modal** — listes de filtres, liste de choix d'un réglage,
  menu d'une entrée du rail, feuille des saisons (Vigie) — se retiraient
  d'un coup, voile compris. `FadingModal` (vue) garde la Modal le temps que
  son contenu s'efface (préréglage `veil`), puis la retire ; tvOS rend alors
  le focus à ce qui l'avait ouverte. Ce que la fermeture déclenchait part à
  la fin (`onExited`) : la pastille d'un filtre se réclame une fois la liste
  effacée (réclamée pendant, la Modal la gardait). Le grand panneau, la
  feuille d'un titre absent et la vue des demandes avaient déjà leur sortie.
- **Le rail reste déplié sous une Modal ouverte depuis lui** (vue des
  demandes, menu d'une entrée) : il se repliait dès que le focus quittait ses
  entrées — sous la Modal — et se redépliait à la fermeture, quatre images
  plus tard (filmé). Il ne se replie plus que si le focus se pose ailleurs
  DANS l'écran (`useRailFocused`).
- **Retour qui masque l'habillage** : le fondu de l'inactivité, inchangé —
  aucune image parasite mesurée.

**Mesuré** (simulateur, compte de test, `simctl io recordVideo`, détecteur
image par image du bloc-notes de la session : chaque image réduite en 48
cellules ; pendant un vrai fondu, chaque cellule reste entre sa valeur de
départ et d'arrivée — une image nue, noire ou un focus passé ailleurs fait
déborder une cellule ; seuil : 20 niveaux sur 255) :

| Menu, 20 fermetures | Avant | Après |
|---|---|---|
| Pistes (lecteur) | 19 avec image nue (débord 106 à 110) | 0 — débord max 6 |
| Réglages, Épisodes (lecteur) | même cause | 0 — max 15 |
| Listes de filtres | coupe sèche | 0 — max 0,2 |
| Grand panneau, liste de choix, menu du rail, feuille des saisons | — | 0 |
| Vue des demandes | rail replié puis redéplié (32) | 0 — max 4 |

Les débords restants (≤ 15) sont un creux doux de luminance pendant le fondu
— deux voiles indépendants ne se fondent jamais tout à fait linéairement —,
jamais une image fausse.

### La suite de fiches (2026-10-02)

Retour de l'essai : « Si je vais dans un titre similaire, puis un autre, puis
un autre, puis un autre, je clique sur back et je dois recliquer sur back
plusieurs fois pour revenir où j'étais. »

- **La règle** (`detailMove`, tv-core `nav/detailChain`, testée) : une page
  de détail — la fiche d'un titre (film, série, épisode, saga), la page
  d'une personne — ouverte depuis une autre page de détail la REMPLACE dans
  la pile. Un seul Retour ramène avant la première fiche, le focus sur la
  carte d'origine (la page révélée n'a pas bougé), et la pile ne garde plus
  une suite de fiches et leurs images.
- **La hiérarchie d'une série ne change pas** : descendre vers une saison ou
  un épisode empile, Retour y remonte ; la page visée juste DESSOUS
  (l'épisode qui remonte à sa série par sa pastille), on y RECULE au lieu
  d'en empiler une seconde.
- **Branchée** (`useOpenDetail`) : cartes de la fiche (similaires, saga,
  collection), personne du casting, pastille de la série, « Plus d'infos »
  et le repli de « Lire » du grand panneau, affiches de la page d'une
  personne. Ailleurs (accueil, bibliothèque, recherche), la première fiche
  s'empile, comme avant.
- **Le lecteur lancé depuis une fiche y revient toujours** — à la fin d'une
  série aussi : il ne se remplace plus par la fiche de la série, qui
  s'empilait sur celle d'origine (`launchedFromDetail`, Apple TV ; Android
  TV inchangé).

Éprouvé dans l'app (simulateur, compte de test) : quatre fiches en chaîne
(pile : Accueil > Films > une seule fiche à chaque saut) ; fiche → personne
→ film ; « Plus d'infos » depuis une fiche ; série → épisode → pastille de la
série — chaque fois un seul Retour, focus sur la carte d'origine.

## Les demandes en cours (Apple TV)

Branche `claude/epic-borg-c14399` (2026-10-02). Demande de l'utilisateur : voir
ses demandes Vigie en cours, d'un coup d'œil, en lecture seule.

- **Le contrat** `titles` (manifeste du plugin, relayé par
  `/api/plugins/active`, `pluginTitlesMeta.ts`) gagne deux routes facultatives :
  `access` → `{ request }` (le compte peut-il demander) et `mine?lang=` → les
  titres attendus, un par titre, dans un des quatre états `pending · arriving
  (percent) · importing · blocked`. Seul l'état voyage : les mots sont ceux du
  cœur (espace i18n `requests` — En attente · En cours + % · Mise en
  bibliothèque · Bloquée, jamais « téléchargement »). Lecteurs validés champ
  par champ : `search/pluginTitlesMine.ts` (shared). Côté Vigie :
  `server/titles/my-titles.ts`, mêmes verdicts que le hub (Sonarr et Radarr
  d'abord), cache 10 s invalidé par une demande.
- **La garde** (`redesignWiring/vigie/useVigieGate`, règle
  `titlesFeaturesOpen` de tv-core) : tout ou rien — `titles` et
  `titles.access` déclarés, `request: true`. Serveur ou Vigie d'avant ce
  contrat, Vigie éteint, compte bloqué (le compte de démonstration de la revue
  Apple) : aucune trace, aucune requête des demandes. Exception assumée,
  écrite dans CLAUDE.md : la seule fonction de Vigie intégrée au cœur.
- **L'aperçu** (`redesign/requests/RequestsDock`) : l'accessoire du rail
  (contrat de la tâche 9), dans le bloc du profil, au-dessus de lui ; clé
  `nav:Requests`. Une affiche, ou deux-trois en éventail avec leur nombre au
  dégradé ; sans demande, le bac vide, discret. Toujours là quand la garde
  est ouverte ; verrouillé pendant un déplacement du rail.
- **La fenêtre** (`RequestsPanelView` dans une Modal, `RequestsPanel`) : le
  grand panneau de l'appui maintenu, 1 320 de large. La croix en entrée (seule
  action, garde anti-clic fantôme) ; Menu ferme (couche « menu » de la pile du
  Retour) ; les lignes ne sont focalisables que si la liste dépasse quatre
  lignes, pour la faire défiler. Centrée à l'ouverture, elle garde ensuite son
  haut : une demande arrivée s'efface, les suivantes remontent en glissant.
- **Le camembert** (`redesign/brand/ProgressPie`) : l'avancement façon App
  Store, statique, repris par « Demander » (tâche 7) — et, depuis le direct, au
  centre de chaque affiche demandée (« Les demandes en direct », plus bas).
- **Le rythme** (`MY_TITLES_REFRESH`, tv-core) : fenêtre ouverte, relue en
  l'ouvrant si elle date de plus de 10 s, puis toutes les 30 s ; sinon toutes
  les 5 min, par l'écran de devant seulement ; au retour au premier plan si la
  lecture a plus d'une minute ; rien en arrière-plan. Une demande faite sur la
  TV patche `myTitlesQueryKey` (`withMyTitle`) : l'aperçu la montre aussitôt.
  Quand un titre AVANCE et qu'on le voit : le direct, 10 s (plus bas).
- **Éprouvé** dans l'app réelle (simulateur, faux backend et faux Vigie à soi,
  agent XCUITest) : BAS depuis la dernière entrée du rail → l'aperçu → le
  profil → Rechercher, HAUT à l'inverse ; OK ouvre, entrée sur la croix, BAS
  défile une longue liste, HAUT remonte, OK et Menu ferment et rendent le
  focus à l'aperçu ; garde ouverte (au démarrage : une liste des extensions,
  un droit, une liste des demandes) ; Vigie d'avant le contrat, compte
  bloqué, Vigie absent, Vigie éteint → ni aperçu ni requête des demandes ;
  0 requête en 75 s au repos et en arrière-plan, 1 au retour, 30 s pile
  fenêtre ouverte ; patch de « Demander » → l'aperçu à jour aussitôt ; sortie
  d'une demande arrivée. Au banc : 16 scènes, `bench:ui planche demandes
  --focus --lang=fr,en`.
- **Livraison** : le serveur (relais de `access` et `mine`) ET Vigie (ses deux
  routes) doivent être à jour, sinon la TV ne montre rien — voulu.

### Essais sur l'Apple TV (tâche de l'utilisateur)

1. Un compte avec des demandes de chaque état : l'aperçu replié et ouvert, la
   fenêtre, le camembert et les pour cent lisibles à trois mètres.
2. Fenêtre ouverte, un titre qui arrive : il sort de la liste dans les 30 s.
3. Compte bloqué dans Vigie, ou Vigie désactivé : rien dans le rail.
4. Menu et la croix ferment ; « gauche, gauche » mène toujours au profil.

## Les saisons manquantes (Apple TV, bureau, mobile)

Branche `claude/silly-noyce-e03f5d` (lot du 2026-10-02, T8), Vigie
`feat/saisons-manquantes`. Retour de l'utilisateur : une série qu'on n'a pas
entière ne proposait, dans la recherche, que sa fiche — jamais de demander la
saison qui manque, « même dans la barre ».

- **Le contrat** `titles` gagne `gaps` (additif) : `GET gaps?keys=tv:A,tv:B`
  → pour chaque série que la bibliothèque a EN PARTIE, les saisons qui lui
  manquent, dans la forme de `seasons` (état, demandable). UNE question pour
  toute une page (`useTitleGaps`, regroupeur commun avec l'état des cartes,
  une entrée de cache par série). Vigie ne lit une fiche Jellyseerr que pour
  une série qu'il dit « en partie » (table des statuts en mémoire) ; la file
  du compte se relit à chaque fois. Le serveur relaie `gaps`
  (`readTitlesMeta`) et donne l'identité TMDB de chaque résultat de
  `/api/search` (`ProviderIds.Tmdb`, tiré de l'index) — sans elle, rien.
- **La feuille des saisons, un modèle commun** (`seasonPick`, shared) : ce que
  l'extension offre se coche, sauf ce que la BIBLIOTHÈQUE a déjà — « Dans la
  bibliothèque », jamais à cocher, même si l'extension n'en sait encore rien
  (saisons Jellyfin hors « virtuelles ») ; trois saisons numérotées ou plus
  qu'on a tiennent en une ligne (« Saisons 1–15 »). Bureau (une feuille pour
  l'app, au-dessus des pages et de l'omnibox), mobile (présentée depuis la
  recherche, la réponse dite sur place) et Apple TV la rendent.
- **Apple TV** (garde `useVigieGate` ET `titles.gaps` + `titles.seasons`
  déclarés, sinon rien) :
  - recherche : la série paraît AUSSI en tête de « À demander », grisée,
    « 2 saisons à demander » (`useSearchGaps`) ; OK ouvre la feuille, entrée
    sur la première à cocher ; plus rien à demander mais une demande du compte
    en cours → son état et l'invite au téléphone ; l'appui maintenu ouvre le
    panneau de la série (c'est un titre de la bibliothèque) ;
  - fiche : les saisons manquantes en onglets GRISÉS au bout de la bande
    (`useSeriesGapTabs`, `Chip absent` : le verre passe au gris du GPU des
    titres absents, `NativeDesaturate`, pointillés, « + » ou horloge ; au
    focus, un gris clair, texte noir). OK ouvre la feuille ENTRÉE sur cette
    saison, déjà cochée ; sur une saison déjà demandée, entrée sur la
    première à cocher. Une saison qui a déjà un onglet (même virtuelle) n'en
    a pas un second ; tant que la bande n'est pas lue, aucun onglet grisé.
- **Bureau** : « Demander » au dégradé JUSTE APRÈS « Lire » au plateau de la
  carte (`overlay.request`, `SeriesGapsScope` : la recherche seulement), le
  hors ligne cédant sa place (cinq boutons au plus) ; « + 2 saisons à
  demander » sous l'affiche et sur le meilleur résultat ; dans l'omnibox, une
  section « À demander » (↵ ferme la barre et ouvre la feuille).
- **Mobile** : la même chose par la feuille d'appui long (« Demander les
  saisons manquantes », en retrait de « Lire », leur nombre), la légende de la
  carte et le meilleur résultat. Jamais « téléchargement ».
- **Le jumeau de Vigie** (`PosterHover`, et sa feuille) suit le nouvel ordre :
  sur une série de la bibliothèque là en partie, « Regarder » puis « Demander
  d'autres saisons » au dégradé.
- **Éprouvé** : au banc (`bench:ui planche saisons-manquantes --focus`) ;
  dans l'app réelle des trois plateformes sur un faux backend et un faux Vigie
  (aucune écriture vers un vrai service, chaque demande journalisée) — Apple
  TV au pavé (agent XCUITest) : DROITE depuis « Saison 15 » atteint les
  onglets grisés, OK, entrée, BAS, OK, Menu rend le focus à l'onglet ;
  « Demande envoyée », la carte « En attente » ; bureau (Chrome sans tête) :
  plateau, feuille au clavier, omnibox ; mobile (simulateur iPhone neuf).
  Garde : Vigie sans `gaps`, compte bloqué, Vigie éteint → ni carte, ni
  onglet, ni « Demander ». La demande part avec `seasons: [17]`, rien d'autre.

### Essais (tâche de l'utilisateur)

1. Apple TV : rechercher une série incomplète — la carte en tête de « À
   demander », OK, la feuille entre sur la saison qui manque ; la fiche, au
   bout des saisons, les onglets grisés lisibles à trois mètres.
2. Bureau : la même recherche — le « + » au survol, la feuille, la barre.
3. Mobile : appui long sur la série dans la recherche.
4. Livrer ENSEMBLE le serveur (relais de `gaps`, `ProviderIds` de la recherche)
   et Vigie (`/titles/gaps`), sinon rien ne paraît — voulu.

## Les demandes en direct (Apple TV)

Branche `claude/intelligent-fermat-a46e61` (2026-10-02, T7 du lot de la
relève). Retour de l'essai à l'émulateur : « un fromage sur l'affiche, et
l'affiche fait comme Apple : elle est grisée, puis prend de plus en plus de
couleur », « en temps réel, comme sur Vigie mobile ou desktop ».

**L'affiche qui arrive** (`redesign/requests/ArrivalArtwork`) — partout où une
demande DU COMPTE se montre : la fenêtre des demandes, l'aperçu du rail, les
cartes absentes (saga d'un film, « À demander » de la recherche), la feuille
des saisons (ses saisons demandées), le grand panneau d'un titre absent.

| État | Affiche | Au centre (`ArrivalSign`) | Mot |
|---|---|---|---|
| En attente | grise | le camembert vide (l'anneau) | « En attente » |
| En route | grise → couleur, au prorata | le camembert qui se remplit | « En cours · 42 % » |
| Mise en bibliothèque | pleine couleur | le camembert plein | « Mise en bibliothèque » |
| Bloquée | grise | l'alerte | « Bloquée » |
| Arrivée (client) | pleine couleur, sans voile | le camembert s'efface en s'ouvrant | « Disponible » |

- **Le gris au GPU, dosé** : la vue native des titres absents
  (`TentacleDesaturateView`, « saturationBlendMode ») porte une OPACITÉ —
  1 gris, 0 couleur. Mesuré au banc (`sonde`, pixels) : la saturation suit
  l'opacité en ligne droite, 40,7 × (1 − opacité). Aucune retouche native.
  L'opacité se pose sur la vue native ELLE-MÊME : sur un parent, le groupe
  composerait le gris contre son propre fond vide. Repli (binaire sans la vue)
  : l'affiche grise SVG par-dessus la couleur, en fondu.
- **Le signe est sur l'affiche, le mot dessous** : la ligne d'état de la
  fenêtre et le badge des cartes disent le mot et le pour cent — jamais la
  couleur seule. Les états sont ceux de `titles.mine` ; « arrivée » est un
  état du CLIENT (`arrivedBetween`, tv-core) : un titre sorti de la liste en
  avançant est arrivé ; sorti d'« en attente » ou de « bloquée » (refusé,
  retiré), il s'en va sans fête.
- **Une arrivée** : dans la fenêtre, toute sa couleur et « Disponible »
  1,4 s, puis la ligne sort comme avant ; dans l'aperçu, 1,8 s devant
  l'éventail ; une carte (saga, recherche) reste « Disponible » en pleine
  couleur pour la session (`useArrivals`), et OK le dit.

**Le direct — la fraîcheur de Vigie, seulement à l'écran.** Vigie (web,
bureau, mobile : un même paquet) relit `/requests/progress` toutes les 10 s
quand quelque chose descend (30 s sinon), page visible seulement, et fait
avancer sa barre chaque seconde sur le temps restant (`useInterpolatedProgress`).
La TV fait pareil :

- **Vigie** donne le temps restant (`titles.mine` → `etaSeconds`, champ
  ADDITIF : seulement ce qui descend vraiment) ; `shared` le lit, borné ;
- **le battement** (`redesignWiring/vigie/liveRequests`, `useLiveRefresh`) :
  une vue qui MONTRE des demandes s'inscrit tant qu'elle est sur l'écran de
  devant, l'app au premier plan, et qu'un de SES titres avance (en route, mise
  en bibliothèque) ; la liste partagée se relit alors dès qu'elle a 10 s
  (`MY_TITLES_REFRESH.liveMs`) — un battement pour tout l'appareil, jamais
  deux lectures. Rien qui avance : aucun minuteur, les rythmes d'avant ;
- **entre deux lectures** (`useArrivalPercent`, `liveClock`) : l'avancement
  projeté d'une seconde à l'autre sur le temps restant, plafonné à 99,5 %,
  jamais de recul sauf vraie chute de plus de 5 points (règles pures de
  tv-core, `liveProgress`) ; UNE horloge pour toutes les vues, qui ne bat que
  si quelque chose avance à l'écran ; le camembert et le pour cent écrit
  disent la même chose à la même seconde ;
- **un pas se pose, un état se fond** : un pas d'avancement pose une opacité
  (une image composée) ; seuls un changement d'état et un rattrapage de dix
  points se fondent (360 ms). Fondre chaque pas coûtait ~100 ms/s de GPU sous
  le verre de la fenêtre quand l'avancement file.

**Mesuré** — banc (simulateur tvOS 26.2, `gpu`, trois tours alternés, Mac
chargé de 30 à 58) :

| Scène | GPU | CPU de l'app (JS de développement) |
|---|---|---|
| Au repos (états, fenêtre, rail, figés) | 0 ms/s | 2-3 ms/s |
| Deux affiches en marche | 2-3 ms/s | 24-54 ms/s |
| Fenêtre en marche (deux lignes, 2,5 %/s) | 10-13 ms/s (avant : 97-109) | 33-48 ms/s |
| Rail en marche | 3-5 ms/s (avant : 29-41) | 25-54 ms/s |

Dans l'app réelle (faux serveur des demandes, `apps/tv/harness/live-requests`) :
`mine` lue toutes les 10 s quand ça avance, fenêtre ouverte comme rail seul ;
aucune lecture en arrière-plan (77 s), une seule au retour (deux avant le
correctif : les deux relectures « si ça date » partaient ensemble, et
`refetch()` annule la lecture en cours) ; rien n'avance : 30 s fenêtre ouverte,
aucune lecture rail seul (5 min) ; Vigie éteint, compte bloqué : ni aperçu ni
`mine`. La fiche d'un film dont un volet est une demande qui avance relit la
liste toutes les 10 s, et la carte avance d'une seconde à l'autre ; arrivée,
plus rien ne s'y relit.

- **Approximation assumée** : « à l'écran » se juge par l'écran de DEVANT (la
  page), pas par la position de défilement — une saga hors de la vue, sur la
  fiche de devant, garde son battement.
- **Au banc** : 12 scènes « Demandes en direct » (`bench:ui planche direct/
  --focus`) — la même affiche à 0, 25, 50, 75 et 100 %, chaque état, au repos
  et au focus, la fenêtre, le rail, les saisons, le grand panneau, et ce qui
  bouge seul (un faux serveur relu toutes les 10 s). Les scènes « Demandes en
  cours » et « Titres absents » montrent aussi l'affiche qui arrive.
- **Preuves** (non suivies) : `apps/tv/harness/ui-bench/out/preuves-demandes-direct/`
  — planches du banc, cycle image par image, vrai rail (replié, ouvert,
  focalisé, qui avance), vraie fenêtre en direct et une arrivée, vraie saga en
  direct, garde, mesures GPU.

### Essais sur l'Apple TV (tâche de l'utilisateur)

1. Une demande en cours : son affiche grise se colore au fil de l'avancement,
   le camembert au centre et le pour cent bougent d'une seconde à l'autre —
   dans la fenêtre, l'aperçu du rail, la saga du film.
2. Une demande qui aboutit, fenêtre ouverte : « Mise en bibliothèque », puis
   « Disponible » en pleine couleur, puis elle sort.
3. Rien en cours (seulement « en attente ») : rien ne doit bouger.
4. Vigie éteint, ou compte bloqué : aucune trace.

## La lumière des fonds et la marque (Apple TV)

Branche `claude/sleepy-mcnulty-7390fe` (2026-10-02). Deux retours de l'essai
sur l'Apple TV : « dans une bibliothèque pleine de cartes, la carte focalisée
donne l'impression d'un grand noir derrière », et le logo « fait PNG qui
flotte ». Relevé au banc avant d'y toucher (grille des films) : la moitié
droite de la scène à rgb(3, 3, 6) — du noir —, la lumière de l'œuvre ne
couvrait que le tiers gauche, et la carte focalisée se soulevait sur une ombre
noire de 30 points.

- **Les jetons** : `TV_LIGHT` (`packages/theme/src/tokens/tvStage.ts`) —
  l'encre du fond, la force des lumières, la lueur des cartes, le halo de la
  marque. Chaque levier se règle en une ligne.
- **Le fond : une encre, plus le noir** — `#100D17` en haut, `#09080E` en
  bas : à peine teintée de la marque (un violet très sourd), jamais un fond
  violet ; plus claire en haut, la scène est éclairée d'en haut. Un voile qui
  doit se fondre dans le fond (le haut d'une fiche qui défile) prend l'encre
  (`ink()`), plus le noir : sur le fond éclairé, un voile noir dessinait une
  bande.
- **La lumière de l'œuvre, partout** (`AmbientBackdrop`) : trois lumières aux
  couleurs de l'œuvre focalisée — une large, d'en haut (son cœur au-dessus de
  l'écran : la scène en reçoit la retombée), une de chaque côté —, à la
  décroissance douce (cinq paliers : une lumière, pas une tache). Les violets
  de l'œuvre restent ramenés au neutre. Leur clarté est BORNÉE
  (`boundedLight`, luminance ≤ 0,4) : un jaune vif n'éblouit plus, et le texte
  posé dessus garde son contraste.
- **La carte focalisée jette SA lumière** (`CardFrame` `glow`, `MediaCard`
  `glowTone`) : le soulèvement n'est plus une grande ombre noire mais une
  ombre aux couleurs de l'œuvre (rayon 46, 0,7), sur le même calque ; l'ombre
  de repos reste dessous, en contact. `glowTone="neutral"` : un blanc doux et
  bas, pour une carte qui doit rester grise (titre hors de la bibliothèque —
  tâche « Collection et Demander »).
- **Le contraste tient** — fond le plus clair relevé sous du texte, sept
  écrans : tertiaire (blanc 0,55) ≥ 4,9:1 (avant : 5,7 à 6,2:1), secondaire
  ≥ 8,2:1 ; la légende de la carte focalisée, dans sa lueur : ≥ 5,6:1. Pire
  cas calculé (les trois lumières au jaune le plus vif que sache produire la
  palette) : 5,0:1 en haut de l'écran grâce à la borne — 4,4:1 sans elle.
- **Écartés** (planches dans `apps/tv/harness/ui-bench/out/lumiere-et-marque/`)
  : A, un voile uniforme (assez de lumière, mais il tourne au brun) ; B,
  seulement d'en haut (le centre reste noir) ; C, en diagonale (inégal d'un
  écran à l'autre) ; E, la retenue plus forte (le tertiaire passe sous 4,5:1
  sur certaines œuvres).

**La marque** (`brand/BrandCorner`, `brand/BrandMark`) — ⚠️ le coin a été
RETIRÉ le 2026-10-03 : plus aucun logo dans l'app (« Le logo dans l'app :
aucun (Apple TV) », plus bas). Ce qui suit en est l'historique :

- la mascotte NORMALE, en couleurs (`brand/logo-color.svg`). ⚠️ Elle fut
  d'abord en MONO blanche (`brand/logo-mono.svg`) : sur l'Apple TV, ses yeux
  creusés en orbites noires et le crâne évidé du chapeau lisaient « tête de
  mort » — l'utilisateur y a vu un « logo d'Halloween » (2026-10-02). Le mono
  a quitté l'app TV (`TentacleMonoLogo` supprimé) ; ne pas l'y remettre ;
- éclairée par la lumière de la MARQUE, la seule qui la porte : le halo des
  icônes de `brand/` (magenta au cœur, violet au bord), discret
  (`TV_LIGHT.brandHalo`) ; sur une image (fiche, carte héros), un voile
  d'ombre à la place — la lumière de la marque y teintait la photo ;
- calée : son DESSIN (pas son carré) affleure au bord droit de la marge de
  sécurité, son centre sur la LIGNE DE LA MARQUE — le centre de la croix
  Retour (`BACK_TOP` + 30 = 98 points), où tombe aussi le titre des
  réglages : la croix à gauche, la marque à droite, un seul trait — rien du
  rail, dont le bloc se centre depuis le rail compact. Son corps (dôme et
  écran) a la hauteur des
  capitales d'un titre d'écran (carré de 60) ; l'emprise du dessin est
  mesurée sur `brand/logo-color.svg` (55,5 → 184,5 × 13 → 228 sur 240) : à
  remesurer si le dessin change d'encombrement ;
- elle défile avec la page — dans l'en-tête des grilles, dans la page de la
  fiche, de l'accueil et de « Pour vous » : elle ne passe plus par-dessus les
  rangées. Sur l'accueil et « Pour vous », elle se pose DANS le coin de la
  carte héros, sur la colonne de ses points de rotation (56 de ses bords) :
  au coin de l'écran, son chapeau dépassait du bord du héros. Fixe là où la
  page ne défile pas : réglages, jumelage, panneaux d'état ;
- la même mascotte en couleurs que les ILLUSTRATIONS — accueil du jumelage,
  démarrage, erreurs, à propos ;
- écartés d'abord : la mascotte en couleur, seulement alignée, et la couleur
  avec le halo (« un autocollant ») ; le mono au dégradé de la marque
  (illisible sur une image chaude). Le choix du mono blanc a été défait par
  l'utilisateur : la marque est TOUJOURS la mascotte normale.

**Le coût** — mesuré au banc (simulateur tvOS 26.2, JS de production, temps
GPU des services de rendu du simulateur), cinq tours en alternance avant /
après, deux relevés de 10 s par scène et par tour. Scènes « Mesure ·
Lumière » : le focus y change SEUL, toutes les 400 ms — la carte grandit, sa
lueur paraît, la lumière du fond passe à celle de l'œuvre suivante.

| Cas | Avant | Après |
|---|---|---|
| Repos (grille, accueil, réglages — halo de la marque compris) | 0,0 ms/s | 0,0 ms/s |
| Grille des films, focus toutes les 400 ms | 204 à 233 (moyenne 217) | 200 à 240 (moyenne 217) |
| « Reprendre », focus toutes les 400 ms | 187 à 233 (moyenne 213) | 188 à 232 (moyenne 210) |

- **À l'arrêt, rien** : lumières, lueur et halo sont des dessins posés une
  fois ; rien ne s'anime seul.
- **En mouvement, le même coût** : l'écart avant / après reste sous la dérive
  d'un tour à l'autre (qui suit la charge du Mac). Les lumières couvrent plus
  d'écran mais restent trois disques de 128 points agrandis par le GPU ; la
  lueur réutilise le calque de l'ombre du soulèvement (une ombre colorée au
  lieu d'une noire) et l'ombre de repos ne s'anime plus.
- **Piège payé** : sous forte charge (huit bancs démarrés, charge de 45 à 140),
  un focus piloté depuis le relais (`fps --sweep`, `focus` en boucle)
  n'arrive pas au même rythme d'un tour à l'autre — le même code a mesuré 14
  puis 223 ms/s. D'où les scènes « Lumière », au mouvement joué dans l'app.

## Le logo de l'app : icône, Top Shelf, lancement (Apple TV)

Retour de l'essai (2026-10-02) : « le logo est vraiment pas bien affiché de
l'app ». Lecture retenue : l'icône de l'écran d'accueil d'abord, puis le Top
Shelf et l'écran de lancement ; le logo DANS l'app, seulement vérifié.

- **Le constat** (simulateur tvOS 26.2 en 4K, à côté de Réglages et de Sing,
  deux apps d'Apple) : une seule couche, donc aucune profondeur au focus ; un
  fond cinéma qui tombait au noir pur en bas à droite — sur l'accueil sombre,
  la tuile se perdait et la mascotte flottait seule.
- **L'icône, en quatre couches** (`brand/tvos.py`, Sing en a cinq) : le FOND
  opaque, violet de nuit plus clair en haut (`#43178C` → `#1B0939`) ; la
  LUMIÈRE de la marque sur sa couche (`#C026D3` 0,82 → `#A855F7` 0,24 → 0) ;
  le POULPE sans ses bras avant ; les BRAS avant devant tout — à
  l'inclinaison, ils glissent devant l'écran qu'ils enlacent, leur base reste
  sur le dôme. Aucun reflet ni ombre peints : tvOS pose les siens au focus.
  Écartés au simulateur : le fond d'avant ; un violet plus vif (la lumière ne
  s'y lit plus) ; un halo large (le dôme se fond dedans) ; la mascotte mono
  blanche sur le dégradé de marque — très « Apple », mais elle perd la
  couleur que portent toutes les autres icônes de l'app.
- **Le cadrage, mesuré** : la mascotte tient 74 % de la hauteur de la tuile
  (les glyphes d'Apple, 70 à 75 %). Le pavé du simulateur ne se pilote pas
  sans sa fenêtre : une sonde UIKit (hors dépôt) affiche l'icône compilée dans
  une vue focalisée et impose l'inclinaison au moteur de parallaxe du système
  — le `UIMotionEffectGroup` de `_UIStackedImageContainerView` donne
  `focusDirectionX/Y` pour un décalage, appliqués par
  `_applyKeyPathsAndRelativeValues:forMotionEffect:` (le KVC direct plante).
  Aux neuf extrêmes, rien n'est rogné ; le tricorne garde 11 % de marge.
- **Le Top Shelf** : la nuit et la lumière de l'icône, étirée en largeur ; la
  mascotte à la taille du rouage du Top Shelf de Réglages (420 points). tvOS 26
  l'étend derrière tout l'accueil : sur l'icône, l'accueil prend la couleur de
  l'app.
- **Le lancement EST la première image** : `LaunchLogo` est la mascotte du
  démarrage dans SA lueur (le `Glow` de `BootView` : l'accent, 0,3 → 0,135 → 0
  sur 640 points ; la mascotte à 200), que le storyboard pose 50 points
  au-dessus du milieu (la colonne mascotte + indicateur est centrée), sur
  l'encre moyenne. Au banc (`surimpressions/demarrage`), lancement et
  démarrage coïncident au pixel près — seul l'indicateur d'attente apparaît.
  Ils se retouchent ENSEMBLE (c'est écrit des deux côtés).
- **Plus de noir au démarrage** : pendant le chargement du JS, la vue racine
  restait NOIRE — mesuré, JS retenu 6 s par un relais : 6 s de noir.
  `AppDelegate` pose l'écran de lancement comme vue d'attente de la vue racine
  (`RCTRootView.loadingView`, par `customizeRootView:`) : il tient jusqu'au
  premier rendu, puis s'efface en fondu (0,25 s).
- **Le logo dans l'app** (`BrandCorner`, retiré depuis : « Le logo dans
  l'app : aucun », ci-dessous) : net en 4K (react-native-svg
  rastérise ses masques à l'échelle de l'écran), centre à 0,25 point de la
  ligne de la croix Retour, bord droit sur la marge : rien à corriger.
- **Pièges** : tvOS garde en cache l'instantané du lancement par numéro de
  build — deux builds de même numéro montrent l'ancien (au simulateur : vider
  `Library/SplashBoard` du conteneur de l'app) ; `generate-icons.py`
  réécrivait l'icns et l'ico du bureau même sous un filtre (corrigé) ; le
  simulateur tvOS n'affiche que Réglages — Sing, présent mais masqué dans le
  runtime, s'affiche réempaqueté sous un autre identifiant (banc seulement).
- **Le coût** : le catalogue compilé passe de 3,09 à 3,62 Mo (les couches de
  lumière, dont celle de l'icône App Store en 1280×768).
- Planches : `apps/tv/harness/ui-bench/out/logo-app-tv/` (hors git).

## Le logo dans l'app : aucun (Apple TV)

Branche `claude/xenodochial-euler-651183` (2026-10-02 → 03). Retour de
l'essai sur l'Apple TV : le logo « vraiment mal intégré », qui « ne suit pas
le scroll », au « halo de lumière moche ». Trois intégrations proposées en
planches, rendus réels au banc — accueil, bibliothèque, fiche, réglages ; au
repos et défilés ; rail replié et ouvert :

- A, la mascotte en tête de la capsule des pages, sur son verre, et
  « Tentacle TV » rail ouvert, comme la barre du bureau ;
- B, la mascotte devant le surtitre du héros de l'accueil, comme le logo de
  la chaîne au-dessus d'un titre dans l'app TV d'Apple ; rien ailleurs ;
- C, aucun logo dans l'app.

Relevé des grandes apps (fiches App Store Apple TV, octobre 2026) : aucune ne
met son logo en tête de sa navigation — c'est le profil (app TV d'Apple,
Netflix, Disney+, Plex) ; un logo d'app, quand il existe, est petit et hors
navigation (Netflix : un « N » seul en haut à droite ; HBO Max : sur ses
héros) ; aucun chez Apple, Plex, Prime Video, Infuse, Paramount+. La HIG :
« Ensure branding always defers to content ».

**L'utilisateur a choisi C.** Parti : `BrandCorner` — le coin, son halo de
marque, son voile d'ombre sur les images — de tous les écrans (accueil, Pour
vous, bibliothèques, collections, Parcourir, fiche, réglages, jumelage,
panneaux d'état) ; le jeton `TV_LIGHT.brandHalo` ; les 120 points réservés à
droite du titre des bibliothèques et des collections ; les enveloppes des
en-têtes de grille ; l'option `withName` de `BrandMark`, jamais appelée.

La marque reste là où elle est légitime :
- l'icône en quatre couches, le Top Shelf et le lancement (« Le logo de
  l'app », ci-dessus) ;
- les ILLUSTRATIONS, par `BrandMark` : démarrage, accueil et étapes du
  jumelage, erreurs, hors ligne, À propos — inchangées (démarrage, À
  propos, accueil du jumelage, hors ligne comparés au banc : 0 pixel de
  différence) ;
- le violet → rose en touches : lecture, progression, étoiles, surtitres.

**La règle** : sur Apple TV, aucun logo d'interface — ni coin, ni tête de
rail, ni marque de héros. La mascotte n'y paraît qu'en illustration d'un
état (démarrage, attente, vide, erreur, accueil du jumelage).

**La preuve** : de l'avant à l'après, seule la zone du logo change (≈ 100 ×
120 points au coin, comparaison au pixel des onze états) ; GPU au repos du
simulateur : 0 ms/s avant comme après (accueil, bibliothèque, fiche,
réglages). Planches : `apps/tv/harness/ui-bench/out/logo-integration/` (hors
git) — propositions (00 à 04), avant / après (05, 06).

## Les rangées (Apple TV)

Branche `claude/bold-dirac-7e0a34` (2026-10-02). Deux retours de l'essai de
l'utilisateur sur son Apple TV : HAUT / BAS qui ne fait « rien » alors que
quelque chose existe plus bas (au bout d'un carrousel au-dessus d'une rangée
plus courte, depuis un réglage un peu décalé), et le passage d'un carrousel à
l'autre qui fait « un saut très étrange ».

**La règle — une seule, pour toute la refonte** (`@tentacle-tv/tv-core`,
`focus/sections.ts`, ses tests en sont le cahier des charges) : une page est
une pile de SECTIONS — une rangée (titre et accessoire compris), une ligne de
grille, une ligne de la barre de filtres, l'en-tête d'une fiche, le panneau
des réglages. HAUT / BAS depuis un élément d'une section :

1. dans sa section d'abord : en descendant, sa ligne suivante (des pastilles
   qui passent à la ligne) ; en remontant, seulement ce qui est à l'APLOMB —
   la pastille du filtre, au-dessus de sa carte, n'est jamais une étape
   obligée depuis le bout de la rangée. Une section qui se dit LISTE de
   lignes (`FocusSection list` : le panneau des réglages) n'a rien qui la
   coiffe : HAUT y va aussi à la ligne voisine, au plus proche ;
2. sinon, la section voisine dès qu'elle a un élément focalisable (une autre
   colonne n'est jamais visée), sur ce qui fait face (sa première ligne en
   descendant ; en remontant, la dernière — et les colonnes qu'une dernière
   ligne incomplète n'a pas), l'élément dont le CENTRE est le plus proche,
   horizontalement, de celui qu'on quitte, même s'il n'est pas sous lui ;
3. rien au-delà : la règle ne décide rien, tvOS et les guides des écrans
   gardent la main (la bande de la croix Retour d'une fiche).

**Deux exceptions, et seulement deux** (tranchées le 2026-10-01) — une section
peut déclarer son ENTRÉE (`redesignWiring/focus/sectionEntry.ts`, prop native
`tvEntry`), qui l'emporte quand elle est focalisable :

- **les onglets de saisons** entrent TOUJOURS par la saison affichée — un
  sélecteur entre par sa sélection ; le focus d'un onglet ne change pas la
  saison, seul OK le fait ;
- **la rangée des épisodes** entre par l'épisode À REPRENDRE à sa première
  entrée — l'arrivée sur la fiche, puis chaque saison choisie par OK ; ensuite,
  dans la même visite, au plus proche (la rangée reste où on l'a laissée).

Elles REMPLACENT les entrées mémorisées d'avant (dernière carte visitée des
rangées de la fiche, dernière action de l'en-tête). La croix Retour garde ses
guides (« La croix Retour », plus haut).

**La traduction Apple TV** — native, parce que la géométrie n'est juste qu'au
moment même du geste (une rangée défile encore quand la flèche part) :

- la vue décrit : `FocusSection` (`redesign/focus/`) — que c'est une section
  (`focusKey`), comment la page la montre (`reveal` : `nearest` à 56 des
  bords, `anchor` à 72 du haut, `start`), si c'est une liste ;
- le port décide : la forme `section` reçoit la règle, au même endroit pour
  tous les écrans (`redesignWiring/focus/sectionNeighbors.ts`, lu par le
  magasin de focus ; le port du banc fait de même) ;
- la vue native `TentacleFocusSection` (`ios/TentacleTV/`) : sur l'élément
  focalisé, deux guides d'un point, de sa largeur, collés au-dessus et
  au-dessous (`TentacleNeighborGuides.m`) — seulement si la règle a une
  cible ; ils renvoient vers un résolveur qui applique la règle au geste
  (`TentacleFocusNeighbors.m`).

**Le saut, et ce qui le remplace.** Cause, mesurée image par image : tvOS
défilait pour amener la carte, puis, une image ou deux plus tard, le
`scrollTo` animé du JS (`revealSection`, `useSectionAnchors`) l'interrompait
— la page s'arrêtait NET (47 → 0 pt/image) et repartait de zéro : deux
mouvements, une durée de 417 à 750 ms selon le moment. Désormais, UN mouvement
(`TentacleRevealScroller.m`) : tvOS propose sa cible par
`scrollViewWillEndDragging:…targetContentOffset:` (aussi pour un défilement
de focus), on lui rend la position courante, et la page va à la cible de la
section sur le ressort `TV_MOTION.spring.scroll` (critique, 0,5 s), joué image
par image — un nouveau focus en plein vol reprend position et vitesse ; ce qui
bouge AU-DESSUS de la section montrée (une rangée qui arrive, un logo lu) est
compensé dans le même montage — plus de recalage après coup. « Réduire les
animations » : la page se pose aussitôt.

| Mesuré (banc, JS de production, Mac au calme, 3 séries de 6 passages) | Avant | Après |
|---|---|---|
| Passages de rangée en un seul mouvement | 1 sur 6 | 6 sur 6 |
| Pire chute de vitesse d'une image à l'autre | 43 à 50 pt | 5 pt (série au calme) |
| Durée jusqu'à 98 % du trajet | 417 à 750 ms | 483 à 500 ms, quelle que soit la distance |
| Fil d'interface (`bench:ui fps`, flèches de l'agent XCUITest) | 59,7 à 59,9 i/s | 59,8 à 59,9 i/s |

Dans l'app réelle (compte de test, JS de développement) : chaque passage
vertical en 467 à 517 ms, sans rupture, accueil comme fiche. Planche de
preuve (courbes image par image, images réelles avant / après) et relevés :
`apps/tv/harness/ui-bench/out/2026-10-02-rangees/` (non suivi). La sonde
d'images était un fichier natif temporaire (couche de présentation de la
page à chaque `CADisplayLink`), jamais commité.

**Partout** : accueil et « Pour vous » (héros, rangées), fiche (en-tête,
onglets, épisodes, distribution, extras, saga, collection, similaires — la
page s'ancre sur la `DetailSection`), bibliothèques, Ma liste, Favoris et
Parcourir (chaque ligne de la grille, rendue par lignes ; les deux lignes de
la barre de filtres), recherche (résultats, groupes du repos), réglages (le
panneau, une liste). Au banc : « Accueil · Rangées inégales » rejoue le bout
d'un carrousel au-dessus d'une rangée plus courte et la pastille du filtre.

Pièges payés (simulateur tvOS 26.2) :

- **tvOS lit la valeur STOCKÉE des destinations d'un `UIFocusGuide`** : une
  méthode surchargée n'est jamais appelée. Pour décider au geste, le guide
  renvoie vers une VUE dont tvOS consulte `preferredFocusEnvironments`.
- **Une bande de toute la largeur, au bord d'une section, perd** contre un
  élément dans l'axe deux rangées plus bas (la rangée courte était sautée) :
  le guide a la largeur de l'élément et lui est collé, comme `nextFocusDown`.
- **Une contrainte qui traverse une ScrollView n'est pas recalculée quand
  elle défile** : un guide posé sur la vue racine restait là où la carte était
  avant que sa rangée défile. Le guide est porté par ce qui défile avec elle.
- **Un guide hors des limites de la vue qui le porte n'est pas trouvé** (sous
  une affiche de grille, la section épouse l'affiche) : le porteur est le
  premier ancêtre qui le contient, sans franchir une ScrollView.
- **Sans cible, pas de guide** : un guide qui ne mène nulle part prendrait le
  geste aux guides des écrans (la bande de la croix Retour).
- **La compensation de mise en page compare la MÊME section** : comparée à
  celle d'avant le changement de focus, elle faisait sauter la page de 200 pt
  au premier passage du héros aux rangées.
- **`FlatList numColumns` ne laisse pas envelopper une ligne** : la grille se
  rend par lignes (`PosterGrid`, une section chacune), à l'identique.

À éprouver sur l'Apple TV (tâche de l'utilisateur) : le glisser du pavé à
travers les rangées (élan), le ressort de la page (0,5 s) au salon, les deux
entrées de la fiche d'une série, la grille au bout d'une bibliothèque, les
réglages. Android TV et webOS n'en reçoivent rien (leurs écrans n'ont pas de
`FocusSection` native ; `tv-core` gagne une règle que personne d'autre ne lit
encore — le modèle de la future navigation commune).

## Prochains épisodes et Déjà vu en 16:9 (Apple TV)

Branche `claude/jolly-mayer-78c071` (2026-10-02), après l'essai de
l'utilisateur : « Les cards prochains épisodes sont affichées au format
vertical au lieu d'horizontal comme desktop. » « Déjà vu » a suivi le même
jour, à sa demande : au bureau aussi, c'est une rangée de vignettes
(`MediaRow variant="episode"`) dont le clic lance la lecture.

- **Les deux rangées** (`useHomeRowModels`) passent à la variante `landscape`
  du modèle partagé, comme au bureau et comme « Reprendre » : la vignette de
  l'ÉPISODE (repli : son fond, puis celui de la série — `resolveBannerImage`,
  la règle du bureau), sa note à lui (portée `item`), les marqueurs et la
  barre de progression du modèle. Même gabarit que « Reprendre » (380 × 214),
  même légende : la série, puis « S2 · E5 — titre de l'épisode »
  (`episodeRowSubtitle`) ; un film garde la règle des vignettes de la TV (sa
  vignette, sinon son fond et son logo) et dit son année. Le titre entier est
  dans l'en-tête du panneau.
- **Les gestes**, ceux d'une vignette : OK lance la lecture ; l'appui maintenu
  ouvre le panneau de la vignette (l'image de l'épisode, « Lire » en tête,
  Ma liste, favori, vu, « Plus d'infos ») ; « Maintenir OK » sous la légende.
- **Le focus** : la règle des sections ne change pas — ses tests disent
  désormais les deux formats (`sections.test.ts`, « rangées de formats
  différents », dont des vignettes entre deux rangées d'affiches). Éprouvé au
  banc en focus NATIF (agent XCUITest). « Prochains épisodes » : de
  « Reprendre », l'aplomb ; BAS depuis la vignette centrée à 782 → l'affiche à
  848 ; HAUT depuis l'affiche à 1400 → la vignette à 1198 (plutôt que 1614).
  « Déjà vu », entre « Pour vous » et « Ma liste » : BAS depuis l'affiche à
  1400 → la vignette à 1198 ; BAS depuis n'importe quelle vignette → le seul
  titre de « Ma liste » ; HAUT depuis lui (296), la vignette VISIBLE la plus
  proche (402, rangée défilée) ; HAUT depuis le film au bout (1650) →
  l'affiche à 1676.
- **Le défilement** : mesuré en A/B dans le même paquet (JS de production,
  10 s de HAUT / BAS au pavé, tours alternés). « Prochains épisodes » (Mac à
  44–53) : 59,4 / 59,4 / 58,8 i/s en 16:9 contre 59,6 / 59,1 / 58,9 en
  affiches. « Déjà vu » (Mac à 27–48, quatre passages par la rangée) : 59,0 /
  59,0 / 58,9 / 59,1 contre 58,8 / 59,3 / 58,5 / 59,4 ; deux tours écartés, un
  de chaque côté (accrocs de 100 à 280 ms simultanés et sonde de coût à zéro :
  le Mac, pas l'app). Autant d'images perdues, CPU de l'app au bruit près.
- **Le banc** notait toute carte d'épisode sur sa série : une vignette se note
  désormais sur l'épisode, comme l'app (`cardOf`, portée).

Planches (avant / après, et la même rangée du bureau, rendue par le vrai
composant web sur le même instantané) :
`apps/tv/harness/ui-bench/out/t4-prochains/` et `…/out/t4-deja-vu/` (non
suivis).

## Les bibliothèques rapides (Apple TV)

Branche `claude/friendly-wu-62d746` (2026-10-02). Retour de l'essai : « que
le chargement des bibliothèques soit ultra rapide, défiler super vite, mais
attention à la RAM ». Tout est mesuré au banc des bibliothèques
(`apps/tv/harness/library-bench/`, README) : l'app réelle au simulateur, en JS
de production, devant 1 200 films servis par un faux serveur CALIBRÉ sur le
vrai (Jellyfin 10.11, compte de test, lecture seule).

**Ce qui coûtait** — mesuré avant de toucher à rien (profileurs Hermes et
natif, sonde de chargement) :

- les pages : 30 titres AVEC leurs sources (`MediaSources` : 87 % du poids,
  229 Kio la page, 7,6 Kio par film), demandées à 0,6 écran de la fin — flèche
  maintenue, le focus attendait à chaque frontière de page ;
- la FlatList par défaut : 21 écrans montés, des lots de dix lignes (60
  cartes : des tâches JS de 0,4 à 1 s quand une page arrivait) ;
- le montage d'une affiche : sept valeurs partagées et huit styles ou
  réactions Reanimated, la plupart à zéro au repos — leur clonage était le
  premier poste du fil JS ; et une valeur partagée LUE sur le fil JS est un
  appel synchrone au fil d'interface (`executeOnUIRuntimeSync`) ;
- la lumière qui suit le focus redessinait l'en-tête et toute la grille à
  chaque carte traversée ;
- la barre d'index du défilement rapide de tvOS (flèche maintenue :
  `_UIFocusFastScrollingController`), que la grille ne montre pas mais que
  tvOS refabriquait, étiquettes comprises, à chaque lot de lignes ajouté :
  le premier poste du fil d'interface.

**Ce qui change** (un commit chacun) :

- la grille demande ses champs à elle (`gridCatalogParams`, jeu `grid` de
  l'api-client : `RecursiveItemCount` seul — Android TV garde `light`, ses
  cartes lisent les sources pour leurs puces de qualité) et des pages de 60 :
  58 Kio au lieu de 229 pour deux fois plus de titres ;
- la page suivante part à trois écrans de la fin ;
- les lignes sont RECYCLÉES (FlashList, déjà embarquée) : défiler ne crée
  plus ni vue native ni valeur animée ; cartes clées par leur place, images
  par leur adresse (une `Image` d'iOS garde l'ancienne image le temps que la
  nouvelle arrive) ; deux lignes d'avance, la règle des sections trouve
  toujours la ligne suivante ;
- l'habit du focus d'une carte (lueur, reflet, fondu de l'ombre :
  `CardFocusDressing`) ne naît qu'au focus et meurt à la fin du retour ; le
  recul n'existe que pour une carte de rangée ; `Reveal` ne crée rien tant
  que rien ne paraît — rendu identique, comparé au pixel ;
- la lumière du fond change toujours à chaque pas du focus, sans redessiner
  la grille (en-tête, vide et pied mémoïsés) ;
- `showsScrollIndex={false}` (react-native-tvos) : plus de barre d'index ;
- la navigation précharge la grille où le focus s'arrête 300 ms : sa première
  page (les paramètres EXACTS de l'écran) et les affiches des deux premières
  lignes, dans le cache HTTP.

| Mesuré (banc, 1 200 titres, médianes de 3 tours alternés) | Avant | Après |
|---|---|---|
| Ouverture : 1re affiche après OK | 713 ms | 508 ms |
| Ouverture : premier écran complet | 770 ms | 509 ms |
| Flèche BAS maintenue 8 s : lignes parcourues | 29 | 90 |
| — affiches vides (part du temps) | 3,4 % | 0,3 % |
| — pire attente d'une affiche | 580 ms | 80 ms |
| — affiches là après l'arrêt | 0 ms | 0 ms |
| — fil d'interface | 57,3 i/s | 59,7 i/s |
| — fil JS / sa pire tâche | 45,5 i/s / 665 ms | 54,4 i/s / 153 ms |
| 30 pas BAS, même travail : fil d'interface | 57,3 à 57,9 i/s | 59,0 à 59,9 i/s |
| — CPU de l'app par ligne parcourue | 433 à 501 ms | 219 à 306 ms |
| — GPU du simulateur | 297 à 321 ms/s | 303 à 322 ms/s |
| RAM, 3 allers-retours de bout en bout (empreinte) | 206 → 429 → 534 → 556 → 568 → 572 → 570 Mo, pic 618 | 199 → 252 → 257 → 259 → 260 → 262 → 263 Mo, pic 286 |

Mac chargé par les autres sessions (charge 16 à 32 pendant ce tableau) : les
temps absolus bougent d'une série à l'autre, l'ordre jamais. Simulateur
1080p : sur une Apple TV 4K, une affiche décodée pèse 614 Ko au lieu de 369.
RAM : sur seize passages de bout en bout, 252 → 275 Mo, une croissance qui
s'éteint (+11, +9, +3 Mo par série) ; le tas JS principal reste à 64 Mo
réservés, ses octets vivants baissent. Tas JS d'« avant » : 191 Mo, après :
73 à 78.

Pièges payés :

- **Flèche maintenue = défilement rapide de tvOS**, pas des pas du focus : la
  page file à 10 000 points/s, puis le focus se pose. Sa barre d'index se
  refabrique à chaque `setContentSize` : `showsScrollIndex={false}` sur toute
  longue page qui défile (l'accueil en profiterait aussi).
- **Après une remontée maintenue ou un glisser vif vers le haut**, tvOS pose
  la page où son défilement rapide s'arrête (127 points sous le haut : titre
  et filtres masqués). Réglé : la PREMIÈRE ligne d'une grille se révèle en
  mode `start` — dès que le focus y entre, d'où qu'il vienne, la page remonte
  d'elle-même jusqu'au titre (prouvé image par image, vidéo de l'écran avec
  `simctl io recordVideo --display=external`). Les autres lignes gardent le
  « au plus près ». La section native appelle sa révélation à CHAQUE entrée
  du focus (`didUpdateFocusInContext`), même quand tvOS ne propose aucun
  défilement.
- **L'agent XCUITest ne tient pas un appui plus d'~11 s** ; sous une charge de
  ~50, les captures `simctl` arrivent avec des secondes de retard — mesurer par
  la sonde, pas par des rafales de captures.

À éprouver sur l'Apple TV (tâche de l'utilisateur) : ouvrir Films depuis la
navigation (le préchargement joue si le focus s'y arrête un instant), flèche
maintenue jusqu'au bout et retour, glisser vif au pavé, appui long et fiche
depuis une affiche, Favoris et Ma liste (même grille). JS seulement : aucune
reconstruction de l'app, aucun changement du serveur.

## Les badges de qualité au focus (Apple TV)

Branche `claude/sweet-maxwell-3d9a5f` (2026-10-03). Demande de l'utilisateur :
« Affiche au minimum un badge 4K, ou Dolby Vision, ou Dolby Atmos si présent
lors du focus sur la card. Attention, ça doit être discret et bien intégré,
style Apple TV. »

- **Ce qui paraît** : au focus d'une affiche, d'une vignette 16:9 ou d'une
  vignette d'épisode de la fiche, quand le focus a tenu 300 ms, la qualité du
  titre — « 4K · VISION · ATMOS » — DANS l'image, en bas à droite : une
  pastille du verre de la note (voile 0,72), sur la rangée de la note
  (au-dessus de la barre de progression), sans la croiser, ni les épingles
  (en haut), ni le logo d'une vignette quand il descend jusqu'à cette rangée.
  Le 4K seul dans une capsule à peine teintée de la marque, le reste en texte
  secondaire monochrome. Fondu d'opacité seulement ; rien au repos (montée avec
  l'habit du focus, `CardFrame.focusLayer`) ; dans le sous-arbre de la cible,
  comme la note : la pastille suit la parallaxe, rien ne recouvre la cible.
  Aucun écart de grille ni de rangée ne change.
- **La règle** (`packages/shared/src/utils/qualityBadges.ts`, testée) : 4K dès
  3200 de large ou 2000 de haut (un 4K recadré en scope en est un) ; UNE
  plage — Dolby Vision, à défaut HDR10+, HDR10, HDR (« DOVIInvalid » n'est pas
  du Dolby Vision) ; Dolby Atmos dès qu'UNE piste le dit, par son profil ou son
  titre — sur un MULTi, l'Atmos est sur la VO, la piste par défaut ne le dit
  pas —, jamais déduit du codec (un TrueHD sans Atmos existe). Trois au plus,
  dans cet ordre ; formes courtes sur les cartes (celles des puces du web),
  noms entiers sur la fiche, qui suit désormais la même règle (« Dolby Atmos »
  quand la VO l'a, « HDR10 » plutôt qu'un « HDR » nu). Le web garde ses puces.
- **Ce qui tient** : chasses d'Inter relevées dans les polices embarquées
  (`redesign/theme/interMetrics.ts`, sans crénage : une borne haute), largeur
  de la note calculée de même (`cardMarkerGeometry`) ; `fitQualityBadges`
  retire les derniers badges jusqu'à ce que la rangée tienne, le 4K d'abord.
  Affiche de 240 pt avec sa note : « 4K · VISION » ; sans note, les trois ;
  vignette 16:9 et vignette d'épisode : les trois.
- **Les données** : les grilles ne demandent toujours pas les flux (jeu
  `grid`). Une liste qui les porte (fiche, rangées avec sources) dit la
  qualité tout de suite ; une série, rien. Sinon, quand le focus a TENU,
  UNE lecture légère du titre (`Items?Ids=<id>&Fields=MediaStreams`, sans
  images, état de lecture ni total) : 4 à 8 Kio, 10 à 25 ms à chaud sur le
  Jellyfin 12.1 (mesuré en lecture seule, compte de test). La source
  (`createQualityBadgeStore`, tv-core, testée ; port `qualityBadgeSource`,
  hôte unique `QualityBadgeHost`) garde ce qu'elle a lu pour la session,
  répond depuis la fiche en cache (`["item", id]`), ne lit jamais deux fois le
  même titre à la fois, suspend ses lectures 15 s après un échec. Rien ne
  s'annule en vol : le client Jellyfin n'emploie aucun signal
  (`fetchWithRetry`) ; ce qui ne part pas, c'est la lecture d'un focus qui n'a
  pas tenu.

Mesuré au banc des bibliothèques (`apps/tv/harness/library-bench/`, 1 200
films, JS de production, paquets figés joués en alternance, 3 tours ; le faux
Jellyfin compte à part les lectures de qualité, `/__stats` `qualityReads`) :

| Mesuré | Avant (`c91966235`) | Badges |
|---|---|---|
| Flèche BAS maintenue 8 s : lignes parcourues | 92 | 91 |
| — lectures de qualité PENDANT le défilement | — | **0** (une, 320 ms après le lâcher, sur la carte où le focus s'arrête) |
| — fil d'interface / fil JS | 60 / 58 i/s | 59,9 / 57,8 i/s |
| — RAM en fin (empreinte) | 220 Mo | 223 Mo |
| Ouverture : premier écran complet | 336 à 542 ms | 378 à 401 ms |
| 30 pas BAS (une carte toutes les ~0,5 s) : lectures | — | 30 — chaque carte reste plus de 300 ms, sa pastille paraît |
| — fil d'interface / fil JS | 59,9 / 59,6 i/s | 60 / 59,2 i/s |
| — CPU de l'app par pas | 204 à 218 ms | 238 à 244 ms |
| — GPU du simulateur | 203 à 246 ms/s | 221 à 254 ms/s |
| 2 allers-retours de bout en bout (800 lignes) : lectures | — | 9, toutes aux arrêts entre deux appuis maintenus |
| — RAM (empreinte), début → fin, pic | 192 → 229 → 236 → 239 → 240 Mo, pic 244 | 198 → 232 → 240 → 242 → 243 Mo, pic 247 |

Images par seconde et RAM inchangées ; un défilement rapide ne lit rien. Le
seul coût est celui de la pastille quand le focus TIENT : une lecture (4 à
14 Kio), son montage et ses deux fondus — ~25 ms de CPU par carte où l'on
s'arrête. Mac chargé par les bancs d'autres sessions (charge 4 à 18) : les
écarts d'ouverture sont dans le bruit (A va de 336 à 542 ms).

Planches : `apps/tv/harness/ui-bench/out/2026-10-03-00-08-26-badges/`
(non suivies) — groupe « Badges de qualité » du banc (`bench:ui planche
badges --focus`) : Captain America : Brave New World (4K Dolby Vision, VO
TrueHD Atmos), Les Chevaliers du ciel (1080p, rien), Game of Thrones S2 · E8
(4K HDR10), en affiche, en vignette et en vignette d'épisode.

À éprouver sur l'Apple TV (tâche de l'utilisateur) : une bibliothèque, un
film 4K Dolby Vision (s'arrêter une demi-seconde : la pastille paraît en bas
à droite, à côté de la note), un 1080p (rien), une série (rien) ; flèche
maintenue (rien ne paraît en route) ; la fiche du même film (mêmes badges,
noms entiers) ; « Reprendre » et la saison d'une série. JS seulement : aucune
reconstruction de l'app, aucun changement du serveur.

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

Automate en 6 étapes, toutes gardées :
- **Accueil** : logo, titre, sous-titre, « Afficher le code de jumelage »,
  « Configurer manuellement », **choix de langue FR/EN** (repris de l'écran
  supprimé).
- **Code relais** : chargement · erreur (Réessayer, Configurer manuellement) ·
  code actif (6 cases, instructions, « expire dans m:ss » + barre) · code
  expiré (Générer un nouveau code) · la croix Retour (vers l'accueil).
- **Serveur manuel** : champ URL (clavier système), vérification en cours,
  5 erreurs (URL invalide, délai, API absente, HTTP n, injoignable), la
  croix Retour, indice télécommande.
- **Identifiants** (Apple TV) : serveur visé, nom d'utilisateur et mot de
  passe (libellés au-dessus, clavier système, points), « Se connecter »,
  « Jumeler avec un code », un message par refus, la croix Retour (vers le
  serveur).
- **Code serveur** : mêmes états que le relais + « Changer de serveur » ; la
  croix Retour vers les identifiants.
- **Succès** : pastille animée, « Bienvenue, {nom} », ouverture de l'accueil.

### 2. Accueil (`Home`)

- **Héros plein cadre** : 1 à 5 titres (reprise, sinon mis en avant),
  rotation ; logo sinon titre ; « S01E02 · Nom » pour un épisode ; année ·
  note · durée · genres ; puces qualité/langues ; barre de reprise ; accroche
  sinon synopsis ; Lecture/Reprendre, Plus d'infos ; indicateurs.
- **Rangées**, dans l'ordre de la mise en page du compte : Reprendre,
  Prochains épisodes et Déjà vu (vignettes 16:9, OK = lecture) · puis en
  affiches (OK = la fiche) : Ma liste · Favoris · Derniers ajouts
  par bibliothèque (lots « +N épisodes ») · rangées reco (`reco:forYou`,
  `inLibrary`, `anime`, `trending`…), dont la première porte la pastille du
  filtre de plateformes.
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
  « Déjumeler cet appareil » à double appui — deux déjumelages complets,
  le premier oublie aussi l'adresse —, légende `tvUnpairCaption`) ·
  **Lecture** (mode du
  lecteur : Par défaut / Me proposer / Faire tout seul (+ Personnalisé) ;
  Android : décodage tunnelisé, fréquence ; langue de l'interface ;
  préférences par bibliothèque : audio, mode et langue des sous-titres,
  réinitialiser → liste de choix) · **À propos** (logo, version, serveur,
  compte, appareil, description, fonctionnalités, licence).
- **Nouveau** : l'interrupteur Liquid Glass (même sens que bureau et mobile) ;
  l'onglet **Navigation** (Apple TV) — les entrées de la barre de gauche,
  visibles ou masquées, dans leur ordre.

### 10. Bande-annonce (`Trailer`)

Lecture, chargement (nom), indisponible — YouTube ne la fournit pas
(réessayer plus tard), ou vidéo hors YouTube, illisible —, attente du réseau
(une roue sur la dernière image), la croix Retour (s'estompe après 3 s,
revient au moindre geste).

### 11. Lecteur — l'habillage seulement

Sur de faux états au banc, moteur jamais chargé :
- écran de chargement (résolution avec étape PrismCore, échec + Réessayer,
  démarrage + Retour) ;
- OSD : haut (Retour, titre, SxEy · nom), barre (temps, tampon, lu,
  pastille, durée), transport (précédent, −10 s, lecture/pause, +30 s,
  défilement, suivant, épisodes, réglages) ; pause ; mise en mémoire tampon ;
- défilement sur la frise (vignette au-dessus du curseur, temps visé en
  grand, écart, vitesse ×2/×4/×8, « OK · Lire ici », « Retour · Annuler ») ;
  badge de saut ±N s ;
- pilule de saut (intro, résumé, aperçu, post-générique, fin : manuelle, auto
  avec décompte + Masquer, en sourdine) et « Épisode suivant » ;
- carte « À suivre » du générique (décompte, lecture auto) et affiche de fin
  plein écran ;
- panneau des épisodes ; pistes (audio, sous-titres) ; réglages (qualité :
  Original — 4K, paliers, puces DV/HDR/Atmos/Mb/s, Auto ; « Comment
  choisir ») ;
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

### 12. Grand panneau (appui maintenu)

Variantes affiche / vignette / reco. Centré sur un voile : en-tête (image,
titre, sous-titre, fermer) ; la note — étoiles en grand, « 7/10 », l'échelle
horizontale (½ à 5 étoiles, retrait au bout) ; les pictos dans l'ordre du
modèle partagé : Lire/Reprendre (+ SxEy ou position), Ma liste, favori, vu,
Plus d'infos (toute carte de la bibliothèque, affiche comprise), Ne plus me
proposer, Toutes les plateformes ; « Demander » de Vigie pour un titre hors
bibliothèque (voir questions).

## Inventaire — ce qui s'affiche par-dessus

- **Hors ligne** : plein écran bloquant (pieuvre qui pleure, titre, message,
  Réessayer, « Déjumeler cet appareil »). Déjumeler se fait à DOUBLE appui,
  comme dans les réglages (armé : « Confirmer le
  déjumelage » et une ligne qui dit la suite), et passe par le déjumelage
  commun (`useUnpairDevice`, origine `offline`) : rien n'attend le réseau.
  Éprouvé au simulateur, serveur coupé : retour au jumelage, plus rien du
  compte (stockage, cache des requêtes, jetons en mémoire), même après une
  relance. Menu y quitte l'application (décision du 2026-09-26) : mesuré
  au-dessus d'une fiche, la pile et le voile sont intacts au retour.
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
reco, personne, extra, lot « +N », volet de saga) · « Maintenir OK » sous la
légende (`CardFocusFooter`) · grand panneau (échelle horizontale de la note,
pictos) · marqueurs (note globale,
note perso, pastille Ma liste · favori · vu, progression, « Découverte »,
puces qualité/langues — pastilles, pas de drapeaux) · bouton (primaire,
secondaire, rond, pilule) · pastille · rangée (titre ≥ 34 + accessoire) ·
héros (halo à la marque) · fond vivant (lumière de l'œuvre, violets ramenés au neutre) · navigation à
gauche (deux capsules qui épousent leur contenu : le bloc des pages, centré,
qui défile, et le profil, ancré en bas ; repliée : icônes ; ouverte : libellés
sous voile, légende en bulle ; toutes les entrées : Rechercher,
Accueil, Pour vous, Ma liste, Favoris, chaque bibliothèque, Tout afficher,
profil et réglages ; appui long : le menu d'organisation) · logo en haut à droite ·
onglets · feuille · panneau · clavier · squelettes · états vides et d'erreur ·
`GlassSurface`.

## Données — ce qui existe, ce qui manque

Présent : tout ce que listent les écrans ci-dessus (champs Jellyfin via le
proxy, notes `/api/ratings`, reco `/api/reco/page`, sagas, recherche, mise en
page de l'accueil). Images : Primary, Thumb, Backdrop, Logo (pas de Banner).

Logos : la reprise et les titres mis en avant (`useResumeItems`,
`useFeaturedItems`) demandent `Logo` depuis le 2026-10-01 — avant, Jellyfin
n'annonçait aucun logo aux vignettes « Reprendre » (`logoUriOf` →
`resolveLogoImage`). Un logo peut être OPAQUE : celui de « Les Chevaliers du
ciel » (instantané Knaoxtest) est un PNG à fond noir plein (alpha = 1
partout), d'où un pavé noir sur la vignette et dans les bannières. C'est la
donnée de Jellyfin, pas la vue : on le laisse — le remplacer dans Jellyfin
suffit.

Manquant ou non transmis aujourd'hui (le branchement le demandera) :
- la note sur la fiche (la donnée existe, `useCardRatingTarget`, jamais montée) ;
- ~~les titres hors bibliothèque sur TV (reco, recherche) : filtrés — d'où
  aucun « Demander »~~ — la recherche et la saga les montrent, grisés, et les
  demandent quand le serveur déclare Vigie (« Collection et « Demander » »,
  plus haut) ; les recommandations restent filtrées ;
- ~~lecteur : durée des décomptes, réglage « lecture auto », segments de la
  barre~~ — réglés au branchement : `countdownTotals` mesure les anneaux, la
  suite n'annonce d'échéance que si la lecture auto la lancera, et les
  segments du serveur coupent la frise.

## Constats hors UI — tâches proposées

- Android : « Adapter la fréquence d'affichage » n'est pas relu au démarrage.
- Réglages, « Oublier ce jumelage » : le texte (`pairing:tvOublierTexte`) dit
  que l'application se fermera ; sur la TV, elle rouvre le jumelage. Réglé
  sur Apple TV (`tvUnpairCaption`) ; Android TV l'affiche encore.
- ~~Filtre de plateformes de la TV : le catalogue est chargé sans studios ni
  identifiants TMDB, le filtre ne peut rien trouver.~~ — réglé au branchement
  des bibliothèques (champs complets, pages suivantes vérifiées).

Bandes noires : au simulateur, la vue racine couvre bien 1920×1080 (captures
du banc bord à bord), l'écran de lancement existe et aucune marge de zone sûre
n'est lue. Les bandes viennent de la mise en page actuelle (fond #000,
marges du cadre et de la bannière) ; la refonte va bord à bord. Reste à
confirmer sur l'Apple TV (tâche d'appareil, de jour).

## Pièges payés au branchement

- **Un `nextFocusDown` posé (`setNativeProps`) sur un champ du jumelage n'a
  aucun effet** — mesuré, alors que le même geste marche sur la croix. Pour
  orienter BAS vers un bouton, un groupe-guide (`AutoFocusGuide`).
- **Un clavier système ne s'ouvre pas pendant qu'un autre se retire**, et
  React Native croit pourtant le champ focalisé : son `focus()` ne fait plus
  RIEN ensuite — OK sur le champ ne rouvrait plus le clavier. Ouvrir par
  `blur()` puis `focus()`, et seulement sur un appui : une ouverture
  différée (le temps que l'autre se retire) se bat avec les gestes de
  l'utilisateur.
- **Le serveur lit le cookie AVANT l'en-tête** (`getTokenFromRequest`) :
  `/api/auth/login` en pose un. Tout appel de connexion d'une TV part sans
  cookie (`credentials: "omit"`).

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
  sans rendu — de l'image ET de la légende : tvOS fait défiler jusqu'à rendre
  tout son cadre visible.
- **Le Metro du banc, lancé depuis un worktree de `.claude/`, n'a pas vu les
  modifications** (2026-09-30, pas de watchman sur ce Mac) : ni `launch` ni
  un nouveau bundle ne les prenaient. Relancer `bench:ui up`, puis `launch` ;
  `list` montre le catalogue réellement servi.
- **Menu depuis le contenu d'un écran POUSSÉ dépilait l'écran** (réglé le
  2026-10-02) : depuis tvOS 26, `UINavigationController` dépile par un GESTE
  (`_backGestureRecognizer`, Menu), qui voit l'appui avant la chaîne de
  répondeurs — ni l'intercepteur ni le patch de `RNSScreen` ne le voyaient.
  `usePreventRemove` ne faisait que réempiler l'écran après coup, et celui du
  dessous paraissait 40 à 70 ms. Le patch refuse désormais ce geste
  (`RNSNavigationController`, « Le Retour (Apple TV) »).
- **Un élément démonté sous le focus ne reçoit jamais son flou** : tvOS
  l'envoie à une vue que React a déjà retirée. Le plateau d'une carte se
  démontait ainsi sous le focus parti vers la voisine, et la carte restait
  « ouverte ». `FocusTarget` annonce la perte à son démontage.
- **`GET /Users/{id}` est refusé par le proxy du serveur** (403, hors de sa
  liste blanche) : le portrait du compte passe par
  `Users/{id}/Images/Primary` (`usePairedAccount` + `useVerifiedImage`).
- **Un `select` de TanStack Query défini dans le rendu** est rejoué à chaque
  rendu ; une `Map` n'a pas de partage structurel : valeur neuve à chaque
  rendu, et tout l'accueil se redessinait (`useSeriesRatings`). Un `select`
  vit au niveau du module.
- **Un guide `autoFocus` entre par l'élément le plus en haut à gauche**, pas
  par le premier de l'arbre : pour imposer l'entrée, une DESTINATION
  (`createEntryGuide`). Et un guide sans destination se déclare
  `focusable={false}`, sinon il devient lui-même une cible invisible.
- **Une cible mémoïsée garde ses props natives** : libérée par la liaison du
  port, un bouton aux props stables restait `isTVSelectable: false`, jamais
  redessiné. Un verrou s'écrit aussi sur le nœud monté (`setNativeProps`).
- **Un calque décoratif qui DÉBORDE recouvre aussi** : le halo du portrait de
  Parcourir (116 points autour de lui) recouvrait la pilule Retour, et HAUT
  ne la trouvait plus. Un focalisable voisin d'un halo passe au-dessus
  (`zIndex`).
- **Menu depuis une page poussée faisait ARRIVER deux fois l'écran d'en
  dessous** (plus depuis le 2026-10-02 : Menu ne dépile plus de lui-même) :
  le dépilage natif, retenu, le montrait un instant avant le réempilement,
  puis la navigation dépilait pour de bon, et tvOS rendait entre les deux la
  carte qu'on y avait quittée. Un focus posé à `transitionEnd` se repose à
  chaque arrivée (`useSystemKeyboard`).
- **Un guide `autoFocus` ne ramène qu'à ce qui a DÉJÀ eu le focus**
  (`previouslyFocusedItem`) : l'en-tête de Parcourir menait à la pilule
  Retour parce qu'elle prenait le focus pendant le chargement ; arrivé sur
  une page déjà là — ou croix verrouillée —, HAUT restait sur l'affiche. Pour
  mener à une cible précise : une DESTINATION.
- **Un habillage tu ne « réapparaît » pas** : HAUT sur l'écran d'ouverture
  rallumait l'habillage caché dessous, et sa restauration de focus
  (`useTVOsdEntryFocus`) visait un bouton infocalisable — l'app restait SANS
  focus. Un piège n'y peut rien : il ne retient que les gestes, pas une
  réclamation. Ne dire « réapparu » que si rien ne le couvre (`PlayerScreen`).
- **Deux apps sur le même Metro se disputent l'inspecteur** : deux clones du
  même modèle s'y présentent sous le même identifiant d'appareil et se
  délogent l'un l'autre chaque seconde (CDP inutilisable). Un Metro par app
  — le banc d'un côté, l'app réelle de l'autre.
- **Une Modal refermée rend le focus à la VUE qui l'avait**, pas à l'entrée :
  dans une liste rendue par position, cette case montre peut-être une autre
  entrée (le menu du rail a fait monter la sienne). Réclamer au premier focus
  que tvOS rend (`useRailArrange`, `returnTo`).
- **Une réclamation faite pendant Menu sur une page poussée était défaite**
  par la restauration du réempilement, qui arrivait après elle : réclamer de
  nouveau, une fois, si le focus retombe ailleurs dans la foulée
  (`claimAfterRestore`, gardé : sans réempilement, il ne fait plus rien).
- **La Siri Remote n'émet pas `longLeft`** (ni la fin d'un appui maintenu sur
  une flèche) quand la flèche DÉPLACE le focus : un raccourci déclenché par
  une flèche se garde au rythme du focus (`RailShortcuts`). Là où le focus ne
  bouge pas (le fond du lecteur), elle l'émet bien : début à 0,5 s, fin au
  relâcher, rien entre les deux (mesuré au simulateur, télécommande à
  l'agent). Et un appui simple n'émet QUE son relâchement : `useTVRemote`
  jetait ceux de haut et bas, qui n'atteignaient jamais le lecteur.
- **Un appui MAINTENU sur OK d'un bouton sans `onLongPress`** déclenche son
  `onPress` au relâchement (React Native tvOS) : « Reprendre » du héros
  lançait la lecture. Le héros ouvre désormais le grand panneau ; tout
  bouton qui ne doit rien faire au maintien prend un `onLongPress`.
- **Pas de doigt synthétique sur tvOS** : `XCUIRemote` n'a que des appuis, et
  un chemin de pointeur d'XCTest (`XCPointerEventPath`, via
  `eventSynthesizer`, complétion `(BOOL, NSError)`) est accepté sans jamais
  atteindre la Siri Remote. LLDB, lui, s'attache à l'app du simulateur sans
  mot de passe : `[[UIScreen mainScreen] focusedView]` et ses
  `motionEffects` se relisent.
- **AVPlayer attend sans fin un flux qui ne répond pas** : mesuré au
  simulateur, plus d'une minute et demie de chargement, aucune erreur. Toute
  lecture qui n'est pas celle du lecteur principal se borne elle-même (chien
  de garde de la bande-annonce).
- **Un glisser du pavé tactile n'émet que `swipeUp/Down/Left/Right`** quand
  le focus ne peut pas bouger (un seul focalisable) : ni flèche, ni OK —
  et `useTVRemote` les ignore. Pour réveiller un chrome estompé, la
  télécommande typée (`useRemoteEvents`, `kind: "swipe"`).
- **Une sonde de 1 Ko ne prouve pas qu'un flux se lit** : le format 18 de
  YouTube sert son premier mégaoctet et refuse le reste. Sonder ce que le
  lecteur demandera (une plage ouverte).

## Recette de A à Z — ce que l'utilisateur veut éprouver (2026-09-30)

Au simulateur Apple TV, dans l'app réelle, une fois tous les branchements
fusionnés :

- naviguer de carte en carte partout : rangées, grilles, affiches qui se
  redressent, BAS / HAUT entre rangées ;
- sur chaque carte, un appui MAINTENU ouvre un GRAND panneau (2026-10-01 :
  rien ne se fait plus sur la carte elle-même) : les étoiles, l'échelle de
  note HORIZONTALE — GAUCHE / DROITE, pré-focalisée à 5/10 ou sur la note
  posée —, puis les pictos : lire, Ma liste, j'aime, vu, les infos ;
- au focus, la carte garde l'ÉPINGLE des états (Ma liste · j'aime · vu) ;
- toutes les cartes disent qu'un appui maintenu ouvre le panneau (« Maintenir
  OK : plus d'options ») ;
- la navigation se DÉPLIE au focus et montre ses libellés ;
- la marque se voit sans crier : boutons de lecture, barres de progression et
  étoiles au violet → rose, halos doux aux couleurs de la marque.

## Questions ouvertes

1. Le focus sans contour (agrandissement, reflet, verre qui blanchit) : le
   garder partout, ou un anneau discret là où l'agrandissement ne se voit pas
   (pastilles de filtre, étoiles) ?
2. ~~« Demander » de Vigie sur TV : montrer les titres hors bibliothèque
   (reco, recherche) avec leur « Demander », ou garder la TV sur la
   bibliothèque seule ?~~ — tranché le 2026-10-01 : la saga d'un film et la
   recherche seulement, et seulement quand le serveur déclare Vigie installé
   et activé (« Collection et « Demander » », plus haut).
3. Libellé du bouton de lecture : « Lire » (cartes, feuille) ou « Lecture »
   (fiche, héros) — un seul partout ?
4. ~~La croix du grand panneau n'est pas atteinte par HAUT depuis l'échelle
   (mesuré au banc) : Menu ferme le panneau. Faut-il un guide vers elle ?~~
   — oui, posé (groupe `sheet:header`, « Branchement — fiche, bande-annonce,
   feuille » ci-dessus).
5. ~~« Cette bande-annonce ne peut pas être lue sur ce téléviseur » accuse le
   téléviseur, alors que c'est YouTube qui refuse le flux (et que le serveur
   retient l'échec dix minutes). Le reformuler — « YouTube ne la fournit pas
   pour l'instant, réessayez plus tard » ?~~ — oui (tranché le 2026-10-01) :
   la voie YouTube dit « YouTube ne fournit pas cette bande-annonce pour
   l'instant. Réessayez plus tard. » (clé nouvelle `trailerUnavailableYoutube`,
   `TrailerView` `unavailableReason`) ; une vidéo hors YouTube garde
   `trailerUnavailableTv`. Android TV et webOS n'en changent rien.
