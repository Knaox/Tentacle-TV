import { getPrisma } from "../../services/db";
import { legacyMariadbUrl, legacySourceState, MIGRATION_REPORT_KEY, type LegacySourceState } from "../../services/database/legacySource";
import { hostInfo } from "../../setup/hostInfo";
import { cacheCopyPercent, cacheCopyState, type CacheCopyPhase } from "../cache/deferredCacheCopy";
import { sourceIdentity, type SourceIdentity } from "../legacySource/sourceConfig";
import { parseReport } from "../migrationReport";
import { sourceDivergence } from "../postMigration";
import type { SourceCheck } from "../verify/sourceDivergence";
import { dropDatabaseCommand, removalGuide, type RemovalGuide } from "./removalGuide";

/**
 * Ce que la carte « Base de données » et le tableau de bord de l'admin disent de
 * la migration : réservé à un administrateur authentifié. Des noms de tables, des
 * comptes, des durées, l'IDENTITÉ de l'ancienne base (hôte, port, nom — jamais
 * d'identifiants) ; jamais l'empreinte, jamais une valeur de ligne.
 */
export interface DatabaseMigrationSummary {
  legacy: LegacySourceState;
  /** Une ancienne base est encore désignée par l'environnement ou `database.json`. */
  sourceConfigured: boolean;
  report: null | {
    finishedAt: number;
    durationMs: number;
    tables: number;
    rows: number;
    sourceEmpty: boolean;
    sourceVersion: string;
    source: SourceIdentity;
    unrecognized: string[];
    retired: string[];
    refused: Array<{ table: string; reason: string }>;
    deferred: string[];
  };
  cache: { phase: CacheCopyPhase; percent: number };
  /** Le contrôle de l'ancienne base depuis la migration (§ 3.10) ; `null` : pas encore fait. */
  sourceCheck: SourceCheck | null;
  removal: RemovalGuide & { dropCommand: string | null };
}

export async function databaseMigrationSummary(): Promise<DatabaseMigrationSummary> {
  const url = legacyMariadbUrl();
  const row = await getPrisma().serverConfig.findUnique({ where: { key: MIGRATION_REPORT_KEY } });
  const report = parseReport(row?.value);
  const identity = report?.source.identity ?? (url ? sourceIdentity(url) : null);
  const guide = removalGuide(process.env, identity, hostInfo().containerized);
  const cache = cacheCopyState();
  return {
    legacy: legacySourceState(),
    sourceConfigured: url !== null,
    report: report && {
      finishedAt: report.finishedAt,
      durationMs: report.durationMs,
      tables: report.tables.length,
      rows: report.rowsWritten,
      sourceEmpty: !!report.sourceEmpty,
      sourceVersion: report.source.version,
      source: report.source.identity,
      unrecognized: report.unrecognized ?? [],
      retired: report.retired,
      refused: report.refused,
      deferred: report.deferred.map((d) => d.table),
    },
    cache: { phase: cache.phase, percent: cacheCopyPercent(cache) },
    sourceCheck: sourceDivergence(),
    removal: { ...guide, dropCommand: guide.kind === "external" ? dropDatabaseCommand(guide.database) : null },
  };
}
