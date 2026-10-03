/**
 * L'ENTRÉE DÉCLARÉE d'une section — la seule exception à la règle de
 * voisinage (`sections.ts`) : l'élément sur lequel HAUT / BAS arrive dans la
 * section depuis une voisine, à la place de l'élément au centre le plus
 * proche. Elle l'emporte quand elle est parmi les éléments de la section.
 *
 * Deux politiques, et seulement deux :
 * - « toujours » : un sélecteur entre par sa sélection (les onglets de saisons
 *   entrent par la saison affichée). L'intégration déclare la clé telle
 *   quelle — rien à décider ici ;
 * - « première visite » : l'ANCRE tant que la section n'a pas eu le focus
 *   depuis le dernier réarmement, puis plus d'entrée — le plus proche, la
 *   rangée reste où on l'a laissée (les épisodes entrent par celui à
 *   reprendre à l'arrivée sur la fiche, puis à chaque saison choisie).
 *
 * La plateforme pose l'entrée sur la section (tvOS : `tvEntry`, le numéro
 * natif de l'élément, que la section native honore au moment du geste) ; elle
 * réarme quand la clé de réarmement change (la saison choisie).
 *
 * Module pur.
 */

export interface FirstVisitEntryState {
  /** Vrai tant que la section n'a pas eu le focus depuis le dernier réarmement. */
  readonly armed: boolean;
}

/** Armée : à l'arrivée, et à chaque réarmement. */
export const FIRST_VISIT_ARMED: FirstVisitEntryState = Object.freeze({ armed: true });
/** Désarmée : la section a eu le focus. Une valeur unique — un état React qui
 *  la reçoit deux fois ne se redessine pas deux fois. */
export const FIRST_VISIT_DONE: FirstVisitEntryState = Object.freeze({ armed: false });

/** Un focus posé dans l'écran : désarme si la clé est de la section. */
export function firstVisitAfterFocus(
  state: FirstVisitEntryState,
  focusedKey: string,
  owns: (key: string) => boolean,
): FirstVisitEntryState {
  return state.armed && owns(focusedKey) ? FIRST_VISIT_DONE : state;
}

/** L'entrée à déclarer : l'ancre tant que c'est armé, sinon aucune (le plus proche). */
export function firstVisitEntry(state: FirstVisitEntryState, anchorKey: string | null): string | null {
  return state.armed ? anchorKey : null;
}
