import { estHorizontale, sens, type Direction } from "./touches";

/**
 * Amener un élément en vue, et faire défiler quand il n'y a pas de voisin.
 *
 * **Jamais `scrollIntoView(options)`** : sur Chrome 53 la forme dictionnaire
 * n'existe pas. L'objet passé est évalué comme un booléen, toujours vrai, et
 * l'appel devient `scrollIntoView(true)` — alignement en haut, saut brutal à
 * chaque déplacement du focus. Tout se fait donc par écriture directe de
 * `scrollLeft` et `scrollTop`, ce qui a le mérite d'être exact partout.
 */

/** Marge conservée entre l'élément visé et le bord, en pixels. */
const MARGE = 96;

/** Pas horizontal quand aucun voisin n'a été trouvé, en fraction de piste. */
const PAS_HORIZONTAL = 0.6;

/** Plafond du pas vertical, en fraction de la hauteur visible. */
const PLAFOND_PAS_VERTICAL = 0.4;

/** Fait entrer l'élément dans la zone visible, horizontalement puis verticalement. */
export function amenerEnVue(element: HTMLElement): void {
  const scroller = scrollerHorizontal(element);
  if (scroller) amenerDansScroller(element, scroller);

  // Puis le conteneur qui défile VERTICALEMENT, s'il y en a un — un rail dont
  // les entrées débordent, une liste d'options, un panneau de réglages.
  //
  // Sans cette étape, l'élément n'était amené en vue que par le comportement
  // natif de `focus()` : il colle au bord, sans la marge que le reste du module
  // s'impose, et sur une dalle qui rogne ses bords il peut rester invisible.
  const vertical = scrollerVertical(element);
  if (vertical) amenerDansScrollerVertical(element, vertical);

  amenerDansPage(element);
}

/**
 * Le conteneur à défilement horizontal qui porte l'élément, s'il existe.
 *
 * C'est la piste d'une rangée. Le reconnaître importe : faire défiler la page
 * pour atteindre une carte située à droite ne servirait à rien, c'est la piste
 * qu'il faut déplacer.
 */
export function scrollerHorizontal(element: HTMLElement): HTMLElement | null {
  let courant: HTMLElement | null = element.parentElement;
  while (courant && courant !== document.body) {
    const style = window.getComputedStyle(courant);
    const defile = style.overflowX === "auto" || style.overflowX === "scroll";
    if (defile && courant.scrollWidth > courant.clientWidth + 1) return courant;
    courant = courant.parentElement;
  }
  return null;
}

/**
 * Le conteneur à défilement vertical qui porte l'élément, s'il existe.
 *
 * Écrit à part de son homologue horizontal plutôt que paramétré : les deux
 * lisent des propriétés différentes, et une fonction qui prend un axe en
 * argument coûterait plus à lire qu'elle n'économise à écrire.
 */
export function scrollerVertical(element: HTMLElement): HTMLElement | null {
  let courant: HTMLElement | null = element.parentElement;
  while (courant && courant !== document.body) {
    const style = window.getComputedStyle(courant);
    const defile = style.overflowY === "auto" || style.overflowY === "scroll";
    if (defile && courant.scrollHeight > courant.clientHeight + 1) return courant;
    courant = courant.parentElement;
  }
  return null;
}

function amenerDansScrollerVertical(element: HTMLElement, scroller: HTMLElement): void {
  const boiteElement = element.getBoundingClientRect();
  const boiteScroller = scroller.getBoundingClientRect();

  const debordeEnHaut = boiteElement.top - boiteScroller.top - MARGE;
  const debordeEnBas = boiteElement.bottom - boiteScroller.bottom + MARGE;

  if (debordeEnHaut < 0) scroller.scrollTop += debordeEnHaut;
  else if (debordeEnBas > 0) scroller.scrollTop += debordeEnBas;
}

function amenerDansScroller(element: HTMLElement, scroller: HTMLElement): void {
  const boiteElement = element.getBoundingClientRect();
  const boiteScroller = scroller.getBoundingClientRect();

  const debordeAGauche = boiteElement.left - boiteScroller.left - MARGE;
  const debordeADroite = boiteElement.right - boiteScroller.right + MARGE;

  if (debordeAGauche < 0) scroller.scrollLeft += debordeAGauche;
  else if (debordeADroite > 0) scroller.scrollLeft += debordeADroite;
}

function amenerDansPage(element: HTMLElement): void {
  const boite = element.getBoundingClientRect();
  const debordeEnHaut = boite.top - MARGE;
  const debordeEnBas = boite.bottom - window.innerHeight + MARGE;

  if (debordeEnHaut < 0) window.scrollBy(0, debordeEnHaut);
  else if (debordeEnBas > 0) window.scrollBy(0, debordeEnBas);
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
 * Rend une fonction d'ANNULATION qui restaure la position d'origine, ou `null`
 * si rien ne peut défiler. C'est elle qui garantit la règle : un défilement
 * qui n'a pas abouti à un déplacement du focus n'a jamais eu lieu.
 */
export function defilerParPas(
  depuis: HTMLElement | null,
  direction: Direction,
): (() => void) | null {
  if (estHorizontale(direction)) {
    const scroller = depuis ? scrollerHorizontal(depuis) : null;
    if (!scroller) return null;
    const avant = scroller.scrollLeft;
    scroller.scrollLeft += sens(direction) * scroller.clientWidth * PAS_HORIZONTAL;
    if (scroller.scrollLeft === avant) return null;
    return () => {
      scroller.scrollLeft = avant;
    };
  }

  const scroller = depuis ? scrollerVertical(depuis) : null;
  const vue = scroller ? scroller.clientHeight : window.innerHeight;
  const rangee = depuis ? depuis.getBoundingClientRect().height + MARGE : vue * PLAFOND_PAS_VERTICAL;
  const pas = sens(direction) * Math.min(rangee, vue * PLAFOND_PAS_VERTICAL);

  if (scroller) {
    const avant = scroller.scrollTop;
    scroller.scrollTop += pas;
    if (scroller.scrollTop === avant) return null;
    return () => {
      scroller.scrollTop = avant;
    };
  }

  const avant = window.pageYOffset;
  window.scrollBy(0, pas);
  if (window.pageYOffset === avant) return null;
  return () => {
    window.scrollTo(window.pageXOffset, avant);
  };
}
