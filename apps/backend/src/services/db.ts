import type { PrismaClient } from "@prisma/client";
import { mariadbMigrationPending } from "./database/legacySource";
import { applyCoreMigrations } from "./database/migrator";
import { connectSqlitePrisma } from "./database/prismaClient";
import { coreDatabasePath, prismaSqliteUrl } from "./database/sqlitePath";

/**
 * La base du serveur : un fichier SQLite du dossier de données
 * (`data/tentacle.db`), rien à configurer (docs/sqlite/DECISION.md).
 *
 * Ouverture en deux temps, dans cet ordre et une fois par processus : les
 * migrations du cœur par `node:sqlite`, Prisma FERMÉ (`applyCoreMigrations`),
 * puis le client Prisma à une seule connexion.
 */

let prisma: PrismaClient | null = null;
/** L'ouverture en cours : des appels simultanés l'attendent au lieu d'ouvrir un second client. */
let opening: Promise<boolean> | null = null;
/** Migrations appliquées dans CE processus : jamais rejouées une fois Prisma ouvert. */
let migrated = false;
let lastOpenError: string | null = null;

/** Le moteur de la base — à lire au lieu de le deviner par une URL (extensions). */
export function databaseEngine(): "sqlite" {
  return "sqlite";
}

/** Le chemin du fichier de la base. */
export function getDatabaseFilePath(): string {
  return coreDatabasePath();
}

/** Pourquoi la dernière ouverture a échoué — `null` si elle a réussi ou n'a pas eu lieu. */
export function databaseOpenError(): string | null {
  return lastOpenError;
}

/**
 * Ouvre la base : la crée au besoin, applique ses migrations, connecte Prisma.
 * `true` si la base est prête. Un échec (disque plein, droits, migration
 * refusée) est journalisé et laisse le serveur sans base, jamais arrêté.
 *
 * En vol unique : la garde et `/api/setup/status` peuvent l'appeler en même
 * temps ; deux clients ouverts, ce serait deux connexions sur le fichier (les
 * P1008 que la connexion unique évite) et un client perdu.
 */
export function initPrisma(): Promise<boolean> {
  if (prisma) return Promise.resolve(true);
  if (!opening) {
    opening = openDatabase().finally(() => {
      opening = null;
    });
  }
  return opening;
}

async function openDatabase(): Promise<boolean> {
  const path = coreDatabasePath();
  try {
    // Un chemin qui couperait l'URL de Prisma est refusé AVANT de créer quoi que ce soit.
    prismaSqliteUrl(path);
    if (!migrated) {
      const report = applyCoreMigrations(path);
      migrated = true;
      if (report.applied.length > 0) console.log(`[db] Migrations appliquées : ${report.applied.join(", ")}`);
      if (report.unknown.length > 0) {
        console.warn(`[db] Base migrée par une version plus récente (${report.unknown.join(", ")}) : le serveur démarre quand même`);
      }
    }
    prisma = await connectSqlitePrisma(path);
    lastOpenError = null;
    return true;
  } catch (err) {
    lastOpenError = err instanceof Error ? err.message : String(err);
    console.error(`[db] Ouverture de ${path} impossible : ${lastOpenError}`);
    prisma = null;
    return false;
  }
}

/** Get the singleton PrismaClient. Throws if not initialized. */
export function getPrisma(): PrismaClient {
  if (!prisma) throw new Error("Database not initialized");
  return prisma;
}

/** Check if PrismaClient is ready. */
export function hasPrisma(): boolean {
  return prisma !== null;
}

/** Une nouvelle tentative au plus toutes les 10 s : `/api/setup/status` est public. */
export const OPEN_RETRY_INTERVAL_MS = 10_000;
let lastRetry = 0;

/**
 * La base ne s'ouvrait pas (disque plein, droits) : on réessaie, au plus
 * toutes les 10 s — la garde de l'API et `/api/setup/status` passent par ici.
 * Jamais quand une MariaDB attend sa migration : ce serait créer une base vide.
 */
export function retryDatabaseOpen(now = Date.now()): Promise<boolean> {
  if (prisma) return Promise.resolve(true);
  if (opening) return opening;
  if (mariadbMigrationPending() || now - lastRetry < OPEN_RETRY_INTERVAL_MS) return Promise.resolve(false);
  lastRetry = now;
  return initPrisma();
}

export type DatabaseProbe = { ok: true; version: string } | { ok: false };

/** La base répond-elle, et en quelle version de SQLite : borné. */
export async function probeDatabase(timeoutMs = 3000): Promise<DatabaseProbe> {
  if (!prisma) return { ok: false };
  let timer: NodeJS.Timeout | undefined;
  try {
    const rows = await Promise.race([
      prisma.$queryRaw<Array<{ version: string }>>`SELECT sqlite_version() AS version`,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), timeoutMs);
      }),
    ]);
    return { ok: true, version: String(rows[0]?.version ?? "") };
  } catch {
    return { ok: false };
  } finally {
    clearTimeout(timer);
  }
}
