/**
 * Ce que disent les chiffres — lectures pures de la réponse de
 * `/api/stats/me`, partagées par le web et le mobile : le rythme (pic,
 * moments de la journée, week-end), l'échelle des graphiques, et les niveaux
 * de la grille jour × heure.
 */

export const RHYTHM_DAYS = 7;
export const RHYTHM_HOURS = 24;

/** Les moments de la journée, en heures locales : [début, fin). */
export const DAYPARTS = {
  morning: [5, 12],
  afternoon: [12, 18],
  evening: [18, 23],
  night: [23, 29], // 23 h → 5 h le lendemain
} as const;

export type Daypart = keyof typeof DAYPARTS;

export interface RhythmInsight {
  totalSeconds: number;
  /** Le jour (0 = lundi) le plus regardé ; null sans mesure. */
  topWeekday: number | null;
  /** L'heure (0 … 23) la plus regardée, tous jours confondus ; null sans mesure. */
  topHour: number | null;
  /** Le moment de la journée dominant ; null sans mesure. */
  topDaypart: Daypart | null;
  dayparts: Record<Daypart, number>;
  /** Part du temps du samedi et du dimanche (0..1). */
  weekendShare: number;
  /** Part du temps entre 22 h et 5 h (0..1). */
  lateShare: number;
  /** Part du temps entre 5 h et 10 h (0..1). */
  earlyShare: number;
}

const inRange = (hour: number, [from, to]: readonly [number, number]) =>
  (hour >= from && hour < to) || (hour + 24 >= from && hour + 24 < to);

function argmax(values: number[]): number | null {
  let at: number | null = null;
  for (let i = 0; i < values.length; i++) {
    if (values[i] > 0 && (at === null || values[i] > values[at])) at = i;
  }
  return at;
}

/** La lecture du rythme : `grid` = 168 cases, lundi 0 h en tête (cf. le contrat). */
export function analyzeRhythm(grid: readonly number[]): RhythmInsight {
  const byDay = new Array<number>(RHYTHM_DAYS).fill(0);
  const byHour = new Array<number>(RHYTHM_HOURS).fill(0);
  let total = 0;
  grid.forEach((v, i) => {
    byDay[Math.floor(i / RHYTHM_HOURS)] += v;
    byHour[i % RHYTHM_HOURS] += v;
    total += v;
  });
  const share = (pick: (hour: number) => boolean) =>
    total > 0 ? byHour.reduce((n, v, h) => n + (pick(h) ? v : 0), 0) / total : 0;

  const dayparts = {} as Record<Daypart, number>;
  for (const part of Object.keys(DAYPARTS) as Daypart[]) dayparts[part] = share((h) => inRange(h, DAYPARTS[part]));
  const topDaypart = total > 0
    ? (Object.keys(dayparts) as Daypart[]).reduce((a, b) => (dayparts[b] > dayparts[a] ? b : a))
    : null;

  return {
    totalSeconds: total,
    topWeekday: argmax(byDay),
    topHour: argmax(byHour),
    topDaypart,
    dayparts,
    weekendShare: total > 0 ? (byDay[5] + byDay[6]) / total : 0,
    lateShare: share((h) => h >= 22 || h < 5),
    earlyShare: share((h) => h >= 5 && h < 10),
  };
}

/** Niveau d'une case de la grille, de 0 (rien) à 4 (le maximum), à pas égaux. */
export const HEAT_LEVELS = 4;

export function heatLevel(value: number, max: number): number {
  if (value <= 0 || max <= 0) return 0;
  return Math.min(HEAT_LEVELS, Math.max(1, Math.ceil((value / max) * HEAT_LEVELS)));
}

/**
 * Une échelle « ronde » pour un axe en heures : le maximum arrondi vers le
 * haut à un pas de 1, 2, 2,5 ou 5 × 10ⁿ, et ses graduations. Jamais de
 * graduation à 7,3 h — l'œil lit des nombres ronds.
 */
export function niceAxis(maxValue: number, targetTicks = 4): { max: number; step: number; ticks: number[] } {
  if (!(maxValue > 0)) return { max: 1, step: 1, ticks: [0, 1] };
  const rough = maxValue / targetTicks;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rough) ?? 10 * magnitude;
  const max = Math.ceil(maxValue / step - 1e-9) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= max + step / 2; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return { max, step, ticks };
}
