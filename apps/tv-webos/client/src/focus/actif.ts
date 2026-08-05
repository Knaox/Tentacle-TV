import { amenerEnVue } from "./defilement";

/**
 * L'élément qui porte le focus, et comment le lui donner.
 *
 * Deux fonctions de trois lignes, dans leur propre module parce que le moteur
 * de déplacement et la pose du focus à l'entrée d'un écran en ont tous les deux
 * besoin. Les laisser dans l'un aurait obligé l'autre à l'importer, et le
 * premier importe déjà le second : le cycle se serait refermé.
 */

/** L'élément qui porte le focus, ou `null` si c'est le document lui-même. */
export function elementActif(): HTMLElement | null {
  const actif = document.activeElement;
  if (!actif || actif === document.body || actif === document.documentElement) return null;
  return actif as HTMLElement;
}

/**
 * Donne le focus, et amène l'élément en vue.
 *
 * Les deux ne se séparent pas : un focus posé sur une carte hors écran est un
 * anneau qu'on ne voit pas, donc un utilisateur qui ne sait plus où il est.
 *
 * `preventScroll` retire au navigateur son défilement natif — alignement au
 * bord, sans la marge que `amenerEnVue` s'impose. Chrome 53 ignore l'option et
 * fait son saut ; `amenerEnVue` repasse immédiatement derrière et impose la
 * même position finale, l'option n'est donc qu'un confort des navigateurs
 * récents — dont celui où l'on met au point.
 */
export function donnerFocus(element: HTMLElement): void {
  element.focus({ preventScroll: true });
  amenerEnVue(element);
}
