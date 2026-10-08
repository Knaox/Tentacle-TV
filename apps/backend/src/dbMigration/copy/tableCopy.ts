import type { MariadbReader, SelectColumn, SourceRow } from "../legacySource/mariadbReader";
import type { SourceTable } from "../legacySource/sourceSchema";
import { quoteIdent } from "../legacySource/extensionDdl";

/**
 * La copie d'UNE table, page après page : lecture sur la clé primaire dans
 * l'instantané de la source, écriture dans une transaction courte par page.
 *
 * Le plan dit, colonne CIBLE par colonne cible, d'où vient la valeur : une colonne
 * de la source (convertie) ou une valeur de repli (colonne absente d'une source
 * ancienne). Une transformation de ligne (Famille v1 → v2, purge d'AniList…) peut
 * écarter ou réécrire une ligne avant l'écriture.
 */
export interface TargetStatement {
  run(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
}
export interface CopyTarget {
  exec(sql: string): void;
  prepare(sql: string): TargetStatement;
}

export interface ColumnPlan {
  target: string;
  /** Index de la colonne dans la ligne lue, ou `null` si la source ne l'a pas. */
  sourceIndex: number | null;
  convert: (value: unknown, row: SourceRow) => unknown;
}

export interface TablePlan {
  source: SourceTable;
  /** Colonnes LUES dans la source, dans l'ordre des lignes rendues (fuseau à convertir compris). */
  sourceColumns: SelectColumn[];
  target: string;
  columns: ColumnPlan[];
  /** `INSERT OR IGNORE` pour les caches copiés après la bascule : la ligne vivante gagne. */
  verb: "INSERT" | "INSERT OR IGNORE";
  /** Écarte (`null`) ou réécrit une ligne déjà convertie, indexée par colonne cible. */
  transformRow?: (row: Record<string, unknown>) => Record<string, unknown> | null;
}

/** Ce que la vérification observe pendant la copie (empreinte de la source, sommes attendues). */
export interface CopyObservers {
  /** Chaque ligne LUE, telle que la source l'a rendue. */
  raw?: (row: SourceRow) => void;
  /** Chaque ligne ÉCRITE, dans l'ordre des colonnes du plan. */
  written?: (values: unknown[]) => void;
}

export interface CopyProgress {
  table: string;
  rowsDone: number;
}

export interface CopyResult {
  table: string;
  rowsRead: number;
  rowsWritten: number;
  ms: number;
}

/** ~8 Mo par page : `tmdb_meta_cache` (≈ 44 Ko la ligne) lit 200 lignes, une petite table 5 000. */
export function pageSizeFor(table: SourceTable): number {
  const avg = table.approxRows > 0 ? table.approxBytes / table.approxRows : 512;
  return Math.max(100, Math.min(5000, Math.floor((8 * 1024 * 1024) / Math.max(avg, 1))));
}

export async function copyTable(
  reader: MariadbReader,
  plan: TablePlan,
  target: CopyTarget,
  onProgress?: (p: CopyProgress) => void,
  observers: CopyObservers = {},
): Promise<CopyResult> {
  const started = Date.now();
  const names = plan.columns.map((c) => quoteIdent(c.target));
  const insert = target.prepare(
    `${plan.verb} INTO ${quoteIdent(plan.target)} (${names.join(", ")}) VALUES (${names.map(() => "?").join(", ")})`,
  );
  // Le curseur lit la valeur BRUTE de la clé (jamais une date convertie de fuseau) :
  // le plan lit en double une colonne de clé qu'il convertit.
  const keyIndexes = plan.source.keyColumns.map((k) => plan.sourceColumns.findIndex((c) => c.name === k && !c.fromZone));
  if (keyIndexes.some((i) => i < 0)) throw new Error(`clé de ${plan.target} absente des colonnes lues`);
  const size = pageSizeFor(plan.source);
  let after: unknown[] | null = null;
  let offset = 0;
  let rowsRead = 0;
  let rowsWritten = 0;
  for (;;) {
    const rows = await reader.page(plan.source, plan.sourceColumns, { after }, size, offset);
    if (rows.length === 0) break;
    target.exec("BEGIN IMMEDIATE");
    try {
      for (const raw of rows) {
        observers.raw?.(raw);
        const row = convertRow(plan, raw);
        const kept = plan.transformRow ? plan.transformRow(row) : row;
        if (!kept) continue;
        const values = plan.columns.map((c) => kept[c.target]);
        insert.run(...(values as never[]));
        observers.written?.(values);
        rowsWritten++;
      }
      target.exec("COMMIT");
    } catch (err) {
      target.exec("ROLLBACK");
      throw err;
    }
    rowsRead += rows.length;
    onProgress?.({ table: plan.target, rowsDone: rowsRead });
    if (rows.length < size) break;
    if (keyIndexes.length) after = keyIndexes.map((i) => rows[rows.length - 1][i]);
    else offset += rows.length;
  }
  return { table: plan.target, rowsRead, rowsWritten, ms: Date.now() - started };
}

export function convertRow(plan: TablePlan, raw: SourceRow): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const c of plan.columns) {
    row[c.target] = c.convert(c.sourceIndex === null ? undefined : raw[c.sourceIndex], raw);
  }
  return row;
}
