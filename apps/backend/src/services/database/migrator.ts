import { createHash } from "crypto";
import { chmodSync, closeSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync } from "fs";
import { dirname, resolve } from "path";
import type { DatabaseSync } from "node:sqlite";
import { openSqlite } from "./nodeSqlite";

/**
 * L'exécuteur des migrations du cœur (docs/sqlite/DECISION.md § 3).
 *
 * Les fichiers `prisma/migrations-sqlite/NNNN_nom.sql` sont générés par
 * `prisma migrate diff` (`pnpm db:migration <nom>`) et commités ; ils sont
 * appliqués ici, dans l'ordre, une transaction chacun, AVANT que Prisma
 * n'ouvre la base — la CLI Prisma n'est pas dans l'image.
 *
 * Il ne touche que ce que ses fichiers nomment : tirés d'une base qui ne porte
 * que le cœur, ils ne peuvent nommer ni `seer_*` ni une table d'extension.
 */
export const CORE_MIGRATIONS_DIR = resolve(__dirname, "../../../prisma/migrations-sqlite");
/** La table de suivi. Hors de `schema.prisma` : l'anti-dérive l'écarte avant de comparer. */
export const MIGRATIONS_TABLE = "core_migrations";

const FILE_NAME = /^(\d{4}_[a-z0-9_]+)\.sql$/;

export interface CoreMigration {
  id: string;
  sql: string;
  checksum: string;
}

export interface CoreMigrationReport {
  /** Les migrations appliquées par CET appel. */
  applied: string[];
  /** Appliquées par une version PLUS RÉCENTE du serveur (retour à une image d'avant). */
  unknown: string[];
}

/** Une migration publiée a été retouchée : la base ne correspond plus à ses fichiers. */
export class MigrationChecksumError extends Error {
  constructor(readonly migrationId: string) {
    super(`[db] La migration ${migrationId} a changé depuis qu'elle a été appliquée — une migration publiée ne se retouche jamais.`);
    this.name = "MigrationChecksumError";
  }
}

/** Empreinte d'un fichier, fins de ligne normalisées (un dépôt Windows les change). */
export function migrationChecksum(sql: string): string {
  return createHash("sha256").update(sql.replace(/\r\n/g, "\n")).digest("hex");
}

/** Les migrations d'un dossier, dans l'ordre de leur numéro. */
export function readCoreMigrations(dir: string = CORE_MIGRATIONS_DIR): CoreMigration[] {
  return readdirSync(dir)
    .map((name) => FILE_NAME.exec(name))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => {
      const sql = readFileSync(resolve(dir, match[0]), "utf-8");
      return { id: match[1], sql, checksum: migrationChecksum(sql) };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

function appliedMigrations(db: DatabaseSync): Map<string, string> {
  db.exec(
    `CREATE TABLE IF NOT EXISTS "${MIGRATIONS_TABLE}" ("id" TEXT NOT NULL PRIMARY KEY, "checksum" TEXT NOT NULL, "appliedAt" INTEGER NOT NULL)`,
  );
  const rows = db.prepare(`SELECT "id", "checksum" FROM "${MIGRATIONS_TABLE}" ORDER BY "id"`).all() as Array<{ id: string; checksum: string }>;
  return new Map(rows.map((row) => [row.id, row.checksum]));
}

/** Applique UNE migration : tout ou rien, clés étrangères vérifiées avant de valider. */
function applyOne(db: DatabaseSync, migration: CoreMigration): void {
  db.exec("BEGIN IMMEDIATE");
  try {
    db.exec(migration.sql);
    const violations = db.prepare("PRAGMA foreign_key_check").all();
    if (violations.length > 0) {
      throw new Error(`[db] La migration ${migration.id} laisse ${violations.length} clé(s) étrangère(s) orpheline(s)`);
    }
    db.prepare(`INSERT INTO "${MIGRATIONS_TABLE}" ("id", "checksum", "appliedAt") VALUES (?, ?, ?)`).run(
      migration.id,
      migration.checksum,
      Date.now(),
    );
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

/**
 * La base porte les secrets du serveur (jwt_secret, clés Jellyfin et TMDB) :
 * lisible du seul compte du serveur. Le fichier naît en 0600 AVANT que SQLite
 * ne l'ouvre (SQLite suivrait l'umask, 0644 sous Docker), et un fichier
 * d'avant, plus ouvert, y est ramené. `-wal` et `-shm` prennent le mode du
 * fichier principal à leur création ; ceux qui existent déjà sont ramenés
 * aussi. Jamais `process.umask` : il changerait tout le volume.
 */
export function restrictDatabaseFiles(path: string): void {
  if (!existsSync(path)) closeSync(openSync(path, "a", 0o600));
  for (const file of [path, `${path}-wal`, `${path}-shm`]) {
    if (!existsSync(file)) continue;
    try {
      chmodSync(file, 0o600);
    } catch {
      /* fichier d'un autre propriétaire, ou Windows : le serveur le lit quand même */
    }
  }
}

/**
 * Crée la base si elle n'existe pas, la passe en WAL et lui applique les
 * migrations qui lui manquent. Idempotent. Lève sur une migration retouchée
 * ou en échec — la base reste alors dans l'état de la dernière migration réussie.
 */
export function applyCoreMigrations(path: string, migrations: CoreMigration[] = readCoreMigrations()): CoreMigrationReport {
  mkdirSync(dirname(path), { recursive: true });
  restrictDatabaseFiles(path);
  // Clés étrangères coupées le temps des migrations (une table refaite les
  // contourne), puis vérifiées par `foreign_key_check` avant chaque COMMIT.
  const db = openSqlite(path, { foreignKeys: false });
  try {
    db.exec("PRAGMA journal_mode = WAL");
    const done = appliedMigrations(db);
    const applied: string[] = [];
    for (const migration of migrations) {
      const checksum = done.get(migration.id);
      if (checksum !== undefined) {
        if (checksum !== migration.checksum) throw new MigrationChecksumError(migration.id);
        continue;
      }
      applyOne(db, migration);
      applied.push(migration.id);
    }
    const known = new Set(migrations.map((migration) => migration.id));
    return { applied, unknown: [...done.keys()].filter((id) => !known.has(id)) };
  } finally {
    db.close();
  }
}
