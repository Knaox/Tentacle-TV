/**
 * L'ÉCRAN D'ATTENTE de la migration de la base (serveur 1.25, MariaDB → SQLite),
 * le même sur tous les clients : la règle pure qui lit ce que le serveur dit et
 * les clés de ses mots (espace i18n `errors`, `dbMigration*`).
 *
 * Le serveur le dit de deux façons, toutes deux publiques et sans détail :
 * - `GET /api/health` → `database` : `{ engine, state, progress?, reason?, retryInSeconds? }` ;
 * - toute autre route pendant la migration : 503 `{ state: "migrating", database, progress }`.
 *
 * Ce n'est JAMAIS une panne : ni voile hors ligne, ni erreur (`connectivityCase`
 * n'a pas à s'en mêler). Un client ne montre l'écran que face à un serveur qui
 * DÉCLARE `server.databaseMigration` (`useServerCapability`) : un serveur d'avant
 * n'en a jamais.
 */

/** Liste FERMÉE des motifs d'échec (miroir de `MigrationFailureReason`, backend). */
export const DATABASE_MIGRATION_REASONS = [
  "source_unreachable",
  "source_config",
  "source_too_old",
  "source_missing",
  "disk_space",
  "unsafe_path",
  "copy_failed",
  "verification_failed",
  "unknown",
] as const;

export type DatabaseMigrationReason = (typeof DATABASE_MIGRATION_REASONS)[number];

export type DatabaseMigrationView =
  | { kind: "migrating"; percent: number; done: number; total: number; etaSeconds: number | null }
  /** `retryInSeconds: null` : pas de nouvel essai automatique (`source_missing`) — ne rien en dire. */
  | { kind: "failed"; reason: DatabaseMigrationReason; retryInSeconds: number | null; percent: number };

const num = (v: unknown, fallback = 0): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

function reasonOf(v: unknown): DatabaseMigrationReason {
  return (DATABASE_MIGRATION_REASONS as readonly string[]).includes(v as string) ? (v as DatabaseMigrationReason) : "unknown";
}

/**
 * La migration en cours ou en échec, lue dans `database` de `/api/health` — ou
 * dans le corps d'un 503 du mode maintenance. `null` : rien à montrer (base
 * prête, serveur d'avant 1.25, réponse illisible).
 */
export function databaseMigrationOf(body: unknown): DatabaseMigrationView | null {
  if (!body || typeof body !== "object") return null;
  const db = (body as { database?: unknown }).database;
  if (!db || typeof db !== "object") return null;
  const d = db as { state?: unknown; progress?: unknown; reason?: unknown; retryInSeconds?: unknown };
  const p = (d.progress && typeof d.progress === "object" ? d.progress : {}) as Record<string, unknown>;
  const percent = Math.max(0, Math.min(100, Math.floor(num(p.percent))));
  if (d.state === "migrating") {
    const eta = p.etaSeconds === null || p.etaSeconds === undefined ? null : Math.max(0, num(p.etaSeconds));
    return { kind: "migrating", percent, done: num(p.done), total: num(p.total), etaSeconds: eta };
  }
  if (d.state === "failed") {
    const retry = typeof d.retryInSeconds === "number" && Number.isFinite(d.retryInSeconds) ? Math.max(0, d.retryInSeconds) : null;
    return { kind: "failed", reason: reasonOf(d.reason), retryInSeconds: retry, percent };
  }
  return null;
}

/** Le 503 du mode maintenance (`{ state: "migrating" }`) : à prendre pour l'écran d'attente, pas pour une panne. */
export function isMigrationMaintenance(status: number, body: unknown): boolean {
  return status === 503 && !!body && typeof body === "object" && (body as { state?: unknown }).state === "migrating";
}

/** Les clés de l'écran (espace `errors`). */
export const DB_MIGRATION_COPY = {
  title: "errors:dbMigrationTitle",
  body: "errors:dbMigrationBody",
  tables: "errors:dbMigrationTables",
  etaMinutes: "errors:dbMigrationEtaMinutes",
  etaSoon: "errors:dbMigrationEtaSoon",
  etaUnknown: "errors:dbMigrationEtaUnknown",
  footer: "errors:dbMigrationFooter",
  failedTitle: "errors:dbMigrationFailedTitle",
  failedBody: "errors:dbMigrationFailedBody",
  retryIn: "errors:dbMigrationRetryIn",
  retryNow: "errors:dbMigrationRetryNow",
  rollback: "errors:dbMigrationRollback",
} as const;

/** Une phrase par motif ; les motifs techniques renvoient au journal du serveur, sans détail. */
export const DB_MIGRATION_REASON_KEYS: Record<DatabaseMigrationReason, string> = {
  source_unreachable: "errors:dbMigrationReasonUnreachable",
  source_config: "errors:dbMigrationReasonConfig",
  source_too_old: "errors:dbMigrationReasonTooOld",
  source_missing: "errors:dbMigrationReasonMissing",
  disk_space: "errors:dbMigrationReasonDiskSpace",
  unsafe_path: "errors:dbMigrationReasonOther",
  copy_failed: "errors:dbMigrationReasonOther",
  verification_failed: "errors:dbMigrationReasonOther",
  unknown: "errors:dbMigrationReasonOther",
};

/** Le temps restant en mots : la clé, et le nombre de minutes à y glisser. */
export function dbMigrationEta(etaSeconds: number | null): { key: string; minutes?: number } {
  if (etaSeconds === null) return { key: DB_MIGRATION_COPY.etaUnknown };
  if (etaSeconds < 60) return { key: DB_MIGRATION_COPY.etaSoon };
  return { key: DB_MIGRATION_COPY.etaMinutes, minutes: Math.ceil(etaSeconds / 60) };
}

/** Le délai avant le prochain essai, en texte court (« 45 s », « 2 min 30 s »). */
export function dbMigrationRetryClock(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes} min ${rest} s` : `${minutes} min`;
}

/** La relecture de `/api/health` pendant l'attente (le serveur répond vite, sans base). */
export const DB_MIGRATION_POLL_MS = 2000;
