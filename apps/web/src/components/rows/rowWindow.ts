/**
 * Fenêtre de cartes rendues dans une rangée, et les deux cales qui tiennent sa
 * géométrie.
 *
 * Module PUR — des nombres, aucun élément — sur le modèle de
 * `hoverPreviewGeometry` : c'est ce qui le rend testable sans DOM, et
 * l'arithmétique ci-dessous mérite de l'être. Les mesures vivent dans
 * `useRowWindow`.
 *
 * # Pourquoi pas `@tanstack/react-virtual`, qui est déjà installé
 *
 * Il est utilisé pour la grille de bibliothèque, où il est le bon outil. Ici il
 * ne l'est pas, pour trois raisons dans l'ordre de gravité :
 *
 *  1. Il positionne les éléments en `position: absolute`. Des enfants absolus ne
 *     participent plus au dimensionnement du parent : la piste s'effondrerait à
 *     zéro de hauteur, et la rangée entière avec. Il faudrait donc lui imposer
 *     une hauteur calculée — or le bloc titre d'une carte fait 48 ou 50 px selon
 *     qu'il porte ou non sa seconde ligne, sur deux variantes de carte. On
 *     remplacerait une hauteur exacte et gratuite par une constante magique.
 *  2. Il poserait un `transform` sur chaque carte, ce qui crée un bloc conteneur
 *     et un contexte d'empilement par carte — donc un conflit direct avec le
 *     `z-index` de survol, qui a précisément besoin que les cartes se comparent
 *     entre elles.
 *  3. Sa mesure dynamique ne résout aucun problème existant : `useRowCardWidth`
 *     rend déjà une largeur EXACTE, identique pour toutes les cartes de la
 *     rangée. Sa dérive « estimation ≠ réel » deviendrait au contraire une source
 *     de décalages là où l'arithmétique est juste au pixel.
 *
 * Le jour où une rangée aurait des cartes de largeurs différentes, il faudra
 * l'utiliser. Pas avant.
 */

export interface RowWindowInput {
  scrollLeft: number;
  clientWidth: number;
  /** Gouttière gauche du scroller — la première carte commence après elle. */
  paddingLeft: number;
  cardWidth: number;
  /** `column-gap` mesuré sur le scroller, jamais écrit en dur. */
  gap: number;
  count: number;
  overscan: number;
  /**
   * Index de la carte SURVOLÉE, que la fenêtre englobe même si le défilement
   * l'en a fait sortir. Voir `PIN_REACH`.
   */
  pinned?: number | null;
  /**
   * Rangée hors écran : aucune carte rendue, une seule cale de la largeur
   * totale. L'élément scroller survit, donc le navigateur conserve son
   * `scrollLeft` — c'est tout l'intérêt de vider la fenêtre plutôt que de
   * démonter la rangée.
   */
  vacant?: boolean;
}

export interface RowWindowRange {
  /** Premier index rendu. `end < start` signale une plage VIDE. */
  start: number;
  end: number;
  /** Largeur de la cale de tête, en pixels. Zéro = pas de cale. */
  padStart: number;
  padEnd: number;
}

/**
 * Portée maximale de l'épingle de survol, en cartes.
 *
 * Au-delà, la carte survolée est si loin de la fenêtre visible que son aperçu
 * est de toute façon déjà refermé (le suivi de `useHoverPreview` ferme dès que
 * le curseur n'est plus sur la carte). L'épingle ne sert qu'au TRANSITOIRE : la
 * fenêtre bouge alors que le curseur, lui, n'a pas bougé.
 */
const PIN_REACH = 4;

const clamp = (v: number, min: number, max: number): number =>
  Math.max(min, Math.min(v, max));

/**
 * Largeur totale de la piste, cales comprises : `count × (carte + gouttière)`
 * moins la dernière gouttière.
 *
 * C'est l'invariant de tout ce module. `scrollWidth` doit être IDENTIQUE avec ou
 * sans fenêtrage, sinon les flèches de défilement (`useRowScroll`, qui compare
 * `scrollLeft` à `scrollWidth`) et les bornes du panneau d'aperçu
 * (`boundsFor`) se trompent — et le `scrollLeft` sauterait à chaque changement
 * de fenêtre.
 */
export function rowTrackWidth(count: number, cardWidth: number, gap: number): number {
  return count <= 0 ? 0 : count * (cardWidth + gap) - gap;
}

/**
 * La fenêtre à rendre, et la largeur des deux cales qui remplacent le reste.
 *
 * Les cales ne portent JAMAIS `snap-start` : ce sont des vides, pas des points
 * d'accroche. Et leur largeur exclut la gouttière qui les sépare de la première
 * (respectivement dernière) carte rendue : celle-là est fournie par le `gap` du
 * conteneur flex, comme entre deux cartes. D'où le `− gap` des deux formules.
 */
export function rowWindow(input: RowWindowInput): RowWindowRange {
  const { cardWidth, gap, count, overscan, vacant } = input;
  const step = cardWidth + gap;

  if (count <= 0 || step <= 0) {
    return { start: 0, end: -1, padStart: 0, padEnd: 0 };
  }

  if (vacant) {
    return { start: 0, end: -1, padStart: rowTrackWidth(count, cardWidth, gap), padEnd: 0 };
  }

  // Index des cartes qui contiennent les deux bords de la zone visible. Une
  // sur-inclusion d'une carte est sans conséquence — c'est précisément ce que
  // l'overscan absorbe.
  const origin = input.scrollLeft - input.paddingLeft;
  const first = Math.floor(origin / step);
  const last = Math.floor((origin + input.clientWidth) / step);

  let start = clamp(first - overscan, 0, count - 1);
  let end = clamp(last + overscan, 0, count - 1);

  const pinned = input.pinned;
  if (pinned != null && pinned >= 0 && pinned < count) {
    // L'épingle ÉTEND la plage, elle n'ajoute jamais un index isolé : une plage
    // à trou casserait l'arithmétique à deux cales.
    if (pinned < start) start = Math.max(0, Math.max(pinned, start - PIN_REACH));
    else if (pinned > end) end = Math.min(count - 1, Math.min(pinned, end + PIN_REACH));
  }

  return {
    start,
    end,
    padStart: start > 0 ? start * step - gap : 0,
    padEnd: end < count - 1 ? (count - 1 - end) * step - gap : 0,
  };
}
