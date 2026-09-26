import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import { DATA_ROOT } from "./dataDir";
import { resolveDatabaseUrlSource, type DatabaseUrlSource } from "./databaseInfo";

const DATA_DIR = DATA_ROOT;
const DB_CONFIG_FILE = resolve(DATA_DIR, "database.json");
const ENV_FILE = resolve(__dirname, "../../.env");

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
// réécrit les deux à chaud (cf. `resolveDatabaseUrlSource`).
const bootEnvUrl = process.env.DATABASE_URL || null;
const bootFileUrl = readConfigFileUrl();

/** Read DATABASE_URL from env var or persisted config file. */
export function getDatabaseUrl(): string | null {
  return process.env.DATABASE_URL || readConfigFileUrl();
}

/** Qui décide de la connexion au prochain démarrage : l'environnement ou `data/database.json`. */
export function getDatabaseUrlSource(): DatabaseUrlSource | null {
  return resolveDatabaseUrlSource(bootEnvUrl, bootFileUrl, getDatabaseUrl());
}

/** L'URL sur laquelle Prisma est connecté — `null` sans connexion. */
export function getActiveDatabaseUrl(): string | null {
  return prisma ? activeUrl : null;
}

/** Persist a DATABASE_URL so it survives restarts (both .env and fallback file). */
export function saveDatabaseUrl(url: string): void {
  // Fallback JSON file
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(DB_CONFIG_FILE, JSON.stringify({ url }), "utf-8");

  // Update .env so systemd/docker picks it up on restart
  try {
    let content = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, "utf-8") : "";
    const line = `DATABASE_URL=${url}`;
    if (/^DATABASE_URL=.*/m.test(content)) {
      content = content.replace(/^DATABASE_URL=.*/m, line);
    } else {
      content = content.trimEnd() + "\n" + line + "\n";
    }
    writeFileSync(ENV_FILE, content, "utf-8");
  } catch (err) {
    console.warn("[DB] Could not update .env file:", err);
  }

  // Also update current process
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
