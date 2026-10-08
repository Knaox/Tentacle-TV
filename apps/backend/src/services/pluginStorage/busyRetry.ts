/**
 * Reprise quand SQLite est occupé. Le serveur n'a qu'une connexion : dans le
 * processus, les requêtes font la queue ; une attente trop longue, ou un autre
 * processus qui tient le verrou (la CLI), rend une erreur passagère qui ne doit
 * jamais remonter jusqu'à une extension (worker de Vigie, écritures de fond).
 *
 * Ce qui se rejoue (DECISION.md § 5) : P1008 (`busy_timeout` dépassé : un
 * autre processus tient le verrou), P2028 et P2024 (attente du pool de la
 * connexion unique), P2034, et le code SQLite lui-même. Rien d'autre : une
 * unicité violée (P2002) ou une erreur de syntaxe ne se rejouent jamais.
 */

const RETRYABLE_PRISMA_CODES = new Set(["P1008", "P2024", "P2028", "P2034"]);
const BUSY_PATTERNS = [/SQLITE_BUSY/i, /SQLITE_LOCKED/i, /database is locked/i, /database table is locked/i, /DatabaseBusy/];

export function isSqliteBusy(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const { code, message } = err as { code?: unknown; message?: unknown };
  if (typeof code === "string" && (/^SQLITE_(BUSY|LOCKED)/.test(code) || RETRYABLE_PRISMA_CODES.has(code))) return true;
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
