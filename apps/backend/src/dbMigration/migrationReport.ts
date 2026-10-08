import type { CopyAllResult, TableReport } from "./copy/copyAll";
import type { TargetVerification } from "./verify/verifyTarget";

/**
 * Le RAPPORT de migration, rangé dans `server_config[sqlite_migration_report]` :
 * sa présence prouve que la base est née d'une migration (socle,
 * `legacySource.ts`), l'admin en tire son résumé. Il ne porte QUE des noms de
 * tables et de colonnes du schéma, des comptes, des tailles et des durées —
 * jamais une valeur de ligne (audit S9).
 */
export const SOURCE_FINGERPRINT_KEY = "sqlite_migration_source_fingerprint";
export const REPORT_VERSION = 1;

export interface MigrationReport {
  version: typeof REPORT_VERSION;
  serverVersion: string;
  startedAt: number;
  finishedAt: number;
  durationMs: number;
  source: { engine: "mariadb"; version: string; bytes: number; zoneConverted: boolean };
  disk: { requiredBytes: number; freeBytes: number };
  rowsWritten: number;
  tables: TableReport[];
  /** Anciennes tables du cœur, laissées dans MariaDB. */
  retired: string[];
  /** Tables refusées (collision de nom, casse), laissées dans MariaDB. */
  refused: Array<{ table: string; reason: string }>;
  /** Copiées après la bascule, en fond (le cache TMDB). */
  deferred: Array<{ table: string; sourceRows: number }>;
  zeroDates: Record<string, number>;
  foreignKeyOrphans: Record<string, number>;
  familyOrphansDropped: number;
}

interface BuildInput {
  deps: { serverVersion: string };
  copy: CopyAllResult;
  verification: TargetVerification;
  startedAt: number;
  finishedAt: number;
  sourceVersion: string;
  sourceBytes: number;
  free: number;
  zoneConverted?: boolean;
}

export function buildReport(input: BuildInput): MigrationReport {
  const { copy } = input;
  return {
    version: REPORT_VERSION,
    serverVersion: input.deps.serverVersion,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    durationMs: input.finishedAt - input.startedAt,
    source: { engine: "mariadb", version: input.sourceVersion, bytes: input.sourceBytes, zoneConverted: !!input.zoneConverted },
    disk: { requiredBytes: Math.ceil(input.sourceBytes * 1.1) + 100 * 1024 * 1024, freeBytes: input.free },
    rowsWritten: copy.tables.reduce((n, t) => n + t.rowsWritten, 0),
    tables: copy.tables,
    retired: copy.fates.filter((f) => f.fate === "retired").map((f) => f.name),
    refused: copy.fates.flatMap((f) => (f.fate === "refused" ? [{ table: f.name, reason: f.reason }] : [])),
    deferred: copy.deferred,
    zeroDates: copy.zeroDates,
    foreignKeyOrphans: input.verification.foreignKeyOrphans,
    familyOrphansDropped: copy.familyOrphansDropped,
  };
}

/** Le rapport relu (base née d'une migration), ou `null`. */
export function parseReport(json: string | null | undefined): MigrationReport | null {
  if (!json) return null;
  try {
    const report = JSON.parse(json) as MigrationReport;
    return report?.version === REPORT_VERSION && Array.isArray(report.tables) ? report : null;
  } catch {
    return null;
  }
}
