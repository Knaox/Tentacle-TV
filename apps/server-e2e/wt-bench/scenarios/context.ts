/**
 * Le contexte d'un scénario : le navigateur, les membres ouverts, les
 * vérifications et les mesures consignées. Un scénario ne lève pas pour un
 * défaut constaté : il le CONSIGNE (`check`) et continue, pour qu'un passage
 * donne tout le tableau d'un coup.
 */

import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Browser } from "playwright-core";
import { RUN_DIR, readState, type BenchAccount, type BenchState } from "../env";
import { WebClient, type WebClientOptions } from "../clients/webClient";
import { fmt, type DriftStats } from "../measure";

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

  drift(name: string, s: DriftStats, target = "< 100 ms"): void {
    this.metric(name, fmt(s), s.p95, target);
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

  async close(): Promise<void> {
    await this.dump("fin");
    for (const c of this.clients) await c.close();
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
    ],
  });
}
