import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { DATA_ROOT } from "../dataDir";
import { databaseUrlFromEnv, type DatabaseEnv } from "../databaseEnv";
import { openSqlite } from "./nodeSqlite";
import { coreDatabasePath } from "./sqlitePath";

/**
 * L'ANCIENNE base MariaDB d'un serveur d'avant 1.25 — lue seulement comme
 * SOURCE de la migration vers SQLite, jamais modifiée, jamais servie
 * (docs/sqlite/DECISION.md § 8). Partira avec le support de MariaDB.
 *
 * Elle se désignait par l'environnement (`DATABASE_URL`, `DB_*` des piles) ou
 * par `data/database.json`, écrit par l'assistant d'avant. Plus AUCUNE route
 * n'écrit ce fichier : il ne fait que désigner une source (une route qui
 * l'écrirait pourrait pointer la migration vers une base étrangère, dont le
 * `jwt_secret` serait importé).
 */
const LEGACY_SCHEME = /^(mysql|mariadb):\/\//i;

/**
 * La clé de `server_config` que la migration écrit dans `tentacle.db` (son
 * rapport, en JSON). Sa présence prouve que la base est née d'une migration.
 */
export const MIGRATION_REPORT_KEY = "sqlite_migration_report";

/**
 * - `none` : aucune MariaDB configurée — la base SQLite est la seule ;
 * - `pending` : une MariaDB attend sa migration (pas de `tentacle.db`, ou une
 *   `tentacle.db` jamais installée — la migration la met de côté en `.bak`) ;
 * - `migrated` : `tentacle.db` est née de la migration ;
 * - `never_migrated` : une `tentacle.db` INSTALLÉE sans migration, face à une
 *   MariaDB configurée — rien d'automatique, une alerte « À régler ».
 */
export type LegacySourceState = "none" | "pending" | "migrated" | "never_migrated";

/**
 * Le fichier de l'ancien assistant. Jamais écrit : seulement lu, et nommé dans
 * la marche à suivre de l'administration, qui dit de le SUPPRIMER une fois la
 * migration confirmée (il désignerait sinon une source pour toujours).
 */
export function legacyConfigFile(dataRoot: string = DATA_ROOT): string {
  return resolve(dataRoot, "database.json");
}

function urlFromConfigFile(dataRoot: string): string | null {
  const file = legacyConfigFile(dataRoot);
  if (!existsSync(file)) return null;
  try {
    const url = (JSON.parse(readFileSync(file, "utf-8")) as { url?: unknown }).url;
    return typeof url === "string" && url ? url : null;
  } catch {
    return null;
  }
}

/** L'URL de la base MariaDB configurée, ou `null`. Ne se connecte à rien. */
export function legacyMariadbUrl(env: DatabaseEnv = process.env, dataRoot: string = DATA_ROOT): string | null {
  const url = databaseUrlFromEnv(env) ?? urlFromConfigFile(dataRoot);
  return url && LEGACY_SCHEME.test(url) ? url : null;
}

/**
 * D'où vient la source : l'environnement de la pile (`DATABASE_URL`, `DB_*`) ou
 * le fichier de l'ancien assistant ; `null` sans source. L'environnement l'emporte.
 */
export function legacySourceOrigin(env: DatabaseEnv = process.env, dataRoot: string = DATA_ROOT): "env" | "file" | null {
  if (!legacyMariadbUrl(env, dataRoot)) return null;
  return databaseUrlFromEnv(env) ? "env" : "file";
}

/** Les marques d'une `tentacle.db` existante, lues en lecture seule ; un fichier vide n'en a aucune. */
function readMarks(path: string): { installed: boolean; migrated: boolean } {
  const db = openSqlite(path, { readOnly: true });
  try {
    const table = db.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'server_config'`).get();
    if (!table) return { installed: false, migrated: false };
    const rows = db
      .prepare(`SELECT "key", "value" FROM "server_config" WHERE "key" IN ('setup_completed', ?)`)
      .all(MIGRATION_REPORT_KEY) as Array<{ key: string; value: string }>;
    return {
      installed: rows.some((row) => row.key === "setup_completed" && row.value === "true"),
      migrated: rows.some((row) => row.key === MIGRATION_REPORT_KEY),
    };
  } finally {
    db.close();
  }
}

/**
 * L'état de la source, LU sur le disque. Ouvre `tentacle.db` par `node:sqlite` :
 * jamais pendant que Prisma la tient ouverte dans ce processus (§ 8).
 */
export function inspectLegacySource(env: DatabaseEnv = process.env, dataRoot: string = DATA_ROOT): LegacySourceState {
  if (legacyMariadbUrl(env, dataRoot) === null) return "none";
  const path = coreDatabasePath(dataRoot);
  if (!existsSync(path)) return "pending";
  const marks = readMarks(path);
  if (marks.migrated) return "migrated";
  return marks.installed ? "never_migrated" : "pending";
}

let state: LegacySourceState | null = null;

/**
 * L'état relevé AU DÉMARRAGE, avant que Prisma n'ouvre la base, puis gardé :
 * la garde et `/api/setup/status` le relisent sans rouvrir le fichier. La
 * migration le met à jour par `setLegacySourceState` une fois la bascule faite.
 */
export function legacySourceState(): LegacySourceState {
  state ??= inspectLegacySource();
  return state;
}

export function setLegacySourceState(next: LegacySourceState): void {
  state = next;
}

/**
 * Une MariaDB attend sa migration : le serveur n'ouvre PAS `tentacle.db` (ni
 * n'en crée une vide à côté — elle passerait pour la sienne, et la migration
 * n'aurait plus jamais lieu).
 */
export function mariadbMigrationPending(): boolean {
  return legacySourceState() === "pending";
}
