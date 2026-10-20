/**
 * Le contexte d'un scénario : le navigateur, les membres ouverts, les
 * vérifications et les mesures consignées. Un scénario ne lève pas pour un
 * défaut constaté : il le CONSIGNE (`check`) et continue, pour qu'un passage
 * donne tout le tableau d'un coup.
 */

import { appendFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Browser } from "playwright-core";
import { RUN_DIR, readState, type BenchAccount, type BenchState } from "../env";
import { WebClient, type WebClientOptions } from "../clients/webClient";
import { fmt, stats, type DriftPoint } from "../measure";

export interface CheckResult {
  name: string;
  ok: boolean;
  detail?: string;
}

export interface Metric {
  name: string;
  value: string;
  /** Valeur brute (ms) pour le rapport ; absente si non chiffrable. */
  ms?: number | null;
  target?: string;
}

export interface ScenarioResult {
  id: string;
  title: string;
  startedAt: string;
  durationS: number;
  checks: CheckResult[];
  metrics: Metric[];
  error?: string;
}

export class ScenarioContext {
  readonly checks: CheckResult[] = [];
  readonly metrics: Metric[] = [];
  readonly clients: WebClient[] = [];
  readonly state: BenchState;
  readonly outDir: string;

  constructor(readonly id: string, readonly browser: Browser) {
    this.state = readState();
    this.outDir = join(RUN_DIR, "out", id);
    // Un passage = un dossier propre : les journaux d'un passage d'avant ne s'y mêlent pas.
    rmSync(this.outDir, { recursive: true, force: true });
    mkdirSync(this.outDir, { recursive: true });
  }

  log(line: string): void {
    const text = `[${this.id}] ${line}`;
    console.log(text);
    appendFileSync(join(this.outDir, "log.txt"), `${new Date().toISOString()} ${line}\n`);
  }

  check(name: string, ok: boolean, detail?: string): boolean {
    this.checks.push({ name, ok, detail });
    this.log(`${ok ? "✔" : "✘"} ${name}${detail ? ` — ${detail}` : ""}`);
    return ok;
  }

  metric(name: string, value: string, ms?: number | null, target?: string): void {
    this.metrics.push({ name, value, ms, target });
    this.log(`◆ ${name} : ${value}${target ? ` (cible ${target})` : ""}`);
  }

  /**
   * Une fenêtre de régime : |dérive| du pire membre (p50, p95, max), plus le
   * BIAIS de chacun (médiane signée, > 0 en avance) — un biais constant n'est
   * pas du bruit : la boucle le croit corrigé. Les points sont gardés.
   */
  drift(name: string, points: DriftPoint[], target = "< 100 ms"): void {
    const s = stats(points);
    const labels = points.length ? Object.keys(points[0].drift).slice(1) : [];
    const bias = labels.map((l) => {
      const v = points.map((p) => p.drift[l]).filter((x): x is number => x !== null).sort((x, y) => x - y);
      return v.length ? `${l} ${v[Math.floor(v.length / 2)] > 0 ? "+" : ""}${v[Math.floor(v.length / 2)]}` : `${l} —`;
    });
    this.metric(name, `${fmt(s)} · biais ${bias.join(", ")} ms`, s.p95, target);
    const slug = name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    writeFileSync(join(this.outDir, `points-${slug}.json`), JSON.stringify(points));
  }

  async member(account: BenchAccount, label: string, opts: WebClientOptions = {}): Promise<WebClient> {
    const client = await WebClient.open(this.browser, this.state, account, label, opts);
    this.clients.push(client);
    await client.login();
    return client;
  }

  /** Captures et journaux de chaque membre, pour comprendre un échec après coup. */
  async dump(tag: string): Promise<void> {
    for (const c of this.clients) {
      await c.screenshot(join(this.outDir, `${tag}-${c.label}.png`));
      appendFileSync(join(this.outDir, `frames-${c.label}.jsonl`), c.frames.map((f) => JSON.stringify(f)).join("\n") + "\n");
      appendFileSync(join(this.outDir, `console-${c.label}.txt`), c.console.join("\n") + "\n");
      c.frames.length = 0;
      c.console.length = 0;
    }
  }

  /**
   * Fin de scénario : chaque appareil QUITTE sa salle avant de fermer — sinon,
   * adhésion par appareil oblige, l'appareil fermé tient le compte dans la
   * salle le temps de sa grâce (120 s) et le scénario suivant ne peut plus
   * créer de groupe pour ce compte.
   */
  async close(): Promise<void> {
    await this.dump("fin");
    await this.release(...this.clients);
  }

  /** Fait quitter puis ferme ces membres (au milieu d'un scénario aussi). */
  async release(...clients: WebClient[]): Promise<void> {
    for (const c of [...clients]) {
      for (let i = 0; i < 4; i += 1) {
        const g = await c.api<unknown>("GET", "/api/watch-together/group").catch(() => null);
        if (!g?.json) break;
        await c.api("POST", "/api/watch-together/group/leave").catch(() => null);
      }
      await c.close();
      const at = this.clients.indexOf(c);
      if (at >= 0) this.clients.splice(at, 1);
    }
  }
}

export async function launchBrowser(): Promise<Browser> {
  return chromium.launch({
    headless: true,
    channel: process.env.E2E_CHROME ? undefined : "chrome",
    executablePath: process.env.E2E_CHROME,
    args: [
      "--autoplay-policy=no-user-gesture-required",
      // Un onglet en arrière-plan garde ses minuteries : le scénario « arrière-plan »
      // le règle lui-même, membre par membre.
      "--disable-renderer-backgrounding",
      "--mute-audio",
      // Sortie audio FACTICE : l'horloge média de Chrome suit la sortie audio, et
      // capot fermé (la nuit) celle du Mac ne consomme plus — la vidéo calait,
      // puis avançait par sauts de ~1,8 s (mesuré le 20/10 : lecteur seul figé à
      // 40,000 s ; avec ce drapeau, 0 échantillon figé sur 40).
      "--disable-audio-output",
      ...(process.env.WT_CHROME_ARGS ? process.env.WT_CHROME_ARGS.split(" ") : []),
    ],
  });
}
