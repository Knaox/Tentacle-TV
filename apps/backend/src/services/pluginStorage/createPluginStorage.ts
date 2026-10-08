import { withBusyRetry, type BusyRetryOptions } from "./busyRetry";
import { assertIdentifier, createStorageSql } from "./sqlFragments";
import { runPluginMigrations } from "./migrations";
import type { PluginStorage, PluginStorageQueries } from "./types";

/**
 * Ce que l'interface attend de la base : deux appels bruts et une transaction.
 * En service, c'est le client Prisma du cœur (`prismaExecutor.ts`) ; dans les
 * tests, une vraie SQLite (`node:sqlite`) — la même interface, le même SQL.
 */
export interface RawExecutor {
  query(sql: string, params: unknown[]): Promise<Record<string, unknown>[]>;
  execute(sql: string, params: unknown[]): Promise<number>;
  transaction<T>(fn: (tx: RawExecutor) => Promise<T>): Promise<T>;
}

export interface PluginStorageOptions {
  pluginId: string;
  executor: RawExecutor;
  clock?: () => Date;
  retry?: BusyRetryOptions;
}

/** Aucun BigInt ne sort : un COUNT(*) ou un entier 64 bits redevient un `number`. */
export function normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    out[key] = typeof value === "bigint" ? Number(value) : value;
  }
  return out;
}

function queriesOver(
  executor: RawExecutor,
  sql: PluginStorageQueries["sql"],
  retry: BusyRetryOptions | undefined,
  inTransaction: boolean,
): PluginStorageQueries {
  // Dans une transaction, la reprise vaut pour la transaction entière, pas pour un ordre seul.
  const guarded = <T>(fn: () => Promise<T>) => (inTransaction ? fn() : withBusyRetry(fn, retry));
  const query = async <T>(text: string, ...params: unknown[]) =>
    (await guarded(() => executor.query(text, params))).map(normalizeRow) as T[];
  const columns = async (table: string): Promise<string[]> => {
    const rows = await query<{ name: string }>("SELECT name FROM pragma_table_info(?) ORDER BY cid", assertIdentifier(table));
    return rows.map((row) => String(row.name));
  };
  return {
    dialect: "sqlite",
    sql,
    query,
    execute: (text, ...params) => guarded(() => executor.execute(text, params)),
    columns,
    tableExists: async (table) => (await columns(table)).length > 0,
  };
}

export function createPluginStorage(options: PluginStorageOptions): PluginStorage {
  const { executor, retry } = options;
  const sql = createStorageSql(options.clock);
  const base = queriesOver(executor, sql, retry, false);
  const transaction: PluginStorage["transaction"] = (fn) =>
    withBusyRetry(() => executor.transaction((tx) => fn(queriesOver(tx, sql, retry, true))), retry);
  const storage: PluginStorage = {
    ...base,
    version: 1,
    transaction,
    migrate: (migrations) => runPluginMigrations(options.pluginId, storage, migrations),
  };
  return storage;
}
