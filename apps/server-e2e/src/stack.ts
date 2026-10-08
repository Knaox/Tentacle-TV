import { execFile } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

/**
 * Une pile Docker du dépôt (`stacks/tentacle-*`), montée pour un scénario :
 * son propre projet compose, ses ports, son dossier de travail SOUS le dépôt
 * (`apps/server-e2e/.runs/`, ignoré par git) — colima ne monte que le dossier
 * personnel, un dossier temporaire du système resterait vide dans la VM.
 *
 *   E2E_COMPOSE           la commande compose (défaut « docker compose »)
 *   E2E_TENTACLE_VERSION  l'étiquette de l'image à éprouver (défaut « latest »)
 *   E2E_KEEP=1            ne pas démonter la pile à la fin (pour y regarder)
 */
const run = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO = resolve(HERE, "../../..");
const RUNS = resolve(HERE, "../.runs");
const COMPOSE = (process.env.E2E_COMPOSE ?? "docker compose").split(" ").filter(Boolean);
const IMAGE_TAG = process.env.E2E_TENTACLE_VERSION ?? "latest";

export interface StackOptions {
  stack: "full" | "only";
  project: string;
  /** Les variables du `.env` de la pile (ports, domaines…). */
  env: Record<string, string>;
  /** Un fichier compose de plus, fusionné par-dessus (variables du serveur). */
  override?: string;
  /** Des fichiers compose du dépôt, fusionnés eux aussi (ex. `apps/server-e2e/proxies/compose.yaml`). */
  extraComposeFiles?: string[];
  /** Des fichiers écrits dans le dossier de travail (`RUN_DIR` pour compose) : la config d'un mandataire… */
  files?: Record<string, string>;
  profiles?: string[];
}

export async function docker(...args: string[]): Promise<string> {
  const { stdout } = await run("docker", args, { maxBuffer: 64 * 1024 * 1024 });
  return stdout;
}

export class Stack {
  readonly dir: string;
  readonly media: string;

  constructor(readonly options: StackOptions) {
    this.dir = join(RUNS, options.project);
    this.media = join(this.dir, "media");
    if (existsSync(this.dir)) rmSync(this.dir, { recursive: true, force: true });
    mkdirSync(this.media, { recursive: true });
    const env = { TENTACLE_VERSION: IMAGE_TAG, MEDIA_PATH: this.media, RUN_DIR: this.dir, ...options.env };
    writeFileSync(join(this.dir, ".env"), Object.entries(env).map(([k, v]) => `${k}=${v}`).join("\n") + "\n");
    if (options.override) writeFileSync(join(this.dir, "override.yaml"), options.override);
    for (const [name, content] of Object.entries(options.files ?? {})) {
      mkdirSync(dirname(join(this.dir, name)), { recursive: true });
      writeFileSync(join(this.dir, name), content);
    }
  }

  get port(): number {
    return Number(this.options.env.TENTACLE_PORT ?? 3000);
  }

  url(path: string): string {
    return `http://127.0.0.1:${this.port}${path}`;
  }

  async compose(...args: string[]): Promise<string> {
    const files = ["-f", join(REPO, "stacks", `tentacle-${this.options.stack}`, "compose.yaml")];
    for (const extra of this.options.extraComposeFiles ?? []) files.push("-f", join(REPO, extra));
    if (this.options.override) files.push("-f", join(this.dir, "override.yaml"));
    const profiles = (this.options.profiles ?? []).flatMap((p) => ["--profile", p]);
    const [bin, ...pre] = COMPOSE;
    const { stdout } = await run(
      bin,
      [...pre, "-p", this.options.project, "--project-directory", this.dir, ...files, "--env-file", join(this.dir, ".env"), ...profiles, ...args],
      { maxBuffer: 64 * 1024 * 1024 },
    );
    return stdout;
  }

  async up(): Promise<void> {
    await this.down();
    await this.compose("up", "-d");
    await this.waitHealthy();
  }

  /** Monter SANS effacer les volumes : une pile reprise d'un déploiement précédent (mêmes noms). */
  async start(): Promise<void> {
    await this.compose("up", "-d", "--remove-orphans");
    await this.waitHealthy();
  }

  /** Démonter en GARDANT les volumes, comme un « Pull and redeploy » de Portainer entre deux piles. */
  async stop(): Promise<void> {
    await this.compose("down", "--remove-orphans");
  }

  /**
   * Une requête dans la base SQLite de la pile (`data/tentacle.db` du conteneur
   * Tentacle). Une lecture passe par `tentacle db query` (lecture seule, sans
   * en-tête, colonnes séparées par des tabulations — la sortie de `mariadb -N`) ;
   * une écriture (préparer un scénario) par `node:sqlite`, sous le compte du
   * serveur : un `-wal` créé par root lui serait illisible. La requête passe en
   * argument, jamais recollée dans une ligne de shell.
   */
  async sql(query: string): Promise<string> {
    if (/^\s*(SELECT|WITH|PRAGMA)\b/i.test(query)) return this.exec("tentacle", "tentacle", "db", "query", "--no-header", query);
    const write = [
      'const { DatabaseSync } = require("node:sqlite");',
      "const db = new DatabaseSync(process.argv[1]);",
      'db.exec("PRAGMA busy_timeout = 15000");',
      "db.exec(process.argv[2]);",
      "db.close();",
    ].join(" ");
    const shell = 'exec su-exec "${PUID:-1000}:${PGID:-1000}" node -e "$1" "${TENTACLE_DATA_DIR:-/app/apps/backend/data}/tentacle.db" "$2"';
    return this.exec("tentacle", "sh", "-c", shell, "sh", write, query);
  }

  async down(): Promise<void> {
    if (process.env.E2E_KEEP === "1" && this.started) return;
    await this.compose("down", "-v", "--remove-orphans").catch(() => undefined);
  }

  private started = false;

  async waitHealthy(timeoutMs = 180_000): Promise<void> {
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) {
      const ok = await fetchWithin(this.url("/api/health"), {}, 5_000).then((r) => r.ok, () => false);
      if (ok) {
        this.started = true;
        return;
      }
      await sleep(2_000);
    }
    throw new Error(`${this.options.project} : Tentacle ne répond pas sur ${this.port}`);
  }

  async logs(service = "tentacle"): Promise<string> {
    return this.compose("logs", "--no-color", service);
  }

  /** Le DERNIER code d'installation annoncé dans les journaux. */
  async setupCode(timeoutMs = 60_000): Promise<string> {
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) {
      const codes = [...(await this.logs()).matchAll(/code d'installation : ([0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4})/g)];
      if (codes.length) return codes[codes.length - 1][1];
      await sleep(1_000);
    }
    throw new Error("aucun code d'installation dans les journaux");
  }

  async exec(service: string, ...command: string[]): Promise<string> {
    return this.compose("exec", "-T", service, ...command);
  }
}

/** Toute requête du banc a une échéance : un service qui accepte la connexion sans répondre ne fige pas le banc. */
export function fetchWithin(url: string, init: RequestInit = {}, ms = 30_000): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(ms) });
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Attendre qu'une condition tienne (sonde répétée), ou échouer avec un message clair. */
export async function waitFor<T>(what: string, probe: () => Promise<T | null | undefined | false>, timeoutMs = 90_000, everyMs = 2_000): Promise<T> {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const value = await probe().catch(() => null);
    if (value) return value;
    await sleep(everyMs);
  }
  throw new Error(`délai dépassé : ${what}`);
}
