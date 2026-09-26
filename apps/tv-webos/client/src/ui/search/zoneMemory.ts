import type { FocusEvent } from "react";
import { ENTRY_ATTRIBUTE } from "../../focus/zones";

/**
 * Une zone qui se souvient de sa dernière cible — le `autoFocus` des
 * `TVFocusGuideView` de l'Apple TV et d'Android TV.
 *
 * Le moteur sait déjà rediriger une arrivée transversale dans une zone vers sa
 * destination déclarée (`data-tv-zone-entree`, cf. `focus/zones.ts`). Il suffit
 * donc de DÉPLACER cette marque sur ce qui prend le focus dans la zone : on y
 * revient là où on l'avait quittée — la touche de la colonne de saisie, la
 * carte des résultats —, jamais sur ce que la géométrie trouve en face.
 *
 * Tant que rien n'a été visé, la cascade du moteur s'applique : le premier
 * focusable de la zone, c'est-à-dire le meilleur résultat. Une cible démontée
 * (nouvelle requête) emporte sa marque avec elle : on retombe sur la cascade.
 */
export function rememberZoneEntry(event: FocusEvent<HTMLElement>): void {
  if (event.target instanceof HTMLElement) markZoneEntry(event.target);
}

/**
 * Désigne `element` comme LA destination d'entrée de sa zone.
 *
 * La marque est retirée de tout le reste de la zone, et non de la seule cible
 * précédente dont on se souviendrait : elle tient ainsi à un remontage de la
 * surcouche, et à une désignation qui ne passe pas par le focus — revenir à la
 * barre désigne ce qui avait ouvert l'étagère, pour qu'un appui à droite y
 * ramène.
 */
export function markZoneEntry(element: HTMLElement): void {
  const zone = element.closest<HTMLElement>("[data-tv-zone]");
  if (!zone) return;
  for (const marked of zone.querySelectorAll<HTMLElement>(`[${ENTRY_ATTRIBUTE}]`)) {
    if (marked !== element) marked.removeAttribute(ENTRY_ATTRIBUTE);
  }
  element.setAttribute(ENTRY_ATTRIBUTE, "");
}
