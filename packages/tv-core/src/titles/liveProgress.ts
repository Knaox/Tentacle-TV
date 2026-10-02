import type { MyTitleState } from "@tentacle-tv/shared";

/**
 * L'avancement EN DIRECT des demandes, sur les téléviseurs — pur. La même
 * fraîcheur que Vigie sur le téléphone et le bureau (la barre du hub,
 * `useInterpolatedProgress`) :
 *
 *   - la liste se relit toutes les 10 s tant qu'un titre AVANCE (en route, ou
 *     en train d'entrer dans la bibliothèque) et qu'on le voit
 *     (`MY_TITLES_REFRESH.liveMs`) ; rien de plus quand rien n'avance ;
 *   - entre deux lectures, l'avancement suit le temps restant annoncé
 *     (`etaSeconds`), d'une seconde à l'autre — plafonné à 99,5 % : seule une
 *     vraie lecture dit 100 % ;
 *   - jamais de recul, sauf une vraie chute de plus de 5 points (une reprise
 *     de zéro) : un camembert qui recule à chaque lecture est ce qu'il y a de
 *     plus désagréable à regarder ;
 *   - sans temps restant, immobile : mieux vaut un camembert qui attend la
 *     lecture suivante qu'un camembert qui avance pendant que tout bloque.
 *
 * Et la COULEUR d'une affiche attendue : grise, elle se colore au prorata de
 * l'avancement (`colorFraction`).
 */

export const LIVE_PROGRESS = {
  /** Le pas de l'avancement à l'écran, entre deux lectures : celui de la barre du hub. */
  tickMs: 1000,
  /** Seule une vraie lecture dit 100 %. */
  ceiling: 99.5,
  /** Au-delà de cette chute, c'est une vraie reprise : elle se montre. */
  dropPoints: 5,
} as const;

/** Une lecture de l'avancement : ce qu'elle dit, et quand l'appareil l'a reçue. */
export interface ProgressReading {
  /** 0 à 100 ; `null` : il ne se sait pas. */
  percent: number | null;
  /** Le temps restant annoncé, en secondes ; `null` : rien qui descende. */
  etaSeconds: number | null;
  /** L'heure de réception (ms, horloge de l'appareil). */
  at: number;
}

/** L'avancement se projette : il se sait, et un temps restant l'accompagne. */
export function isProjectable(reading: ProgressReading): boolean {
  return reading.percent !== null && reading.etaSeconds !== null && reading.etaSeconds > 0 && reading.percent < LIVE_PROGRESS.ceiling;
}

/** L'avancement à l'instant `now`, projeté depuis la dernière lecture (ligne droite jusqu'à l'échéance). */
export function projectedPercent(reading: ProgressReading, now: number): number | null {
  const { percent, etaSeconds, at } = reading;
  if (percent === null || !isProjectable(reading)) return percent;
  const elapsed = Math.max(0, now - at) / 1000;
  const ratio = Math.min(1, elapsed / (etaSeconds as number));
  return Math.min(LIVE_PROGRESS.ceiling, percent + (100 - percent) * ratio);
}

/**
 * Ce que l'écran garde : `next` (la projection), sauf s'il recule sans vraie
 * chute — une nouvelle lecture (`base`) un peu en deçà de ce que la projection
 * montrait déjà ; `shown` reste alors, et la projection le rattrape.
 */
export function steadyPercent(shown: number | null, next: number | null, base: number | null): number | null {
  if (shown === null || next === null || base === null) return next;
  return next < shown && base >= shown - LIVE_PROGRESS.dropPoints ? shown : next;
}

/** Un titre arrivé dans la bibliothèque : un état du CLIENT (le contrat le retire de la liste). */
export type ArrivalState = MyTitleState | "arrived";

/** Il AVANCE : en route, ou en train d'entrer dans la bibliothèque. */
export function isAdvancing(state: ArrivalState): boolean {
  return state === "arriving" || state === "importing";
}

/** Au moins un titre avance : la liste mérite le rythme du direct. */
export function anyAdvancing(titles: readonly { state: ArrivalState }[] | null | undefined): boolean {
  return (titles ?? []).some((title) => isAdvancing(title.state));
}

/**
 * La part de COULEUR d'une affiche attendue : 0, grise ; 1, pleine couleur.
 * En attente et bloquée : grise. En route : au prorata de l'avancement (grise
 * tant qu'il ne se sait pas). Le fichier là (mise en bibliothèque), puis
 * arrivée : pleine couleur.
 */
export function colorFraction(state: ArrivalState, percent: number | null): number {
  if (state === "importing" || state === "arrived") return 1;
  if (state !== "arriving" || percent === null) return 0;
  return Math.min(1, Math.max(0, percent / 100));
}

/** Ce qui bouge d'abord — en route, puis en train d'entrer —, le reste dans l'ordre reçu. */
export function livelyFirst<T extends { state: ArrivalState }>(titles: readonly T[]): T[] {
  const rank = (title: T) => (title.state === "arriving" ? 0 : title.state === "importing" ? 1 : 2);
  return titles.map((title, index) => ({ title, index })).sort((a, b) => rank(a.title) - rank(b.title) || a.index - b.index).map(({ title }) => title);
}

/**
 * Les titres ARRIVÉS entre deux lectures : sortis de la liste alors qu'ils
 * avançaient (en route, ou en train d'entrer dans la bibliothèque). Sorti
 * d'« en attente » ou de « bloquée », un titre n'est pas arrivé — refusé,
 * retiré : il quitte la liste sans fête.
 */
export function arrivedBetween<T extends { key: string; state: ArrivalState }>(before: readonly T[] | null | undefined, after: readonly T[] | null | undefined): T[] {
  if (!before || !after) return [];
  const still = new Set(after.map((title) => title.key));
  return before.filter((title) => isAdvancing(title.state) && !still.has(title.key));
}
