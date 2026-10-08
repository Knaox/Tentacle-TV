import { getPrisma } from "../db";
import { createPluginStorage, type RawExecutor } from "./createPluginStorage";
import { prismaExecutor } from "./prismaExecutor";
import type { PluginStorage } from "./types";

/**
 * L'interface de stockage telle que l'hôte la prête (`ctx.storage`), sur le
 * client Prisma du cœur — le serveur ne sert que depuis SQLite.
 */
export function createHostPluginStorage(pluginId: string): PluginStorage {
  // Le client se lit à chaque appel : une reconnexion en change.
  const executor: RawExecutor = {
    query: (sql, params) => prismaExecutor(getPrisma()).query(sql, params),
    execute: (sql, params) => prismaExecutor(getPrisma()).execute(sql, params),
    transaction: (fn) => prismaExecutor(getPrisma()).transaction(fn),
  };
  return createPluginStorage({ pluginId, executor });
}
