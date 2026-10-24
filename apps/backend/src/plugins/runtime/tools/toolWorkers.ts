import { spawn, type ChildProcessWithoutNullStreams } from "child_process";
import { mkdirSync } from "fs";
import { createServer, type Server, type Socket } from "net";
import { resolve } from "path";
import { pythonCommand } from "../../../services/tools/toolPaths";
import { freshSocketPath, removeSocket } from "../guestLaunch";
import { HostCallFailure, type HostCallContext } from "../hostDispatcher";
import type { ToolName } from "../pluginServerRuntime";
import { activeYtDlpZipapp, resolveCommand, toolEnv } from "./toolExec";
import { WORKER_BOOTSTRAP } from "./workerBootstrap";
import { WORKER_SCRIPT } from "./workerScript";
import { checkWorkerLine, MAX_REQUEST_LINE } from "./toolWorkerProtocol";

/**
 * Les ouvriers PERSISTANTS d'une extension (`tools.spawnWorker`) : l'interpréteur
 * Python du cœur, sous l'amorçage de `workerBootstrap.ts`, qui importe yt-dlp
 * depuis le zipapp EN SERVICE (celui que `services/ytDlp.ts` tient à jour, sans
 * copie) puis exécute le programme de l'HÔTE (`workerScript.ts`), jamais un
 * script d'extension. Son stdin/stdout est relié à une socket que l'hôte ouvre
 * et que l'invité rejoint (protocole fermé `WorkerRequest` / `WorkerMessage`,
 * chaque requête relue par `toolWorkerProtocol.ts`) : une connexion à la fois,
 * la plus récente gagne. L'ouvrier mort est relancé
 * (délai qui double, 60 s au plus) ; une nouvelle version de yt-dlp le relance
 * aussi, à la prochaine connexion. Arrêtés avec l'invité.
 */

interface Worker {
  id: string;
  pluginId: string;
  socketPath: string;
  server: Server;
  proc: ChildProcessWithoutNullStreams | null;
  zipapp: string;
  client: Socket | null;
  backoffMs: number;
  stopped: boolean;
  timer: NodeJS.Timeout | null;
}

const MAX_WORKERS_PER_PLUGIN = 4;
const workers = new Map<string, Worker>();

function startProcess(worker: Worker, ctx: HostCallContext): void {
  const zipapp = activeYtDlpZipapp();
  if (!zipapp) {
    worker.proc = null;
    return;
  }
  worker.zipapp = zipapp;
  mkdirSync(resolve(ctx.dataDir, "tmp"), { recursive: true });
  const tmp = resolve(ctx.dataDir, "tmp");
  // HOME et caches dans les données : yt-dlp n'y cherche rien d'autre, et l'amorçage refuserait le reste.
  const env = { ...toolEnv(), HOME: resolve(ctx.dataDir), XDG_CACHE_HOME: resolve(ctx.dataDir, ".cache"), TMPDIR: tmp, TEMP: tmp, TMP: tmp };
  // L'interpréteur cherché dans le PATH du SERVEUR : celui de l'ouvrier ne garde que le dossier de Node.
  const python = resolveCommand(pythonCommand()) ?? pythonCommand();
  const proc = spawn(
    python,
    ["-I", "-u", "-c", WORKER_BOOTSTRAP + WORKER_SCRIPT, zipapp, resolve(ctx.dataDir), process.execPath],
    { cwd: ctx.dataDir, env, stdio: ["pipe", "pipe", "pipe"], windowsHide: true },
  );
  worker.proc = proc;
  proc.stdout.on("data", (chunk: Buffer) => {
    if (worker.client && !worker.client.destroyed) worker.client.write(chunk);
  });
  let stderrLines = 0;
  proc.stderr.setEncoding("utf8");
  proc.stderr.on("data", (chunk: string) => {
    // Les erreurs de l'ouvrier dans le journal, bornées : un script bavard n'inonde rien.
    if (stderrLines++ < 50) console.warn(`[plugin:${worker.pluginId}] ouvrier ${worker.id} : ${chunk.trim().slice(0, 500)}`);
  });
  proc.stdin.on("error", () => undefined);
  const dead = () => {
    if (worker.proc !== proc) return;
    worker.proc = null;
    // Le client apprend la mort par la fermeture de sa connexion : il se reconnecte, l'ouvrier est relancé.
    worker.client?.end();
    if (worker.stopped) return;
    const delay = worker.backoffMs;
    worker.backoffMs = Math.min(worker.backoffMs * 2, 60_000);
    worker.timer = setTimeout(() => {
      worker.timer = null;
      if (!worker.stopped) startProcess(worker, ctx);
    }, delay);
    worker.timer.unref();
  };
  proc.once("exit", dead);
  proc.once("error", (err) => {
    console.warn(`[plugin:${worker.pluginId}] ouvrier ${worker.id} : lancement impossible (${err.message})`);
    dead();
  });
  // Vivant une minute : la relance suivante repart d'une seconde.
  setTimeout(() => {
    if (worker.proc === proc) worker.backoffMs = 1_000;
  }, 60_000).unref();
}

function attach(worker: Worker, client: Socket, ctx: HostCallContext): void {
  worker.client?.destroy();
  worker.client = client;
  // yt-dlp mis à jour depuis : l'ouvrier repart sur la nouvelle copie.
  const zipapp = activeYtDlpZipapp();
  if (worker.proc && zipapp && zipapp !== worker.zipapp) worker.proc.kill();
  if (!worker.proc && !worker.timer) startProcess(worker, ctx);
  // Chaque ligne de l'invité passe par la porte du protocole : Python ne reçoit que des requêtes valides.
  let buffer = "";
  client.setEncoding("utf8");
  client.on("data", (chunk: string) => {
    buffer += chunk;
    if (buffer.length > MAX_REQUEST_LINE * 4) {
      client.destroy();
      return;
    }
    for (let nl = buffer.indexOf("\n"); nl >= 0; nl = buffer.indexOf("\n")) {
      const checked = checkWorkerLine(buffer.slice(0, nl), ctx.dataDir);
      buffer = buffer.slice(nl + 1);
      if (!checked) continue;
      if ("reply" in checked) client.write(`${JSON.stringify(checked.reply)}\n`);
      else if (worker.proc?.stdin.writable) worker.proc.stdin.write(`${checked.forward}\n`);
    }
  });
  client.on("error", () => undefined);
  client.on("close", () => {
    if (worker.client === client) worker.client = null;
  });
}

export async function spawnWorker(ctx: HostCallContext, tool: ToolName, name: string): Promise<{ workerId: string; socketPath: string }> {
  if (tool !== "yt-dlp") throw new HostCallFailure("invalid", "outil inconnu");
  if (!activeYtDlpZipapp()) throw new HostCallFailure("unavailable", "aucun zipapp yt-dlp en service sur ce serveur");
  const id = `${ctx.pluginId}-${name}`;
  const existing = workers.get(id);
  if (existing && !existing.stopped) return { workerId: id, socketPath: existing.socketPath };
  if ([...workers.values()].filter((w) => w.pluginId === ctx.pluginId).length >= MAX_WORKERS_PER_PLUGIN) {
    throw new HostCallFailure("unavailable", "trop d'ouvriers pour cette extension");
  }
  const socketPath = freshSocketPath(`w-${name}`);
  const server = createServer();
  const worker: Worker = {
    id, pluginId: ctx.pluginId, socketPath, server, proc: null, zipapp: "", client: null,
    backoffMs: 1_000, stopped: false, timer: null,
  };
  server.on("connection", (client) => attach(worker, client, ctx));
  await new Promise<void>((done, fail) => {
    server.once("error", fail);
    server.listen(socketPath, () => done());
  });
  workers.set(id, worker);
  startProcess(worker, ctx);
  return { workerId: id, socketPath };
}

export function stopWorker(pluginId: string, workerId: string): void {
  const worker = workers.get(workerId);
  if (!worker || worker.pluginId !== pluginId) throw new HostCallFailure("notFound", "ouvrier inconnu");
  shutdownWorker(worker);
}

function shutdownWorker(worker: Worker): void {
  worker.stopped = true;
  workers.delete(worker.id);
  if (worker.timer) clearTimeout(worker.timer);
  worker.client?.destroy();
  worker.proc?.kill();
  worker.server.close();
  removeSocket(worker.socketPath);
}

/** L'invité est parti (ou coupé) : ses ouvriers aussi. */
export function stopPluginWorkers(pluginId: string): void {
  for (const worker of [...workers.values()]) if (worker.pluginId === pluginId) shutdownWorker(worker);
}

/** Pour les tests et l'arrêt du serveur. */
export function stopAllWorkers(): void {
  for (const worker of [...workers.values()]) shutdownWorker(worker);
}
