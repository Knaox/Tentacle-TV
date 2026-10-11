/**
 * Ce que l'assemblage construit depuis le dépôt, dans l'ordre du Dockerfile
 * (étapes « base » et « prod-deps ») — mais sur Windows : `prisma generate`
 * y pose le moteur `query_engine-windows.dll.node`, que l'image n'a pas.
 *
 * Les commandes passent par le shell (pnpm est un `.cmd` sous Windows, que
 * Node refuse de lancer sans lui) : chaque argument est donc cité.
 */
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { pruneNodeModules } from "./prune.mts";

export type Log = (line: string) => void;

/** Cite un argument pour `cmd.exe` (seuls des chemins et des options passent ici). */
export function quoteArg(arg: string): string {
  if (/^[\w@./:=\\-]+$/.test(arg)) return arg;
  if (arg.includes('"')) throw new Error(`argument non citable : ${arg}`);
  return `"${arg}"`;
}

export function run(command: string, args: readonly string[], cwd: string, log: Log, env: NodeJS.ProcessEnv = process.env): void {
  const line = [command, ...args].map(quoteArg).join(" ");
  log(`$ ${line}`);
  const result = spawnSync(line, { cwd, env, shell: true, stdio: "inherit" });
  if (result.status !== 0) throw new Error(`échec (${result.status ?? result.signal ?? "?"}) : ${line}`);
}

/** Le client web, le serveur, ses dépendances partagées, l'hôte ; le client LG si demandé. */
export function buildSources(repo: string, withTvClient: boolean, log: Log): void {
  run("pnpm", ["--filter", "@tentacle-tv/web", "build"], repo, log);
  const backend = join(repo, "apps", "backend");
  // La clé Klipy n'est gravée que si la CI la donne : sans elle, le fichier
  // commité (clé vide, GIFs coupés) reste tel quel.
  if (process.env.KLIPY_API_KEY) run("node", ["scripts/bake-klipy-key.mjs"], backend, log);
  run("pnpm", ["exec", "prisma", "generate"], backend, log);
  run("pnpm", ["build"], backend, log);
  run("pnpm", ["build:shared-deps"], backend, log);
  run("pnpm", ["--filter", "@tentacle-tv/server-windows", "build"], repo, log);
  if (withTvClient) run("pnpm", ["--filter", "@tentacle-tv/tv-webos", "build"], repo, log);
}

/**
 * Les dépendances de PRODUCTION du serveur, aux versions du verrou, puis le
 * client Prisma généré (moteur Windows) et l'élagage. Rend le `node_modules`.
 */
export function deployProdDeps(repo: string, workDir: string, log: Log): string {
  const deploy = join(workDir, "deploy");
  rmSync(deploy, { recursive: true, force: true });
  mkdirSync(workDir, { recursive: true });
  run(
    "pnpm",
    [
      "--filter",
      "@tentacle-tv/backend",
      "deploy",
      "--prod",
      "--frozen-lockfile",
      "--ignore-scripts",
      "--config.inject-workspace-packages=true",
      "--config.allow-unused-patches=true",
      deploy,
    ],
    repo,
    log,
  );
  const nodeModules = join(deploy, "node_modules");
  run(
    "node",
    [join(repo, "apps", "backend", "docker", "check-lockfile-deps.mjs"), "--drop-optional-peers", "pnpm-lock.yaml", "apps/backend", nodeModules],
    repo,
    log,
  );
  const generated = join(repo, "node_modules", ".prisma", "client");
  if (!existsSync(join(generated, "query_engine-windows.dll.node"))) {
    throw new Error("client Prisma sans moteur Windows : lancer « prisma generate » sur Windows");
  }
  cpSync(generated, join(nodeModules, ".prisma", "client"), { recursive: true, dereference: true });
  const removed = pruneNodeModules(nodeModules);
  log(`élagage : ${removed} entrée(s) retirée(s)`);
  if (!existsSync(join(nodeModules, ".prisma", "client", "query_engine-windows.dll.node"))) {
    throw new Error("l'élagage a retiré le moteur Prisma de Windows");
  }
  return nodeModules;
}
