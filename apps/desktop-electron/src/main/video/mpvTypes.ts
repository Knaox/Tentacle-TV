/**
 * Les formes échangées avec la page.
 *
 * Isolées pour que `mpv.ts` et `mpvDrain.ts` puissent les partager sans que
 * l'un doive importer l'autre : la vidange a besoin de ces types, et le cycle
 * de vie a besoin de la vidange.
 */

/** Charge utile poussée vers la page. */
export interface PropertyChange {
  name: string;
  data: unknown;
  id: number;
}

export interface MpvEventPayload {
  event: string;
  [key: string]: unknown;
}
