import { existsSync } from "fs";
import { resolve } from "path";
import { DATA_ROOT } from "../services/dataDir";
import { coreDatabasePath } from "../services/database/sqlitePath";
import { applyCoreMigrations } from "../services/database/migrator";
import { openSqlite } from "../services/database/nodeSqlite";
import { inspectLegacySource, legacyMariadbUrl, MIGRATION_REPORT_KEY, setLegacySourceState } from "../services/database/legacySource";
import { BACKEND_VERSION } from "../services/version";
import { sealSetup } from "../setup/setupLock";
import { coreModels } from "./copy/coreModels";
import { MigrationFailure } from "./migrationErrors";
import { lockHolder, tryAcquireLock } from "./migrationLock";
import { migrateUntilDone, writeStatusFile } from "./migrationLoop";
import { emptySourceReport } from "./migrationReport";
import { migrationProgressed, publicDatabaseState } from "./migrationState";
import { runMigration, type MigrationOutcome } from "./runMigration";
import { runApiSample } from "./verify/apiSample";

/**
 * La migration AVANT le démarrage du serveur : appelée en tête de `main()` quand
 * le socle dit « migration en attente » (`legacySourceState() === "pending"`).
 * Rend la main une fois `tentacle.db` née de la migration ; le démarrage normal
 * ouvre alors Prisma, puis charge les extensions — une seule fois.
 */
export const DEFERRED_TABLES: ReadonlySet<string> = new Set(["tmdb_meta_cache"]);
/** Caches : hors de l'empreinte de divergence (§ 3.10) — une divergence de cache ne déclenche rien. */
export const CACHE_TABLES: ReadonlySet<string> = new Set([
  "tmdb_meta_cache",
  "recommendation_cache",
  "facet_idf",
  "item_cooccurrences",
  "seer_tmdb_cache",
  "seer_search_titles",
  "seer_search_meta",
]);

export function migrationPaths(dataRoot: string = DATA_ROOT) {
  return {
    final: coreDatabasePath(dataRoot),
    status: resolve(dataRoot, "db-migration-status.json"),
    trigger: resolve(dataRoot, "db-migration-retry"),
    lock: resolve(dataRoot, "db-migration.lock"),
  };
}

const log = (line: string) => console.log(line);

/** Une source sans aucune table du cœur : base neuve, et la preuve qu'il n'y avait rien à reprendre. */
function markEmptySource(finalPath: string, startedAt: number): void {
  applyCoreMigrations(finalPath);
  const db = openSqlite(finalPath);
  try {
    db.prepare(`INSERT INTO "server_config" ("key", "value") VALUES (?, ?) ON CONFLICT("key") DO UPDATE SET "value" = excluded."value"`).run(
      MIGRATION_REPORT_KEY,
      JSON.stringify(emptySourceReport(BACKEND_VERSION, startedAt, Date.now())),
    );
  } finally {
    db.close();
  }
}

/** UN essai, verrou tenu ; un autre copieur vivant (la CLI) : on attend qu'il finisse. */
export async function migrateOnce(url: string, paths = migrationPaths()): Promise<MigrationOutcome> {
  const lock = tryAcquireLock(paths.lock);
  if (!lock) {
    throw new MigrationFailure("unknown", `une autre migration est en cours (processus ${lockHolder(paths.lock) ?? "?"})`);
  }
  try {
    // La CLI a pu finir pendant notre attente : la base est née, rien à refaire.
    if (existsSync(paths.final) && inspectLegacySource() === "migrated") return { kind: "already" };
    const startedAt = Date.now();
    let lastWrite = 0;
    const outcome = await runMigration({
      sourceUrl: url,
      finalPath: paths.final,
      prepareTarget: (path) => void applyCoreMigrations(path),
      openTarget: (path, options) => openSqlite(path, { foreignKeys: options.foreignKeys }),
      models: coreModels(),
      sealSetup: () => sealSetup(),
      apiSample: runApiSample,
      deferred: DEFERRED_TABLES,
      caches: CACHE_TABLES,
      serverVersion: BACKEND_VERSION,
      onProgress: (p) => {
        migrationProgressed(p);
        const now = Date.now();
        if (now - lastWrite < 1000) return;
        lastWrite = now;
        const percent = publicDatabaseState(now).progress?.percent ?? 0;
        writeStatusFile(paths.status, { state: "migrating", attempt: 0, updatedAt: now, percent });
      },
      log,
    });
    if (outcome.kind === "empty") markEmptySource(paths.final, startedAt);
    return outcome;
  } finally {
    lock.release();
  }
}

export interface BootMigrationHooks {
  /** Démarre le serveur de maintenance ; rend sa fermeture. */
  startMaintenance: () => Promise<() => Promise<void>>;
  run?: () => Promise<MigrationOutcome>;
  sleep?: (ms: number) => Promise<void>;
}

export async function migrateBeforeBoot(hooks: BootMigrationHooks, paths = migrationPaths()): Promise<void> {
  const url = legacyMariadbUrl();
  if (!url) return;
  log("[db-migration] Une base MariaDB attend sa migration vers SQLite : l'écran d'attente est servi, MariaDB n'est que lue.");
  const stopMaintenance = await hooks.startMaintenance();
  try {
    await migrateUntilDone(hooks.run ?? (() => migrateOnce(url, paths)), {
      statusFile: paths.status,
      triggerFile: paths.trigger,
      log,
      sleep: hooks.sleep,
    });
  } finally {
    await stopMaintenance();
  }
  setLegacySourceState("migrated");
}
