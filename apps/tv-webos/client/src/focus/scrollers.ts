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
function defileVerticalement(element: HTMLElement, style: CSSStyleDeclaration): boolean {
  const debordement = style.overflowY;
  if (debordement !== "auto" && debordement !== "scroll") return false;
  return element.scrollHeight > element.clientHeight + 1;
}

function defileHorizontalement(element: HTMLElement, style: CSSStyleDeclaration): boolean {
  const debordement = style.overflowX;
  if (debordement !== "auto" && debordement !== "scroll") return false;
  return element.scrollWidth > element.clientWidth + 1;
}

function remonter(
  element: HTMLElement,
  retenir: (candidat: HTMLElement, style: CSSStyleDeclaration) => boolean,
): HTMLElement[] {
  const chaine: HTMLElement[] = [];
  let courant: HTMLElement | null = element.parentElement;

  while (courant && courant !== document.body) {
    const style = window.getComputedStyle(courant);
    if (retenir(courant, style)) chaine.push(courant);
    courant = courant.parentElement;
  }

  return chaine;
}

/** Les conteneurs à défilement vertical qui portent l'élément, du plus interne au plus externe. */
export function scrollersVerticaux(element: HTMLElement): HTMLElement[] {
  return remonter(element, defileVerticalement);
}

/** Les conteneurs à défilement horizontal qui portent l'élément, du plus interne au plus externe. */
export function scrollersHorizontaux(element: HTMLElement): HTMLElement[] {
  return remonter(element, defileHorizontalement);
}

/**
 * Le premier conteneur à défilement vertical, s'il existe.
 *
 * Le pas de défilement, lui, n'en veut qu'un : faire avancer d'une rangée
 * concerne la liste où l'on se trouve, pas ce qui la porte.
 */
export function scrollerVertical(element: HTMLElement): HTMLElement | null {
  return scrollersVerticaux(element)[0] ?? null;
}

/** Le premier conteneur à défilement horizontal — la piste d'une rangée. */
export function scrollerHorizontal(element: HTMLElement): HTMLElement | null {
  return scrollersHorizontaux(element)[0] ?? null;
}
