/**
 * Le lissage du compte à rebours. Le temps restant brut se recalcule à chaque
 * échantillon de débit et tremble (un débit qui varie de 20 % fait varier la
 * fin d'autant) ; affiché tel quel, le compte à rebours de l'écran verrouillé
 * sauterait d'une minute dans un sens puis dans l'autre.
 *
 * On lisse donc l'HEURE DE FIN, pas la durée : une fin qui ne bouge pas fait
 * un compte à rebours qui descend d'une seconde par seconde. Elle suit la fin
 * brute par une moyenne exponentielle en TEMPS (constante `tau`), et l'on ne
 * PUBLIE une nouvelle fin (Live Activity, notification) que si elle s'écarte
 * franchement de celle qui est affichée — chaque mise à jour coûte du budget
 * à iOS et de la batterie.
 */

export interface LiveEstimate {
  /** Fin estimée, lissée (epoch ms). */
  endsAtMs: number;
  /** Quand elle a été mise à jour pour la dernière fois (epoch ms). */
  updatedAtMs: number;
}

/** Constante de temps du lissage : la moitié du chemin vers la fin brute en ~14 s. */
export const LIVE_ESTIMATE_TAU_MS = 20_000;
/** Écart minimal qui mérite une nouvelle publication… */
export const LIVE_PUBLISH_MIN_SHIFT_MS = 30_000;
/** … ou, sur un long transfert, cette part du temps restant. */
export const LIVE_PUBLISH_SHIFT_RATIO = 0.1;

/**
 * La fin lissée après un nouveau temps restant brut. `null` (on ne sait pas
 * dire, ou l'on attend) efface l'estimation : à la reprise, on repart de la
 * mesure, jamais d'une fin d'avant l'attente.
 */
export function nextLiveEstimate(
  previous: LiveEstimate | null,
  rawEtaMs: number | null,
  nowMs: number,
  tauMs: number = LIVE_ESTIMATE_TAU_MS,
): LiveEstimate | null {
  if (rawEtaMs === null || !Number.isFinite(rawEtaMs) || rawEtaMs < 0) return null;
  const target = nowMs + rawEtaMs;
  if (previous === null) return { endsAtMs: target, updatedAtMs: nowMs };
  const elapsed = Math.max(0, nowMs - previous.updatedAtMs);
  const weight = 1 - Math.exp(-elapsed / tauMs);
  const endsAtMs = previous.endsAtMs + weight * (target - previous.endsAtMs);
  // Une fin déjà passée alors que des octets restent n'est jamais affichée.
  return { endsAtMs: Math.max(endsAtMs, nowMs + 1_000), updatedAtMs: nowMs };
}

/** Faut-il publier `next` à la place de la fin affichée (`shown`) ? */
export function shouldPublishEstimate(shownEndsAtMs: number | null, nextEndsAtMs: number | null, nowMs: number): boolean {
  if (shownEndsAtMs === null || nextEndsAtMs === null) return shownEndsAtMs !== nextEndsAtMs;
  const left = Math.max(0, nextEndsAtMs - nowMs);
  const threshold = Math.max(LIVE_PUBLISH_MIN_SHIFT_MS, left * LIVE_PUBLISH_SHIFT_RATIO);
  return Math.abs(nextEndsAtMs - shownEndsAtMs) >= threshold;
}
