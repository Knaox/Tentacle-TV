/**
 * L'horloge du banc : `setTimeout` / `clearTimeout` remplacés par une file que
 * le banc fait avancer (`advance`) — les filets des panneaux (800, 900, 1 200,
 * 1 500 ms) se jouent sans attendre, dans le même ordre à chaque passage.
 * Importé EN PREMIER par le banc : rien ne lit l'horloge avant lui.
 */

interface Timer {
  at: number;
  fn: () => void;
}

const timers = new Map<number, Timer>();
let now = 0;
let nextId = 1;

const g = globalThis as unknown as Record<string, unknown>;
g.setTimeout = (fn: (...args: unknown[]) => void, ms?: number, ...args: unknown[]) => {
  const id = nextId++;
  timers.set(id, { at: now + Math.max(0, ms ?? 0), fn: () => fn(...args) });
  return id;
};
g.clearTimeout = (id: number) => {
  timers.delete(id);
};

/** Fait avancer l'horloge de `ms`, en jouant les minuteries échues dans l'ordre ; `run` enveloppe chaque rappel (act). */
export function advance(ms: number, run: (fn: () => void) => void): void {
  const end = now + ms;
  for (;;) {
    let next: [number, Timer] | null = null;
    for (const entry of timers) {
      if (entry[1].at > end) continue;
      if (!next || entry[1].at < next[1].at || (entry[1].at === next[1].at && entry[0] < next[0])) next = entry;
    }
    if (!next) break;
    timers.delete(next[0]);
    now = next[1].at;
    run(next[1].fn);
  }
  now = end;
}

/** Oublie toute minuterie en attente (entre deux scénarios). */
export function resetClock(): void {
  timers.clear();
  now = 0;
}
