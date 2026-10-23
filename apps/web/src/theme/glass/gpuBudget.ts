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
 * Scénarios du banc et ce que la physique a le droit d'y coûter.
 *
 * États TENUS (rien ne s'arrête tant que le geste dure) : écart de médiane, en
 * POINTS d'occupation du GPU d'Electron au-dessus de la référence de la passe :
 *  - au repos, pointeur posé : RIEN — aucune boucle ne tourne (0,5 de bruit) ;
 *  - reflet qui suit un pointeur en mouvement continu : une petite couche
 *    déplacée par image, et le flou de la surface recalculé dessous ;
 *  - mouvement réduit : la physique se tait.
 *
 * GESTES (appui, fusion) : le banc les répète sans relâche (`periodMs`) pour
 * mesurer un régime stable, mais personne n'appuie cinq fois par seconde. Le
 * verdict porte donc sur le temps GPU d'UN geste (écart × période) : 60 ms au
 * plus — ~1 ms par image sur les ~50 images d'un ressort à 120 Hz, moins de
 * 3 % en moyenne à un geste toutes les deux secondes.
 */
export const GPU_BUDGETS = {
  idle: { maxDelta: 0.5 },
  hoverStill: { maxDelta: 0.5 },
  pointerSweep: { maxDelta: 6 },
  sheenSweep: { maxDelta: 6 },
  pressPulse: { periodMs: 400, maxGestureMs: 60 },
  fusion: { periodMs: 700, maxGestureMs: 60 },
  reducedSweep: { maxDelta: 1 },
} as const satisfies Record<string, { maxDelta: number } | { periodMs: number; maxGestureMs: number }>;

export type GpuScenario = keyof typeof GPU_BUDGETS;

export interface GpuVerdict {
  scenario: GpuScenario;
  /** Écart de médiane, en points. */
  delta: number;
  /** Temps GPU d'un geste (ms), pour les scénarios de geste. */
  gestureMs?: number;
  /** Le seuil appliqué (points, ou ms par geste), et son unité. */
  limit: number;
  unit: "points" | "ms/geste";
  ok: boolean;
}

/** Verdict d'un scénario : passe physique allumée contre sa référence. */
export function judgeScenario(scenario: GpuScenario, measured: GpuSummary, reference: GpuSummary): GpuVerdict {
  const delta = r1(measured.median - reference.median);
  const budget: { maxDelta: number } | { periodMs: number; maxGestureMs: number } = GPU_BUDGETS[scenario];
  if ("periodMs" in budget) {
    const gestureMs = Math.round((Math.max(0, delta) / 100) * budget.periodMs);
    return { scenario, delta, gestureMs, limit: budget.maxGestureMs, unit: "ms/geste", ok: gestureMs <= budget.maxGestureMs };
  }
  return { scenario, delta, limit: budget.maxDelta, unit: "points", ok: delta <= budget.maxDelta };
}

/* ── Le budget de LENTILLES (lot lg5, décision de Damien du 23/10) ────────────
 *
 * Mesuré au banc de fluidité (`apps/desktop-electron/bench/liquid-glass/perf/`) :
 * une lentille (filtre SVG d'un `backdrop-filter`) coûte ~0,3 à 0,45 ms de
 * dessin GPU par image redessinée, QUELLE QUE SOIT sa taille et sa place — le
 * coût suit la fenêtre, pas le verre. Sur un dessous qui bouge (le héros
 * redessine toute la fenêtre trente fois par seconde), chaque lentille visible
 * se recalcule à chaque image : à 20 lentilles, une image sur deux est perdue.
 * Au-delà du budget, les verres les moins prioritaires restent du GIVRE (flou,
 * teinte, ombre) sans lentille ; sous le budget, rien ne change.
 */

/** Lentilles visibles en même temps, au plus (« 6 à 8 », décision du 23/10). */
export const LENS_BUDGET = 8;

/**
 * La priorité d'un verre pour sa lentille : une SURFACE (menu, popover,
 * feuille, barre latérale) d'abord, puis le CHROME de la fenêtre (la barre du
 * haut), puis les contrôles des pages.
 */
export type LensRank = "surface" | "chrome" | "control";

const RANK_WEIGHT: Record<LensRank, number> = { surface: 3, chrome: 2, control: 1 };

export interface LensCandidate {
  id: string;
  rank: LensRank;
  /** À l'écran : seuls les verres visibles comptent (hors champ, ils ne coûtent rien). */
  visible: boolean;
  /** Surface à l'écran, en points² : à rang égal, le plus grand verre garde sa lentille. */
  area: number;
  /** Ordre d'arrivée : à égalité, le premier venu garde la sienne (pas de bascule). */
  order: number;
}

/**
 * Les verres qui GARDENT leur lentille. Hors champ : gardée (rien n'est
 * dessiné, et un verre qui revient ne bascule pas tant que le budget tient).
 * À l'écran : les `budget` premiers par rang, puis surface, puis ancienneté.
 */
export function allocateLenses(candidates: readonly LensCandidate[], budget: number = LENS_BUDGET): Set<string> {
  const granted = new Set(candidates.filter((c) => !c.visible).map((c) => c.id));
  const visible = candidates
    .filter((c) => c.visible)
    .sort((a, b) => RANK_WEIGHT[b.rank] - RANK_WEIGHT[a.rank] || b.area - a.area || a.order - b.order);
  for (const c of visible.slice(0, Math.max(0, budget))) granted.add(c.id);
  return granted;
}
