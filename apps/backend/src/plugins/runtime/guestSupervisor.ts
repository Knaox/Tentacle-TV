import type { ChildProcess } from "child_process";
import type { GuestToHost, HostEvent, HostToGuest, PluginRuntimeManifest } from "./pluginServerRuntime";
import { freshSocketPath, launchGuest, removeSocket, type GuestPaths } from "./guestLaunch";

/**
 * La vie d'UN invité : lancé, prêt (`ready` reçu), relancé s'il meurt — avec
 * un délai qui double (1 s → 60 s), remis à zéro après une minute de bonne
 * santé —, arrêté proprement (`shutdown`, puis SIGTERM, puis SIGKILL). Tant
 * qu'il n'est pas prêt, le relais répond 503 ; il ne fait jamais attendre une
 * requête au-delà de `READY_WAIT_MS`.
 */

export type GuestState = "starting" | "running" | "backoff" | "stopped";

export interface GuestCallHandler {
  (msg: Extract<GuestToHost, { t: "call" }>, reply: (msg: HostToGuest) => void): void;
}

export interface SupervisorOptions {
  pluginId: string;
  manifest: PluginRuntimeManifest;
  paths: Omit<GuestPaths, "socket">;
  locale: () => string;
  onCall: GuestCallHandler;
  /** Après chaque arrêt de l'invité (mort ou voulu) : les ouvriers d'outils s'arrêtent avec lui. */
  onExit?: () => void;
  launch?: typeof launchGuest;
  log?: (level: "info" | "warn" | "error", message: string) => void;
}

const BACKOFF_MIN_MS = 1_000;
const BACKOFF_MAX_MS = 60_000;
const HEALTHY_AFTER_MS = 60_000;
const READY_TIMEOUT_MS = 30_000;
const SHUTDOWN_GRACE_MS = 5_000;
const KILL_GRACE_MS = 2_000;
/** Au plus tant de lignes de journal par minute et par invité : un invité bavard n'inonde pas les journaux. */
const LOG_LINES_PER_MINUTE = 120;

export class GuestSupervisor {
  state: GuestState = "stopped";
  version: string | null = null;
  socket: string | null = null;
  lastError: string | null = null;
  restarts = 0;
  private child: ChildProcess | null = null;
  private wanted = false;
  private backoffMs = BACKOFF_MIN_MS;
  private timer: NodeJS.Timeout | null = null;
  private readyWaiters: ((ok: boolean) => void)[] = [];
  private readyAt = 0;
  private logWindow = { start: 0, count: 0 };

  constructor(private readonly opts: SupervisorOptions) {}

  get pluginId(): string {
    return this.opts.pluginId;
  }

  get manifest(): PluginRuntimeManifest {
    return this.opts.manifest;
  }

  start(): void {
    this.wanted = true;
    if (this.child || this.timer) return;
    this.spawn();
  }

  /** Prêt dans `timeoutMs`, ou `false` (arrêté, en relance, trop lent). */
  whenReady(timeoutMs: number): Promise<boolean> {
    if (this.state === "running") return Promise.resolve(true);
    if (!this.wanted) return Promise.resolve(false);
    return new Promise((done) => {
      const timer = setTimeout(() => {
        this.readyWaiters = this.readyWaiters.filter((w) => w !== settle);
        done(false);
      }, timeoutMs);
      const settle = (ok: boolean) => {
        clearTimeout(timer);
        done(ok);
      };
      this.readyWaiters.push(settle);
    });
  }

  send(msg: HostToGuest): boolean {
    if (!this.child?.connected) return false;
    this.child.send(msg);
    return true;
  }

  pushEvent(event: HostEvent): boolean {
    return this.state === "running" && this.send({ t: "event", event });
  }

  /** Arrêt voulu : plus aucune relance. Résolu quand le processus est parti. */
  async stop(reason: "disabled" | "restart" | "stop"): Promise<void> {
    this.wanted = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const child = this.child;
    this.settleReady(false);
    if (!child) {
      this.state = "stopped";
      return;
    }
    await new Promise<void>((done) => {
      if (child.exitCode !== null || child.signalCode !== null) return done();
      child.once("exit", () => done());
      this.send({ t: "shutdown", reason });
      const term = setTimeout(() => {
        child.kill("SIGTERM");
        setTimeout(() => child.kill("SIGKILL"), KILL_GRACE_MS).unref();
      }, SHUTDOWN_GRACE_MS);
      term.unref();
      child.once("exit", () => clearTimeout(term));
    });
    this.state = "stopped";
  }

  private spawn(): void {
    this.state = "starting";
    this.version = null;
    this.readyAt = 0;
    const socket = freshSocketPath(this.opts.pluginId);
    this.socket = socket;
    let child: ChildProcess;
    try {
      child = (this.opts.launch ?? launchGuest)(this.opts.pluginId, this.opts.manifest, { ...this.opts.paths, socket }, this.opts.locale());
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err);
      this.scheduleRestart();
      return;
    }
    this.child = child;
    const readyTimer = setTimeout(() => {
      if (this.state !== "starting" || this.child !== child) return;
      this.lastError = "pas de « ready » dans les temps";
      this.log("warn", this.lastError);
      child.kill("SIGKILL");
    }, READY_TIMEOUT_MS);
    readyTimer.unref();

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => this.logLines("info", chunk));
    child.stderr?.on("data", (chunk: string) => this.logLines("warn", chunk));
    child.on("message", (raw: unknown) => this.onMessage(child, raw));
    child.on("error", (err) => {
      this.lastError = err.message;
    });
    child.once("exit", (code, signal) => {
      clearTimeout(readyTimer);
      if (this.child !== child) return;
      this.child = null;
      removeSocket(socket);
      this.socket = null;
      this.opts.onExit?.();
      if (!this.wanted) {
        this.state = "stopped";
        return;
      }
      this.lastError = `parti (${signal ?? `code ${code}`})`;
      this.log("warn", `${this.lastError} — relance dans ${Math.round(this.backoffMs / 1000)} s`);
      this.settleReady(false);
      this.scheduleRestart();
    });
  }

  private scheduleRestart(): void {
    this.state = "backoff";
    this.restarts++;
    // Une bonne santé assez longue efface le passé : la relance suivante repart d'une seconde.
    if (this.readyAt && Date.now() - this.readyAt > HEALTHY_AFTER_MS) this.backoffMs = BACKOFF_MIN_MS;
    const delay = this.backoffMs;
    this.backoffMs = Math.min(this.backoffMs * 2, BACKOFF_MAX_MS);
    this.timer = setTimeout(() => {
      this.timer = null;
      if (this.wanted) this.spawn();
    }, delay);
    this.timer.unref();
  }

  private onMessage(child: ChildProcess, raw: unknown): void {
    if (this.child !== child || !raw || typeof raw !== "object") return;
    const msg = raw as Partial<GuestToHost> & { t?: unknown };
    if (msg.t === "ready") {
      this.version = typeof msg.version === "string" ? msg.version.slice(0, 32) : null;
      this.state = "running";
      this.readyAt = Date.now();
      this.lastError = null;
      this.log("info", `prêt (${this.version ?? "?"})`);
      this.settleReady(true);
    } else if (msg.t === "call" && typeof msg.id === "number") {
      this.opts.onCall(msg as Extract<GuestToHost, { t: "call" }>, (out) => {
        if (this.child === child) this.send(out);
      });
    } else if (msg.t === "log" && typeof msg.message === "string") {
      const level = msg.level === "error" || msg.level === "warn" ? msg.level : "info";
      this.logLines(level, msg.message);
    }
  }

  private settleReady(ok: boolean): void {
    const waiters = this.readyWaiters;
    this.readyWaiters = [];
    for (const w of waiters) w(ok);
  }

  private logLines(level: "info" | "warn" | "error", text: string): void {
    const now = Date.now();
    if (now - this.logWindow.start > 60_000) this.logWindow = { start: now, count: 0 };
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      if (++this.logWindow.count > LOG_LINES_PER_MINUTE) return;
      this.log(level, line.slice(0, 500));
    }
  }

  private log(level: "info" | "warn" | "error", message: string): void {
    const write = this.opts.log ?? ((l, m) => console[l === "info" ? "log" : l](m));
    write(level, `[plugin:${this.opts.pluginId}] ${message}`);
  }
}
