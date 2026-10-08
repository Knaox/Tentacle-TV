/**
 * Ce que la source CONTIENT, lu dans `information_schema` — jamais supposé : une
 * installation qui saute de 1.2x à 1.25 arrive avec le schéma de SA version
 * (colonnes en moins, colonnes retirées depuis, clé primaire d'avant).
 */
export interface SourceColumn {
  name: string;
  /** `varchar`, `datetime`, `tinyint`… */
  dataType: string;
  /** Type complet : `varchar(191)`, `tinyint(1)`, `decimal(10,3)`… */
  columnType: string;
  nullable: boolean;
  /** Défaut tel que MariaDB l'écrit (`'pending'`, `current_timestamp(3)`, `NULL`). */
  defaultValue: string | null;
  /** `auto_increment`, `on update current_timestamp()`… */
  extra?: string;
}

export interface SourceIndex {
  name: string;
  unique: boolean;
  columns: string[];
}

export interface SourceTable {
  name: string;
  columns: SourceColumn[];
  primaryKey: string[];
  /** Les colonnes qui ordonnent la lecture par pages : la clé primaire, sinon un index unique sans NULL. */
  keyColumns: string[];
  indexes: SourceIndex[];
  /** Estimation de MariaDB (pour la progression seulement ; le compte exact vient de `COUNT(*)`). */
  approxRows: number;
  approxBytes: number;
}

type Query = (sql: string, params?: unknown[]) => Promise<unknown[][]>;

const TABLES_SQL = `SELECT TABLE_NAME, TABLE_ROWS, DATA_LENGTH + INDEX_LENGTH
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'
  ORDER BY TABLE_NAME`;

const COLUMNS_SQL = `SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
  ORDER BY TABLE_NAME, ORDINAL_POSITION`;

const INDEXES_SQL = `SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE, COLUMN_NAME
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
  ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX`;

const str = (v: unknown): string => String(v);
const num = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));

export async function readSourceSchema(query: Query): Promise<SourceTable[]> {
  const [tableRows, columnRows, indexRows] = [await query(TABLES_SQL), await query(COLUMNS_SQL), await query(INDEXES_SQL)];
  const tables = new Map<string, SourceTable>();
  for (const [name, rows, bytes] of tableRows) {
    tables.set(str(name), {
      name: str(name),
      columns: [],
      primaryKey: [],
      keyColumns: [],
      indexes: [],
      approxRows: num(rows),
      approxBytes: num(bytes),
    });
  }
  for (const [table, name, dataType, columnType, nullable, defaultValue, extra] of columnRows) {
    tables.get(str(table))?.columns.push({
      name: str(name),
      dataType: str(dataType).toLowerCase(),
      columnType: str(columnType).toLowerCase(),
      nullable: str(nullable) === "YES",
      defaultValue: defaultValue === null || defaultValue === undefined ? null : str(defaultValue),
      extra: extra ? str(extra).toLowerCase() : "",
    });
  }
  for (const [table, indexName, nonUnique, column] of indexRows) {
    const t = tables.get(str(table));
    if (!t) continue;
    let index = t.indexes.find((i) => i.name === str(indexName));
    if (!index) {
      index = { name: str(indexName), unique: num(nonUnique) === 0, columns: [] };
      t.indexes.push(index);
    }
    index.columns.push(str(column));
  }
  for (const t of tables.values()) {
    const primary = t.indexes.find((i) => i.name === "PRIMARY");
    t.primaryKey = primary ? [...primary.columns] : [];
    t.indexes = t.indexes.filter((i) => i.name !== "PRIMARY");
    t.keyColumns = t.primaryKey.length ? t.primaryKey : pagingKey(t);
  }
  return [...tables.values()];
}

/** Sans clé primaire : un index unique dont aucune colonne n'admet NULL ordonne aussi bien. */
function pagingKey(t: SourceTable): string[] {
  const notNull = (c: string) => t.columns.find((col) => col.name === c)?.nullable === false;
  return t.indexes.find((i) => i.unique && i.columns.every(notNull))?.columns ?? [];
}
