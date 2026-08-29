/**
 * Les conteneurs qui défilent autour d'un élément.
 *
 * Le moteur les cherchait un par un, et le premier trouvé décidait de tout.
 * Cela suffisait tant qu'il n'y avait qu'un niveau — une piste dans une page.
 * Une surcouche de recherche pose déjà deux niveaux : une liste de résultats
 * qui défile verticalement, dans un corps qui défile aussi. Amener un élément
 * en vue dans le premier sans toucher au second le laisse hors de l'écran.
 *
 * On rend donc la CHAÎNE, du plus interne au plus externe — l'ordre dans lequel
 * `scrollIntoView` natif procède, et le seul qui converge : corriger le
 * conteneur intérieur d'abord, puis mesurer à nouveau pour le suivant, dont la
 * correction a pu devenir nulle.
 *
 * `document.body` borne la remontée : au-delà, c'est la fenêtre, qui n'est pas
 * un élément et se traite à part.
 */

/** Un conteneur défile-t-il réellement sur cet axe, ou est-ce une déclaration sans effet ? */
function scrollsVertically(element: HTMLElement, style: CSSStyleDeclaration): boolean {
  const overflow = style.overflowY;
  if (overflow !== "auto" && overflow !== "scroll") return false;
  return element.scrollHeight > element.clientHeight + 1;
}

function scrollsHorizontally(element: HTMLElement, style: CSSStyleDeclaration): boolean {
  const overflow = style.overflowX;
  if (overflow !== "auto" && overflow !== "scroll") return false;
  return element.scrollWidth > element.clientWidth + 1;
}

function climb(
  element: HTMLElement,
  remember: (candidate: HTMLElement, style: CSSStyleDeclaration) => boolean,
): HTMLElement[] {
  const chain: HTMLElement[] = [];
  let current: HTMLElement | null = element.parentElement;

  while (current && current !== document.body) {
    const style = window.getComputedStyle(current);
    if (remember(current, style)) chain.push(current);
    current = current.parentElement;
  }

  return chain;
}

/** Les conteneurs à défilement vertical qui portent l'élément, du plus interne au plus externe. */
export function verticalScrollers(element: HTMLElement): HTMLElement[] {
  return climb(element, scrollsVertically);
}

/** Les conteneurs à défilement horizontal qui portent l'élément, du plus interne au plus externe. */
export function horizontalScrollers(element: HTMLElement): HTMLElement[] {
  return climb(element, scrollsHorizontally);
}

/**
 * Le premier conteneur à défilement vertical, s'il existe.
 *
 * Le pas de défilement, lui, n'en veut qu'un : faire avancer d'une rangée
 * concerne la liste où l'on se trouve, pas ce qui la porte.
 */
export function verticalScroller(element: HTMLElement): HTMLElement | null {
  return verticalScrollers(element)[0] ?? null;
}

/** Le premier conteneur à défilement horizontal — la piste d'une rangée. */
export function horizontalScroller(element: HTMLElement): HTMLElement | null {
  return horizontalScrollers(element)[0] ?? null;
}
