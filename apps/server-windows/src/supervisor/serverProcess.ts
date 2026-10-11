/**
 * UN lancement du serveur : le processus, son canal IPC, sa sortie.
 *
 * Lancé comme le dit le protocole du fil A, § 1 : le même Node que l'hôte
 * (`process.execPath`, un vrai Node — `fork` et yt-dlp s'en servent), `cwd`
 * au `WORKDIR` de l'image, l'environnement en liste blanche, stdout et stderr
 * vers les journaux, le canal IPC en JSON. Placé aussitôt dans l'objet Job.
 *
 * La relance, l'état et la politique vivent dans `supervisor.ts`.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { request as httpRequest } from "node:http";
import { randomUUID } from "node:crypto";
import {
  HOST_PROTOCOL_VERSION,
  parseServerMessage,
  type HostToServerMessage,
  type ServerToHostMessage,
  type ShutdownReason,
  type StartupFailure,
} from "../protocol";
import type { HostServeResult } from "../host/hostServices";

export interface LaunchSpec {
  execPath: string;
  entry: string;
  cwd: string;
  env: Record<string, string>;
  port: number;
  hostVersion: string;
  /** Les méthodes que l'hôte sert au serveur (`HOST_METHODS`), annoncées dans `host-hello`. */
  hostMethods: readonly string[];
}

export interface ProcessJob {
  assign(pid: number): void;
  terminate(): void;
}

export interface ExitInfo {
  code: number | null;
  startupFailure: StartupFailure | null;
}

export interface ProcessCallbacks {
  onOutput(chunk: string): void;
  onMessage(message: ServerToHostMessage): void;
  onReadyByHealth(): void;
  onExit(info: ExitInfo): void;
  /** Un geste demandé par le serveur (`tentacle:request`) ; la réponse repart au même `id`. */
  onRequest(method: string, params: unknown): Promise<HostServeResult>;
}

/** Sans `tentacle:ready` (serveur d'avant le protocole), on sonde `/api/health`. */
const HEALTH_INTERVAL_MS = 500;

function probeHealth(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = httpRequest({ host: "127.0.0.1", port, path: "/api/health", timeout: 2000 }, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => req.destroy());
    req.end();
  });
}

export class ServerProcess {
  private child: ChildProcess | null = null;
  private exited = false;
  private failure: StartupFailure | null = null;
  private healthTimer: NodeJS.Timeout | null = null;
  private readonly exitWaiters: (() => void)[] = [];
  private readonly pending = new Map<string, (message: ServerToHostMessage) => void>();
  /** Le serveur a parlé le protocole : il saura s'arrêter proprement. */
  speaksProtocol = false;

  constructor(
    private readonly spec: LaunchSpec,
    private readonly job: ProcessJob,
    private readonly callbacks: ProcessCallbacks,
  ) {}

  start(): void {
    const child = spawn(this.spec.execPath, [this.spec.entry], {
      cwd: this.spec.cwd,
      env: this.spec.env,
      stdio: ["ignore", "pipe", "pipe", "ipc"],
      serialization: "json",
      windowsHide: true,
    });
    this.child = child;
    if (child.pid !== undefined) this.job.assign(child.pid);
    child.stdout?.setEncoding("utf8").on("data", (chunk: string) => this.callbacks.onOutput(chunk));
    child.stderr?.setEncoding("utf8").on("data", (chunk: string) => this.callbacks.onOutput(chunk));
    child.on("message", (raw: unknown) => this.receive(raw));
    child.on("error", (error) => this.callbacks.onOutput(`[hôte] lancement impossible : ${error.message}\n`));
    child.on("exit", (code) => this.finish(code));
    this.send({
      type: "tentacle:host-hello",
      protocol: HOST_PROTOCOL_VERSION,
      hostVersion: this.spec.hostVersion,
      methods: [...this.spec.hostMethods],
    });
    this.watchHealth();
  }

  get pid(): number | null {
    return this.child?.pid ?? null;
  }

  get alive(): boolean {
    return this.child !== null && !this.exited;
  }

  /** Arrêt propre, puis fin de l'objet Job passé le délai. Rend quand le processus est sorti. */
  async stop(reason: ShutdownReason, graceMs: number): Promise<void> {
    if (!this.alive) return;
    this.send({ type: "tentacle:shutdown", reason });
    const exited = await this.waitExit(graceMs);
    if (!exited) {
      this.job.terminate();
      await this.waitExit(5_000);
    }
  }

  /** Une question au serveur (`status`…) ; `null` sur délai ou refus. */
  request(method: string, params: unknown, timeoutMs: number): Promise<ServerToHostMessage | null> {
    const id = randomUUID();
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        resolve(null);
      }, timeoutMs);
      this.pending.set(id, (message) => {
        clearTimeout(timer);
        resolve(message);
      });
      const sent = this.send(params === undefined ? { type: "tentacle:request", id, method } : { type: "tentacle:request", id, method, params });
      if (!sent) {
        clearTimeout(timer);
        this.pending.delete(id);
        resolve(null);
      }
    });
  }

  waitExit(timeoutMs: number): Promise<boolean> {
    if (!this.alive) return Promise.resolve(true);
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), timeoutMs);
      this.exitWaiters.push(() => {
        clearTimeout(timer);
        resolve(true);
      });
    });
  }

  private send(message: HostToServerMessage): boolean {
    const child = this.child;
    if (child === null || this.exited || !child.connected) return false;
    try {
      child.send(message);
      return true;
    } catch {
      return false;
    }
  }

  private receive(raw: unknown): void {
    const message = parseServerMessage(raw);
    if (message === null) return;
    this.speaksProtocol = true;
    if (message.type === "tentacle:ready") this.stopHealth();
    if (message.type === "tentacle:startup-failed") this.failure = message.reason;
    if (message.type === "tentacle:response") {
      this.pending.get(message.id)?.(message);
      this.pending.delete(message.id);
      return;
    }
    if (message.type === "tentacle:request") {
      const { id } = message;
      void this.callbacks.onRequest(message.method, message.params).then((answer) => {
        this.send(answer.ok ? { type: "tentacle:response", id, ok: true, result: answer.result } : { type: "tentacle:response", id, ok: false, error: answer.error });
      });
      return;
    }
    this.callbacks.onMessage(message);
  }

  private watchHealth(): void {
    const tick = async (): Promise<void> => {
      if (!this.alive || this.speaksProtocol) return;
      if (await probeHealth(this.spec.port)) {
        if (this.alive && !this.speaksProtocol) this.callbacks.onReadyByHealth();
        return;
      }
      if (this.alive && !this.speaksProtocol) this.healthTimer = setTimeout(() => void tick(), HEALTH_INTERVAL_MS);
    };
    this.healthTimer = setTimeout(() => void tick(), HEALTH_INTERVAL_MS);
  }

  private stopHealth(): void {
    if (this.healthTimer !== null) clearTimeout(this.healthTimer);
    this.healthTimer = null;
  }

  private finish(code: number | null): void {
    this.exited = true;
    this.stopHealth();
    for (const resolve of this.exitWaiters.splice(0)) resolve();
    this.callbacks.onExit({ code, startupFailure: this.failure });
  }
}
