import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { DATA_ROOT } from "../services/dataDir";
import { databaseUrlFromEnv } from "../services/databaseEnv";
import { readHostInfo } from "../setup/hostInfo";
import { SETUP_LOCK_FILE, unsealSetup } from "../setup/setupLock";
import { forgetClaimant } from "../setup/localAccess/claimant";
import { discardSetupToken, setupTokenBanner, writeNewSetupToken } from "../setup/setupToken";
import { runWebCommand, WEB_USAGE } from "./webUiCommand";

/**
 * `tentacle` — la commande de la MACHINE. L'assistant ne se rouvre jamais par
 * HTTP : seulement d'ici, par qui a la main sur le serveur — dans la console
 * du conteneur (Portainer, NAS, `docker exec <conteneur> …`) :
 *
 *   tentacle setup token   # un code neuf (installation ouverte)
 *   tentacle setup reset   # rouvrir l'assistant
 *   tentacle web on|off    # l'interface web (`webUiCommand.ts`)
 *
 * En natif : `node apps/backend/dist/cli/tentacle.js setup …`.
 */
const USAGE = [
  "Tentacle — commandes du serveur / server commands",
  "",
  "  tentacle setup token   affiche un code d'installation neuf",
  "                         print a new one-time setup code",
  "  tentacle setup reset   rouvre l'assistant d'installation (puis redémarrer le conteneur)",
  "                         reopen the setup wizard (then restart the container)",
  ...WEB_USAGE,
];
// Rouvrir l'assistant, c'est aussi repartir du CHOIX du Jellyfin : le choix
// et le parcours d'avant ne valent plus (`setup/flow/setupFlow.ts`).
const SETUP_FLAGS = [
  "setup_completed",
  "admin_jellyfin_id",
  "admin_username",
  "setup_jellyfin_selection",
  "setup_jellyfin_key_created",
  "setup_jellyfin_joined",
];
const HELP = new Set(["help", "-h", "--help"]);

/** Le redémarrage à faire après `reset`, avec l'identifiant du conteneur quand il se lit. */
function resetDone(): string[] {
  const { containerized, containerId } = readHostInfo();
  const target = containerId ?? "<container>";
  const how = containerized
    ? [
        "  Portainer, NAS : « Restart », puis « Logs » / « Journal » du conteneur Tentacle.",
        `  Ligne de commande / command line : docker restart ${target} && docker logs ${target}`,
      ]
    : [];
  return [
    "Assistant rouvert. Redémarrez le serveur ; le code d'installation sera dans son journal.",
    "Wizard reopened. Restart the server; the setup code will be in its logs.",
    ...how,
  ];
}

/**
 * `tentacle tentacle setup token` (le nom de la commande tapé deux fois, comme
 * dans `docker compose exec tentacle tentacle …`) est pardonné : un ou
 * plusieurs `tentacle` en tête sont ignorés.
 */
export function normalizeArgs(args: string[]): string[] {
  let start = 0;
  while (start < args.length && args[start].toLowerCase() === "tentacle") start += 1;
  return args.slice(start).map((arg) => arg.toLowerCase());
}

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
  for (const line of setupTokenBanner(writeNewSetupToken(), port, readHostInfo().containerized)) console.log(line);
}

export async function runCli(args: string[], env: NodeJS.ProcessEnv = process.env): Promise<number> {
  const [scope, action] = normalizeArgs(args);
  const port = env.TENTACLE_HOST_PORT || env.PORT || "3000";
  if (scope !== undefined && HELP.has(scope)) {
    for (const line of USAGE) console.log(line);
    return 0;
  }
  if (scope === undefined) {
    for (const line of USAGE) console.error(line);
    return 2;
  }
  if (scope === "web") return runWebCommand(action, env);
  if (scope !== "setup" || (action !== "token" && action !== "reset")) {
    const typed = ["tentacle", ...args].join(" ");
    console.error(`Commande inconnue / unknown command : ${typed}`);
    console.error("");
    for (const line of USAGE) console.error(line);
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
  forgetClaimant();
  // Pas de code ici : le serveur en cours tient l'assistant pour fermé, et le
  // redémarrage en écrit un neuf — celui qu'on afficherait serait déjà caduc.
  discardSetupToken();
  for (const line of resetDone()) console.log(line);
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
