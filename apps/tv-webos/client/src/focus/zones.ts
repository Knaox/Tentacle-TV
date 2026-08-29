import { FOCUSABLE_SELECTOR, reachableTarget, isInputField, collect } from "./candidates";
import { defaultFocus } from "./default";
import { recover } from "./memory";

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
export const RAIL_SELECTOR = ".rail-tv";

export function inRail(element: HTMLElement | null): boolean {
  return !!element && !!element.closest(RAIL_SELECTOR);
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
  const rail = document.querySelector<HTMLElement>(RAIL_SELECTOR);
  if (!rail) return null;

  const courante = rail.querySelector<HTMLElement>('[aria-current="page"]');
  if (courante && courante.matches(FOCUSABLE_SELECTOR) && reachableTarget(courante)) {
    return courante;
  }

  for (const entree of rail.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)) {
    if (reachableTarget(entree)) return entree;
  }
  return null;
}

/**
 * La mémoire VIVANTE du contenu : le dernier élément focalisé hors rail.
 *
 * Une référence directe, pas une clé — elle ne sert qu'à la sortie du rail,
 * quelques secondes après l'entrée, sur un écran qui n'a pas changé. La
 * mémoire par CLÉ de `memory.ts` reste le filet des retours d'écran, où le
 * document a été reconstruit. L'invalidation au changement de route est ce qui
 * évite le focus mort : restituer un nœud d'un AUTRE écran, démonté avec lui.
 */
let lastContent: HTMLElement | null = null;

export function rememberContent(element: HTMLElement): void {
  if (inRail(element)) return;
  lastContent = element;
}

export function invalidateContent(): void {
  lastContent = null;
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
  if (lastContent && document.contains(lastContent) && reachableTarget(lastContent)) {
    return lastContent;
  }

  const found = recover();
  if (found && !inRail(found)) return found;

  const outsideRail = collect(document).filter((candidate) => !inRail(candidate.element));
  return defaultFocus(document, outsideRail);
}

/** Ce qu'une enveloppe du portage pose sur la cible d'entrée qu'elle a choisie. */
export const ENTRY_ATTRIBUTE = "data-tv-zone-entree";

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
  `[${ENTRY_ATTRIBUTE}]`,
  '[class*="cta-primary"]',
  '[aria-selected="true"]',
  '[aria-current]:not([aria-current="false"])',
  FOCUSABLE_SELECTOR,
];

/**
 * Où atterrir dans une zone, sans rien savoir d'où l'on vient.
 *
 * La cascade était enfermée dans `redirectZoneEntry`, qui exige une
 * arrivée géométrique et rend `null` dans trois cas qui n'ont aucun sens
 * quand on OUVRE un panneau. Or c'est exactement la question qu'une enveloppe
 * se pose alors : « où poser le focus dans ce menu qui vient de paraître ? »
 *
 * **Le dernier rang évite les champs de saisie, et c'est un correctif.** Le
 * repli « premier focusable en ordre de document » désignait, dans le menu
 * des genres, son champ de recherche — donc **un simple appui vers le bas
 * faisait monter le clavier système webOS**, précisément le défaut que le
 * focus par défaut documente avoir corrigé de son côté. Une préférence, pas
 * un veto : le menu de la note n'offre qu'un curseur, et un curseur ne fait
 * monter aucun clavier — mieux vaut y entrer que nulle part.
 */
export function destinationEntreeDeZone(zone: HTMLElement): HTMLElement | null {
  for (const selector of CASCADE_ENTREE) {
    const found: HTMLElement[] = [];
    for (const target of zone.querySelectorAll<HTMLElement>(selector)) {
      if (!target.matches(FOCUSABLE_SELECTOR)) continue;
      if (!reachableTarget(target)) continue;
      if (!isInputField(target)) return target;
      found.push(target);
    }
    if (found.length > 0) return found[0];
  }
  return null;
}

/**
 * Redirige une arrivée TRANSVERSALE dans une zone vers sa destination.
 *
 * `null` quand il n'y a rien à rediriger : pas de zone, déplacement interne
 * (la garde anti-piège), l'arrivée géométrique est déjà la destination, ou la
 * zone n'a pas de destination lisible — l'arrivée géométrique reste alors la
 * bonne réponse.
 */
export function redirectZoneEntry(
  start: HTMLElement | null,
  arrival: HTMLElement,
): HTMLElement | null {
  const zone = arrival.closest<HTMLElement>("[data-tv-zone]");
  if (!zone) return null;
  if (start && zone.contains(start)) return null;

  const target = destinationEntreeDeZone(zone);
  if (!target || target === arrival) return null;
  return target;
}
