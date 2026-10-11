/**
 * La vie du serveur vue de l'hôte : lancer, relancer, arrêter, et dire l'état.
 *
 * Le rôle de tini et de `restart: unless-stopped` dans l'image. Chaque
 * lancement est un `ServerProcess` ; la décision après une sortie est celle de
 * `RestartPolicy` (protocole du fil A, § 4). L'état se publie à l'icône par
 * `onState`, à chaque changement.
 */
import { SERVER_EXIT_CODES, SHUTDOWN_TIMINGS, type ServerToHostMessage, type ShutdownReason } from "../protocol";
import type { HostServeResult } from "../host/hostServices";
import { RestartPolicy, type BlockedCause } from "./restartPolicy";
import { ServerProcess, type ExitInfo, type LaunchSpec, type ProcessJob } from "./serverProcess";

export type ServerState =
  | { kind: "starting" }
  | { kind: "running"; port: number; version: string; appState: string | null }
  | { kind: "stopped" }
  | { kind: "blocked"; cause: BlockedCause };

export interface SupervisorOptions {
  /** Relu à chaque lancement : le port a pu changer. */
  spec: () => LaunchSpec;
  job: ProcessJob;
  log: (line: string) => void;
  output: (chunk: string) => void;
  onState: (state: ServerState) => void;
  /** Les gestes demandés par le serveur ; sans eux, `unknown_method`. */
  serve?: (method: string, params: unknown) => Promise<HostServeResult>;
  /** Un serveur qui tient sans planter ce temps-là efface l'ardoise des plantages. */
  stableAfterMs?: number;
}

/** Un serveur d'avant le protocole ne s'arrête pas proprement : inutile d'attendre 10 s. */
const LEGACY_GRACE_MS = 2_000;

export class Supervisor {
  private current: ServerProcess | null = null;
  private stopping = false;
  private restartTimer: NodeJS.Timeout | null = null;
  private stableTimer: NodeJS.Timeout | null = null;
  private readonly policy = new RestartPolicy();
  private state: ServerState = { kind: "stopped" };

  constructor(private readonly options: SupervisorOptions) {}

  get serverState(): ServerState {
    return this.state;
  }

  get process(): ServerProcess | null {
    return this.current;
  }

  /** Lance le serveur s'il ne tourne pas (premier démarrage, « Redémarrer le serveur »). */
  start(): void {
    this.clearRestart();
    if (this.current?.alive) return;
    this.stopping = false;
    const spec = this.options.spec();
    this.setState({ kind: "starting" });
    this.options.log(`lancement du serveur (port ${spec.port})`);
    const launched = new ServerProcess(spec, this.options.job, {
      onOutput: this.options.output,
      onMessage: (message) => this.onMessage(message, spec.port),
      onReadyByHealth: () => this.onRunning(spec.port, "", null),
      onExit: (info) => this.onExit(launched, info),
      onRequest: (method, params) => this.options.serve?.(method, params) ?? Promise.resolve({ ok: false, error: "unknown_method" }),
    });
    this.current = launched;
    launched.start();
  }

  /** Arrêt propre ; rend quand le serveur est sorti. Rien ne relance ensuite. */
  async stop(reason: ShutdownReason): Promise<void> {
    this.stopping = true;
    this.clearRestart();
    const running = this.current;
    if (running === null || !running.alive) {
      this.setState({ kind: "stopped" });
      return;
    }
    this.options.log(`arrêt du serveur (${reason})`);
    const grace = running.speaksProtocol ? SHUTDOWN_TIMINGS.hostGraceMs : LEGACY_GRACE_MS;
    await running.stop(reason, grace);
  }

  async restart(reason: ShutdownReason): Promise<void> {
    await this.stop(reason);
    this.policy.reset();
    this.start();
  }

  private onMessage(message: ServerToHostMessage, port: number): void {
    switch (message.type) {
      case "tentacle:ready":
        this.onRunning(message.port || port, message.version, message.appState || null);
        return;
      case "tentacle:startup-failed":
        this.options.log(`démarrage impossible : ${message.reason}${message.detail ? ` (${message.detail})` : ""}`);
        return;
      case "tentacle:restarting":
        this.options.log(`redémarrage demandé par le serveur : ${message.detail}`);
        return;
      default:
        return;
    }
  }

  private onRunning(port: number, version: string, appState: string | null): void {
    this.setState({ kind: "running", port, version, appState });
    if (this.stableTimer !== null) clearTimeout(this.stableTimer);
    this.stableTimer = setTimeout(() => this.policy.reset(), this.options.stableAfterMs ?? 5 * 60_000);
  }

  private onExit(launched: ServerProcess, info: ExitInfo): void {
    if (this.current !== launched) return;
    if (this.stableTimer !== null) clearTimeout(this.stableTimer);
    this.options.log(`le serveur est sorti (code ${info.code ?? "tué"})`);
    const decision = this.policy.decide({
      code: info.code,
      requestedByHost: this.stopping,
      startupFailure: info.startupFailure,
    });
    switch (decision.action) {
      case "stopped":
        this.setState({ kind: "stopped" });
        return;
      case "blocked":
        this.options.log(`relance suspendue : ${decision.cause}`);
        this.setState({ kind: "blocked", cause: decision.cause });
        return;
      case "restart":
        if (info.code !== SERVER_EXIT_CODES.RESTART) this.options.log(`relance dans ${decision.delayMs} ms`);
        this.setState({ kind: "starting" });
        this.restartTimer = setTimeout(() => this.start(), decision.delayMs);
        return;
    }
  }

  private clearRestart(): void {
    if (this.restartTimer !== null) clearTimeout(this.restartTimer);
    this.restartTimer = null;
  }

  private setState(state: ServerState): void {
    this.state = state;
    this.options.onState(state);
  }
}
