import { estHorizontale, sens, type Direction } from "./keys";
import { correction, type Mou } from "./framing";
import { candidatAuDela, dansUnCalqueFixe } from "./beyond";
import { decider } from "./border";
import {
  scrollerHorizontal,
  scrollerVertical,
  scrollersHorizontaux,
  scrollersVerticaux,
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
const MARGE = 96;

/** Pas horizontal quand aucun voisin n'a été trouvé, en fraction de piste. */
const PAS_HORIZONTAL = 0.6;

/** Plafond du pas vertical, en fraction de la hauteur visible. */
const PLAFOND_PAS_VERTICAL = 0.4;

export { scrollerHorizontal, scrollerVertical };

/**
 * Fait entrer l'élément dans la zone visible, horizontalement puis verticalement.
 *
 * Toute la CHAÎNE des conteneurs est parcourue, du plus interne au plus
 * externe, et l'élément est re-mesuré entre chaque : corriger le conteneur
 * intérieur déplace l'élément, donc la correction du suivant a pu devenir
 * nulle. Ne traiter que le premier laissait un résultat hors écran dès qu'il y
 * avait deux niveaux — la liste de résultats dans le corps de la recherche.
 */
export function amenerEnVue(element: HTMLElement): void {
  for (const scroller of scrollersHorizontaux(element)) {
    const delta = correction(
      segmentHorizontal(element.getBoundingClientRect()),
      segmentHorizontal(scroller.getBoundingClientRect()),
      MARGE,
      { avant: scroller.scrollLeft, apres: resteHorizontal(scroller) },
    );
    if (delta !== 0) scroller.scrollLeft += delta;
  }

  for (const scroller of scrollersVerticaux(element)) {
    const delta = correction(
      segmentVertical(element.getBoundingClientRect()),
      segmentVertical(scroller.getBoundingClientRect()),
      MARGE,
      { avant: scroller.scrollTop, apres: resteVertical(scroller) },
    );
    if (delta !== 0) scroller.scrollTop += delta;
  }

  // Un élément d'un calque FIXE ne suit pas la page : le « corriger » par la
  // fenêtre écrivait un défilement que l'élément ignorait — le rail faisait
  // glisser la page derrière lui de quelques pixels à CHAQUE focus, sans que
  // rien ne converge jamais, en violation de la règle « la page ne défile pas
  // sans que le focus bouge ». Ses conteneurs INTERNES, eux, viennent d'être
  // servis : un panneau fixe qui défile intérieurement défile toujours.
  if (dansUnCalqueFixe(element)) return;

  const delta = correction(
    segmentVertical(element.getBoundingClientRect()),
    { debut: 0, fin: window.innerHeight },
    MARGE,
    mouDeLaFenetre(),
  );
  if (delta !== 0) window.scrollBy(0, delta);
}

function segmentVertical(rectangle: DOMRect) {
  return { debut: rectangle.top, fin: rectangle.bottom };
}

function segmentHorizontal(rectangle: DOMRect) {
  return { debut: rectangle.left, fin: rectangle.right };
}

/** Ce que la fenêtre peut encore défiler, de part et d'autre. */
function mouDeLaFenetre(): Mou {
  const avant = Math.max(0, window.pageYOffset);
  const total = document.documentElement.scrollHeight - window.innerHeight;
  return { avant, apres: Math.max(0, total - avant) };
}

function resteVertical(scroller: HTMLElement): number {
  return Math.max(0, scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop);
}

function resteHorizontal(scroller: HTMLElement): number {
  return Math.max(0, scroller.scrollWidth - scroller.clientWidth - scroller.scrollLeft);
}

/** Un pas de défilement : son annulation, et le fait qu'il ait ACCOSTÉ —
 *  écrit jusqu'au bord, sans plus de mou au-delà. */
export interface Pas {
  annuler: () => void;
  accoste: boolean;
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
export function defilerParPas(
  depuis: HTMLElement | null,
  direction: Direction,
  confineA: ParentNode | null = null,
): Pas | null {
  const recevable = (scroller: HTMLElement | null): HTMLElement | null => {
    if (!scroller) return null;
    // Sous un conteneur piégeant, seul ce qui lui est INTÉRIEUR peut bouger.
    // Sans cette règle, « bas » depuis la dernière ligne d'un menu de filtres
    // faisait défiler la page DERRIÈRE le menu, deux fois, avant de tout
    // rendre : huit dixièmes de seconde de tremblement pour un appui qui
    // n'avait nulle part où aller.
    if (confineA && !confineA.contains(scroller)) return null;
    return scroller;
  };

  const versLaFin = sens(direction) === 1;
  const horizontal = estHorizontale(direction);

  const scroller = recevable(
    depuis ? (horizontal ? scrollerHorizontal(depuis) : scrollerVertical(depuis)) : null,
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
  const bordPossible =
    !horizontal && !confineA && !!depuis && !dansUnCalqueFixe(depuis)
      ? !candidatAuDela(depuis, versLaFin, true)
      : false;

  const vue = scroller
    ? horizontal
      ? scroller.clientWidth
      : scroller.clientHeight
    : window.innerHeight;

  const decision = decider({
    mou: mouDisponible(scroller, versLaFin, horizontal),
    // Un pas horizontal ne se mesure pas à l'élément de départ mais à la
    // piste : `Infinity` laisse le plafond décider seul, ce qu'il faisait déjà.
    hauteurDepart: horizontal ? Number.POSITIVE_INFINITY : tailleDe(depuis, false),
    vue,
    marge: MARGE,
    plafond: horizontal ? PAS_HORIZONTAL : PLAFOND_PAS_VERTICAL,
    seuil: vue,
    candidatAuDela: !bordPossible,
  });
  if (decision.type === "rien") return null;

  const ecrit = decision.type === "bord" ? decision.delta : decision.pas;
  const accoste = decision.type === "bord" || decision.accoste;
  return ecrire(scroller, versLaFin ? ecrit : -ecrit, horizontal, accoste);
}

/** Ce qui reste à défiler dans la direction, sur le scroller ou la fenêtre. */
function mouDisponible(
  scroller: HTMLElement | null,
  versLaFin: boolean,
  horizontal: boolean,
): number {
  if (!scroller) {
    const fenetre = mouDeLaFenetre();
    return versLaFin ? fenetre.apres : fenetre.avant;
  }
  if (horizontal) return versLaFin ? resteHorizontal(scroller) : scroller.scrollLeft;
  return versLaFin ? resteVertical(scroller) : scroller.scrollTop;
}

function tailleDe(element: HTMLElement | null, horizontal: boolean): number {
  if (!element) return 0;
  const boite = element.getBoundingClientRect();
  return horizontal ? boite.width : boite.height;
}

/** Écrit le défilement et rend de quoi le rendre — ou `null` s'il n'a pas pris. */
function ecrire(
  scroller: HTMLElement | null,
  delta: number,
  horizontal: boolean,
  accoste: boolean,
): Pas | null {
  if (!scroller) {
    const avant = window.pageYOffset;
    window.scrollBy(0, delta);
    if (window.pageYOffset === avant) return null;
    return { annuler: () => window.scrollTo(window.pageXOffset, avant), accoste };
  }

  if (horizontal) {
    const avant = scroller.scrollLeft;
    scroller.scrollLeft += delta;
    if (scroller.scrollLeft === avant) return null;
    return {
      annuler: () => {
        scroller.scrollLeft = avant;
      },
      accoste,
    };
  }

  const avant = scroller.scrollTop;
  scroller.scrollTop += delta;
  if (scroller.scrollTop === avant) return null;
  return {
    annuler: () => {
      scroller.scrollTop = avant;
    },
    accoste,
  };
}
