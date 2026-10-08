/**
 * L'interface de stockage que l'hôte prête à une extension (`ctx.storage`).
 *
 * Elle s'ajoute à `getPrisma()`, gardé pour les extensions d'avant : une
 * extension qui la trouve écrit un SQL qui tourne sur les DEUX moteurs, en ne
 * passant par ces aides que pour les seules tournures non portables (upsert,
 * maintenant, intervalle, début du jour). Une extension qui ne la trouve pas
 * (serveur ≤ 1.24) est sur MariaDB et garde son comportement d'avant.
 *
 * Les noms de ce fichier traversent la frontière d'un module chargé à
 * l'exécution : ils ne se renomment pas, ils s'ajoutent.
 */

export type StorageDialect = "sqlite" | "mysql";

export type IntervalUnit = "second" | "minute" | "hour" | "day";

/** Une colonne d'un upsert dont la valeur, en cas de conflit, se recalcule. */
export interface UpsertSpec {
  table: string;
  /** Colonnes insérées, dans l'ordre des paramètres `?`. */
  columns: readonly string[];
  /** La clé (primaire ou unique) qui fait le conflit. Exigée par SQLite. */
  conflict: readonly string[];
  /**
   * Ce qui change sur conflit : une colonne seule reprend la valeur proposée ;
   * un couple `[colonne, expression]` pose l'expression, où `{new:col}` désigne
   * la valeur proposée (`VALUES(col)` / `excluded.col`). Vide : on ignore.
   */
  update: ReadonlyArray<string | readonly [string, string]>;
}

/** Les tournures que les deux moteurs n'écrivent pas pareil. */
export interface StorageSql {
  /** Instant présent, à écrire dans une colonne de date. */
  now(): string;
  /** Instant présent décalé de `amount` unités (négatif : dans le passé). */
  shiftedNow(amount: number, unit: IntervalUnit): string;
  /**
   * Minuit du jour en cours dans le FUSEAU DU SERVEUR (pas celui de la base) :
   * un quota journalier ne dépend plus de l'horloge de MariaDB ni de l'UTC de SQLite.
   */
  startOfToday(): string;
  /** `INSERT … ON DUPLICATE KEY UPDATE` / `INSERT … ON CONFLICT DO UPDATE`. */
  upsert(spec: UpsertSpec): string;
  /** `INSERT IGNORE` / `INSERT OR IGNORE` — à faire suivre de ` INTO t …`. */
  insertIgnore(): string;
  /** Une date JS au format que la base garde (à passer en paramètre `?`). */
  dateParam(date: Date): unknown;
}

/** Une migration d'extension : idempotente de préférence, jamais destructrice. */
export interface PluginMigration {
  /** 1, 2, 3… : appliquées dans l'ordre, une seule fois chacune. */
  version: number;
  name: string;
  up: (storage: PluginStorageQueries) => Promise<void>;
}

export interface PluginStorageQueries {
  readonly dialect: StorageDialect;
  readonly sql: StorageSql;
  /** Lignes, entiers normalisés (`Number`, jamais un BigInt). */
  query<T = Record<string, unknown>>(sql: string, ...params: unknown[]): Promise<T[]>;
  /** Nombre de lignes touchées. */
  execute(sql: string, ...params: unknown[]): Promise<number>;
  /** Noms des colonnes d'une table, `[]` si elle n'existe pas. */
  columns(table: string): Promise<string[]>;
  tableExists(table: string): Promise<boolean>;
}

export interface PluginStorage extends PluginStorageQueries {
  /** Version de l'interface : 1. Une aide nouvelle se teste avant usage. */
  readonly version: 1;
  /** Transaction courte, reprise d'elle-même si la base est occupée. */
  transaction<T>(fn: (tx: PluginStorageQueries) => Promise<T>): Promise<T>;
  /** Applique les migrations pas encore passées ; rend les versions appliquées. */
  migrate(migrations: readonly PluginMigration[]): Promise<number[]>;
}
