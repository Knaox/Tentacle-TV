/**
 * Mesure de la dérive entre membres, sur l'heure murale COMMUNE du Mac.
 *
 * Chaque échantillon est lu dans la page (position + heure de la lecture) ;
 * on ramène toutes les positions à un même instant `t0` en extrapolant à la
 * vitesse du lecteur (zéro en pause). La dérive d'un membre est l'écart de sa
 * position ramenée à celle du membre de référence (le premier), en ms ; > 0 :
 * en avance.
 */

export interface Sample {
  label: string;
  wallMs: number;
  pos: number | null;
  paused: boolean;
  rate: number;
  readyState?: number;
}

export interface Sampler {
  label: string;
  sample(): Promise<Sample>;
}

export interface DriftPoint {
  at: number;
  /** label → dérive (ms) par rapport à la référence ; null si illisible. */
  drift: Record<string, number | null>;
  pos: Record<string, number | null>;
  paused: Record<string, boolean>;
}

const sleep = (ms: number): Promise<void> => new Promise((ok) => setTimeout(ok, ms));

export async function measureOnce(clients: Sampler[]): Promise<DriftPoint> {
  const samples = await Promise.all(clients.map((c) => c.sample()));
  const t0 = samples.reduce((s, x) => s + x.wallMs, 0) / samples.length;
  const at = (x: Sample): number | null =>
    x.pos === null ? null : x.pos + (x.paused ? 0 : ((t0 - x.wallMs) / 1000) * x.rate);
  const ref = at(samples[0]);
  const point: DriftPoint = { at: t0, drift: {}, pos: {}, paused: {} };
  for (const x of samples) {
    const p = at(x);
    point.pos[x.label] = p;
    point.paused[x.label] = x.paused;
    point.drift[x.label] = p === null || ref === null ? null : Math.round((p - ref) * 1000);
  }
  return point;
}

export interface DriftStats {
  n: number;
  /** Médiane, 95ᵉ centile et maximum de |dérive| (ms) du pire membre. */
  p50: number;
  p95: number;
  max: number;
  meanAbs: number;
}

export function stats(points: DriftPoint[], labels?: string[]): DriftStats {
  const values: number[] = [];
  for (const p of points) {
    const keys = labels ?? Object.keys(p.drift);
    const worst = Math.max(...keys.map((k) => Math.abs(p.drift[k] ?? Number.NaN)).filter((v) => Number.isFinite(v)));
    if (Number.isFinite(worst)) values.push(worst);
  }
  if (values.length === 0) return { n: 0, p50: Number.NaN, p95: Number.NaN, max: Number.NaN, meanAbs: Number.NaN };
  const sorted = [...values].sort((a, b) => a - b);
  const q = (f: number): number => sorted[Math.min(sorted.length - 1, Math.floor(f * sorted.length))];
  return {
    n: values.length,
    p50: q(0.5),
    p95: q(0.95),
    max: sorted[sorted.length - 1],
    meanAbs: Math.round(values.reduce((s, v) => s + v, 0) / values.length),
  };
}

/** Échantillonne pendant `durationMs`, toutes les `everyMs`. */
export async function measureWindow(clients: Sampler[], durationMs: number, everyMs = 250): Promise<DriftPoint[]> {
  const points: DriftPoint[] = [];
  const end = Date.now() + durationMs;
  while (Date.now() < end) {
    points.push(await measureOnce(clients));
    await sleep(everyMs);
  }
  return points;
}

/**
 * Attend que tous les membres soient alignés (|dérive| < `withinMs`) ET dans
 * l'état voulu (lecture ou pause), `stable` fois de suite. Rend le délai
 * (ms) depuis `since`, ou null à l'échéance, avec les points relevés.
 */
export async function waitAligned(
  clients: Sampler[],
  opts: { withinMs: number; playing: boolean; since: number; timeoutMs: number; stable?: number; everyMs?: number },
): Promise<{ ms: number | null; points: DriftPoint[] }> {
  const points: DriftPoint[] = [];
  const stable = opts.stable ?? 3;
  let streak = 0;
  let firstOk: number | null = null;
  while (Date.now() - opts.since < opts.timeoutMs) {
    const p = await measureOnce(clients);
    points.push(p);
    const ok = clients.every((c) => {
      const d = p.drift[c.label];
      return d !== null && Math.abs(d) < opts.withinMs && p.paused[c.label] === !opts.playing;
    });
    if (ok) {
      if (streak === 0) firstOk = p.at;
      streak += 1;
      if (streak >= stable) return { ms: Math.round((firstOk ?? p.at) - opts.since), points };
    } else {
      streak = 0;
    }
    await sleep(opts.everyMs ?? 100);
  }
  return { ms: null, points };
}

/** Attend qu'une condition tienne ; rend le délai, ou null à l'échéance. */
export async function waitFor(check: () => Promise<boolean> | boolean, timeoutMs: number, everyMs = 250): Promise<number | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await check()) return Date.now() - start;
    await sleep(everyMs);
  }
  return null;
}

export const fmt = (s: DriftStats): string =>
  s.n === 0 ? "—" : `p50 ${s.p50} ms · p95 ${s.p95} ms · max ${s.max} ms (n=${s.n})`;
