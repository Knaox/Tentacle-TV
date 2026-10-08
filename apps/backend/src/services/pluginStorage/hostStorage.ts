import { getActiveDatabaseUrl, getDatabaseUrl, getPrisma } from "../db";
import { createPluginStorage, type RawExecutor } from "./createPluginStorage";
import { prismaExecutor } from "./prismaExecutor";
import type { DateStorageFormat } from "./sqlFragments";
import type { PluginStorage, StorageDialect } from "./types";

/**
 * L'interface de stockage telle que l'hôte la prête (`ctx.storage`).
 *
 * Le moteur se lit sur l'URL de la base en service : `file:` est SQLite,
 * le reste MariaDB.
 */

/**
 * Le format des dates sur SQLite, celui que le client Prisma du cœur relit :
 * toute date écrite par une extension doit pouvoir être relue par lui
 * (`content_claims` de Vigie). Provisoire jusqu'à la note de décision du socle.
 */
export const SQLITE_DATE_FORMAT: DateStorageFormat = "iso8601";

export function currentStorageDialect(): StorageDialect {
  const url = getActiveDatabaseUrl() ?? getDatabaseUrl() ?? "";
  return url.startsWith("file:") ? "sqlite" : "mysql";
}

export function createHostPluginStorage(pluginId: string): PluginStorage {
  // Le client se lit à chaque appel : une reconnexion (`reconnectPrisma`) en change.
  const executor: RawExecutor = {
    query: (sql, params) => prismaExecutor(getPrisma()).query(sql, params),
    execute: (sql, params) => prismaExecutor(getPrisma()).execute(sql, params),
    transaction: (fn) => prismaExecutor(getPrisma()).transaction(fn),
  };
  return createPluginStorage({ pluginId, dialect: currentStorageDialect(), dateFormat: SQLITE_DATE_FORMAT, executor });
}
