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
  /**
   * `Date.now()` à la lecture de l'évènement dans la file de mpv. La page s'en
   * sert pour extrapoler `time-pos` entre deux valeurs : la propriété est
   * étranglée à 8 Hz (mpvDrain.ts) et traverse l'IPC — sans l'instant de
   * mesure, une position lue « maintenant » date de jusqu'à 125 ms.
   */
  at?: number;
}

export interface MpvEventPayload {
  event: string;
  [key: string]: unknown;
}
