/**
 * La forme d'une section du panneau de diagnostic.
 *
 * Isolée pour que les sections vivent dans des fichiers séparés sans se citer
 * l'une l'autre — `playerDebugData.ts` les assemble, aucune ne dépend des
 * autres.
 */

export interface DebugSection {
  title: string;
  /** `null` en troisième position = pas de jugement bon/mauvais à porter. */
  lines: Array<readonly [string, string, boolean | null]>;
  /** Section de tête : rendue plus grande, c'est ce qu'on lit en premier. */
  emphasis?: boolean;
  /**
   * Plateformes où la section a un SENS ; absente = partout. Chaque plateforme
   * ne lit que ses lignes : une info macOS affichée « non » en rouge sur Linux
   * fait accuser un défaut qui n'existe pas.
   */
  platforms?: ReadonlyArray<"windows" | "macos" | "linux" | "web">;
}
