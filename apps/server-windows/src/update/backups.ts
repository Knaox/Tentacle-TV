/**
 * La sauvegarde de la base avant une mise à jour du paquet :
 * `backups\tentacle-<version>.db`, les TROIS plus récentes gardées.
 *
 * Faite par l'hôte APRÈS l'arrêt du serveur, jamais pendant que Prisma tient
 * la base : l'arrêt propre a vidé le WAL (`wal_checkpoint(TRUNCATE)`), le
 * fichier seul est donc complet. Un `-wal` resté là (arrêt brutal) part avec
 * lui : SQLite le rejouera à l'ouverture de la copie.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, utimesSync } from "node:fs";
import { join } from "node:path";

export const DATABASE_FILE = "tentacle.db";
export const BACKUPS_KEPT = 3;

/** Un nom de fichier sûr pour la version (`1.25.1`, `inconnue`). */
export function backupName(version: string): string {
  const safe = version.replace(/[^\w.-]/g, "_") || "inconnue";
  return `tentacle-${safe}.db`;
}

export type BackupResult = { kind: "saved"; file: string; removed: string[] } | { kind: "no-database" };

export function backupDatabase(dataDir: string, backupsDir: string, version: string, kept = BACKUPS_KEPT): BackupResult {
  const database = join(dataDir, DATABASE_FILE);
  if (!existsSync(database)) return { kind: "no-database" };
  mkdirSync(backupsDir, { recursive: true });
  const file = join(backupsDir, backupName(version));
  copyFileSync(database, file);
  // `CopyFileW` garde la date de la source : la sauvegarde prend celle du geste, qui ordonne l'élagage.
  const now = new Date();
  utimesSync(file, now, now);
  const wal = `${database}-wal`;
  if (existsSync(wal) && statSync(wal).size > 0) copyFileSync(wal, `${file}-wal`);
  else rmSync(`${file}-wal`, { force: true });
  return { kind: "saved", file, removed: prune(backupsDir, kept) };
}

/** Garde les `kept` sauvegardes les plus récentes ; rend les noms retirés. */
function prune(backupsDir: string, kept: number): string[] {
  const backups = readdirSync(backupsDir)
    .filter((name) => /^tentacle-.+\.db$/.test(name))
    .map((name) => ({ name, time: statSync(join(backupsDir, name)).mtimeMs }))
    .sort((a, b) => b.time - a.time);
  const removed = backups.slice(kept).map((backup) => backup.name);
  for (const name of removed) {
    rmSync(join(backupsDir, name), { force: true });
    rmSync(join(backupsDir, `${name}-wal`), { force: true });
  }
  return removed;
}
