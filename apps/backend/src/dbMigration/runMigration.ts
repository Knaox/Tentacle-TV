import type { DatabaseSync } from "node:sqlite";
import { existsSync } from "fs";
import { dirname } from "path";
import { MariadbReader } from "./legacySource/mariadbReader";
import { describeSource, ignoredParams, SourceConfigError, sourceIdentity, tlsWithoutVerification } from "./legacySource/sourceConfig";
import type { CoreModel } from "./copy/coreModels";
import { copyAll, type CopyAllResult } from "./copy/copyAll";
import { failureOf, MigrationFailure } from "./migrationErrors";
import * as files from "./migrationFiles";
import { MIGRATION_REPORT_KEY } from "./transforms/legacyRows";
import { verifyTarget } from "./verify/verifyTarget";
import { buildReport, type MigrationReport, SOURCE_FINGERPRINT_KEY } from "./migrationReport";

/**
 * UNE migration, de bout en bout, sans Prisma dans ce processus :
 *
 *   sceller l'installation → place disque → base vide mise de côté → brouillon
 *   `.migrating` (0600) préparé par les migrations du socle → copie (instantané
 *   MariaDB) → vérification → rapport → contrôle « API » par Prisma dans un
 *   processus ENFANT → fsync → renommage en `tentacle.db`.
 *
 * Un arrêt à n'importe quel moment laisse `tentacle.db` absente (ou intacte) et
 * MariaDB intacte : la migration repart de zéro au prochain essai.
 */
export interface RunMigrationDeps {
  sourceUrl: string;
  finalPath: string;
  /** Crée et met à niveau le schéma du cœur (`applyCoreMigrations` du socle). */
  prepareTarget: (path: string) => void;
  /** `openSqlite` du socle (node:sqlite). */
  openTarget: (path: string, options: { foreignKeys: boolean }) => DatabaseSync;
  models: CoreModel[];
  /** Pose `data/setup-complete` : une installation finie ne se rouvre jamais (audit S3). */
  sealSetup: () => void;
  /** Le contrôle par Prisma, dans un processus enfant, sur le brouillon. */
  apiSample: (path: string, expected: Record<string, number>) => Promise<void>;
  deferred: ReadonlySet<string>;
  caches: ReadonlySet<string>;
  serverVersion: string;
  onProgress?: (p: { tablesDone: number; tablesTotal: number; bytesDone: number; bytesTotal: number }) => void;
  log: (line: string) => void;
  now?: () => number;
}

export type MigrationOutcome =
  | { kind: "empty" } // la source n'a jamais été installée : rien à reprendre
  | { kind: "already" } // un autre copieur (la CLI) a fini pendant l'attente
  | { kind: "migrated"; report: MigrationReport };

export async function runMigration(deps: RunMigrationDeps): Promise<MigrationOutcome> {
  const now = deps.now ?? Date.now;
  const startedAt = now();
  const draft = files.migratingPath(deps.finalPath);
  files.refuseSymlinks(deps.finalPath);
  files.refuseSymlinks(draft);

  let reader: MariadbReader;
  try {
    reader = await MariadbReader.open(deps.sourceUrl);
  } catch (err) {
    if (err instanceof SourceConfigError) throw new MigrationFailure("source_config", err.message);
    throw failureOf(err, "source_unreachable");
  }
  const ignored = ignoredParams(deps.sourceUrl);
  if (ignored.length) deps.log(`[db-migration] Paramètres de pool ignorés pour la lecture : ${ignored.join(", ")}`);
  if (reader.sourceZone) deps.log(`[db-migration] Source dans le fuseau « ${reader.sourceZone} » : ses dates « session » sont converties en UTC`);
  let db: DatabaseSync | null = null;
  try {
    deps.log(`[db-migration] Source ${describeSource(deps.sourceUrl)} (${reader.serverVersion}), lecture seule sur un instantané`);
    if (tlsWithoutVerification(deps.sourceUrl)) deps.log("[db-migration] TLS sans vérification du certificat (sslaccept=accept_invalid_certs), comme le faisait la 1.24");
    // L'installation finie de la source le reste : avant TOUT le reste (S3).
    if ((await reader.configValue("setup_completed")) === "true") deps.sealSetup();

    const sourceBytes = (await reader.tables()).reduce((n, t) => n + t.approxBytes, 0);
    const required = files.requiredBytes(sourceBytes);
    const free = files.freeBytes(dirname(deps.finalPath));
    if (free < required) {
      throw new MigrationFailure("disk_space", `${Math.round(required / 1e6)} Mo nécessaires, ${Math.round(free / 1e6)} Mo libres`);
    }

    // Une base vide née à côté (jamais installée) part en `.bak`, la migration la remplace.
    if (existsSync(deps.finalPath)) {
      const bak = files.backupPath(deps.finalPath);
      files.moveDatabase(deps.finalPath, bak);
      deps.log(`[db-migration] Base vide mise de côté : ${bak}`);
    }
    files.removeDraft(draft);
    files.createPrivateFile(draft);
    deps.prepareTarget(draft);
    db = deps.openTarget(draft, { foreignKeys: false });
    // Un brouillon : une coupure le jette entier, inutile d'attendre le disque à chaque page.
    db.exec("PRAGMA synchronous = OFF");

    const copy: CopyAllResult = await copyAll({
      reader,
      target: db,
      models: deps.models,
      startedAt,
      deferred: deps.deferred,
      caches: deps.caches,
      onTable: (_t, p) => deps.onProgress?.(p),
    });
    if (copy.verdict === "empty") {
      deps.log("[db-migration] La source ne porte aucune table du cœur (installation jamais faite) : rien à migrer");
      db.close();
      db = null;
      files.removeDraft(draft);
      return { kind: "empty" };
    }
    const verification = verifyTarget(db, copy.expected);
    const report = buildReport({
      deps, copy, verification, startedAt, finishedAt: now(), identity: sourceIdentity(deps.sourceUrl),
      sourceVersion: reader.serverVersion, sourceBytes, free, zoneConverted: reader.sourceZone !== null,
    });
    // Les clés de la migration qui manquaient encore (une source ne les porte jamais : la
    // migration n'écrit pas dans MariaDB ; mais si l'une était là, elle serait remplacée).
    const migrationKeys = [SOURCE_FINGERPRINT_KEY, MIGRATION_REPORT_KEY];
    const present = Number(
      (db.prepare(`SELECT COUNT(*) AS n FROM "server_config" WHERE "key" IN (?, ?)`).get(...migrationKeys) as { n: number | bigint }).n,
    );
    const upsert = db.prepare(`INSERT INTO "server_config" ("key", "value") VALUES (?, ?) ON CONFLICT("key") DO UPDATE SET "value" = excluded."value"`);
    upsert.run(SOURCE_FINGERPRINT_KEY, JSON.stringify(copy.fingerprint));
    upsert.run(MIGRATION_REPORT_KEY, JSON.stringify(report));
    // Ce que Prisma doit relire, établi SANS relire le brouillon : les lignes de la copie
    // (vérifiées contre la source) plus EXACTEMENT les clés posées ci-dessus. L'enfant
    // revérifie ainsi que rien d'autre n'est apparu entre la vérification et la bascule
    // (le banc a vu l'oubli de ces clés : échec à chaque essai).
    const added = migrationKeys.length - present;
    const counts = Object.fromEntries(
      report.tables.filter((t) => t.kind === "core").map((t) => [t.table, t.rowsWritten + (t.table === "server_config" ? added : 0)]),
    );
    db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
    db.close();
    db = null;

    await deps.apiSample(draft, counts);

    files.syncFile(draft);
    files.moveDatabase(draft, deps.finalPath);
    files.syncDirectory(deps.finalPath);
    deps.log(`[db-migration] Bascule faite : ${report.tables.length} tables, ${report.rowsWritten} lignes en ${report.durationMs} ms`);
    return { kind: "migrated", report };
  } catch (err) {
    const failure = failureOf(err, "copy_failed");
    try {
      db?.close();
    } catch {
      /* déjà fermée */
    }
    try {
      files.removeDraft(draft);
    } catch {
      /* un lien à la place du brouillon : on ne le suit pas */
    }
    throw failure;
  } finally {
    await reader.close().catch(() => undefined);
  }
}
