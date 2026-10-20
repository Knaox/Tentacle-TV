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
    private hermes: HermesSession,
    private readonly state: BenchState,
    /** Le jeton de la session posée sur l'appareil : son identité d'appareil côté serveur. */
    private readonly token: string,
  ) {}

  private metroPort = 0;
  private deviceName = "";

  static async attach(state: BenchState, account: BenchAccount, label: string, metroPort: number, deviceName: string, token: string): Promise<IosClient> {
    const hermes = await HermesSession.connect(metroPort, deviceName);
    const client = new IosClient(label, account, hermes, state, token);
    client.metroPort = metroPort;
    client.deviceName = deviceName;
    return client;
  }

  /** La session Hermes, rouverte si l'app a été relancée ou Metro rechargé. */
  private async session(): Promise<HermesSession> {
    if (!this.hermes.closed) return this.hermes;
    const logs = this.hermes.console;
    this.hermes = await HermesSession.connect(this.metroPort, this.deviceName);
    this.hermes.console.push(...logs, `${Date.now()} [banc] session Hermes rouverte`);
    return this.hermes;
  }

  private async eval<T>(expression: string): Promise<T> {
    return (await this.session()).eval<T>(expression);
  }

  /**
   * La position : la dernière annonce BRUTE du moteur, extrapolée à l'heure de
   * la lecture si elle est fraîche — sinon la position du port. `portPos` garde
   * ce que croit le moteur de synchro, pour mesurer l'erreur de son estimation.
   */
  async sample(): Promise<PlayerSample & { portPos: number | null }> {
    const s = await this.eval<(Probe & { wallMs: number }) | null>(
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

  /** Navigation par le routeur d'expo-router (module trouvé par son nom) : aucun lien profond. */
  async navigate(path: string): Promise<void> {
    await this.eval(
      "var id = null; __r.getModules().forEach(function(v, k){ if (v && v.verboseName && /expo-router\\/build\\/imperative-api\\.js$/.test(v.verboseName)) id = k; });"
      + ` if (id === null) throw new Error("routeur introuvable"); __r(id).router.push(${JSON.stringify(path)}); return true;`,
    );
  }

  /**
   * Un élément de l'arbre React : par `testID` ou par texte affiché. `press`
   * remonte jusqu'au premier `onPress` et l'appelle — le geste de l'écran,
   * sans l'outil tactile du simulateur.
   */
  async find(what: { testID?: string; text?: string }, press = false): Promise<boolean> {
    const pred = what.testID
      ? `f.memoizedProps && f.memoizedProps.testID === ${JSON.stringify(what.testID)}`
      : `f.memoizedProps && typeof f.memoizedProps.children === "string" && f.memoizedProps.children.indexOf(${JSON.stringify(what.text ?? "")}) >= 0`;
    return this.eval<boolean>(
      "var hook = globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__; var hit = null;"
      + " hook.renderers.forEach(function(_, rid){ hook.getFiberRoots(rid).forEach(function(root){"
      + "   var stack = [root.current]; while (stack.length && !hit) { var f = stack.pop();"
      + `     if (${pred}) hit = f; if (f.sibling) stack.push(f.sibling); if (f.child) stack.push(f.child); } }); });`
      + " if (!hit) return false;"
      + (press
        ? " var g = hit; while (g && !(g.memoizedProps && typeof g.memoizedProps.onPress === 'function')) g = g.return;"
          + " if (!g) return false; g.memoizedProps.onPress(); return true;"
        : " return true;"),
    );
  }

  /** Geste au lecteur par la sonde : les mêmes chemins que les boutons du lecteur mobile. */
  async action(kind: "play" | "pause" | "seekBy", value?: number): Promise<void> {
    await this.eval(`globalThis.__wtBench.action(${JSON.stringify(kind)}, ${JSON.stringify(value ?? null)}); return true;`);
  }

  async setPlaying(playing: boolean): Promise<void> {
    const cur = await this.sample();
    if (cur.paused === !playing) return;
    await this.action(playing ? "play" : "pause");
  }

  /** Journaux `[WT …]` de l'app reçus par Hermes depuis la connexion. */
  get logs(): string[] {
    return this.hermes.console;
  }

  close(): void {
    this.hermes.close();
  }

  get webUrl(): string {
    return this.state.webUrl;
  }
}
