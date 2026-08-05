import { SELECTEUR_FOCUSABLE, cibleAtteignable, recenser } from "./candidats";
import { focusParDefaut } from "./defaut";
import { retrouver } from "./memoire";

/**
 * Les zones : là où la géométrie ne suffit pas, une destination déclarée.
 *
 * Un déplacement ORDINAIRE reste géométrique — c'est ce qui rend le moteur
 * indifférent aux écrans. Mais deux moments échappent à la géométrie, et les
 * clients de salon les traitent tous par des destinations explicites (Android
 * TV : `destinations` du TVFocusGuideView ; tvOS : preferredFocusEnvironments) :
 *
 * - **entrer dans une zone** : le premier élément croisé n'est presque jamais
 *   le bon. Entrer dans le rail doit viser la page COURANTE, pas l'entrée la
 *   plus proche ; entrer dans le bloc d'actions d'une fiche doit viser
 *   « Lecture », pas le trailer que l'ordonnée désignait ;
 * - **sortir du rail** : revenir où l'on était, pas où la géométrie mène.
 *
 * Une zone se déclare par `data-tv-zone` sur son conteneur ; sa destination
 * d'entrée se RÉSOUT à chaque appui, jamais à l'avance — les boutons d'une
 * fiche arrivent quand leurs données arrivent. La redirection ne s'applique
 * qu'aux entrées TRANSVERSALES : une fois dedans, on circule librement, sans
 * quoi la zone serait un piège qui recapture chaque déplacement interne.
 */

/** La navigation latérale, qui obéit à des règles d'accès particulières. */
export const SELECTEUR_RAIL = ".rail-tv";

export function dansLeRail(element: HTMLElement | null): boolean {
  return !!element && !!element.closest(SELECTEUR_RAIL);
}

/**
 * L'entrée du rail : l'écran où l'on se trouve.
 *
 * `aria-current="page"` est déjà posé par les entrées du rail pour les
 * lecteurs d'écran, et il dit exactement ce qu'on cherche. Sur un écran sans
 * entrée courante — une fiche média —, la première entrée atteignable fait
 * l'affaire : on vient y CHOISIR une destination, autant partir du haut.
 */
export function entreeDuRail(): HTMLElement | null {
  const rail = document.querySelector<HTMLElement>(SELECTEUR_RAIL);
  if (!rail) return null;

  const courante = rail.querySelector<HTMLElement>('[aria-current="page"]');
  if (courante && courante.matches(SELECTEUR_FOCUSABLE) && cibleAtteignable(courante)) {
    return courante;
  }

  for (const entree of rail.querySelectorAll<HTMLElement>(SELECTEUR_FOCUSABLE)) {
    if (cibleAtteignable(entree)) return entree;
  }
  return null;
}

/**
 * La mémoire VIVANTE du contenu : le dernier élément focalisé hors rail.
 *
 * Une référence directe, pas une clé — elle ne sert qu'à la sortie du rail,
 * quelques secondes après l'entrée, sur un écran qui n'a pas changé. La
 * mémoire par CLÉ de `memoire.ts` reste le filet des retours d'écran, où le
 * document a été reconstruit. L'invalidation au changement de route est ce qui
 * évite le focus mort : restituer un nœud d'un AUTRE écran, démonté avec lui.
 */
let dernierContenu: HTMLElement | null = null;

export function retenirContenu(element: HTMLElement): void {
  if (dansLeRail(element)) return;
  dernierContenu = element;
}

export function invaliderContenu(): void {
  dernierContenu = null;
}

/**
 * Où le focus va quand on quitte le rail par la droite.
 *
 * En cascade, du plus fidèle au plus général : l'élément qu'on avait — s'il
 * est toujours monté et atteignable, car le fenêtrage a pu le démonter
 * pendant qu'on parcourait le rail —, celui que la clé de route retrouve,
 * sinon le focus par défaut de l'écran, hors rail.
 */
export function sortieDuRail(): HTMLElement | null {
  if (dernierContenu && document.contains(dernierContenu) && cibleAtteignable(dernierContenu)) {
    return dernierContenu;
  }

  const retrouve = retrouver();
  if (retrouve && !dansLeRail(retrouve)) return retrouve;

  const horsRail = recenser(document).filter((candidat) => !dansLeRail(candidat.element));
  return focusParDefaut(document, horsRail);
}

/** Ce qu'une enveloppe du portage pose sur la cible d'entrée qu'elle a choisie. */
export const ATTRIBUT_ENTREE = "data-tv-zone-entree";

/**
 * La destination d'entrée d'une zone, du plus explicite au plus général.
 *
 * `data-tv-zone-entree` est désigné par une enveloppe du portage, seule à
 * savoir ce que sa zone veut voir viser ; `cta-primary` est l'appel à l'action
 * du système de design — « Lecture », « Reprendre » ; `aria-selected` est
 * l'onglet actif — la saison affichée ; `aria-current` est l'élément courant.
 * Les trois derniers sont déjà posés pour d'autres raisons : la zone n'invente
 * rien, elle lit.
 *
 * **Le dernier rang est un repli et pas un sélecteur** : le premier focusable
 * de la zone, en ordre de document. Sans lui, une zone dont aucune marque n'a
 * encore paru — les boutons d'une fiche arrivent avec leurs données — rendait
 * la main à la géométrie, laquelle choisissait sur tout l'écran. Déclarer une
 * zone garantit désormais un atterrissage à l'intérieur, toujours.
 */
const CASCADE_ENTREE = [
  `[${ATTRIBUT_ENTREE}]`,
  '[class*="cta-primary"]',
  '[aria-selected="true"]',
  '[aria-current]:not([aria-current="false"])',
  SELECTEUR_FOCUSABLE,
];

/**
 * Redirige une arrivée TRANSVERSALE dans une zone vers sa destination.
 *
 * `null` quand il n'y a rien à rediriger : pas de zone, déplacement interne
 * (la garde anti-piège), l'arrivée géométrique est déjà la destination, ou la
 * zone n'a pas de destination lisible — l'arrivée géométrique reste alors la
 * bonne réponse.
 */
export function redirigerEntreeDeZone(
  depart: HTMLElement | null,
  arrivee: HTMLElement,
): HTMLElement | null {
  const zone = arrivee.closest<HTMLElement>("[data-tv-zone]");
  if (!zone) return null;
  if (depart && zone.contains(depart)) return null;

  for (const selecteur of CASCADE_ENTREE) {
    for (const cible of zone.querySelectorAll<HTMLElement>(selecteur)) {
      if (!cible.matches(SELECTEUR_FOCUSABLE)) continue;
      if (cible === arrivee) return null;
      if (cibleAtteignable(cible)) return cible;
    }
  }
  return null;
}
