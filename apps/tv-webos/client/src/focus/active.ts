import { bringIntoView } from "./scroll";
import { horizontalScrollers, verticalScrollers } from "./scrollers";

/**
 * L'élément qui porte le focus, et comment le lui donner.
 *
 * Deux fonctions dans leur propre module parce que le moteur de déplacement et
 * la pose du focus à l'entrée d'un écran en ont tous les deux besoin. Les
 * laisser dans l'un aurait obligé l'autre à l'importer, et le premier importe
 * déjà le second : le cycle se serait refermé.
 */

/** L'élément qui porte le focus, ou `null` si c'est le document lui-même. */
export function activeElement(): HTMLElement | null {
  const active = document.activeElement;
  if (!active || active === document.body || active === document.documentElement) return null;
  return active as HTMLElement;
}

/** Une position de défilement relevée avant `focus()`, pour la rendre après. */
interface Anchor {
  /** Le conteneur, ou `null` pour la fenêtre. */
  target: HTMLElement | null;
  x: number;
  y: number;
}

function read(element: HTMLElement): Anchor[] {
  const anchors: Anchor[] = [{ target: null, x: window.pageXOffset, y: window.pageYOffset }];

  // Un `Set` : un conteneur qui défile dans les deux sens serait relevé — donc
  // restauré — deux fois, la seconde écrasant la première avec les mêmes
  // valeurs. Inoffensif, mais inutile.
  const containers = new Set<HTMLElement>([
    ...verticalScrollers(element),
    ...horizontalScrollers(element),
  ]);
  containers.forEach((target) => {
    anchors.push({ target, x: target.scrollLeft, y: target.scrollTop });
  });

  return anchors;
}

function restore(anchors: Anchor[]): void {
  for (const anchor of anchors) {
    if (!anchor.target) {
      if (window.pageXOffset !== anchor.x || window.pageYOffset !== anchor.y) {
        window.scrollTo(anchor.x, anchor.y);
      }
      continue;
    }
    if (anchor.target.scrollLeft !== anchor.x) anchor.target.scrollLeft = anchor.x;
    if (anchor.target.scrollTop !== anchor.y) anchor.target.scrollTop = anchor.y;
  }
}

/**
 * Donne le focus, et amène l'élément en vue.
 *
 * Les deux ne se séparent pas : un focus posé sur une carte hors écran est un
 * anneau qu'on ne voit pas, donc un utilisateur qui ne sait plus où il est.
 *
 * **Le cadrage nous appartient, et il a fallu le reprendre au navigateur.**
 * `focus({ preventScroll: true })` n'existe qu'à partir de Chrome 64 ; la
 * dalle en a 53, et Blink y fait son propre amené-en-vue — pour un élément
 * partiellement visible, il le RECENTRE. Mesuré dans une liste d'épisodes : en
 * remontant, une ligne affleurant le haut de l'écran repartait au milieu, et
 * `bringIntoView` ne rattrapait rien puisqu'un élément recentré est dans la
 * marge. La page défilait d'un demi-écran et l'anneau redescendait alors qu'on
 * montait.
 *
 * On relève donc les positions de défilement avant, et on les rend juste
 * après : ce que le navigateur a décidé est effacé, et `bringIntoView` reste le
 * seul à décider. Sur un moteur récent l'option est honorée, rien n'a bougé,
 * la restauration ne fait rien — **le comportement devient le même au bureau
 * et sur la dalle**, ce qu'il n'était pas.
 */
export function giveFocus(element: HTMLElement): void {
  const anchors = read(element);
  element.focus({ preventScroll: true });
  restore(anchors);
  bringIntoView(element);
}
