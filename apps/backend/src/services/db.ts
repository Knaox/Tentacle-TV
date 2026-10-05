import { PrismaClient } from "@prisma/client";
import { chmodSync, existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import { DATA_ROOT } from "./dataDir";
import { resolveDatabaseUrlSource, type DatabaseUrlSource } from "./databaseInfo";
import { databaseUrlFromEnv } from "./databaseEnv";

const DATA_DIR = DATA_ROOT;
const DB_CONFIG_FILE = resolve(DATA_DIR, "database.json");

let prisma: PrismaClient | null = null;
/** L'URL de la connexion ouverte : une modification ne l'atteint qu'au redémarrage. */
let activeUrl: string | null = null;

function readConfigFileUrl(): string | null {
  if (!existsSync(DB_CONFIG_FILE)) return null;
  try {
    const config = JSON.parse(readFileSync(DB_CONFIG_FILE, "utf-8"));
    return config.url || null;
  } catch {
    return null;
  }
}

// L'environnement et le fichier TELS QU'AU DÉMARRAGE : `saveDatabaseUrl`
// réécrit les deux à chaud (cf. `resolveDatabaseUrlSource`). L'environnement,
// c'est `DATABASE_URL` ou les variables `DB_*` des piles Docker (databaseEnv.ts).
const bootEnvUrl = databaseUrlFromEnv(process.env);
const bootFileUrl = readConfigFileUrl();
// Le fichier porte le mot de passe de la base : lisible du seul compte du
// serveur. Une version d'avant l'écrivait lisible de tous (0644).
if (bootFileUrl) restrictToOwner(DB_CONFIG_FILE);

function restrictToOwner(file: string): void {
  try {
    chmodSync(file, 0o600);
  } catch {
    /* fichier d'un autre propriétaire : le serveur le lit quand même */
  }
}

/** L'URL de la base : l'environnement d'abord, sinon `data/database.json`. */
export function getDatabaseUrl(): string | null {
  return databaseUrlFromEnv(process.env) || readConfigFileUrl();
}

/** Qui décide de la connexion au prochain démarrage : l'environnement ou `data/database.json`. */
export function getDatabaseUrlSource(): DatabaseUrlSource | null {
  return resolveDatabaseUrlSource(bootEnvUrl, bootFileUrl, getDatabaseUrl());
}

/** L'URL sur laquelle Prisma est connecté — `null` sans connexion. */
export function getActiveDatabaseUrl(): string | null {
  return prisma ? activeUrl : null;
}

/**
 * Garde l'URL pour les démarrages suivants, dans `data/database.json` (0600).
 * Plus d'écriture de `apps/backend/.env` : le serveur ne le lit pas, et dans
 * l'image il n'est pas inscriptible (une pile d'erreur à chaque installation).
 */
export function saveDatabaseUrl(url: string): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(DB_CONFIG_FILE, JSON.stringify({ url }), { encoding: "utf-8", mode: 0o600 });
  // `mode` ne vaut qu'à la création du fichier.
  restrictToOwner(DB_CONFIG_FILE);
  // Le processus en cours la lit aussi (getDatabaseUrl), jusqu'au redémarrage.
  process.env.DATABASE_URL = url;
}

/** True when DATABASE_URL is available from env or config file. */
export function hasDatabaseUrl(): boolean {
  return !!getDatabaseUrl();
}

/** Initialize the PrismaClient. Returns true on success. */
export async function initPrisma(url?: string): Promise<boolean> {
  const dbUrl = url || getDatabaseUrl();
  if (!dbUrl) return false;

  try {
    prisma = new PrismaClient({
      datasources: { db: { url: dbUrl } },
    });
    await prisma.$connect();
    activeUrl = dbUrl;
    return true;
  } catch (err) {
    console.error("[DB] Connection failed:", err);
    prisma = null;
    activeUrl = null;
    return false;
  }
}

/** Re-initialize PrismaClient with a new URL. */
export async function reinitPrisma(url: string): Promise<boolean> {
  if (prisma) {
    await prisma.$disconnect().catch(() => {});
    prisma = null;
  }
  return initPrisma(url);
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

/** Disconnect and reconnect (handles stale connections). */
export async function reconnectPrisma(): Promise<boolean> {
  if (prisma) {
    await prisma.$disconnect().catch(() => {});
    prisma = null;
  }
  return initPrisma();
}

export type DatabaseProbe = { ok: true; version: string } | { ok: false };

/**
 * La base répond-elle, et laquelle est-ce : `SELECT VERSION()`, borné. Qu'une
 * URL soit configurée ne disait ni l'un ni l'autre.
 */
export async function probeDatabase(timeoutMs = 3000): Promise<DatabaseProbe> {
  if (!prisma) return { ok: false };
  let timer: NodeJS.Timeout | undefined;
  try {
    const rows = await Promise.race([
      prisma.$queryRaw<Array<{ version: string }>>`SELECT VERSION() AS version`,
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
