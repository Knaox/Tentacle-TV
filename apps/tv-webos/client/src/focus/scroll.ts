import { isHorizontal, directionSign, type Direction } from "./keys";
import { correction, type Slack } from "./framing";
import { candidateBeyond, inFixedLayer } from "./beyond";
import { decide } from "./border";
import {
  horizontalScroller,
  verticalScroller,
  horizontalScrollers,
  verticalScrollers,
} from "./scrollers";

/**
 * Amener un élément en vue, et faire défiler quand il n'y a pas de voisin.
 *
 * **Jamais `scrollIntoView(options)`** : sur Chrome 53 la forme dictionnaire
 * n'existe pas. L'objet passé est évalué comme un booléen, toujours vrai, et
 * l'appel devient `scrollIntoView(true)` — alignement en haut, saut brutal à
 * chaque déplacement du focus. Tout se fait donc par écriture directe de
 * `scrollLeft` et `scrollTop`, ce qui a le mérite d'être exact partout.
 *
 * Le calcul lui-même vit dans `framing.ts`, qui ne connaît que des segments :
 * il est le même pour un axe ou l'autre, pour un conteneur ou pour la fenêtre,
 * et il est testé.
 */

/** Marge conservée entre l'élément visé et le bord, en pixels. */
const MARGIN = 96;

/** Pas horizontal quand aucun voisin n'a été trouvé, en fraction de piste. */
const HORIZONTAL_STEP = 0.6;

/** Plafond du pas vertical, en fraction de la hauteur visible. */
const MAX_VERTICAL_STEP = 0.4;

export { horizontalScroller, verticalScroller };

/**
 * Fait entrer l'élément dans la zone visible, horizontalement puis verticalement.
 *
 * Toute la CHAÎNE des conteneurs est parcourue, du plus interne au plus
 * externe, et l'élément est re-mesuré entre chaque : corriger le conteneur
 * intérieur déplace l'élément, donc la correction du suivant a pu devenir
 * nulle. Ne traiter que le premier laissait un résultat hors écran dès qu'il y
 * avait deux niveaux — la liste de résultats dans le corps de la recherche.
 */
export function bringIntoView(element: HTMLElement): void {
  for (const scroller of horizontalScrollers(element)) {
    const delta = correction(
      segmentHorizontal(element.getBoundingClientRect()),
      segmentHorizontal(scroller.getBoundingClientRect()),
      MARGIN,
      { before: scroller.scrollLeft, after: horizontalRest(scroller) },
    );
    if (delta !== 0) scroller.scrollLeft += delta;
  }

  for (const scroller of verticalScrollers(element)) {
    const delta = correction(
      segmentVertical(element.getBoundingClientRect()),
      segmentVertical(scroller.getBoundingClientRect()),
      MARGIN,
      { before: scroller.scrollTop, after: verticalRest(scroller) },
    );
    if (delta !== 0) scroller.scrollTop += delta;
  }

  // Un élément d'un calque FIXE ne suit pas la page : le « corriger » par la
  // fenêtre écrivait un défilement que l'élément ignorait — le rail faisait
  // glisser la page derrière lui de quelques pixels à CHAQUE focus, sans que
  // rien ne converge jamais, en violation de la règle « la page ne défile pas
  // sans que le focus bouge ». Ses conteneurs INTERNES, eux, viennent d'être
  // servis : un panneau fixe qui défile intérieurement défile toujours.
  if (inFixedLayer(element)) return;

  const delta = correction(
    segmentVertical(element.getBoundingClientRect()),
    { debut: 0, fin: window.innerHeight },
    MARGIN,
    windowSlack(),
  );
  if (delta !== 0) window.scrollBy(0, delta);
}

function segmentVertical(rect: DOMRect) {
  return { debut: rect.top, fin: rect.bottom };
}

function segmentHorizontal(rect: DOMRect) {
  return { debut: rect.left, fin: rect.right };
}

/** Ce que la fenêtre peut encore défiler, de part et d'autre. */
function windowSlack(): Slack {
  const before = Math.max(0, window.pageYOffset);
  const total = document.documentElement.scrollHeight - window.innerHeight;
  return { before, after: Math.max(0, total - before) };
}

function verticalRest(scroller: HTMLElement): number {
  return Math.max(0, scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop);
}

function horizontalRest(scroller: HTMLElement): number {
  return Math.max(0, scroller.scrollWidth - scroller.clientWidth - scroller.scrollLeft);
}

/** Un pas de défilement : son annulation, et le fait qu'il ait ACCOSTÉ —
 *  écrit jusqu'au bord, sans plus de mou au-delà. */
export interface Step {
  cancel: () => void;
  docked: boolean;
}

/**
 * Défile d'UN pas dans la direction, sans cible précise, et de façon révocable.
 *
 * Appelé quand aucun voisin n'a été trouvé — le cas le plus fréquent étant une
 * rangée vidée par le fenêtrage, dont les cartes ne sont pas montées et ne
 * peuvent donc pas être visées. Le défilement les fait apparaître, et le
 * moteur retente ensuite.
 *
 * Deux différences avec l'ancien pas aveugle, chacune payée par un défaut vu à
 * l'écran. Le pas VERTICAL vaut une rangée — la hauteur du point de départ
 * plus la marge du module, plafonnée — et non 60 % d'écran : le grand pas
 * faisait glisser la fenêtre de recensement de plusieurs rangées, et le
 * rattrapage choisissait une carte lointaine, quand il ne démontait pas la
 * carte focalisée elle-même. Et il vise le CONTENEUR à défilement vertical qui
 * porte l'élément avant la fenêtre : dans une surcouche — recherche, panneau
 * de choix —, c'est lui qui doit bouger, pas la page derrière.
 *
 * Rend le pas — son ANNULATION, qui restaure la position d'origine, et son
 * ACCOSTAGE — ou `null` si rien ne peut défiler. L'annulation garantit la
 * règle : un défilement qui n'a pas abouti à un déplacement du focus n'a
 * jamais eu lieu. L'accostage en marque l'exception, décidée par l'appelant :
 * un pas qui a touché le BORD du document répond à un appui explicite vers ce
 * bord, et le bout de la page — bannière au-dessus du premier élément, pied
 * sous le dernier — est une destination en soi.
 *
 * **Et quand il n'y a plus rien à révéler, on ne fait pas un pas : on rejoint
 * le bord.** `border.ts` tranche entre les deux ; ce module ne fait que
 * mesurer le mou, lui poser la question, et écrire. Le pas qui vient d'un
 * « bord » est rendu ACCOSTÉ, ce qui suffit à le mettre hors de portée de la
 * révocation — l'appelant n'a rien de plus à savoir.
 */
export function scrollByStep(
  since: HTMLElement | null,
  direction: Direction,
  confineA: ParentNode | null = null,
): Step | null {
  const acceptable = (scroller: HTMLElement | null): HTMLElement | null => {
    if (!scroller) return null;
    // Sous un conteneur piégeant, seul ce qui lui est INTÉRIEUR peut bouger.
    // Sans cette règle, « bas » depuis la dernière ligne d'un menu de filtres
    // faisait défiler la page DERRIÈRE le menu, deux fois, avant de tout
    // rendre : huit dixièmes de seconde de tremblement pour un appui qui
    // n'avait nulle part où aller.
    if (confineA && !confineA.contains(scroller)) return null;
    return scroller;
  };

  const towardsEnd = directionSign(direction) === 1;
  const horizontal = isHorizontal(direction);

  const scroller = acceptable(
    since ? (horizontal ? horizontalScroller(since) : verticalScroller(since)) : null,
  );
  // La fenêtre n'est jamais intérieure à un piège : sous lui, il n'y a rien à
  // faire défiler si le panneau lui-même ne défile pas. Et il n'y a pas de
  // défilement horizontal de fenêtre : le rail est fixe, la page ne bouge pas
  // latéralement.
  if (!scroller && (confineA || horizontal)) return null;

  // **Le bord ne concerne que la VERTICALE.** C'est là que le défaut se voit —
  // une page dont on ne rejoint jamais le haut. Horizontalement, la question
  // « reste-t-il un candidat à droite » se poserait au DOCUMENT alors que le
  // mou est celui d'une piste : une rangée voisine répondrait pour elle. Les
  // pistes gardent donc leur pas éprouvé, et leur bout reste affaire de
  // révocation. Sous un piège, le bord d'un panneau n'est pas un bout de page.
  const possibleEdge =
    !horizontal && !confineA && !!since && !inFixedLayer(since)
      ? !candidateBeyond(since, towardsEnd, true)
      : false;

  const view = scroller
    ? horizontal
      ? scroller.clientWidth
      : scroller.clientHeight
    : window.innerHeight;

  const decision = decide({
    slack: availableSlack(scroller, towardsEnd, horizontal),
    // Un pas horizontal ne se mesure pas à l'élément de départ mais à la
    // piste : `Infinity` laisse le plafond décider seul, ce qu'il faisait déjà.
    startHeight: horizontal ? Number.POSITIVE_INFINITY : tailleDe(since, false),
    view,
    margin: MARGIN,
    ceiling: horizontal ? HORIZONTAL_STEP : MAX_VERTICAL_STEP,
    threshold: view,
    candidateBeyond: !possibleEdge,
  });
  if (decision.type === "none") return null;

  const written = decision.type === "bord" ? decision.delta : decision.step;
  const docked = decision.type === "bord" || decision.docked;
  return write(scroller, towardsEnd ? written : -written, horizontal, docked);
}

/** Ce qui reste à défiler dans la direction, sur le scroller ou la fenêtre. */
function availableSlack(
  scroller: HTMLElement | null,
  towardsEnd: boolean,
  horizontal: boolean,
): number {
  if (!scroller) {
    const window = windowSlack();
    return towardsEnd ? window.after : window.before;
  }
  if (horizontal) return towardsEnd ? horizontalRest(scroller) : scroller.scrollLeft;
  return towardsEnd ? verticalRest(scroller) : scroller.scrollTop;
}

function tailleDe(element: HTMLElement | null, horizontal: boolean): number {
  if (!element) return 0;
  const box = element.getBoundingClientRect();
  return horizontal ? box.width : box.height;
}

/** Écrit le défilement et rend de quoi le rendre — ou `null` s'il n'a pas pris. */
function write(
  scroller: HTMLElement | null,
  delta: number,
  horizontal: boolean,
  docked: boolean,
): Step | null {
  if (!scroller) {
    const before = window.pageYOffset;
    window.scrollBy(0, delta);
    if (window.pageYOffset === before) return null;
    return { cancel: () => window.scrollTo(window.pageXOffset, before), docked };
  }

  if (horizontal) {
    const before = scroller.scrollLeft;
    scroller.scrollLeft += delta;
    if (scroller.scrollLeft === before) return null;
    return {
      cancel: () => {
        scroller.scrollLeft = before;
      },
      docked,
    };
  }

  const before = scroller.scrollTop;
  scroller.scrollTop += delta;
  if (scroller.scrollTop === before) return null;
  return {
    cancel: () => {
      scroller.scrollTop = before;
    },
    docked,
  };
}
