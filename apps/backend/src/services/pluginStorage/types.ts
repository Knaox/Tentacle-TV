/**
 * L'interface de stockage que l'hôte prête à une extension (`ctx.storage`).
 *
 * Le serveur ne sert que depuis SQLite (docs/sqlite/DECISION.md) : une
 * extension y écrit un SQL SQLite, et ne passe par ces aides que pour ce qui
 * doit rester d'accord avec le cœur — les dates, toujours un INTEGER en
 * millisecondes epoch UTC (le format que Prisma relit et compare), et les
 * upserts. `getPrisma()` reste prêté, pour les modèles du cœur.
 *
 * Les noms de ce fichier traversent la frontière d'un module chargé à
 * l'exécution : ils ne se renomment pas, ils s'ajoutent.
 */

export type StorageDialect = "sqlite";

export type IntervalUnit = "second" | "minute" | "hour" | "day";

/**
 * Ce qu'un upsert pose sur conflit — une liste FERMÉE, jamais du SQL libre :
 * une colonne seule reprend la valeur proposée (`excluded.col`) ;
 * `[col, "now"]` y écrit l'instant présent.
 */
export type UpsertUpdate = string | readonly [string, "now"];

export interface UpsertSpec {
  table: string;
  /** Colonnes insérées, dans l'ordre des paramètres `?`. */
  columns: readonly string[];
  /** Nombre de lignes insérées d'un coup (1 par défaut) : `columns.length × rows` paramètres. */
  rows?: number;
  /** La clé (primaire ou unique) qui fait le conflit. */
  conflict: readonly string[];
  /** Ce qui change sur conflit ; vide : la ligne en place est gardée telle quelle. */
  update: readonly UpsertUpdate[];
}

/** Les tournures que le cœur et les extensions doivent écrire pareil. */
export interface StorageSql {
  /** Instant présent, en SQL (millisecondes epoch, INTEGER). */
  now(): string;
  /** Instant présent décalé de `amount` unités (négatif : dans le passé), en SQL. */
  shiftedNow(amount: number, unit: IntervalUnit): string;
  /**
   * Minuit du jour en cours dans le FUSEAU DU SERVEUR, en SQL : un quota
   * journalier suit l'heure de la maison, pas l'UTC de la base.
   */
  startOfToday(): string;
  /** `INSERT … ON CONFLICT(…) DO UPDATE SET …` (ou `DO NOTHING`). */
  upsert(spec: UpsertSpec): string;
  /** `INSERT OR IGNORE` — à faire suivre de ` INTO t …`. */
  insertIgnore(): string;
  /** Une date JS au format de la base, à lier en paramètre `?`. */
  dateParam(date: Date): number;
  /** Une date relue (entier, `Date`, ou texte d'une base ancienne) ; `null` si illisible. */
  readDate(value: unknown): Date | null;
}

/** Une migration d'extension : jamais destructrice de ce qui sert encore. */
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
  /**
   * Transaction COURTE, reprise d'elle-même si la base est occupée. Jamais
   * d'appel réseau dedans : la base n'a qu'une connexion, tout attendrait.
   */
  transaction<T>(fn: (tx: PluginStorageQueries) => Promise<T>): Promise<T>;
  /** Applique les migrations pas encore passées ; rend les versions appliquées. */
  migrate(migrations: readonly PluginMigration[]): Promise<number[]>;
}
