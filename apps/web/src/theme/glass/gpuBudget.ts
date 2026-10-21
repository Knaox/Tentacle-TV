/**
 * Budget GPU du verre — lecture des mesures et verdict, pur.
 *
 * Trois sources :
 *  - `ioreg -l -r -c AGXDeviceUserClient` : le temps GPU CUMULÉ de chaque
 *    processus (`accumulatedGPUTime`, ns), lisible SANS droits — la source du
 *    banc. Par processus : on isole Electron (rendu de la page) et
 *    WindowServer (composition des fenêtres, flou du verre natif compris) ;
 *  - `powermetrics --samplers gpu_power` : la référence de CLAUDE.md
 *    (« GPU HW active residency », tout le Mac), mais il exige sudo ;
 *  - `ioreg -r -c IOAccelerator` « Device Utilization % » : reste à 0 sur
 *    M4 / macOS 26 (relevé du 21/10) — gardé pour d'autres Mac, jamais seul.
 * Un verdict se lit en ÉCART à une référence prise dans la même passe (même
 * page, physique coupée), jamais en absolu d'une passe à l'autre.
 *
 * Utilisé par `apps/web/bench/glass-gpu/` (Node lit le TypeScript tel quel).
 */

export interface GpuSample {
  /** Occupation du GPU, en %. */
  busy: number;
  /** Puissance GPU en mW (powermetrics seulement). */
  powerMw?: number;
}

export interface GpuSummary {
  n: number;
  median: number;
  p90: number;
  mean: number;
  max: number;
}

/** Échantillons d'une sortie de powermetrics (un bloc « GPU » par intervalle). */
export function parsePowermetrics(text: string): GpuSample[] {
  const samples: GpuSample[] = [];
  for (const block of text.split(/\*{4}\s*GPU usage\s*\*{4}/i).slice(1)) {
    const busy = /GPU (?:HW )?active residency:\s*([\d.]+)%/i.exec(block);
    if (!busy) continue;
    const power = /GPU Power:\s*([\d.]+)\s*mW/i.exec(block);
    samples.push({ busy: parseFloat(busy[1]), ...(power ? { powerMw: parseFloat(power[1]) } : {}) });
  }
  return samples;
}

/**
 * « Device Utilization % » d'une sortie d'ioreg. Plusieurs accélérateurs
 * (eGPU, Intel + AMD) : le plus occupé fait foi — c'est lui qui chauffe.
 */
export function parseIoregUtilization(text: string): number | null {
  const values = [...text.matchAll(/"Device Utilization %"\s*=\s*(\d+)/g)].map((m) => Number(m[1]));
  return values.length === 0 ? null : Math.max(...values);
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Temps GPU cumulé par processus (ns), d'une sortie de
 * `ioreg -l -w0 -r -c AGXDeviceUserClient` : chaque client nomme son créateur
 * (« pid 395, WindowServer ») puis, s'il a déjà soumis du travail, ses
 * `AppUsage`. Un processus a plusieurs clients : on additionne.
 */
export function parseAgxGpuTime(text: string): Map<number, number> {
  const byPid = new Map<number, number>();
  let pid: number | null = null;
  for (const line of text.split("\n")) {
    const creator = /"IOUserClientCreator"\s*=\s*"pid (\d+),/.exec(line);
    if (creator) {
      pid = Number(creator[1]);
      continue;
    }
    if (pid === null || !line.includes('"AppUsage"')) continue;
    const total = [...line.matchAll(/"accumulatedGPUTime"=(\d+)/g)].reduce((sum, m) => sum + Number(m[1]), 0);
    byPid.set(pid, (byPid.get(pid) ?? 0) + total);
  }
  return byPid;
}

/** Part du temps (%) où le GPU a travaillé pour `pids` entre deux relevés. */
export function gpuBusyPercent(
  before: Map<number, number>,
  after: Map<number, number>,
  pids: Iterable<number>,
  wallMs: number,
): number {
  if (wallMs <= 0) return 0;
  let ns = 0;
  for (const pid of pids) ns += Math.max(0, (after.get(pid) ?? 0) - (before.get(pid) ?? 0));
  return r1((ns / 1e6 / wallMs) * 100);
}

const quantile = (sorted: number[], q: number): number => {
  if (sorted.length === 0) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
};

export function summarize(values: number[]): GpuSummary {
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.length === 0 ? NaN : values.reduce((s, v) => s + v, 0) / values.length;
  return {
    n: values.length,
    median: r1(quantile(sorted, 0.5)),
    p90: r1(quantile(sorted, 0.9)),
    mean: r1(mean),
    max: sorted.length === 0 ? NaN : sorted[sorted.length - 1],
  };
}

/**
 * Scénarios du banc et ce que la physique a le droit d'y coûter, en POINTS
 * d'occupation au-dessus de la référence de la même passe (médiane) :
 *  - au repos, pointeur posé : RIEN — aucune boucle ne tourne (0,5 de bruit) ;
 *  - reflet qui suit un pointeur en mouvement continu : une recomposition par
 *    image d'une petite couche, pas plus que ce que coûte déjà le flou ;
 *  - appuis répétés (lentille) et fusion : des transitions courtes ;
 *  - mouvement réduit : la physique se tait, retour au repos.
 */
export const GPU_BUDGETS = {
  idle: { maxDelta: 0.5 },
  hoverStill: { maxDelta: 0.5 },
  pointerSweep: { maxDelta: 6 },
  pressPulse: { maxDelta: 6 },
  fusion: { maxDelta: 6 },
  reducedSweep: { maxDelta: 1 },
} as const satisfies Record<string, { maxDelta: number }>;

export type GpuScenario = keyof typeof GPU_BUDGETS;

export interface GpuVerdict {
  scenario: GpuScenario;
  delta: number;
  maxDelta: number;
  ok: boolean;
}

/** Écart de médiane entre la passe physique allumée et sa référence. */
export function judgeScenario(scenario: GpuScenario, measured: GpuSummary, reference: GpuSummary): GpuVerdict {
  const delta = r1(measured.median - reference.median);
  const { maxDelta } = GPU_BUDGETS[scenario];
  return { scenario, delta, maxDelta, ok: delta <= maxDelta };
}
