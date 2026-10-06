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
  stack: "full" | "db" | "only";
  project: string;
  /** Les variables du `.env` de la pile (ports, domaines…). */
  env: Record<string, string>;
  /** Un fichier compose de plus, fusionné par-dessus (variables du serveur, config du mandataire). */
  override?: string;
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
    const env = { TENTACLE_VERSION: IMAGE_TAG, MEDIA_PATH: this.media, ...options.env };
    writeFileSync(join(this.dir, ".env"), Object.entries(env).map(([k, v]) => `${k}=${v}`).join("\n") + "\n");
    if (options.override) writeFileSync(join(this.dir, "override.yaml"), options.override);
  }

  get port(): number {
    return Number(this.options.env.TENTACLE_PORT ?? 3000);
  }

  url(path: string): string {
    return `http://127.0.0.1:${this.port}${path}`;
  }

  async compose(...args: string[]): Promise<string> {
    const files = ["-f", join(REPO, "stacks", `tentacle-${this.options.stack}`, "compose.yaml")];
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
