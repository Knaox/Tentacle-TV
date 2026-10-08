import { existsSync, readFileSync, writeFileSync } from "fs";
import { openSqlite } from "../services/database/nodeSqlite";
import { inspectLegacySource, legacyMariadbUrl, MIGRATION_REPORT_KEY } from "../services/database/legacySource";
import { migrateOnce, migrationPaths } from "../dbMigration/bootMigration";
import { processAlive } from "../dbMigration/migrationLock";
import type { MigrationStatusFile } from "../dbMigration/migrationLoop";
import { failureOf } from "../dbMigration/migrationErrors";
import { parseReport, type MigrationReport } from "../dbMigration/migrationReport";
import { refuseSymlink } from "../dbMigration/migrationFiles";
import { orphanedLegacyInstallation } from "../dbMigration/orphanedSource";

/**
 * `tentacle db migrate` — la migration MariaDB → SQLite, tout de suite, avec un
 * rapport lisible. Sous Docker (`docker exec`), le serveur tourne déjà en mode
 * maintenance : la commande lui demande un essai IMMÉDIAT (fichier déclencheur)
 * et suit son fichier d'état. Serveur arrêté (installation native) : elle migre
 * elle-même, sous le même verrou. Elle ne modifie jamais MariaDB.
 */
export const DB_MIGRATE_USAGE = [
  "  tentacle db migrate    migre l'ancienne base MariaDB vers SQLite, tout de suite (rapport)",
  "                         migrate the old MariaDB database to SQLite now (with a report)",
];

const say = (fr: string, en: string) => console.log(`${fr}\n${en}`);
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Le rapport en lignes : des noms de tables et des comptes, rien d'autre. */
export function reportLines(r: MigrationReport): string[] {
  if (r.sourceEmpty) return ["L'ancienne base n'avait aucune table de Tentacle : installation neuve.", "The old database had no Tentacle table: new installation."];
  const lines = [
    `Migration terminée en ${(r.durationMs / 1000).toFixed(1)} s : ${r.tables.length} tables, ${r.rowsWritten} lignes.`,
    `Migration done in ${(r.durationMs / 1000).toFixed(1)} s: ${r.tables.length} tables, ${r.rowsWritten} rows.`,
    `  Source : ${r.source.version} (${r.source.identity.host}:${r.source.identity.port}/${r.source.identity.database})`,
  ];
  if (r.deferred.length) lines.push(`  Copiée en fond après la bascule / copied in the background : ${r.deferred.map((d) => d.table).join(", ")}`);
  if (r.unrecognized.length) lines.push(`  Tables non reconnues, copiées par précaution / unrecognized, copied as a precaution : ${r.unrecognized.join(", ")}`);
  if (r.retired.length) lines.push(`  Anciennes tables du cœur laissées dans MariaDB / old core tables left in MariaDB : ${r.retired.join(", ")}`);
  if (r.refused.length) lines.push(`  Tables refusées / refused tables : ${r.refused.map((t) => `${t.table} (${t.reason})`).join(", ")}`);
  const filtered = r.tables.filter((t) => t.filtered > 0);
  if (filtered.length) lines.push(`  Lignes écartées (purges d'avant) / rows left out : ${filtered.map((t) => `${t.table} ${t.filtered}`).join(", ")}`);
  return lines;
}

function readReport(path: string): MigrationReport | null {
  const db = openSqlite(path, { readOnly: true });
  try {
    const row = db.prepare(`SELECT "value" FROM "server_config" WHERE "key" = ?`).get(MIGRATION_REPORT_KEY) as { value?: string } | undefined;
    return parseReport(row?.value);
  } finally {
    db.close();
  }
}

function readStatus(path: string): MigrationStatusFile | null {
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as MigrationStatusFile;
  } catch {
    return null;
  }
}

/** Le serveur de maintenance vit : un essai immédiat, puis son issue. */
async function askServer(paths: ReturnType<typeof migrationPaths>, before: MigrationStatusFile): Promise<number> {
  refuseSymlink(paths.trigger);
  writeFileSync(paths.trigger, "", { mode: 0o600 });
  say("Essai demandé au serveur…", "Attempt requested from the server…");
  let lastPercent = -1;
  for (let i = 0; i < 3600; i++) {
    await sleep(1000);
    const status = readStatus(paths.status);
    if (!status) continue;
    const newer = status.attempt > before.attempt || status.updatedAt > before.updatedAt;
    if (status.state === "migrating" && status.percent !== lastPercent) {
      lastPercent = status.percent;
      console.log(`  ${status.percent} %`);
    }
    if (!newer) continue;
    if (status.state === "done") return finishWithReport(paths.final);
    if (status.state === "failed" && status.attempt > before.attempt) {
      say(`Échec (${status.reason}) : ${status.detail ?? ""}`, `Failed (${status.reason}). MariaDB is intact.`);
      return 1;
    }
  }
  say("Le serveur n'a pas répondu à temps.", "The server did not answer in time.");
  return 1;
}

function finishWithReport(finalPath: string): number {
  const report = existsSync(finalPath) ? readReport(finalPath) : null;
  for (const line of report ? reportLines(report) : ["Migration terminée.", "Migration done."]) console.log(line);
  return 0;
}

export async function runDbMigrateCommand(paths = migrationPaths()): Promise<number> {
  const url = legacyMariadbUrl();
  if (!url) {
    if (orphanedLegacyInstallation(null)) {
      say(
        "Cette installation utilisait une base MariaDB, qui n'est plus configurée : remettez le service de la base et ses variables (DB_HOST, DB_PASSWORD_FILE ou DATABASE_URL) le temps de la migration, puis redémarrez.",
        "This installation used a MariaDB database that is no longer configured: put the database service and its variables back for the migration, then restart.",
      );
      return 1;
    }
    say("Aucune ancienne base MariaDB configurée : rien à migrer.", "No old MariaDB database configured: nothing to migrate.");
    return 0;
  }
  const state = inspectLegacySource();
  if (state === "migrated") {
    say("La base est déjà migrée.", "The database is already migrated.");
    return finishWithReport(paths.final);
  }
  if (state === "never_migrated") {
    say(
      "Une base SQLite installée existe déjà, sans migration : rien n'est fait. Pour migrer quand même (la base actuelle gardée en .bak), utilisez « À régler » dans l'administration.",
      "An installed SQLite database already exists, without migration: nothing is done. To migrate anyway (current database kept as .bak), use the administration's « To fix ».",
    );
    return 1;
  }
  const status = readStatus(paths.status);
  if (status?.pid && status.pid !== process.pid && processAlive(status.pid)) return askServer(paths, status);
  say("Migration en cours (le serveur est arrêté : la commande migre elle-même)…", "Migrating (the server is stopped: the command migrates by itself)…");
  try {
    const outcome = await migrateOnce(url, paths);
    if (outcome.kind === "empty") say("L'ancienne base n'avait aucune table de Tentacle : base neuve créée.", "The old database had no Tentacle table: new database created.");
    return finishWithReport(paths.final);
  } catch (err) {
    const failure = failureOf(err);
    say(`Échec (${failure.reason}) : ${failure.detail}. MariaDB est intacte.`, `Failed (${failure.reason}). MariaDB is intact.`);
    return 1;
  }
}
