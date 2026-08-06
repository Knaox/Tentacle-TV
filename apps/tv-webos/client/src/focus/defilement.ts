import { estHorizontale, sens, type Direction } from "./touches";
import { correction, type Mou } from "./cadrage";
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
 * Le calcul lui-même vit dans `cadrage.ts`, qui ne connaît que des segments :
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

function dansUnCalqueFixe(element: HTMLElement): boolean {
  for (let courant: HTMLElement | null = element; courant; courant = courant.parentElement) {
    if (getComputedStyle(courant).position === "fixed") return true;
  }
  return false;
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

  // Le pas se BORNE au mou restant, et un mou nul le refuse net. C'est la fin
  // de l'aller-retour de bout de page : arrivé au bord — où le cadrage vient
  // de coller le scroll —, l'appui suivant écrivait un pas que le navigateur
  // clampait au maximum, la barre sautait au fond, puis la révocation la
  // ramenait huit dixièmes de seconde plus tard. Un pas qui n'a nulle part où
  // aller n'a pas à partir — et un pas qui écrit tout le mou a ACCOSTÉ.
  if (estHorizontale(direction)) {
    const scroller = recevable(depuis ? scrollerHorizontal(depuis) : null);
    if (!scroller) return null;
    const avant = scroller.scrollLeft;
    const mou = sens(direction) === 1 ? resteHorizontal(scroller) : avant;
    if (mou < 1) return null;
    const pas = Math.min(scroller.clientWidth * PAS_HORIZONTAL, mou);
    scroller.scrollLeft += sens(direction) * pas;
    if (scroller.scrollLeft === avant) return null;
    return {
      annuler: () => {
        scroller.scrollLeft = avant;
      },
      accoste: pas >= mou,
    };
  }

  const scroller = recevable(depuis ? scrollerVertical(depuis) : null);
  // La fenêtre n'est jamais intérieure à un piège : sous lui, il n'y a rien à
  // faire défiler si le panneau lui-même ne défile pas.
  if (!scroller && confineA) return null;

  const vue = scroller ? scroller.clientHeight : window.innerHeight;
  const rangee = depuis ? depuis.getBoundingClientRect().height + MARGE : vue * PLAFOND_PAS_VERTICAL;
  const plafonne = Math.min(rangee, vue * PLAFOND_PAS_VERTICAL);

  if (scroller) {
    const avant = scroller.scrollTop;
    const mou = sens(direction) === 1 ? resteVertical(scroller) : avant;
    if (mou < 1) return null;
    const pas = Math.min(plafonne, mou);
    scroller.scrollTop += sens(direction) * pas;
    if (scroller.scrollTop === avant) return null;
    return {
      annuler: () => {
        scroller.scrollTop = avant;
      },
      accoste: pas >= mou,
    };
  }

  const avant = window.pageYOffset;
  const mouFenetre = sens(direction) === 1 ? mouDeLaFenetre().apres : mouDeLaFenetre().avant;
  if (mouFenetre < 1) return null;
  const pas = Math.min(plafonne, mouFenetre);
  window.scrollBy(0, sens(direction) * pas);
  if (window.pageYOffset === avant) return null;
  return {
    annuler: () => {
      window.scrollTo(window.pageXOffset, avant);
    },
    accoste: pas >= mouFenetre,
  };
}
