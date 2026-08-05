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

/** Pas de défilement quand aucun voisin n'a été trouvé, en fraction d'écran. */
const PAS_AVEUGLE = 0.6;

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
 * Défile dans la direction demandée sans cible précise.
 *
 * Appelé quand aucun voisin n'a été trouvé — le cas le plus fréquent étant une
 * rangée vidée par le fenêtrage, dont les cartes ne sont pas montées et ne
 * peuvent donc pas être visées. Le défilement les fait apparaître, et le
 * moteur retente ensuite.
 *
 * Rend vrai si quelque chose a effectivement bougé : c'est ce qui permet au
 * moteur de savoir s'il vaut la peine d'attendre un nouveau montage.
 */
export function defilerAveuglement(depuis: HTMLElement | null, direction: Direction): boolean {
  if (estHorizontale(direction)) {
    const scroller = depuis ? scrollerHorizontal(depuis) : null;
    if (!scroller) return false;
    const avant = scroller.scrollLeft;
    scroller.scrollLeft += sens(direction) * scroller.clientWidth * PAS_AVEUGLE;
    return scroller.scrollLeft !== avant;
  }

  const avant = window.pageYOffset;
  window.scrollBy(0, sens(direction) * window.innerHeight * PAS_AVEUGLE);
  return window.pageYOffset !== avant;
}
