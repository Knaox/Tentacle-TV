/**
 * Quand dire « Prêt à regarder hors ligne », et de quels titres — règle PURE.
 *
 * Avant : seulement quand plus AUCUN titre n'était en file, en cours ni en
 * pause. Un seul titre retenu — une pause, une attente du Wi-Fi, une coupure
 * en attente de sa relance — et les titres prêts ne se disaient jamais
 * (recette Android du 21/10, D4 : trois titres finis, aucune notification,
 * pendant qu'un quatrième restait « En attente »).
 *
 * Désormais : dès que plus rien ne TOURNE ni n'attend une place (`queued`,
 * `downloading`), les titres arrivés depuis la dernière annonce se disent. Ce
 * qui est en pause n'empêche plus rien ; il se dira à son tour.
 */

export interface ReadyEntry {
  id: number;
  status: string;
  errorCode: string | null;
}

export interface ReadyState<T extends ReadyEntry> {
  /** La dernière photo de la liste ; `null` avant la première (rien à comparer). */
  previous: Map<number, T> | null;
  /** Les titres arrivés depuis la dernière annonce. */
  pending: T[];
}

export interface ReadyStep<T extends ReadyEntry> {
  state: ReadyState<T>;
  /** Les titres à annoncer MAINTENANT (vide : rien à dire). */
  ready: T[];
  /** Les titres qui viennent de s'arrêter faute de place. */
  diskFull: T[];
  /** Un transfert vient de démarrer après un moment sans rien : la permission se demande. */
  started: boolean;
}

const RUNNING = new Set(["queued", "downloading"]);

function running(entries: Iterable<ReadyEntry>): number {
  let count = 0;
  for (const entry of entries) if (RUNNING.has(entry.status)) count += 1;
  return count;
}

export const INITIAL_READY_STATE: ReadyState<never> = { previous: null, pending: [] };

export function nextReadyStep<T extends ReadyEntry>(state: ReadyState<T>, entries: readonly T[]): ReadyStep<T> {
  const current = new Map(entries.map((entry) => [entry.id, entry] as const));
  const previous = state.previous;
  if (previous === null) return { state: { previous: current, pending: [] }, ready: [], diskFull: [], started: false };

  const pending = [...state.pending];
  const diskFull: T[] = [];
  for (const [id, entry] of current) {
    const before = previous.get(id);
    if (before === undefined || before.status === entry.status) continue;
    if (entry.status === "complete") pending.push(entry);
    if (entry.status === "error" && entry.errorCode === "disk-full") diskFull.push(entry);
  }
  // Un titre annoncé puis retiré avant l'annonce ne se dit pas.
  const stillThere = pending.filter((entry) => current.get(entry.id)?.status === "complete");
  const runningNow = running(current.values());
  const started = running(previous.values()) === 0 && runningNow > 0;
  if (runningNow === 0 && stillThere.length > 0) {
    return { state: { previous: current, pending: [] }, ready: stillThere, diskFull, started };
  }
  return { state: { previous: current, pending: stillThere }, ready: [], diskFull, started };
}
