/**
 * La suite de compatibilité Jellyfin, en UNE commande (depuis la racine) :
 *
 *   pnpm test:jellyfin-compat -- --version 12.1
 *
 * Lance l'image officielle `jellyfin/jellyfin:<version>` dans Docker, lui
 * fabrique une médiathèque synthétique, la prépare comme un administrateur,
 * démarre le VRAI backend Tentacle sur une MariaDB jetable, puis fait tourner
 * les suites (`suites/*.compat.ts`) — api-client et backend — contre elle.
 * Écrit `compat/reports/jellyfin-<version exacte>.json` et inscrit le verdict
 * dans `compat/jellyfin.json`. Détruit tout ce qu'elle a créé, sauf `--keep`.
 *
 * Options : --port 18096 · --db-port 18099 · --backend-port 3031 ·
 * --prefix tentacle-jf-compat · --legacy-auth off|on|default (off : comme un
 * Jellyfin 12 neuf ; l'option est coupée partout où elle existe) · --reuse ·
 * --keep · --no-manifest · --minimum 10.10.0 · --run-dir <dossier> ·
 * --image <image> (défaut jellyfin/jellyfin:<version>).
 */

import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { BACKEND_DIR } from "../notif-e2e/benchEnv";
import { databaseUrl, seedBackendConfig, startBackend, startDatabase, stopDatabase } from "./backendEnv";
import { CONTEXT_ENV, type CompatContext } from "./context";
import { assertDockerReady } from "./docker";
import { prepareInstance, removeInstance } from "./instance";
import { COMPAT_PASSWORD, USER2_NAME, USER_NAME, type Account } from "./provision";
import { buildReport, readRecords, updateManifest } from "./report";
import { printSummary } from "./summary";

const REPO = resolve(BACKEND_DIR, "../..");
const log = (line: string): void => console.log(`[compat] ${line}`);

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  const args = argv.filter((a) => a !== "--");
  for (let i = 0; i < args.length; i++) {
    const key = args[i].replace(/^--/, "");
    const next = args[i + 1];
    if (next !== undefined && !next.startsWith("--")) { out[key] = next; i++; } else out[key] = true;
  }
  return out;
}

async function tentacleLogin(backendUrl: string, username: string, id: string): Promise<Account> {
  const res = await fetch(`${backendUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password: COMPAT_PASSWORD, deviceId: `compat-${username}`, client: "Tentacle Compat", device: "Suite" }),
  });
  if (!res.ok) throw new Error(`Connexion Tentacle de ${username} refusée (${res.status})`);
  const body = (await res.json()) as { AccessToken: string };
  return { name: username, password: COMPAT_PASSWORD, id, token: body.AccessToken };
}

function gitCommit(): string {
  const res = spawnSync("git", ["rev-parse", "--short", "HEAD"], { cwd: REPO, encoding: "utf8" });
  return res.stdout.trim() || "inconnu";
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  const tag = String(args.version ?? "");
  if (!tag) throw new Error("--version manquant (ex. --version 12.1)");
  const prefix = String(args.prefix ?? "tentacle-jf-compat");
  const port = Number(args.port ?? 18096);
  const db = { name: `${prefix}-db`, port: Number(args["db-port"] ?? 18099) };
  const backendPort = Number(args["backend-port"] ?? 3031);
  const image = String(args.image ?? `jellyfin/jellyfin:${tag}`);
  const runDir = resolve(String(args["run-dir"] ?? join(tmpdir(), "tentacle-jf-compat", tag)));
  rmSync(runDir, { recursive: true, force: true });
  mkdirSync(runDir, { recursive: true });
  const keep = args.keep === true;

  assertDockerReady();
  const legacy = String(args["legacy-auth"] ?? "off") as "off" | "on" | "default";
  const instance = await prepareInstance({
    image, prefix, tag, port, reuse: args.reuse === true, legacyAuth: legacy, openapiFile: join(runDir, "openapi.json"),
  }, log);

  let backend: Awaited<ReturnType<typeof startBackend>> | null = null;
  try {
    const dbUrl = await startDatabase(db, log);
    const jwtSecret = await seedBackendConfig(dbUrl, { jellyfinUrl: instance.url, apiKey: instance.apiKey, adminUserId: instance.admin.id });
    log(`Backend Tentacle sur :${backendPort} (journal : ${join(runDir, "backend.log")})…`);
    backend = await startBackend({ port: backendPort, dbUrl, runDir });

    const context: CompatContext = {
      jellyfin: { url: instance.url, version: instance.version, image, serverId: instance.serverId, legacyAuth: instance.legacyAuth },
      apiKey: instance.apiKey,
      admin: await tentacleLogin(backend.url, instance.admin.name, instance.admin.id),
      user: await tentacleLogin(backend.url, USER_NAME, instance.userIds.user),
      user2: await tentacleLogin(backend.url, USER2_NAME, instance.userIds.user2),
      libraries: instance.libraries,
      fixtures: instance.fixtures,
      backend: { url: backend.url, jwtSecret, databaseUrl: databaseUrl(db) },
      recordFile: join(runDir, "records.jsonl"),
      openapiFile: join(runDir, "openapi.json"),
    };
    const contextFile = join(runDir, "context.json");
    writeFileSync(contextFile, JSON.stringify(context, null, 2));

    log("Suites de compatibilité…");
    const vitest = spawnSync(process.execPath, [require.resolve("vitest/vitest.mjs"), "run", "--config", "test/jellyfin-compat/vitest.config.ts"], {
      cwd: BACKEND_DIR, stdio: "inherit", env: { ...process.env, [CONTEXT_ENV]: contextFile },
    });

    const report = buildReport(readRecords(context.recordFile), {
      version: instance.version, image, ranAt: new Date().toISOString(), legacyAuth: instance.legacyAuth,
      tentacleServer: (JSON.parse(readFileSync(join(BACKEND_DIR, "package.json"), "utf8")) as { version: string }).version, commit: gitCommit(),
    });
    const reportFile = join(REPO, "compat/reports", `jellyfin-${instance.version}.json`);
    mkdirSync(join(REPO, "compat/reports"), { recursive: true });
    writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`);
    if (args["no-manifest"] !== true) {
      const revision = updateManifest(join(REPO, "compat/jellyfin.json"), report, args.minimum ? String(args.minimum) : null);
      log(`Manifeste compat/jellyfin.json : révision ${revision}.`);
    }
    printSummary(report, reportFile);
    return report.verdict === "fail" || vitest.status === null ? 1 : 0;
  } finally {
    await backend?.stop();
    if (!keep) {
      stopDatabase(db);
      removeInstance(prefix, tag);
      log("Conteneurs et volumes de l'instance supprimés (--keep pour les garder).");
    } else {
      log(`Gardés : ${instance.container} (${instance.url}), ${db.name}. Backend arrêté.`);
    }
  }
}

main().then((code) => process.exit(code), (err: unknown) => {
  console.error(`[compat] ÉCHEC : ${err instanceof Error ? err.stack ?? err.message : String(err)}`);
  process.exit(2);
});
