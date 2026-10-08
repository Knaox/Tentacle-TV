import type { SelectColumn, SourceRow } from "../legacySource/mariadbReader";
import type { SourceColumn, SourceTable } from "../legacySource/sourceSchema";
import { isDateTimeColumn, mariadbDateTimeToMs, toSqliteValue } from "../legacySource/sqliteTypes";
import { zonePolicy } from "../legacySource/timeZones";
import type { ColumnPlan, TablePlan } from "./tableCopy";
import type { CoreField, CoreModel } from "./coreModels";

/**
 * Les PLANS de copie : pour chaque colonne de la cible, d'où vient la valeur et
 * comment elle se convertit. Une table du cœur suit son modèle Prisma (types,
 * défauts) ; une table d'extension se recopie colonne pour colonne.
 */
export interface PlanContext {
  /** Fuseau des `NOW()` de la source, `null` si UTC (GENERIC-COPY.md). */
  sourceZone: string | null;
  /** L'instant de la copie : la valeur de `now()` d'une colonne absente de la source. */
  startedAt: number;
  /** Dates « zéro » rencontrées, par `table.colonne` — des comptes, jamais une valeur. */
  zeroDates: Map<string, number>;
}

export interface CorePlan extends TablePlan {
  /** Colonnes du modèle absentes de la source (source ancienne) : remplies de leur défaut. */
  missingColumns: string[];
  /** Colonnes de la source que le modèle n'a plus (retirées depuis) : non lues. */
  droppedColumns: string[];
}

/** Liste de lecture : une clé convertie de fuseau est lue en double (brute pour le curseur). */
function selectList(source: SourceTable, columns: SourceColumn[], zoneOf: (c: SourceColumn) => string | null): SelectColumn[] {
  const list: SelectColumn[] = columns.map((c) => ({ name: c.name, fromZone: zoneOf(c) }));
  for (const key of source.keyColumns) {
    if (!list.some((c) => c.name === key && !c.fromZone)) list.push({ name: key });
  }
  return list;
}

function zeroCounted(ctx: PlanContext, where: string, required: boolean, text: string): number | null {
  const ms = mariadbDateTimeToMs(text);
  if (ms !== null) return ms;
  ctx.zeroDates.set(where, (ctx.zeroDates.get(where) ?? 0) + 1);
  return required ? 0 : null;
}

function convertCore(field: CoreField, where: string, ctx: PlanContext): (v: unknown) => unknown {
  return (v) => {
    if (v === null || v === undefined) return null;
    switch (field.type) {
      case "DateTime":
        return zeroCounted(ctx, where, field.required, String(v));
      case "Boolean":
        return Number(v) ? 1 : 0;
      case "Int":
      case "Float":
        return Number(v);
      case "String":
        return Buffer.isBuffer(v) ? v.toString("utf8") : String(v);
      default:
        return v;
    }
  };
}

/** La valeur d'une colonne que la source n'a pas (elle est venue après sa version). */
function fallbackCore(field: CoreField, model: CoreModel, read: SelectColumn[], ctx: PlanContext): (v: unknown, raw: SourceRow) => unknown {
  const def = field.default;
  if (def !== undefined && (typeof def !== "object" || def === null)) {
    const literal = typeof def === "boolean" ? (def ? 1 : 0) : def;
    return () => literal;
  }
  if (def && typeof def === "object" && (def as { name?: unknown }).name === "now") return () => ctx.startedAt;
  if (field.updatedAt) {
    // `@updatedAt` sans valeur : la date de création de la ligne, sinon l'instant de la copie.
    const created = read.findIndex((c) => c.name === "createdAt" && !c.fromZone);
    return (_v, raw) => (created >= 0 && raw[created] ? zeroCounted(ctx, `${model.table}.createdAt`, true, String(raw[created])) : ctx.startedAt);
  }
  if (!field.required) return () => null;
  throw new Error(`colonne requise absente de la source sans défaut : ${model.table}.${field.column}`);
}

export function corePlan(model: CoreModel, source: SourceTable, ctx: PlanContext): CorePlan {
  const sourceCols = new Map(source.columns.map((c) => [c.name, c]));
  const present = model.fields.filter((f) => sourceCols.has(f.column));
  const zoneOf = (c: SourceColumn) =>
    isDateTimeColumn(c) && ctx.sourceZone && zonePolicy(model.table, c.name, true) === "session" ? ctx.sourceZone : null;
  const read = selectList(source, present.map((f) => sourceCols.get(f.column)!), zoneOf);
  const columns: ColumnPlan[] = model.fields.map((field) => {
    const index = read.findIndex((c) => c.name === field.column);
    if (index < 0) return { target: field.column, sourceIndex: null, convert: fallbackCore(field, model, read, ctx) };
    return { target: field.column, sourceIndex: index, convert: convertCore(field, `${model.table}.${field.column}`, ctx) };
  });
  return {
    source,
    sourceColumns: read,
    target: model.table,
    columns,
    verb: "INSERT",
    missingColumns: model.fields.filter((f) => !sourceCols.has(f.column)).map((f) => f.column),
    droppedColumns: source.columns.filter((c) => !model.fields.some((f) => f.column === c.name)).map((c) => c.name),
  };
}

export function extensionPlan(source: SourceTable, ctx: PlanContext, verb: TablePlan["verb"] = "INSERT"): TablePlan {
  const zoneOf = (c: SourceColumn) =>
    isDateTimeColumn(c) && ctx.sourceZone && zonePolicy(source.name, c.name, false) === "session" ? ctx.sourceZone : null;
  const read = selectList(source, source.columns, zoneOf);
  const columns: ColumnPlan[] = source.columns.map((col) => {
    const index = read.findIndex((c) => c.name === col.name);
    const where = `${source.name}.${col.name}`;
    return {
      target: col.name,
      sourceIndex: index,
      convert: (v: unknown) => {
        if (isDateTimeColumn(col) && typeof v === "string" && mariadbDateTimeToMs(v) === null) {
          ctx.zeroDates.set(where, (ctx.zeroDates.get(where) ?? 0) + 1);
        }
        return toSqliteValue(col, v);
      },
    };
  });
  return { source, sourceColumns: read, target: source.name, columns, verb };
}
