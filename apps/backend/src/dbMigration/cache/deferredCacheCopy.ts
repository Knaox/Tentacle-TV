import { fork } from "child_process";
import { existsSync } from "fs";
import { resolve } from "path";
import { parseReport } from "../migrationReport";
import { CACHE_DONE_KEY, type CacheChildConfig, type CacheChildMessage } from "./cacheCopyProtocol";
import { MIGRATION_REPORT_KEY } from "../../services/database/legacySource";

/**
 * Le pilote, côté serveur, de la copie de fond du cache TMDB : relit le rapport
 * (tables différées) et le marqueur de fin, lance l'enfant, suit sa progression
 * pour la carte « Base de données » de l'admin (« Copie du cache en cours
 * (x %) »). Jamais une erreur ni une alerte pour un cache : MariaDB devenue
 * injoignable arrête la copie proprement, une ligne au journal, et le cache se
 * reconstruit comme il l'a toujours fait. Elle reprend au démarrage suivant.
 */
export type CacheCopyPhase = "none" | "running" | "done" | "stopped";

export interface CacheCopyState {
  phase: CacheCopyPhase;
  done: number;
  total: number;
}

let state: CacheCopyState = { phase: "none", done: 0, total: 0 };

export function cacheCopyState(): CacheCopyState {
  return state;
}

/** 0 à 100. */
export function cacheCopyPercent(s: CacheCopyState = state): number {
  if (s.phase === "done") return 100;
  return s.total > 0 ? Math.min(99, Math.floor((100 * s.done) / s.total)) : 0;
}

export interface DeferredCacheOptions {
  url: string | null;
  path: string;
  /** Lecture d'une clé de `server_config` (par Prisma, ouverte dans ce processus). */
  readConfig: (key: string) => Promise<string | null>;
  batchRows?: number;
  pauseMs?: number;
  log?: (line: string) => void;
}

function childEntry(): string {
  const js = resolve(__dirname, "cacheCopyChild.js");
  return existsSync(js) ? js : resolve(__dirname, "cacheCopyChild.ts");
}

/** Rend une promesse tenue à la FIN de la copie (réussie ou arrêtée) — ou tout de suite s'il n'y a rien à copier. */
export async function startDeferredCacheCopy(options: DeferredCacheOptions): Promise<void> {
  const log = options.log ?? ((line: string) => console.log(line));
  const report = parseReport(await options.readConfig(MIGRATION_REPORT_KEY));
  const tables = report?.deferred.map((d) => d.table) ?? [];
  if (tables.length === 0) return;
  if (await options.readConfig(CACHE_DONE_KEY)) {
    state = { phase: "done", done: 0, total: 0 };
    return;
  }
  if (!options.url) {
    log("[db-migration] Cache TMDB : l'ancienne base n'est plus configurée, le cache se reconstruira au fil de l'eau.");
    state = { phase: "stopped", done: 0, total: 0 };
    return;
  }
  state = { phase: "running", done: 0, total: report?.deferred.reduce((n, d) => n + d.sourceRows, 0) ?? 0 };
  log(`[db-migration] Copie du cache TMDB en fond (${tables.join(", ")})`);
  const started = Date.now();
  await new Promise<void>((done) => {
    const child = fork(childEntry(), [], { stdio: ["ignore", "inherit", "inherit", "ipc"] });
    let settled = false;
    const finish = (phase: CacheCopyPhase, line: string) => {
      if (settled) return;
      settled = true;
      state = { ...state, phase };
      log(line);
      done();
    };
    child.on("message", (message: CacheChildMessage) => {
      if (message.kind === "progress") state = { phase: "running", done: message.done, total: message.total };
      else if (message.kind === "done") finish("done", `[db-migration] Cache TMDB copié en ${Math.round((Date.now() - started) / 1000)} s`);
      else finish("stopped", `[db-migration] Copie du cache TMDB arrêtée (${message.reason}) : elle reprendra au prochain démarrage, le cache se reconstruit en attendant.`);
    });
    child.on("exit", () => finish("stopped", "[db-migration] Copie du cache TMDB interrompue : elle reprendra au prochain démarrage."));
    child.on("error", () => finish("stopped", "[db-migration] Copie du cache TMDB impossible à lancer : elle reprendra au prochain démarrage."));
    const config: CacheChildConfig = {
      path: options.path,
      url: options.url!,
      tables,
      batchRows: options.batchRows ?? 50,
      pauseMs: options.pauseMs ?? 50,
    };
    child.send(config);
  });
}

/** Les tests. */
export function resetCacheCopyState(): void {
  state = { phase: "none", done: 0, total: 0 };
}
