/**
 * RÉCLAMER le focus, et le réclamer DE NOUVEAU si la plateforme le rend
 * ailleurs dans la foulée.
 *
 * Mesuré au simulateur tvOS : un Menu sur une page poussée dépile l'écran puis
 * la pile le réempile, et UIKit restaure sa dernière cible APRÈS la
 * réclamation — le focus retombait sur la case où se trouvait l'entrée
 * annulée, pas sur elle. D'où UNE reprise, et seulement dans
 * `RESTORE_WITHIN_MS` : passé ce délai, un focus ailleurs vient de
 * l'utilisateur et n'est jamais contrarié. Dans le délai, il l'est une fois —
 * relevé tel quel (le relevé T3, « Constats »).
 *
 * Le focus pris par la clé réclamée elle-même ne clôt pas la surveillance ;
 * le premier focus AILLEURS la clôt, repris ou non.
 *
 * Module pur : l'horloge est passée par l'appelant, qui arrête aussi sa
 * surveillance au bout du délai.
 */

/** Une restauration de la plateforme arrive dans ce délai ; au-delà, c'est l'utilisateur. */
export const RESTORE_WITHIN_MS = 900;

export interface RestoreWatch {
  readonly key: string;
  /** Jusqu'à quand (ms) un focus ailleurs est une restauration. */
  readonly until: number;
}

/** `ignore` : rien, la surveillance continue ; `reclaim` : réclamer encore, puis cesser ; `stop` : cesser. */
export type RestoreStep = "ignore" | "reclaim" | "stop";

/** La surveillance qui suit la réclamation de `key`. */
export function watchRestore(key: string, now: number): RestoreWatch {
  return { key, until: now + RESTORE_WITHIN_MS };
}

/** Un événement de focus pendant la surveillance. */
export function restoreStep(watch: RestoreWatch, focusedKey: string, focused: boolean, now: number): RestoreStep {
  if (!focused || focusedKey === watch.key) return "ignore";
  return now <= watch.until ? "reclaim" : "stop";
}
