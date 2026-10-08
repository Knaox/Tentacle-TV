import type { DatabaseSync } from "node:sqlite";

/**
 * SQLite par le module intégré de Node (`node:sqlite`) — sans Prisma, sans
 * dépendance native : l'exécuteur de migrations, la CLI en lecture seule et la
 * copie depuis MariaDB s'en servent.
 *
 * ⚠️ Jamais sur un fichier que Prisma tient ouvert dans le MÊME processus :
 * les verrous POSIX de SQLite sont par processus, deux bibliothèques ne s'y
 * voient pas verrouiller (mesuré, docs/sqlite/DECISION.md § 8). Au démarrage
 * AVANT Prisma, depuis un autre processus, ou sur un autre fichier.
 */
export interface OpenSqliteOptions {
  readOnly?: boolean;
  /** Contraintes de clés étrangères : l'exécuteur de migrations les vérifie lui-même. */
  foreignKeys?: boolean;
}

type NodeSqliteModule = typeof import("node:sqlite");
let loaded: NodeSqliteModule | null = null;

/**
 * Charge `node:sqlite` en taisant SON avertissement « expérimental » (Node 22)
 * et lui seul : le journal du serveur n'a pas à s'en inquiéter à chaque démarrage.
 */
function nodeSqlite(): NodeSqliteModule {
  if (loaded) return loaded;
  const emitWarning = process.emitWarning;
  process.emitWarning = ((warning: string | Error, ...rest: unknown[]) => {
    const text = typeof warning === "string" ? warning : warning.message;
    if (/SQLite/i.test(text)) return;
    (emitWarning as (...args: unknown[]) => void).call(process, warning, ...rest);
  }) as typeof process.emitWarning;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    loaded = require("node:sqlite") as NodeSqliteModule;
  } finally {
    process.emitWarning = emitWarning;
  }
  return loaded;
}

/** Ouvre une base SQLite ; `busy_timeout` de 15 s, comme le serveur. */
export function openSqlite(path: string, options: OpenSqliteOptions = {}): DatabaseSync {
  const { DatabaseSync } = nodeSqlite();
  const db = new DatabaseSync(path, {
    readOnly: options.readOnly ?? false,
    enableForeignKeyConstraints: options.foreignKeys ?? true,
  });
  db.exec("PRAGMA busy_timeout = 15000");
  return db;
}
