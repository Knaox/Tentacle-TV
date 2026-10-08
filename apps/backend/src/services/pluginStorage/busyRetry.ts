/**
 * Reprise quand SQLite est occupé. Le mode WAL laisse lire pendant une
 * écriture, mais deux écritures se suivent : au-delà de `busy_timeout`, la
 * seconde reçoit SQLITE_BUSY. Les extensions écrivent en parallèle dans le
 * même processus (worker de Vigie, écritures de fond) : une erreur passagère
 * ne doit jamais remonter jusqu'à elles.
 *
 * Les messages varient selon la couche (moteur de Prisma, adaptateur, pilote
 * natif) : on reconnaît le code SQLite et ses formulations, rien d'autre.
 */

const BUSY_PATTERNS = [/SQLITE_BUSY/i, /SQLITE_LOCKED/i, /database is locked/i, /database table is locked/i, /DatabaseBusy/];

export function isSqliteBusy(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const { code, message } = err as { code?: unknown; message?: unknown };
  if (typeof code === "string" && /^SQLITE_(BUSY|LOCKED)/.test(code)) return true;
  return typeof message === "string" && BUSY_PATTERNS.some((pattern) => pattern.test(message));
}

export interface BusyRetryOptions {
  attempts?: number;
  baseDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Rejoue `fn` tant que la base est occupée, avec une attente qui grandit (et un peu de hasard). */
export async function withBusyRetry<T>(fn: () => Promise<T>, options: BusyRetryOptions = {}): Promise<T> {
  const attempts = options.attempts ?? 6;
  const base = options.baseDelayMs ?? 25;
  const sleep = options.sleep ?? defaultSleep;
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= attempts || !isSqliteBusy(err)) throw err;
      await sleep(base * 2 ** (attempt - 1) + Math.floor(Math.random() * base));
    }
  }
}
