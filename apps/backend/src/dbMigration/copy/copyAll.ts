import type { MariadbReader } from "../legacySource/mariadbReader";
import type { SourceTable } from "../legacySource/sourceSchema";
import { createIndexSql, createTableSql } from "../legacySource/extensionDdl";
import { judgeSource } from "../legacySource/sourceFloor";
import { legacyRowFilter } from "../transforms/legacyRows";
import { MigrationFailure } from "../migrationErrors";
import type { CoreModel } from "./coreModels";
import { copyFamily, FAMILY_TABLES } from "./copyFamily";
import { copyTable, type CopyTarget, type TablePlan } from "./tableCopy";
import { classifyTables, type TableFate } from "./tableClassification";
import { corePlan, extensionPlan, type PlanContext } from "./tablePlans";
import { CopyObservations } from "./tableObservers";
import type { TableChecksum } from "../verify/checksums";

/**
 * La copie de TOUTE la source, avant la bascule — sauf les tables différées
 * (le cache TMDB, copié ensuite en fond). Ordre : la Famille (sa migration v2
 * dit quelles cloches d'invitation partent), le reste du cœur, puis les tables
 * d'extension, créées par la copie avec leur forme (GENERIC-COPY.md).
 */
export interface CopyAllInput {
  reader: MariadbReader;
  target: CopyTarget;
  models: CoreModel[];
  startedAt: number;
  /** Copiées plus tard, en fond (le cache TMDB). */
  deferred: ReadonlySet<string>;
  /** Hors de l'empreinte de divergence (§ 3.10). */
  caches: ReadonlySet<string>;
  onTable?: (done: { table: string; rows: number }, progress: { tablesDone: number; tablesTotal: number; bytesDone: number; bytesTotal: number }) => void;
}

export interface TableReport {
  table: string;
  kind: "core" | "extension";
  sourceRows: number;
  rowsWritten: number;
  filtered: number;
  ms: number;
  missingColumns?: string[];
  droppedColumns?: string[];
}

export interface CopyAllResult {
  verdict: ReturnType<typeof judgeSource>["kind"];
  tables: TableReport[];
  fates: TableFate[];
  deferred: Array<{ table: string; sourceRows: number }>;
  expected: Record<string, TableChecksum>;
  fingerprint: Record<string, { rows: number; sum: string }>;
  zeroDates: Record<string, number>;
  familyOrphansDropped: number;
}

export async function copyAll(input: CopyAllInput): Promise<CopyAllResult> {
  const { reader, target, models } = input;
  const sources = new Map((await reader.tables()).map((t) => [t.name, t]));
  const names = [...sources.keys()];
  const verdict = judgeSource(names, models.map((m) => m.table)).kind;
  const empty: CopyAllResult = { verdict, tables: [], fates: [], deferred: [], expected: {}, fingerprint: {}, zeroDates: {}, familyOrphansDropped: 0 };
  if (verdict === "too_old") throw new MigrationFailure("source_too_old", "la source précède la 1.4.0 (share_links / provisioning_codes absents)");
  if (verdict === "empty") return empty;

  const targetNames = (target.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>).map((r) => r.name);
  const fates = classifyTables(names, models.map((m) => m.table), targetNames);
  const modelByTable = new Map(models.map((m) => [m.table, m]));
  const ctx: PlanContext = { sourceZone: reader.sourceZone, startedAt: input.startedAt, zeroDates: new Map() };
  const observations = new CopyObservations(input.caches);
  const copied = fates.filter((f) => (f.fate === "core" || f.fate === "extension") && !input.deferred.has(f.name));
  const bytesTotal = copied.reduce((n, f) => n + sources.get(f.name)!.approxBytes, 0);
  let bytesDone = 0;
  const tables: TableReport[] = [];
  const done = (table: string, rows: number) => {
    bytesDone += sources.get(table)!.approxBytes;
    input.onTable?.({ table, rows }, { tablesDone: tables.length, tablesTotal: copied.length, bytesDone, bytesTotal });
  };

  // 1. La Famille, ensemble.
  const family = await copyFamily(reader, sources, modelByTable, ctx, target, (t, cols) => observations.for(t, cols));
  for (const r of family.reports) {
    tables.push({ table: r.table, kind: "core", sourceRows: r.rowsRead, rowsWritten: r.rowsWritten, filtered: r.rowsRead - r.rowsWritten, ms: r.ms });
    done(r.table, r.rowsWritten);
  }

  // 2. Le reste du cœur, puis les extensions.
  for (const fate of copied) {
    if ((FAMILY_TABLES as readonly string[]).includes(fate.name)) continue;
    const source = sources.get(fate.name)!;
    const sourceRows = await reader.count(source.name);
    let plan: TablePlan & { missingColumns?: string[]; droppedColumns?: string[] };
    if (fate.fate === "core") {
      plan = corePlan(modelByTable.get(fate.name)!, source, ctx);
      const keep = legacyRowFilter(fate.name);
      const closed = family.closedInvitationIds;
      plan.transformRow = (row) => {
        if (keep && !keep(row)) return null;
        // Les cloches d'une invitation qui n'est plus en attente partent (Famille v2, étape 5).
        if (fate.name === "notifications" && row.type === "family_invite" && closed.has(String(row.refId))) return null;
        return row;
      };
    } else {
      plan = extensionPlan(source, ctx);
      target.exec(createTableSql(source));
    }
    const observers = observations.for(fate.name, plan.columns.map((c) => c.target));
    const result = await copyTable(reader, plan, target, undefined, observers);
    if (result.rowsRead !== sourceRows) {
      throw new MigrationFailure("copy_failed", `${fate.name} : ${result.rowsRead} lignes lues pour ${sourceRows} dans l'instantané`);
    }
    if (fate.fate === "extension") createIndexes(target, source, targetNames);
    tables.push({
      table: fate.name,
      kind: fate.fate === "core" ? "core" : "extension",
      sourceRows,
      rowsWritten: result.rowsWritten,
      filtered: sourceRows - result.rowsWritten,
      ms: result.ms,
      ...(plan.missingColumns?.length ? { missingColumns: plan.missingColumns } : {}),
      ...(plan.droppedColumns?.length ? { droppedColumns: plan.droppedColumns } : {}),
    });
    done(fate.name, result.rowsWritten);
  }

  const deferred = fates.filter((f) => input.deferred.has(f.name) && (f.fate === "core" || f.fate === "extension"));
  return {
    verdict,
    tables,
    fates,
    deferred: deferred.map((f) => ({ table: f.name, sourceRows: sources.get(f.name)!.approxRows })),
    expected: observations.expectedSums(),
    fingerprint: observations.sourceFingerprint(),
    zeroDates: Object.fromEntries(ctx.zeroDates),
    familyOrphansDropped: family.orphansDropped,
  };
}

/** Index d'une table d'extension, après ses données (plus rapide) ; noms globaux tenus à jour. */
function createIndexes(target: CopyTarget, source: SourceTable, targetNames: string[]): void {
  const indexes = target.prepare("SELECT name FROM sqlite_master WHERE type = 'index'").all() as Array<{ name: string }>;
  const taken = new Set(indexes.map((r) => r.name.toLowerCase()));
  for (const name of targetNames) taken.add(name.toLowerCase());
  for (const sql of createIndexSql(source, taken)) target.exec(sql);
}
