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
  epaisseur: 3,
  teinte: "#ffffff",
  /** Opacité du halo violet, appliquée à la couleur de marque. */
  haloOpacite: 0.5,
  /** Rayon de flou du halo. */
  haloFlou: 18,
  /** Débordement du halo au-delà de l'anneau. Sans équivalent natif : React
   *  Native n'a pas de notion d'étalement d'ombre, le flou l'absorbe. */
  haloEtalement: 4,

  /** L'ombre qui décolle une carte focalisée du fond. */
  releveDecalageY: 14,
  releveFlou: 30,
  releveOpacite: 0.85,
} as const;

/** L'agrandissement d'une carte au focus, et sa courbe.
 *
 * L'origine est le BAS de la carte : une affiche qui grandit par son centre
 * empiète sur la rangée du dessus, où le regard n'a rien à faire. En grandissant
 * par le bas, elle pousse vers le haut, dans l'espace que la rangée réserve
 * déjà pour l'anneau. */
export const TV_CARD_FOCUS = {
  echelle: 1.08,
  duree: 180,
  origine: "center bottom",
} as const;
