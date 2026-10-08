import type { RawExecutor } from "./createPluginStorage";

/**
 * Une VRAIE base SQLite pour les tests (`node:sqlite`, intégré à Node 22) :
 * l'interface de stockage y tourne sans Prisma, avec le même SQL qu'en service.
 * Réservé aux tests — jamais importé par le serveur.
 */

type Statement = {
  all(...params: unknown[]): Record<string, unknown>[];
  run(...params: unknown[]): { changes: number | bigint };
};
export type TestDatabase = { exec(sql: string): void; prepare(sql: string): Statement; close(): void };

export function openTestDatabase(path = ":memory:"): TestDatabase {
  // Lu à l'exécution : le module n'existe qu'avec le préfixe `node:`.
  const { DatabaseSync } = (process as unknown as { getBuiltinModule(id: string): unknown }).getBuiltinModule("node:sqlite") as {
    DatabaseSync: new (path: string) => TestDatabase;
  };
  return new DatabaseSync(path);
}

/** Les valeurs que `node:sqlite` sait lier : une date passe par l'interface (`dateParam`). */
function bindable(params: unknown[]): unknown[] {
  return params.map((value) => (typeof value === "boolean" ? (value ? 1 : 0) : value === undefined ? null : value));
}

export function sqliteExecutor(db: TestDatabase): RawExecutor {
  let depth = 0;
  const executor: RawExecutor = {
    query: async (sql, params) => db.prepare(sql).all(...bindable(params)),
    execute: async (sql, params) => Number(db.prepare(sql).run(...bindable(params)).changes),
    transaction: async (fn) => {
      // Une seule connexion : les transactions imbriquées deviennent des points de sauvegarde.
      const savepoint = `sp_${depth}`;
      db.exec(depth === 0 ? "BEGIN IMMEDIATE" : `SAVEPOINT ${savepoint}`);
      depth++;
      try {
        const result = await fn(executor);
        depth--;
        db.exec(depth === 0 ? "COMMIT" : `RELEASE ${savepoint}`);
        return result;
      } catch (err) {
        depth--;
        db.exec(depth === 0 ? "ROLLBACK" : `ROLLBACK TO ${savepoint}`);
        throw err;
      }
    },
  };
  return executor;
}

/** La table de l'hôte, telle que le schéma du cœur la pose. */
export const PLUGIN_MIGRATIONS_DDL = `CREATE TABLE IF NOT EXISTS plugin_migrations (
  pluginId TEXT NOT NULL,
  version INTEGER NOT NULL,
  name TEXT NOT NULL,
  appliedAt DATETIME NOT NULL,
  PRIMARY KEY (pluginId, version)
)`;
