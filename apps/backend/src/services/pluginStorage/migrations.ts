import type { PluginMigration, PluginStorage, PluginStorageQueries } from "./types";

/**
 * Les migrations VERSIONNÉES d'une extension, tenues par l'hôte dans
 * `plugin_migrations` (une ligne par extension et par version passée).
 *
 * - Chacune ne passe qu'une fois ; une version déjà notée n'est jamais rejouée.
 * - Sur SQLite, la migration et sa trace partent dans la MÊME transaction :
 *   une migration qui échoue ne laisse rien à moitié. MariaDB valide d'office
 *   chaque ordre DDL : la trace suit la migration, qui doit donc être
 *   idempotente (IF NOT EXISTS, colonne cherchée avant d'être ajoutée).
 * - Une table venue d'ailleurs (copie de la migration MariaDB → SQLite, base
 *   d'avant cette interface) n'a aucune trace : la première migration la
 *   RECONNAÎT et la complète, elle ne la recrée pas.
 * - L'hôte ne touche jamais aux tables d'une extension : il ne fait que noter.
 */

export const MIGRATIONS_TABLE = "plugin_migrations";

function checkMigrations(migrations: readonly PluginMigration[]): PluginMigration[] {
  const sorted = [...migrations].sort((a, b) => a.version - b.version);
  sorted.forEach((migration, index) => {
    if (!Number.isInteger(migration.version) || migration.version < 1) {
      throw new Error(`[pluginStorage] version de migration invalide : ${migration.version}`);
    }
    if (index > 0 && sorted[index - 1].version === migration.version) {
      throw new Error(`[pluginStorage] version de migration en double : ${migration.version}`);
    }
  });
  return sorted;
}

async function appliedVersions(storage: PluginStorageQueries, pluginId: string): Promise<Set<number>> {
  const rows = await storage.query<{ version: number }>(
    `SELECT version FROM ${MIGRATIONS_TABLE} WHERE pluginId = ?`, pluginId,
  );
  return new Set(rows.map((row) => Number(row.version)));
}

async function record(storage: PluginStorageQueries, pluginId: string, migration: PluginMigration): Promise<void> {
  await storage.execute(
    `INSERT INTO ${MIGRATIONS_TABLE} (pluginId, version, name, appliedAt) VALUES (?, ?, ?, ?)`,
    pluginId, migration.version, migration.name, storage.sql.dateParam(new Date()),
  );
}

// Une file par extension : deux appels simultanés ne jouent pas deux fois la même migration.
const queues = new Map<string, Promise<unknown>>();

export function runPluginMigrations(
  pluginId: string,
  storage: PluginStorage,
  migrations: readonly PluginMigration[],
): Promise<number[]> {
  const previous = queues.get(pluginId) ?? Promise.resolve();
  const run = previous.catch(() => undefined).then(() => applyPending(pluginId, storage, migrations));
  queues.set(pluginId, run);
  return run;
}

async function applyPending(
  pluginId: string,
  storage: PluginStorage,
  migrations: readonly PluginMigration[],
): Promise<number[]> {
  const sorted = checkMigrations(migrations);
  const done = await appliedVersions(storage, pluginId);
  const applied: number[] = [];
  for (const migration of sorted) {
    if (done.has(migration.version)) continue;
    try {
      if (storage.dialect === "sqlite") {
        await storage.transaction(async (tx) => {
          await migration.up(tx);
          await record(tx, pluginId, migration);
        });
      } else {
        await migration.up(storage);
        await record(storage, pluginId, migration);
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new Error(`[pluginStorage] ${pluginId} : migration ${migration.version} (${migration.name}) en échec — ${detail}`, { cause: err });
    }
    console.log(`[pluginStorage] ${pluginId} : migration ${migration.version} (${migration.name}) appliquée`);
    applied.push(migration.version);
  }
  return applied;
}
