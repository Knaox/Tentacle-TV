/**
 * Le MOUVEMENT de la refonte TV — pour Apple TV seulement.
 *
 * À côté de la scène (`tvStage.ts`) : ce que le salon change au rythme. Des
 * nombres, pas des fonctions : les vues d'Apple TV les traduisent en courbes
 * et en ressorts Reanimated (`apps/tv/src/redesign/motion/`), qui les jouent
 * sur le fil d'interface. Android TV et webOS n'en reçoivent AUCUN : l'app
 * aiguille par plateforme, et la logique partagée n'en porte jamais.
 *
 * Le vocabulaire est celui d'Apple : un ressort se dit par sa RÉPONSE (la
 * période de l'oscillation non amortie, en secondes) et sa fraction
 * d'amortissement (1 : sans rebond ; 0,8 : un dépassement de 1,5 %,
 * invisible, qui donne l'arrivée « vivante » du focus de tvOS). Une courbe se
 * dit par les points de contrôle d'une cubique de Bézier, une durée en ms.
 *
 * Les règles : n'animer que `transform` et `opacity` ; ce qui arrive suit une
 * sortie douce ou un ressort, ce qui s'en va est plus bref (60 à 70 % de
 * l'entrée) ; tout s'interrompt — un focus qui repart reprend là où en est
 * l'animation, avec sa vitesse ; réduire les animations les rend instantanées.
 */

type Bezier = readonly [number, number, number, number];

export interface TvSpring {
  /** Période de l'oscillation non amortie, en secondes. */
  response: number;
  /** 1 : critique, sans rebond ; < 1 : un dépassement. */
  dampingFraction: number;
}

export const TV_MOTION = {
  curve: {
    /** La sortie douce du bureau (`--ease-out`) : ce qui ARRIVE. */
    out: [0.22, 1, 0.36, 1] as Bezier,
    /** L'aller-retour d'un état qui bascule, le fondu enchaîné. */
    inOut: [0.45, 0, 0.25, 1] as Bezier,
    /** Ce qui S'EN VA : part doucement, finit vite. */
    in: [0.4, 0, 1, 1] as Bezier,
  },
  spring: {
    /** Le focus qui arrive : vif (75 % en 100 ms), un dépassement invisible. */
    focus: { response: 0.28, dampingFraction: 0.8 } as TvSpring,
    /** L'appui relâché : l'élément remonte avec un soupçon de rebond. */
    press: { response: 0.3, dampingFraction: 0.62 } as TvSpring,
    /** Un panneau qui surgit (grand panneau, listes, liste de choix). */
    panel: { response: 0.42, dampingFraction: 0.86 } as TvSpring,
    /** La navigation qui se déplie. */
    unfold: { response: 0.36, dampingFraction: 0.88 } as TvSpring,
  },
  focus: {
    /** Le focus qui s'en va : plus bref que l'arrivée, sans rebond. */
    outMs: 200,
    /** Les voisines qui reculent, et reviennent. */
    recedeMs: 260,
  },
  press: {
    /** OK enfoncé : l'élément s'enfonce d'un cran… */
    scale: 0.96,
    inMs: 90,
  },
  reveal: {
    /** Ce qui paraît au focus (légende, indication, raison) et se retire. */
    inMs: 220,
    outMs: 140,
  },
  overlay: {
    /** Le voile d'une surimpression, à l'ouverture et à la fermeture. */
    veilInMs: 240,
    veilOutMs: 180,
    /** Le panneau qui se retire. */
    panelOutMs: 160,
    /** Ce que le panneau part de plus petit (0,94) et y retourne. */
    panelScale: 0.94,
  },
  page: {
    /** Le fondu enchaîné de la pile native d'un écran à l'autre. */
    fadeMs: 320,
    /** L'arrivée du contenu d'un écran poussé (l'en-tête d'une fiche). */
    enterMs: 420,
    /** Ce que ce contenu attend : l'image le précède. */
    enterDelayMs: 80,
  },
  image: {
    /** Une grande image qui arrive se POSE : elle part un peu plus près… */
    settleScale: 1.04,
    /** …et recule à sa place, lentement (sortie douce). */
    settleMs: 900,
    /** Une image chargée entre en fondu, au lieu d'apparaître d'un coup. */
    fadeInMs: 300,
  },
  player: {
    /** L'habillage qui paraît au moindre geste : vite, en sortie douce… */
    chromeInMs: 260,
    /** …et qui s'efface à l'inactivité : posément, sans hâte devant l'image. */
    chromeOutMs: 300,
    /** Ce que la frise et les commandes montent en paraissant, en points. */
    chromeRise: 24,
    /** Ce que la barre du haut descend en paraissant. */
    chromeDrop: 16,
    /** Ce qu'un panneau (épisodes, pistes) ou une carte glisse en entrant. */
    panelSlide: 48,
  },
  crossfade: {
    /** Le héros qui tourne : l'image. Le texte part vite, arrive après. */
    heroMs: 700,
    heroTextOutMs: 180,
    heroTextInMs: 360,
    /** Le fond vivant qui change de lumière. */
    ambientMs: 600,
  },
  /**
   * La parallaxe au pouce : ce que le doigt posé sur le pavé tactile fait à
   * l'élément focalisé — un décalage (`shift`, en points, de chaque côté) et
   * une inclinaison (`tilt`, en radians), au plus fort quand le doigt est au
   * bord. C'est tvOS qui la joue, d'après le doigt.
   */
  parallax: {
    /** Le cadre d'une carte (affiche, vignette, épisode, portrait). */
    card: { shift: 6, tilt: 0.07 },
    /** Une ligne large (réglage, option, entrée de navigation) : elle glisse,
     *  sans s'incliner — l'inclinaison en déformerait les bords. */
    row: { shift: 3, tilt: 0 },
  },
} as const;
