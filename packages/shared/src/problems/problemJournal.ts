import type { ProblemDiagnostic, ProblemEnvironment } from "./problemDiagnostics";

/**
 * Le petit journal LOCAL des erreurs montrées — tournant (les plus anciennes
 * partent), jamais envoyé seul : il ne quitte l'appareil que joint par
 * « Signaler un problème », à la demande de l'utilisateur. Pur : la plateforme
 * fournit son stockage (texte), le journal le relit au démarrage.
 */

/** Ce que le journal garde au plus : assez pour une soirée, rien de lourd. */
export const PROBLEM_JOURNAL_CAPACITY = 50;

/** La même erreur répétée à la chaîne (un lecteur qui réessaie) ne pousse pas les autres dehors. */
export const PROBLEM_JOURNAL_REPEAT_MS = 5_000;

/** Le format du rapport, pour qu'un lecteur de demain sache le relire. */
export const PROBLEM_REPORT_VERSION = 1;

export interface ProblemJournalStorage {
  load(): string | null | Promise<string | null>;
  save(serialized: string): void | Promise<void>;
}

/** Une entrée, et combien de fois elle s'est répétée d'affilée. */
export interface ProblemJournalEntry extends ProblemDiagnostic {
  repeated?: number;
}

/** Ce que « Signaler un problème » joindra. */
export interface ProblemReport {
  version: typeof PROBLEM_REPORT_VERSION;
  generatedAt: string;
  environment: ProblemEnvironment;
  /** La plus récente d'abord. */
  entries: ProblemJournalEntry[];
}

export interface ProblemJournal {
  record(entry: ProblemDiagnostic): void;
  /** La plus récente d'abord. */
  entries(): ProblemJournalEntry[];
  clear(): void;
  /** Le rapport à joindre : l'environnement actuel et les `limit` dernières entrées. */
  attach(environment: ProblemEnvironment, limit?: number): ProblemReport;
  /** Relire le stockage (une fois, au démarrage) ; les entrées notées avant restent devant. */
  hydrate(): Promise<void>;
}

function isEntry(value: unknown): value is ProblemJournalEntry {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.code === "string" && typeof record.at === "string" && Array.isArray(record.details);
}

/** Un stockage relu : ce qui n'a pas la forme attendue est ignoré, jamais une exception. */
export function parseProblemJournal(serialized: string | null): ProblemJournalEntry[] {
  if (!serialized) return [];
  try {
    const parsed: unknown = JSON.parse(serialized);
    return Array.isArray(parsed) ? parsed.filter(isEntry).slice(0, PROBLEM_JOURNAL_CAPACITY) : [];
  } catch {
    return [];
  }
}

export function createProblemJournal(options: {
  storage?: ProblemJournalStorage;
  capacity?: number;
  now?: () => number;
} = {}): ProblemJournal {
  const capacity = options.capacity ?? PROBLEM_JOURNAL_CAPACITY;
  const now = options.now ?? Date.now;
  let list: ProblemJournalEntry[] = [];

  const persist = () => {
    if (!options.storage) return;
    try {
      void Promise.resolve(options.storage.save(JSON.stringify(list))).catch(() => undefined);
    } catch {
      // Le journal n'est qu'une aide : un stockage plein ne casse rien.
    }
  };

  return {
    record(entry) {
      const head = list[0];
      if (head && head.code === entry.code && Date.parse(entry.at) - Date.parse(head.at) < PROBLEM_JOURNAL_REPEAT_MS) {
        list = [{ ...head, repeated: (head.repeated ?? 1) + 1 }, ...list.slice(1)];
      } else {
        list = [entry, ...list].slice(0, capacity);
      }
      persist();
    },
    entries: () => list.slice(),
    clear() {
      list = [];
      persist();
    },
    attach(environment, limit = capacity) {
      return {
        version: PROBLEM_REPORT_VERSION,
        generatedAt: new Date(now()).toISOString(),
        environment,
        entries: list.slice(0, limit),
      };
    },
    async hydrate() {
      if (!options.storage) return;
      try {
        const stored = parseProblemJournal(await options.storage.load());
        list = [...list, ...stored].slice(0, capacity);
      } catch {
        // Illisible : on repart d'un journal vide.
      }
    },
  };
}
