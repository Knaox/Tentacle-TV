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
  paused: boolean;
  rate: number;
  ready: boolean;
  route: string;
}

export class IosClient {
  private constructor(
    readonly label: string,
    readonly account: BenchAccount,
    private readonly hermes: HermesSession,
    private readonly state: BenchState,
  ) {}

  static async attach(state: BenchState, account: BenchAccount, label: string, metroPort: number, deviceName: string): Promise<IosClient> {
    const hermes = await HermesSession.connect(metroPort, deviceName);
    return new IosClient(label, account, hermes, state);
  }

  async sample(): Promise<PlayerSample> {
    const s = await this.hermes.eval<(Probe & { wallMs: number }) | null>(
      "var p = globalThis.__wtBench && globalThis.__wtBench.sample ? globalThis.__wtBench.sample() : null;"
      + " return p ? Object.assign({ wallMs: Date.now() }, p) : { wallMs: Date.now(), pos: null, paused: true, rate: 1, ready: false, route: '?' };",
    ).catch(() => null);
    if (!s) return { label: this.label, wallMs: Date.now(), pos: null, paused: true, rate: 1, readyState: 0, seeking: false, path: "?" };
    return {
      label: this.label, wallMs: s.wallMs, pos: s.pos, paused: s.paused, rate: s.rate,
      readyState: s.ready ? 4 : 0, seeking: false, path: s.route,
    };
  }

  /** Appel REST au nom de la session de l'app (son jeton, son appareil). */
  async api<T = unknown>(method: string, path: string, body?: unknown): Promise<{ status: number; json: T }> {
    const key = `__wtBenchApi${Date.now()}${Math.random().toString(36).slice(2)}`;
    await this.hermes.eval(
      `var b = globalThis.__wtBench; if (!b || !b.api) throw new Error("sonde sans api");`
      + ` b.api(${JSON.stringify(method)}, ${JSON.stringify(path)}, ${JSON.stringify(body ?? null)})`
      + `.then(function(r){ globalThis[${JSON.stringify(key)}] = r; }, function(e){ globalThis[${JSON.stringify(key)}] = { status: -1, json: String(e) }; });`
      + " return true;",
    );
    for (let i = 0; i < 100; i += 1) {
      const r = await this.hermes.eval<{ status: number; json: T } | null>(`return globalThis[${JSON.stringify(key)}] || null;`);
      if (r) return r;
      await new Promise((ok) => setTimeout(ok, 100));
    }
    throw new Error(`${this.label} : ${method} ${path} sans réponse`);
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
