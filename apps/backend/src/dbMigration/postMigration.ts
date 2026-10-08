import { existsSync, unlinkSync, writeFileSync } from "fs";
import { resolve } from "path";
import { DATA_ROOT } from "../services/dataDir";
import { getDatabaseFilePath, getPrisma } from "../services/db";
import { coreDatabasePath } from "../services/database/sqlitePath";
import { legacyMariadbUrl, legacySourceState, MIGRATION_REPORT_KEY } from "../services/database/legacySource";
import { requestServerRestart } from "../services/pluginRestart";
import { CACHE_TABLES, DEFERRED_TABLES } from "./bootMigration";
import { setCacheCopyGate } from "./cache/cacheCopyGate";
import { startDeferredCacheCopy } from "./cache/deferredCacheCopy";
import { coreModels } from "./copy/coreModels";
import { sanitizeError } from "./migrationErrors";
import { backupPath, moveDatabase, refuseSymlink, restrictToOwner } from "./migrationFiles";
import { parseReport, SOURCE_FINGERPRINT_KEY } from "./migrationReport";
import { checkSourceDivergence, type SourceCheck } from "./verify/sourceDivergence";

/**
 * Ce qui suit la bascule, une fois Prisma ouvert : la copie de fond du cache TMDB
 * (les tâches gourmandes en TMDB l'attendent) et, tant que l'ancienne base est
 * configurée, le contrôle qu'elle n'a pas changé depuis (§ 3.10). Et la
 * remigration à la demande : un marqueur, puis un redémarrage CONTRÔLÉ — jamais
 * de bascule à chaud ; au démarrage suivant, la base actuelle part en `.bak`.
 */
export const REMIGRATE_REQUEST_FILE = "db-remigrate";

let divergence: SourceCheck | null = null;

export function sourceDivergence(): SourceCheck | null {
  return divergence;
}

async function readConfig(key: string): Promise<string | null> {
  const row = await getPrisma().serverConfig.findUnique({ where: { key } });
  return row?.value ?? null;
}

async function runDivergenceCheck(url: string, log: (line: string) => void): Promise<void> {
  try {
    const fingerprintJson = await readConfig(SOURCE_FINGERPRINT_KEY);
    divergence = await checkSourceDivergence({
      url,
      report: parseReport(await readConfig(MIGRATION_REPORT_KEY)),
      fingerprint: fingerprintJson ? (JSON.parse(fingerprintJson) as Record<string, { rows: number; sum: string }>) : null,
      models: coreModels(),
      ignored: new Set([...CACHE_TABLES, ...DEFERRED_TABLES]),
    });
    if (divergence.status === "changed") {
      log(`[db-migration] ⚠️ L'ancienne base a changé depuis la migration (${divergence.why}) : rien n'est fait automatiquement — « À régler » dans l'administration.`);
    }
  } catch (err) {
    divergence = { status: "unreachable" };
    log(`[db-migration] Contrôle de l'ancienne base impossible : ${sanitizeError(err)}`);
  }
}

/** Au démarrage normal, Prisma ouvert, AVANT les tâches de fond (la porte du cache doit être posée). */
export function startPostMigrationTasks(log: (line: string) => void = (line) => console.log(line)): void {
  if (legacySourceState() !== "migrated") return;
  const url = legacyMariadbUrl();
  setCacheCopyGate(startDeferredCacheCopy({ url, path: getDatabaseFilePath(), readConfig, log }));
  if (url) void runDivergenceCheck(url, log);
}

/** L'administrateur demande une nouvelle migration : marqueur 0600, puis redémarrage contrôlé. */
export function requestRemigration(dataRoot: string = DATA_ROOT): void {
  const marker = resolve(dataRoot, REMIGRATE_REQUEST_FILE);
  refuseSymlink(marker);
  writeFileSync(marker, `${new Date().toISOString()}\n`, { mode: 0o600 });
  restrictToOwner(marker);
  requestServerRestart("Nouvelle migration de la base demandée par l'administrateur");
}

/**
 * Au démarrage, AVANT de relever l'état de la source : une demande de
 * remigration met la base actuelle de côté (`.bak` daté, 0600). La source
 * relevée ensuite est « en attente » et la migration repart d'elle.
 */
export function consumeRemigrationRequest(dataRoot: string = DATA_ROOT, log: (line: string) => void = (line) => console.log(line)): boolean {
  const marker = resolve(dataRoot, REMIGRATE_REQUEST_FILE);
  if (!existsSync(marker)) return false;
  refuseSymlink(marker);
  unlinkSync(marker);
  if (!legacyMariadbUrl(process.env, dataRoot)) {
    log("[db-migration] Nouvelle migration demandée, mais aucune ancienne base n'est configurée : rien n'est fait.");
    return false;
  }
  const final = coreDatabasePath(dataRoot);
  if (existsSync(final)) {
    const bak = backupPath(final);
    moveDatabase(final, bak);
    log(`[db-migration] Nouvelle migration demandée : la base actuelle est gardée dans ${bak}`);
  }
  return true;
}

/** Les tests. */
export function resetPostMigration(): void {
  divergence = null;
}
