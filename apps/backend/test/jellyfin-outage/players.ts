/**
 * Les lecteurs du banc : des clients `/api/ws` qui parlent le canal de
 * session comme les applications (authentification par message, comme le
 * bureau, le mobile et la TV ; `session:hello` ; un battement de position ;
 * au retour de Jellyfin, la relance avec un NOUVEAU PlaySessionId, comme
 * `restartStream`), et qui notent chaque message reçu, horodaté.
 */

import WebSocket from "ws";
import type { JellyfinHealthState, PlaybackStateDto } from "../../src/services/deviceSessions/protocolMessages";

const TICKS_PER_SECOND = 10_000_000;
export const TICK_MS = 2_000;

export interface Received {
  at: number;
  msg: { type: string; state?: JellyfinHealthState; since?: number; [key: string]: unknown };
}

export class FakePlayer {
  readonly received: Received[] = [];
  private ws: WebSocket | null = null;
  private ticker: ReturnType<typeof setInterval> | null = null;
  private session = 0;
  private position = 0;
  private lastTickAt = 0;
  /** Relancé au retour de Jellyfin : vrai pour un lecteur qui suit la règle des clients. */
  reloadOnRecovery = true;
  readonly reloads: Array<{ at: number; playSessionId: string; positionTicks: number }> = [];

  constructor(readonly name: string, readonly token: string, private readonly backendUrl: string, readonly itemId: string) {}

  get playSessionId(): string {
    return `${this.name}-ps${this.session}`;
  }

  async connect(): Promise<void> {
    // Seuls comptent les messages de CETTE connexion (une reconnexion garde le journal).
    const since = Date.now();
    const ws = new WebSocket(`${this.backendUrl.replace(/^http/, "ws")}/api/ws`);
    this.ws = ws;
    ws.on("message", (raw) => this.onMessage(JSON.parse(String(raw)) as Received["msg"]));
    await new Promise<void>((ok, ko) => {
      ws.once("open", () => ok());
      ws.once("error", ko);
    });
    ws.send(JSON.stringify({ type: "auth", token: this.token }));
    await this.waitFor((m) => m.type === "auth_ok" || m.type === "auth_error", 10_000, "auth_ok", since);
    if (this.received.some((r) => r.at >= since && r.msg.type === "auth_error")) throw new Error(`${this.name} : authentification refusée`);
    ws.send(JSON.stringify({ type: "session:hello", version: 1, deviceId: `banc-${this.name}` }));
    await this.waitFor((m) => m.type === "session:ready", 10_000, "session:ready", since);
    // L'état de Jellyfin suit session:ready dans la même salve.
    await this.waitFor((m) => m.type === "server:jellyfin", 2_000, "server:jellyfin", since).catch(() => undefined);
  }

  /** Une lecture commence (lecture directe), puis un battement toutes les TICK_MS. */
  play(playMethod: PlaybackStateDto["playMethod"] = "DirectPlay"): void {
    this.session += 1;
    this.position = 600 * TICKS_PER_SECOND;
    this.lastTickAt = Date.now();
    this.send({ type: "playback:start", state: this.state(playMethod) });
    this.ticker = setInterval(() => this.send({ type: "playback:progress", event: "tick", state: this.state(playMethod) }), TICK_MS);
  }

  close(): void {
    if (this.ticker) clearInterval(this.ticker);
    this.ws?.close();
  }

  /** Les états de Jellyfin reçus, dans l'ordre. */
  jellyfinStates(since = 0): Array<{ at: number; state: JellyfinHealthState }> {
    return this.received
      .filter((r) => r.at >= since && r.msg.type === "server:jellyfin")
      .map((r) => ({ at: r.at, state: r.msg.state as JellyfinHealthState }));
  }

  /** Attend un message ; rend son heure d'arrivée. */
  async waitFor(match: (m: Received["msg"]) => boolean, timeoutMs: number, what: string, since = 0): Promise<number> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const found = this.received.find((r) => r.at >= since && match(r.msg));
      if (found) return found.at;
      if (Date.now() > deadline) throw new Error(`${this.name} : pas de ${what} en ${timeoutMs} ms`);
      await new Promise((ok) => setTimeout(ok, 20));
    }
  }

  private state(playMethod: PlaybackStateDto["playMethod"]): PlaybackStateDto {
    const now = Date.now();
    this.position += (now - this.lastTickAt) * 10_000;
    this.lastTickAt = now;
    return {
      itemId: this.itemId,
      mediaSourceId: this.itemId,
      playSessionId: this.playSessionId,
      playMethod,
      positionTicks: this.position,
      isPaused: false,
      audioStreamIndex: 2,
      subtitleStreamIndex: 3,
    };
  }

  private onMessage(msg: Received["msg"]): void {
    const previous = this.received.filter((r) => r.msg.type === "server:jellyfin").at(-1)?.msg.state;
    this.received.push({ at: Date.now(), msg });
    // La règle des clients (`outageView`) : au retour, le flux se rouvre à la
    // même position, mêmes pistes, nouvelle session — le battement suivant la porte.
    if (msg.type === "server:jellyfin" && msg.state === "up" && previous !== undefined && previous !== "up" && this.ticker && this.reloadOnRecovery) {
      this.session += 1;
      const state = this.state("DirectPlay");
      this.reloads.push({ at: Date.now(), playSessionId: state.playSessionId ?? "", positionTicks: state.positionTicks });
      this.send({ type: "playback:progress", event: "tick", state });
    }
  }

  private send(msg: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }
}
