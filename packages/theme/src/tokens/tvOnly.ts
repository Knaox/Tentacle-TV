/**
 * Les jetons propres au téléviseur — ceux qui n'appartiennent pas au
 * vocabulaire du thème.
 *
 * Séparés de `TV_THEME_TOKEN_OVERRIDES` à dessein : ces noms-là n'existent pas
 * dans `CSS_VAR_NAMES` et ne doivent pas y entrer, sinon l'éditeur de thème de
 * l'administration se mettrait à proposer des réglages qui n'ont de sens que
 * sur une dalle. Ils sont émis à part, après le bloc du thème.
 *
 * Les valeurs sont des chaînes CSS, comme partout dans ce paquet ; les cibles
 * natives les convertissent en nombres via `../native/units`.
 */

/** Le retrait d'overscan.
 *
 * Un téléviseur rogne jusqu'à 5 % de chaque bord, et rien ne permet de savoir
 * combien. Ce retrait remplace `env(safe-area-inset-*)`, que le moteur d'une
 * dalle ne renseigne pas.
 *
 * 5 % de 1920 et de 1080. Les valeurs précédentes — 64 et 36 — étaient 5 % de
 * 1280 × 720 : elles dataient d'un canevas abandonné depuis. Le canevas fait
 * maintenant 1920 et la dalle ne l'agrandit plus (mesuré : rapport de 1,00), si
 * bien que le retrait valait 64 pixels PHYSIQUES au lieu de 96 — les deux tiers
 * de ce qu'il annonce. */
export const TV_OVERSCAN = {
  x: "96px",
  y: "54px",
} as const;

/** Le halo de bannière. NE PAS toucher au flou.
 *
 * `blur` a été baissé une fois, de 48 à 22 px, en croyant corriger « les fonds
 * trop flous ». C'était une faute d'analyse : un même jeton servait à DEUX
 * choses opposées.
 *
 * Le halo de bannière est une LUEUR. Il reprend l'image, la réduit, la floute et
 * la laisse déborder tout autour du cadre — et c'est ce débordement qui fond le
 * bord de la carte dans la page. Baisser le flou l'a rétréci sous la carte : la
 * lueur a disparu et le cadre est apparu comme un rectangle noir posé là. Le
 * halo doit rester très flou, c'est sa définition.
 *
 * Le fond d'écran au focus, lui, est une IMAGE : il doit se reconnaître. Il ne
 * passe pas par ce jeton — voir le fond de focus, qui suit le modèle d'Android
 * TV et d'Apple TV : le décor net, atténué par un dégradé, sans le moindre flou.
 *
 * Côté natif, `blur` alimente `<Image blurRadius>` : le flou y est appliqué une
 * fois à l'image décodée puis mis en cache, au lieu d'être une passe de
 * compositing par image comme le `filter` CSS. `saturation` n'a pas de
 * contrepartie native — elle compense le délavage dû au flou, et son absence se
 * rattrape à l'opacité. */
export const TV_HERO_AMBILIGHT = {
  blur: "48px",
  saturation: "1.7",

  // — Ce qui suit ne part PAS dans le CSS (tvOnlyCssVarEntries liste ses paires
  //   une à une) : c'est la traduction du flou pour React Native.

  /** La carte sur laquelle `blur` a été réglé. `blur / referenceCardWidth`
   *  est le seul nombre transposable : `filter` travaille en pixels d'écran,
   *  `blurRadius` en pixels du bitmap décodé. Poser 48 sur une source de
   *  128 px, c'est un noyau de 18 % de la largeur — l'affiche est écrasée en
   *  une couleur moyenne, et le halo devient une plaque grise. */
  referenceCardWidth: "1524px",

  /** Largeur de la source demandée à Jellyfin, en pixels. Le web se contente
   *  de 128 parce qu'il floute APRÈS avoir agrandi ; en natif le flou est cuit
   *  dans le bitmap, donc son noyau se quantifie sur la source — à 128 px on
   *  vise σ ≈ 3,5 et le cran vaut 14 %, à 256 px on vise ≈ 7 et il tombe
   *  sous 8 %. */
  sourceWidth: 256,

  /** Nombre de couches de l'extinction. `blurRadius` ne déborde pas de son
   *  rectangle : le débordement est reconstruit par des rectangles concentriques
   *  dont l'alpha suit la gaussienne. Seize suffisent pour que le saut d'un
   *  anneau au suivant reste sous 0,031. */
  layers: 16,

  /** Où l'on coupe la queue de la gaussienne. Fixe le débordement à
   *  Φ⁻¹(1 − plancher) ≈ 2,33 σ. */
  alphaFloor: 0.01,
} as const;

/** Le voile diagonal de bannière, allégé pour la dalle.
 *
 * Réglé sur le web pour une bannière qui vit dans une page opaque. Sur la cible
 * téléviseur, la bannière va d'un bord à l'autre et le décor de la carte visée
 * occupe le fond : la valeur du web y produit une moitié gauche éteinte et une
 * démarcation horizontale à mi-écran.
 *
 * Le voile montait à 0,9 d'opacité au coin bas-gauche. Il protège le titre, mais
 * à cette dose il efface le tiers gauche de l'affiche — celui qui porte le plus
 * souvent le sujet. Ramené à 0,62 : le titre reste lisible et l'image redevient
 * visible. */
export const TV_HERO_SCRIM_DIAGONAL =
  "linear-gradient(72deg, " +
  "rgba(var(--scrim-media-rgb), 0.62) 0%, " +
  "rgba(var(--scrim-media-rgb), 0.38) 26%, " +
  "rgba(var(--scrim-media-rgb), 0.14) 48%, " +
  "rgba(var(--scrim-media-rgb), 0.03) 66%, " +
  "transparent 78%)";

/** L'échelle du lecteur.
 *
 * Le lecteur empile sept choses sur une vidéo, réparties dans DEUX arbres
 * React : l'habillage vit sous l'enveloppe d'opacité du lecteur, les surcouches
 * (saut, carte « à suivre ») en sont les frères. Rien ne garantit donc leur
 * ordre de peinture — sauf ce qui est écrit ici.
 *
 * L'habillage n'avait AUCUN z-index : il se peignait à l'étape du flux, donc
 * sous chacune des surcouches que le client web porte de son côté (10 pour le
 * tampon et l'écran de chargement, 20 pour la pilule de son, 30 pour les badges,
 * 40 pour le bouton de reprise, 50 pour les boutons « passer »). Un panneau
 * ouvert passait sous sa propre barre de progression, et l'écran de chargement
 * recouvrait un habillage déjà focalisé.
 *
 * L'échelle part donc AU-DESSUS de celles du web plutôt que de s'y mêler : ce
 * qui appartient au lecteur téléviseur se trie entre soi, et le reste demeure
 * dessous. Ne pas réutiliser ces valeurs ailleurs — hors lecteur, l'échelle du
 * portage va de 1 (cartes) à 100 (recherche).
 *
 * Côté natif, ces mêmes rangs alimentent `zIndex`/`elevation`. */
export const TV_PLAYER_LAYERS = {
  thumbnail: 100,
  veil: 110,
  osd: 120,
  skip: 130,
  upNext: 140,
  panelDim: 150,
  panel: 160,
} as const;

/** Correspondance rang → nom de variable CSS. Les noms restent ceux qu'emploie
 * déjà la feuille du portage ; les renommer casserait chaque règle qui les
 * consomme, pour un gain nul. */
export const TV_PLAYER_LAYER_VAR_NAMES: Record<
  keyof typeof TV_PLAYER_LAYERS,
  string
> = {
  thumbnail: "--z-lecteur-vignette",
  veil: "--z-lecteur-voile",
  osd: "--z-lecteur-osd",
  skip: "--z-lecteur-saut",
  upNext: "--z-lecteur-suivant",
  panelDim: "--z-lecteur-assombrissement",
  panel: "--z-lecteur-panneau",
};

/** Les jetons hors vocabulaire, en paires prêtes à émettre. L'ordre reproduit
 * celui de la feuille d'origine — une variable CSS ne dépend pas de son rang,
 * mais un diff lisible, si. */
export const tvOnlyCssVarEntries = (): Array<[string, string]> => [
  ["--tv-overscan-x", TV_OVERSCAN.x],
  ["--tv-overscan-y", TV_OVERSCAN.y],
  ...(Object.keys(TV_PLAYER_LAYERS) as Array<keyof typeof TV_PLAYER_LAYERS>).map(
    (key): [string, string] => [
      TV_PLAYER_LAYER_VAR_NAMES[key],
      String(TV_PLAYER_LAYERS[key]),
    ],
  ),
  ["--hero-ambilight-blur", TV_HERO_AMBILIGHT.blur],
  ["--hero-ambilight-sat", TV_HERO_AMBILIGHT.saturation],
  ["--hero-scrim-diagonal", TV_HERO_SCRIM_DIAGONAL],
];

/**
 * L'anneau de focus du salon.
 *
 * C'est le seul repère qui dit où l'on est : il n'y a ni souris ni doigt sur un
 * téléviseur, et l'œil le suit en permanence. Sa forme est donc plus arrêtée
 * que celle d'un survol web.
 *
 * Trois couches empilées : un anneau blanc NET, un halo violet de marque qui le
 * décolle du fond, et — sur une carte — une ombre portée qui la fait avancer.
 * Le blanc plutôt que le violet parce qu'une affiche peut être de n'importe
 * quelle couleur, et que seul le blanc s'y détache toujours.
 *
 * **Aucune transition sur l'anneau lui-même** : il apparaît à l'image où le
 * focus arrive. Un anneau qui monte en fondu donne l'impression d'un appareil
 * qui traîne — et le mouvement, s'il en faut un, appartient à la carte, qui
 * s'agrandit.
 *
 * Côté CSS, l'anneau est un `box-shadow` et non un `outline` : l'outline ne
 * suit le rayon des angles qu'à partir de Chromium 94, et la cible en est loin.
 * Côté natif, c'est une bordure plus une ombre — React Native ne sait pas
 * empiler deux ombres sur une même vue, d'où deux calques.
 */
export const TV_FOCUS_RING = {
  /** Épaisseur de l'anneau blanc. */
  thickness: 3,
  tint: "#ffffff",
  /** Opacité du halo violet, appliquée à la couleur de marque. */
  haloOpacity: 0.5,
  /** Rayon de flou du halo. */
  haloBlur: 18,
  /** Débordement du halo au-delà de l'anneau. Sans équivalent natif : React
   *  Native n'a pas de notion d'étalement d'ombre, le flou l'absorbe. */
  haloSpread: 4,

  /** L'ombre qui décolle une carte focalisée du fond. */
  liftOffsetY: 14,
  liftBlur: 30,
  liftOpacity: 0.85,
} as const;

/** L'agrandissement d'une carte au focus, et sa courbe.
 *
 * L'origine est le BAS de la carte : une affiche qui grandit par son centre
 * empiète sur la rangée du dessus, où le regard n'a rien à faire. En grandissant
 * par le bas, elle pousse vers le haut, dans l'espace que la rangée réserve
 * déjà pour l'anneau. */
export const TV_CARD_FOCUS = {
  scale: 1.08,
  duration: 180,
  origin: "center bottom",
} as const;

/** La bannière-CARTE — accueil et bibliothèque.
 *
 * Sur ces deux écrans, la bannière n'est pas le fond de la page : c'est le
 * premier élément d'une liste, une carte arrondie cernée de son halo. Les
 * hauteurs, le fondu et la gouttière viennent de `banner-tv.css` et
 * `library-tv.css` ; le rayon est `radius.lg` du thème (20), le liseré et le
 * halo empruntent leurs opacités au thème web (`surfaces.css`, thème sombre).
 * `tvOnly.banner.test.ts` recroise chaque valeur contre ces feuilles.
 *
 * Côté natif : hauteur = écran × `hauteurVh / 100`, liseré = `borderWidth: 1`
 * teinté de marque (un box-shadow interne n'existe pas en React Native), fondu
 * = remount keyé sur l'item + opacité seule. */
export const TV_BANNER_CARD = {
  homeHeightVh: 62,
  libraryHeightVh: 44,
  /** Gouttière latérale de la carte dans la colonne de contenu
   *  (`--row-gutter-desktop`). */
  gutter: 56,
  fadeMs: 700,
  /** Liseré : 1 px de couleur de marque à cette opacité. */
  borderOpacity: 0.22,
  /** Opacité du halo ambilight derrière la carte
   *  (`--hero-ambilight-opacity`). */
  haloOpacity: 0.55,
  /** Largeur maximale du bloc texte du héros : 46 rem. */
  textMaxWidth: 736,
  /** Bibliothèque : écart entre la carte et la rangée recherche + filtres. */
  filtersGap: 28,
  /** La jauge d'indicateurs (pastilles en lecture seule, bas-droit de la
   *  carte). Valeurs portées par `BannerGaugeTv.tsx` (classes utilitaires au
   *  point d'arrêt `md`, actif sur un canevas de 1920) — pas de feuille à
   *  recroiser, la source est ici. */
  gauge: {
    activeWidth: 44,
    inactiveWidth: 14,
    height: 4,
    gap: 8,
    inset: 40,
    transitionMs: 500,
  },
} as const;

/** La bannière de FICHE, elle, reste plein cadre : c'est le fond de l'écran,
 *  pas un élément de liste. `detail-tv.css` force cette hauteur pour passer
 *  sous les actions sans engloutir la page. */
export const TV_DETAIL_BANNER = {
  heightVh: 58,
  extraPx: 260,
} as const;

/** L'affiche de la fiche. Le composant web `DetailPoster` n'est pas substitué
 *  sur webOS : ses classes (`md:w-56`, `md:w-[22rem]`) donnent ces largeurs
 *  sur le canevas 1920. Film 2:3, épisode 16:9 ; rayon `radius.lg`. */
export const TV_DETAIL_POSTER = {
  movieWidth: 224,
  episodeWidth: 352,
} as const;

/** L'OSD du lecteur — géométrie (`player-tv.css`) et dessin
 *  (`player-osd-tv.css`). `tvOnly.player.test.ts` recroise le tout.
 *
 *  Les voiles de protection remplacent les ombres de texte : deux dégradés
 *  statiques qui débordent du retrait d'overscan jusqu'aux bords réels de la
 *  dalle (positions en pourcents entiers, prêtes pour `locations` de
 *  LinearGradient). */
export const TV_OSD = {
  primaryButton: 84,
  secondaryButton: 64,
  buttonFocusBg: "rgba(255, 255, 255, 0.24)",
  buttonFocusScale: 1.12,
  buttonTransitionMs: 160,
  titleSize: 36,
  subtitleSize: 21,
  subtitleTint: "rgba(255, 255, 255, 0.84)",
  topScrim: { opacities: [0.72, 0.42, 0], positionsPct: [0, 48, 100], bleedPx: 72 },
  bottomScrim: { opacities: [0.82, 0.5, 0], positionsPct: [0, 46, 100], bleedPx: 96 },
  bar: {
    height: 9,
    bg: "rgba(255, 255, 255, 0.18)",
    buffer: "rgba(255, 255, 255, 0.42)",
    knob: 18,
    ghost: 24,
  },
} as const;

/** Les panneaux flottants du lecteur (pistes, épisodes) : ancrés au-dessus de
 *  la barre de progression, jamais pleine hauteur. Le voile n'existe QUE
 *  panneau ouvert — pas de calque permanent à opacité nulle au-dessus d'une
 *  vidéo. */
export const TV_PLAYER_PANEL = {
  width: 460,
  bottom: 154,
  scrim: "rgba(0, 0, 0, 0.62)",
  scrimFadeMs: 180,
  /** Hauteur maximale du contenu : tout l'écran moins ce retrait. */
  maxHeightInset: 260,
  buttonMinHeight: 52,
  buttonText: 19,
  episodeThumb: { width: 160, height: 90 },
} as const;

/** Le bouton « passer l'intro / le générique » : ancré au retrait d'overscan,
 *  il s'écarte de la barre quand l'habillage est visible (transform, jamais
 *  `bottom` — une position animée relance la mise en page). */
export const TV_PLAYER_SKIP = {
  bottom: 148,
  lift: 56,
  paddingV: 14,
  paddingH: 28,
  radius: 10,
  text: 20,
} as const;

/** La carte « épisode suivant », au coin bas-droit du retrait d'overscan. */
export const TV_PLAYER_NEXT_CARD = {
  width: 460,
} as const;
