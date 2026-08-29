import { reachableTarget } from "./candidates";
import { giveFocus } from "./active";

/**
 * Refermer un menu déployé, et rendre le focus à ce qui l'a ouvert.
 *
 * Les menus de filtres d'une bibliothèque — tri, genres, années, note,
 * plateformes — sont écrits pour une souris : ils se referment sur un
 * `mousedown` extérieur, qui ne se produit jamais à la télécommande, ou sur
 * Échap, que le moteur consomme en capture avant eux. Sans intervention,
 * Retour reculait d'un écran EN LAISSANT le panneau déployé par-dessus le
 * précédent.
 *
 * Le déclencheur se reconnaît à `aria-expanded="true"`, qu'il porte déjà pour
 * les lecteurs d'écran — rien à ajouter dans `apps/web`, rien qui dépende d'un
 * libellé traduit. Le CLIQUER est ce qui referme le plus sûrement : c'est une
 * bascule, elle sait se fermer elle-même.
 */

const TRIGGER = '[aria-expanded="true"]';

/**
 * Le déclencheur d'un piège donné : le plus PROCHE, pas le premier du document.
 *
 * Le premier du document était un pari, et il perdait : dix composants du
 * dépôt portent `aria-expanded` — le menu du compte, les sections repliables,
 * la vitesse de lecture, le sélecteur de bibliothèques. Avec deux menus
 * ouverts, Retour refermait celui du haut de page et laissait celui qu'on
 * regardait, en posant le focus loin de lui.
 *
 * On remonte donc depuis le piège, et l'on retient le premier déclencheur
 * rencontré qui ne CONTIENT pas le piège — un ancêtre qui l'englobe est le
 * déclencheur de quelque chose de plus grand, pas de ce panneau-ci. Sans
 * piège, on retombe sur le document entier : c'est le cas des menus qui ne
 * déclarent aucun rôle et ne confinent donc rien.
 */
export function menuTrigger(trap: ParentNode | null): HTMLElement | null {
  if (!trap || !(trap instanceof HTMLElement)) {
    return firstReachable(document.querySelectorAll<HTMLElement>(TRIGGER));
  }

  let current: HTMLElement | null = trap.parentElement;
  while (current) {
    for (const candidate of current.querySelectorAll<HTMLElement>(TRIGGER)) {
      if (candidate.contains(trap)) continue;
      if (reachableTarget(candidate)) return candidate;
    }
    current = current.parentElement;
  }

  return null;
}

function firstReachable(nodes: NodeListOf<HTMLElement>): HTMLElement | null {
  for (const node of nodes) {
    if (reachableTarget(node)) return node;
  }
  return null;
}

/**
 * Referme le menu et rend le focus à son déclencheur. Faux s'il n'y en a pas.
 *
 * Le focus est rendu par `giveFocus` et non par un `focus()` nu : la page a
 * pu défiler pendant qu'on parcourait le panneau, et une pastille hors écran
 * est un anneau qu'on ne voit pas.
 */
export function closeExpandedMenu(trap: ParentNode | null = null): boolean {
  const trigger = menuTrigger(trap);
  if (!trigger) return false;

  trigger.click();
  giveFocus(trigger);
  return true;
}
