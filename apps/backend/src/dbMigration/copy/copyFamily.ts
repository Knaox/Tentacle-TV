import type { MariadbReader } from "../legacySource/mariadbReader";
import type { SourceTable } from "../legacySource/sourceSchema";
import { quoteIdent } from "../legacySource/extensionDdl";
import { migrateFamilyToV2, type Row } from "../transforms/familyV2";
import type { CoreModel } from "./coreModels";
import { convertRow, pageSizeFor, type CopyTarget } from "./tableCopy";
import { corePlan, type PlanContext } from "./tablePlans";
import type { TableObservers } from "./tableObservers";

/**
 * Les trois tables de la Famille passent ENSEMBLE : lues entières (une ligne par
 * personne, petites par nature), migrées v1 → v2 en mémoire, puis écrites. Une
 * source d'avant la Famille ne les a pas : rien à faire.
 */
export const FAMILY_TABLES = ["families", "family_members", "family_invitations"] as const;

export interface FamilyCopyReport {
  table: string;
  rowsRead: number;
  rowsWritten: number;
  ms: number;
}

async function readAll(reader: MariadbReader, model: CoreModel, source: SourceTable, ctx: PlanContext, observers: TableObservers) {
  const plan = corePlan(model, source, ctx);
  const keys = source.keyColumns.map((k) => plan.sourceColumns.findIndex((c) => c.name === k && !c.fromZone));
  const rows: Row[] = [];
  let after: unknown[] | null = null;
  let offset = 0;
  const size = pageSizeFor(source);
  for (;;) {
    const page = await reader.page(source, plan.sourceColumns, { after }, size, offset);
    for (const raw of page) {
      observers.raw(raw);
      rows.push(convertRow(plan, raw));
    }
    if (page.length < size) break;
    if (keys.length) after = keys.map((i) => page[page.length - 1][i]);
    else offset += page.length;
  }
  return { rows, plan };
}

export async function copyFamily(
  reader: MariadbReader,
  sources: Map<string, SourceTable>,
  models: Map<string, CoreModel>,
  ctx: PlanContext,
  target: CopyTarget,
  observersFor: (table: string, columns: string[]) => TableObservers,
): Promise<{ reports: FamilyCopyReport[]; closedInvitationIds: Set<string>; orphansDropped: number }> {
  const present = FAMILY_TABLES.filter((t) => sources.has(t) && models.has(t));
  if (present.length === 0) return { reports: [], closedInvitationIds: new Set(), orphansDropped: 0 };
  const started = Date.now();
  const read: Partial<Record<(typeof FAMILY_TABLES)[number], Row[]>> = {};
  const counts: Record<string, number> = {};
  const observers: Record<string, TableObservers> = {};
  for (const table of present) {
    const model = models.get(table)!;
    observers[table] = observersFor(table, model.fields.map((f) => f.column));
    const { rows } = await readAll(reader, model, sources.get(table)!, ctx, observers[table]);
    read[table] = rows;
    counts[table] = rows.length;
  }
  const result = migrateFamilyToV2(
    { families: read.families ?? [], members: read.family_members ?? [], invitations: read.family_invitations ?? [] },
    ctx.startedAt,
  );
  const written: Record<string, Row[]> = {
    families: result.families,
    family_members: result.members,
    family_invitations: result.invitations,
  };
  const reports: FamilyCopyReport[] = [];
  for (const table of present) {
    const model = models.get(table)!;
    const columns = model.fields.map((f) => f.column);
    const insert = target.prepare(
      `INSERT INTO ${quoteIdent(table)} (${columns.map(quoteIdent).join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`,
    );
    target.exec("BEGIN IMMEDIATE");
    try {
      for (const row of written[table]) {
        const values = columns.map((c) => (row[c] === undefined ? null : row[c]));
        insert.run(...(values as never[]));
        observers[table].written(values);
      }
      target.exec("COMMIT");
    } catch (err) {
      target.exec("ROLLBACK");
      throw err;
    }
    reports.push({ table, rowsRead: counts[table], rowsWritten: written[table].length, ms: Date.now() - started });
  }
  return { reports, closedInvitationIds: result.closedInvitationIds, orphansDropped: result.orphansDropped };
}
