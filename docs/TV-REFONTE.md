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
    avant »). Jamais un fond violet.
- **Focus Apple TV, sans contour** : agrandissement, soulèvement, reflet ; le
  verre focalisé devient blanc, texte noir ; les voisines reculent.
- **Des affiches, sauf la reprise** (retour du 2026-10-01, « comme sur le
  bureau ») : seule « Reprendre la lecture » est en vignettes 16:9 ; toutes les
  autres rangées et étagères sont en affiches 2:3, la raison d'une
  recommandation sous la légende de l'affiche focalisée (`CardFocusNote`).
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
- **Menu d'une page poussée** : toutes les pages du rail s'empilent sur
  l'accueil, et Menu n'y atteint pas l'intercepteur. `RedesignScreen` retient
  donc le retrait (`usePreventRemove`) tant que le focus est dans le contenu :
  Menu y fait ce qu'il fait à la racine (`onBack`, sinon la navigation) ;
  depuis la navigation, la page se dépile. `onBack` est rappelé APRÈS le
  dépilage natif, qui a déjà ôté le focus : il lit `lastFocusedKey`.
- **La rangée focalisée entière à l'écran** : tvOS n'amène que la carte ;
  `revealSection` (`redesign/screens/shared/useForcedFocusReveal.ts`) amène
  sa section — légende, raison, indication de l'appui long — au plus près, à
  56 points des bords. Au banc, le même geste suit le focus figé.

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
  inatteignable.
- **Panneau** (`ActionSheetRedesign`, son focus dans `sheetFocus.ts`) : dans
  une `Modal` (Menu par `onRequestClose` : ferme). Entrée sur l'échelle, à la
  note posée, sinon à 5/10 — décidée une fois la note CONNUE (liste des notes,
  série d'un épisode : l'échelle attend, « … »), puis figée —, par le verrou
  de `useChoiceEntry` ; sans note possible, sur le premier picto. Garde
  anti-clic fantôme sur l'échelle, les pictos et la croix : le panneau s'ouvre
  sous un OK encore enfoncé. Trois groupes PLEINE LARGEUR, chacun son guide
  d'entrée — rien n'y est aligné d'une rangée à l'autre :
  - `sheet:header` mène à la croix. Au bout à droite de l'en-tête, elle
    n'est au-dessus d'aucun cran ni d'aucun picto : HAUT depuis l'échelle ne
    l'atteignait pas (constat de l'utilisateur, « la croix n'est pas
    focalisable »). Désormais HAUT depuis l'échelle y va, et depuis les
    pictos PAR l'échelle (directement, sans échelle). Elle n'est une
    destination qu'une fois le verrou d'entrée levé ;
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
  `chromeDimmed` seul — « Fermer », seul focalisable, garde le focus : le
  câblage rallume au moindre geste, appui ou glisser sur le pavé
  (`useRemoteEvents`).
- **La bande-annonce finit toujours** (branche `refonte/tv-bande-annonce`,
  2026-10-01, après « les bandes-annonces ne se lancent pas ») : par sa
  première image, sa fin, ou « indisponible » — jamais un chargement sans
  fin ni une image figée sans rien dire. Le lecteur tvOS
  (`screens/trailer/TrailerWebView.ios.tsx`) borne la résolution à 45 s
  (`resolveTrailerStream`) ; son chien de garde (`useTrailerPlaybackWatch`)
  ne dit « lecture » qu'à la première image (`onReadyForDisplay`), conclut à
  l'échec sans image en 20 s ou sans progrès pendant 15 s (à la fin si l'on
  est au bout), montre une roue sur la dernière image au bout d'une seconde
  sans progrès (`waiting`), et se suspend en arrière-plan. La raison d'un
  échec part dans les traces de dev (`[TVDIAG] [trailer]`).
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

## La navigation — beaucoup de bibliothèques (Apple TV)

Branche `refonte/tv-nav-bibliotheques`. La vue vit dans `redesign/nav/`, le
câblage dans `redesignWiring/nav/` et `screen/RailShortcuts.tsx`, la
politique partagée dans `packages/tv-core/src/nav/`.

- **Deux capsules** de verre, même largeur, un petit écart : le rail
  (Rechercher fixe en tête, puis la liste) et, dessous, la capsule du PROFIL
  (nom du compte, « Profil et réglages »), fixe. Toute la géométrie est
  constante, repliée comme dépliée (`navGeometry.ts`) : la légende du bas
  garde sa place même repliée.
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
  OK la pose, Retour annule (à la racine par l'intercepteur, sur une page
  poussée par `usePreventRemove`) ; Rechercher, Accueil, « Tout afficher »
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
| Lecteur | habillage (`chrome`), panneaux qui glissent, saut ±, « À suivre », écran de fin |

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
- **Rangées**, dans l'ordre de la mise en page du compte : Reprendre
  (vignettes 16:9, OK = lecture — la seule) · puis en affiches (OK = la
  fiche) : Prochains épisodes · Déjà vu · Ma liste · Favoris · Derniers ajouts
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
(une roue sur la dernière image), bouton Fermer (s'estompe après 3 s, revient
au moindre geste).

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
gauche (deux capsules : le rail qui défile et le profil ; repliée : icônes ;
ouverte : libellés sous voile, légende ; toutes les entrées : Rechercher,
Accueil, Pour vous, Ma liste, Favoris, chaque bibliothèque, Tout afficher,
profil et réglages ; appui long : le menu d'organisation) · logo en haut à droite ·
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
- **Menu depuis le contenu d'un écran POUSSÉ dépilait l'écran** : UIKit dépile
  avant l'intercepteur de `RedesignScreen`, et le patch de react-native-screens
  ne voit pas l'appui (tvOS 26.2). Seul `usePreventRemove` le rattrape (écran
  réempilé après coup) : c'est ce que fait désormais `RedesignScreen`. UNE
  seule retenue par écran — deux font partir deux gestes sur le même Menu.
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
- **Menu depuis une page poussée fait ARRIVER deux fois l'écran d'en
  dessous** : le dépilage natif, retenu, le montre un instant avant le
  réempilement, puis la navigation dépile pour de bon, et tvOS rend entre
  les deux la carte qu'on y avait quittée. Un focus posé à `transitionEnd`
  se repose à chaque arrivée (`useSystemKeyboard`).
- **Une Modal refermée rend le focus à la VUE qui l'avait**, pas à l'entrée :
  dans une liste rendue par position, cette case montre peut-être une autre
  entrée (le menu du rail a fait monter la sienne). Réclamer au premier focus
  que tvOS rend (`useRailArrange`, `returnTo`).
- **Une réclamation faite pendant Menu sur une page poussée est défaite** par
  la restauration du réempilement, qui arrive après elle : réclamer de
  nouveau, une fois, si le focus retombe ailleurs dans la foulée
  (`claimAfterRestore`).
- **La Siri Remote n'émet pas `longLeft`** (ni la fin d'un appui maintenu sur
  une flèche) : un raccourci déclenché par une flèche se garde au rythme du
  focus (`RailShortcuts`).
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
2. « Demander » de Vigie sur TV : montrer les titres hors bibliothèque
   (reco, recherche) avec leur « Demander », ou garder la TV sur la
   bibliothèque seule ? Le panneau sait déjà le rendre (scène « Feuille
   d'actions · Hors bibliothèque ») ; c'est le câblage qui filtre.
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
