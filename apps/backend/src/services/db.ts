import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";

const DATA_DIR = resolve(__dirname, "../../data");
const DB_CONFIG_FILE = resolve(DATA_DIR, "database.json");
const ENV_FILE = resolve(__dirname, "../../.env");

let prisma: PrismaClient | null = null;

/** Read DATABASE_URL from env var or persisted config file. */
export function getDatabaseUrl(): string | null {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (existsSync(DB_CONFIG_FILE)) {
    try {
      const config = JSON.parse(readFileSync(DB_CONFIG_FILE, "utf-8"));
      return config.url || null;
    } catch {
      return null;
    }
  }
  return null;
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
    return true;
  } catch (err) {
    console.error("[DB] Connection failed:", err);
    prisma = null;
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
