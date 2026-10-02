/**
 * La feuille des saisons d'une TV — ce que font OK et Lecture/Pause, pur :
 *
 * - OK COCHE ou décoche une saison ; sur la ligne « Toutes les saisons
 *   manquantes » (dès deux saisons à demander), il coche tout — ou décoche
 *   tout, quand tout l'est déjà ;
 * - Lecture/Pause DEMANDE : tout, depuis la ligne « Toutes » ; sinon ce qui
 *   est coché ; sinon la saison focalisée. Une saison qui ne se demande pas,
 *   ou le pied de la feuille sans rien de coché : rien.
 */

/** Ce qui a le focus dans la feuille. */
export type SeasonsSheetFocus = { kind: "all" } | { kind: "season"; number: number } | { kind: "other" };

/** La ligne « Toutes les saisons manquantes » paraît dès ce nombre de saisons à demander. */
export const ALL_SEASONS_FROM = 2;

export function hasAllSeasonsRow(requestable: readonly number[]): boolean {
  return requestable.length >= ALL_SEASONS_FROM;
}

/** Tout est coché (la ligne « Toutes » l'est alors aussi). */
export function allSeasonsChecked(requestable: readonly number[], checked: ReadonlySet<number>): boolean {
  return requestable.length > 0 && requestable.every((number) => checked.has(number));
}

/** OK sur la ligne « Toutes » : tout coché, ou rien quand tout l'était. */
export function toggleAllSeasons(requestable: readonly number[], checked: ReadonlySet<number>): Set<number> {
  return allSeasonsChecked(requestable, checked) ? new Set() : new Set(requestable);
}

/** Les saisons que demande Lecture/Pause, dans leur ordre ; vide : rien à demander. */
export function shortcutSeasons(requestable: readonly number[], checked: ReadonlySet<number>, focus: SeasonsSheetFocus): number[] {
  if (focus.kind === "all") return [...requestable];
  const chosen = requestable.filter((number) => checked.has(number));
  if (chosen.length > 0) return chosen;
  return focus.kind === "season" && requestable.includes(focus.number) ? [focus.number] : [];
}
