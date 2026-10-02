/* ------------------------------------------------------------------ */
/*  L'ouvrier yt-dlp : un processus Python gardé chaud                 */
/*                                                                     */
/*  Lancer yt-dlp pour chaque bande-annonce, c'est démarrer Python et  */
/*  importer yt-dlp à chaque fois : 0,7 à 1,6 s sur un Mac, bien plus  */
/*  sur un NAS — mesuré le 2026-10-02 : 2,3 à 3,2 s par extraction en  */
/*  ligne de commande, 1,0 à 1,5 s dans un processus déjà chaud.       */
/*  L'ouvrier naît à la première extraction, sert les suivantes, et    */
/*  s'éteint après cinq minutes sans travail (~60 Mo rendus). Il ne    */
/*  marche qu'avec le zipapp officiel (l'image, la copie à jour) ;     */
/*  ailleurs, ou s'il fait défaut, `null` : la ligne de commande       */
/*  reprend la main (ytExtract.ts).                                    */
/* ------------------------------------------------------------------ */

import { spawn, type ChildProcessWithoutNullStreams } from "child_process";
import { closeSync, existsSync, openSync, readSync, statSync } from "fs";
import { delimiter, isAbsolute, join } from "path";
import { WORKER_SCRIPT } from "./ytWorkerScript";

export interface WorkerOutcome {
  formats: Array<Record<string, unknown>>;
  stderr: string;
}

/**
 * `unavailable` : l'ouvrier ne peut pas servir (pas de zipapp, démarrage en
 * échec) — la ligne de commande le remplace. `failed` : il a servi, mais
 * l'extraction a expiré ou il est mort en route — la refaire en ligne de
 * commande doublerait l'attente pour le même résultat.
 */
export type WorkerResult = { status: "done"; outcome: WorkerOutcome } | { status: "unavailable" } | { status: "failed"; reason: string };

/** Sans travail pendant ce temps, l'ouvrier s'éteint : la mémoire revient au serveur. */
const IDLE_MS = 5 * 60 * 1000;
/** Python + import de yt-dlp, même sur un petit serveur. */
const START_TIMEOUT_MS = 20_000;
/** Un ouvrier qui n'a pas su démarrer n'est pas relancé avant ce délai : la ligne de commande sert. */
const RETRY_AFTER_FAILURE_MS = 10 * 60 * 1000;

/** Le fichier de `command` : un chemin, ou un nom cherché dans le PATH. */
function resolveCommand(command: string): string | null {
  if (isAbsolute(command)) return existsSync(command) ? command : null;
  for (const dir of (process.env.PATH ?? "").split(delimiter)) {
    const candidate = join(dir, command);
    if (dir && existsSync(candidate)) return candidate;
  }
  return null;
}

/** Le zipapp officiel : une ligne `#!…python3`, puis l'archive (`PK\x03\x04`). */
export function isZipapp(file: string): boolean {
  let fd: number | null = null;
  try {
    fd = openSync(file, "r");
    const head = Buffer.alloc(256);
    const read = readSync(fd, head, 0, head.length, 0);
    const text = head.subarray(0, read);
    const newline = text.indexOf(0x0a);
    return text.subarray(0, 2).toString() === "#!" && newline > 0 && text.subarray(newline + 1, newline + 5).toString("latin1") === "PK\x03\x04";
  } catch {
    return false;
  } finally {
    if (fd !== null) closeSync(fd);
  }
}

interface Live {
  proc: ChildProcessWithoutNullStreams;
  signature: string;
  ready: Promise<boolean>;
  pending: Map<number, (outcome: WorkerOutcome | null) => void>;
  idle: ReturnType<typeof setTimeout> | null;
}

let live: Live | null = null;
let failedUntil = 0;
let nextId = 1;

function stop(worker: Live): void {
  if (live === worker) live = null;
  if (worker.idle) clearTimeout(worker.idle);
  for (const settle of worker.pending.values()) settle(null);
  worker.pending.clear();
  worker.proc.kill();
}

function start(zipapp: string, signature: string, python: string): Live {
  const proc = spawn(python, ["-u", "-c", WORKER_SCRIPT, zipapp], { stdio: ["pipe", "pipe", "pipe"] });
  const worker: Live = { proc, signature, ready: Promise.resolve(false), pending: new Map(), idle: null };
  worker.ready = new Promise<boolean>((resolveReady) => {
    const timer = setTimeout(() => resolveReady(false), START_TIMEOUT_MS);
    let buffer = "";
    proc.stdout.setEncoding("utf8");
    proc.stdout.on("data", (chunk: string) => {
      buffer += chunk;
      for (let nl = buffer.indexOf("\n"); nl >= 0; nl = buffer.indexOf("\n")) {
        const line = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 1);
        let message: { ready?: boolean; version?: string; id?: number } & Partial<WorkerOutcome>;
        try {
          message = JSON.parse(line);
        } catch {
          continue;
        }
        if (message.ready) {
          clearTimeout(timer);
          console.log(`[trailers] ouvrier yt-dlp ${message.version} prêt`);
          resolveReady(true);
        } else if (typeof message.id === "number") {
          worker.pending.get(message.id)?.({ formats: message.formats ?? [], stderr: message.stderr ?? "" });
          worker.pending.delete(message.id);
        }
      }
    });
    // Fin du processus, ou Python introuvable : plus rien n'arrivera de lui.
    const dead = () => {
      clearTimeout(timer);
      resolveReady(false);
      stop(worker);
    };
    proc.on("exit", dead);
    proc.on("error", dead);
  });
  // L'ouvrier n'écrit rien d'utile sur stderr (ses erreurs voyagent dans les réponses).
  proc.stderr.resume();
  return worker;
}

/** Une passe d'extraction par l'ouvrier (cf. `WorkerResult`). */
export async function workerExtract(
  command: string,
  request: { url: string; clients: string[]; ejs: boolean },
  timeoutMs: number,
  python = "python3",
): Promise<WorkerResult> {
  if (Date.now() < failedUntil) return { status: "unavailable" };
  const file = resolveCommand(command);
  if (!file || !isZipapp(file)) return { status: "unavailable" };
  // Une nouvelle version de yt-dlp (mise à jour du jour) : un nouvel ouvrier.
  const signature = `${file}:${statSync(file).mtimeMs}`;
  if (live && live.signature !== signature) stop(live);
  const worker = live ?? (live = start(file, signature, python));
  if (!(await worker.ready)) {
    failedUntil = Date.now() + RETRY_AFTER_FAILURE_MS;
    console.warn("[trailers] l'ouvrier yt-dlp ne démarre pas : la ligne de commande sert");
    stop(worker);
    return { status: "unavailable" };
  }
  if (worker.idle) clearTimeout(worker.idle);
  const id = nextId++;
  const outcome = await new Promise<WorkerOutcome | null>((settle) => {
    const timer = setTimeout(() => {
      worker.pending.delete(id);
      settle(null);
      // Une extraction qui ne rend pas la main : l'ouvrier est peut-être coincé.
      stop(worker);
    }, timeoutMs);
    worker.pending.set(id, (result) => {
      clearTimeout(timer);
      settle(result);
    });
    worker.proc.stdin.write(`${JSON.stringify({ id, ...request })}\n`);
  });
  if (live === worker && worker.pending.size === 0) {
    worker.idle = setTimeout(() => stop(worker), IDLE_MS);
    worker.idle.unref();
  }
  return outcome ? { status: "done", outcome } : { status: "failed", reason: `ouvrier sans réponse en ${timeoutMs / 1000} s` };
}

/** Pour les tests et l'arrêt du serveur : éteindre l'ouvrier, oublier un échec. */
export function stopYtWorker(): void {
  if (live) stop(live);
  failedUntil = 0;
}
