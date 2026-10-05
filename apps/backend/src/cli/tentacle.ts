import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { DATA_ROOT } from "../services/dataDir";
import { databaseUrlFromEnv } from "../services/databaseEnv";
import { SETUP_LOCK_FILE, unsealSetup } from "../setup/setupLock";
import { discardSetupToken, setupTokenBanner, writeNewSetupToken } from "../setup/setupToken";

/**
 * `tentacle` — la commande de la MACHINE. L'assistant ne se rouvre jamais par
 * HTTP : seulement d'ici, par qui a la main sur le serveur.
 *
 *   docker compose exec tentacle tentacle setup token   # un code neuf (installation ouverte)
 *   docker compose exec tentacle tentacle setup reset   # rouvrir l'assistant
 *
 * En natif : `node apps/backend/dist/cli/tentacle.js setup …`.
 */
const USAGE = "usage: tentacle setup token | tentacle setup reset";
const SETUP_FLAGS = ["setup_completed", "admin_jellyfin_id", "admin_username"];
const RESET_DONE = [
  "Assistant rouvert. Redémarrez le serveur ; le code d'installation sera dans ses journaux :",
  "Wizard reopened. Restart the server; the setup code will be in its logs:",
  "  docker compose restart tentacle && docker compose logs tentacle",
];

function databaseUrl(): string | null {
  const fromEnv = databaseUrlFromEnv(process.env);
  if (fromEnv) return fromEnv;
  const file = resolve(DATA_ROOT, "database.json");
  if (!existsSync(file)) return null;
  try {
    return (JSON.parse(readFileSync(file, "utf-8")) as { url?: string }).url ?? null;
  } catch {
    return null;
  }
}

async function withDatabase<T>(run: (prisma: PrismaClient) => Promise<T>): Promise<T | null> {
  const url = databaseUrl();
  if (!url) return null;
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    return await run(prisma);
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}

async function setupCompleted(): Promise<boolean> {
  if (existsSync(SETUP_LOCK_FILE)) return true;
  const row = await withDatabase((prisma) => prisma.serverConfig.findUnique({ where: { key: "setup_completed" } })).catch(() => null);
  return row?.value === "true";
}

function printToken(port: string): void {
  for (const line of setupTokenBanner(writeNewSetupToken(), port)) console.log(line);
}

export async function runCli(args: string[], env: NodeJS.ProcessEnv = process.env): Promise<number> {
  const [scope, action] = args;
  const port = env.TENTACLE_HOST_PORT || env.PORT || "3000";
  if (scope !== "setup" || (action !== "token" && action !== "reset")) {
    console.error(USAGE);
    return 2;
  }

  if (action === "token") {
    if (await setupCompleted()) {
      console.error("L'installation est terminée : l'assistant est fermé. `tentacle setup reset` le rouvre.");
      console.error("Setup is complete: the wizard is closed. `tentacle setup reset` reopens it.");
      return 1;
    }
    // Le serveur relit ce fichier à chaque essai : pas besoin de le redémarrer.
    printToken(port);
    return 0;
  }

  const cleared = await withDatabase((prisma) => prisma.serverConfig.deleteMany({ where: { key: { in: SETUP_FLAGS } } }));
  if (cleared === null) {
    console.error("Base de données introuvable (DB_* ou data/database.json) — rien n'a été changé.");
    return 1;
  }
  unsealSetup();
  // Pas de code ici : le serveur en cours tient l'assistant pour fermé, et le
  // redémarrage en écrit un neuf — celui qu'on afficherait serait déjà caduc.
  discardSetupToken();
  for (const line of RESET_DONE) console.log(line);
  return 0;
}

if (require.main === module) {
  runCli(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err: unknown) => {
      console.error("[tentacle]", err instanceof Error ? err.message : err);
      process.exit(1);
    },
  );
}
