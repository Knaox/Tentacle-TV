/**
 * Un membre iOS du banc : l'app mobile au simulateur (iPhone ou iPad), lue
 * par Hermes. Le simulateur partage l'horloge du Mac : `Date.now()` lu dans
 * Hermes est l'heure murale commune, comme `performance.timeOrigin` côté web.
 *
 * La position vient de la sonde de développement de l'app
 * (`globalThis.__wtBench`, posée en __DEV__ par le transport Watch Together
 * du mobile) : `{ pos, paused, rate, ready, route }`. Sans sonde, le banc le
 * dit — il ne devine pas une position.
 */

import { HermesSession } from "./hermes";
import type { BenchAccount, BenchState } from "../env";
import type { PlayerSample } from "./webClient";

interface Probe {
  pos: number | null;
  raw: { pos: number | null; atMs: number };
  paused: boolean;
  rate: number;
  ready: boolean;
  route: string;
}

/** Au-delà, la dernière annonce du moteur est trop vieille pour faire foi. */
const RAW_FRESH_MS = 1_000;

export class IosClient {
  private constructor(
    readonly label: string,
    readonly account: BenchAccount,
    private readonly hermes: HermesSession,
    private readonly state: BenchState,
    /** Le jeton de la session posée sur l'appareil : son identité d'appareil côté serveur. */
    private readonly token: string,
  ) {}

  static async attach(state: BenchState, account: BenchAccount, label: string, metroPort: number, deviceName: string, token: string): Promise<IosClient> {
    const hermes = await HermesSession.connect(metroPort, deviceName);
    return new IosClient(label, account, hermes, state, token);
  }

  /**
   * La position : la dernière annonce BRUTE du moteur, extrapolée à l'heure de
   * la lecture si elle est fraîche — sinon la position du port. `portPos` garde
   * ce que croit le moteur de synchro, pour mesurer l'erreur de son estimation.
   */
  async sample(): Promise<PlayerSample & { portPos: number | null }> {
    const s = await this.hermes.eval<(Probe & { wallMs: number }) | null>(
      "var b = globalThis.__wtBench; var p = b && b.sample ? b.sample() : null;"
      + " return p ? Object.assign({ wallMs: Date.now() }, p) : null;",
    ).catch(() => null);
    if (!s) return { label: this.label, wallMs: Date.now(), pos: null, portPos: null, paused: true, rate: 1, readyState: 0, seeking: false, path: "?" };
    const fresh = s.raw.pos !== null && s.wallMs - s.raw.atMs < RAW_FRESH_MS;
    const rawPos = fresh ? s.raw.pos! + (s.paused ? 0 : ((s.wallMs - s.raw.atMs) / 1000) * s.rate) : null;
    return {
      label: this.label, wallMs: s.wallMs, pos: rawPos ?? s.pos, portPos: s.pos, paused: s.paused, rate: s.rate,
      readyState: s.ready ? 4 : 0, seeking: false, path: s.route,
    };
  }

  /** Appel REST avec le jeton de l'appareil — le serveur y voit CET appareil. */
  async api<T = unknown>(method: string, path: string, body?: unknown): Promise<{ status: number; json: T }> {
    const res = await fetch(`${this.state.backendUrl}${path}`, {
      method,
      headers: { Authorization: `Bearer ${this.token}`, ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json: unknown;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = text;
    }
    return { status: res.status, json: json as T };
  }

  /** Geste au lecteur par la sonde : les mêmes chemins que les boutons du lecteur mobile. */
  async action(kind: "play" | "pause" | "seekBy", value?: number): Promise<void> {
    await this.hermes.eval(`globalThis.__wtBench.action(${JSON.stringify(kind)}, ${JSON.stringify(value ?? null)}); return true;`);
  }

  async setPlaying(playing: boolean): Promise<void> {
    const cur = await this.sample();
    if (cur.paused === !playing) return;
    await this.action(playing ? "play" : "pause");
  }

  close(): void {
    this.hermes.close();
  }

  get webUrl(): string {
    return this.state.webUrl;
  }
}
