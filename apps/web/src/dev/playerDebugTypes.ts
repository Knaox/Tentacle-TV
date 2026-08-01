/**
 * La forme d'une section du panneau de diagnostic.
 *
 * Isolée pour que les sections vivent dans des fichiers séparés sans se citer
 * l'une l'autre — `playerDebugData.ts` les assemble, aucune ne dépend des
 * autres.
 */

export interface DebugSection {
  titre: string;
  /** `null` en troisième position = pas de jugement bon/mauvais à porter. */
  lignes: Array<readonly [string, string, boolean | null]>;
  /** Section de tête : rendue plus grande, c'est ce qu'on lit en premier. */
  emphase?: boolean;
}
