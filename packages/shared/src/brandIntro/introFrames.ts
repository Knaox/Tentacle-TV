/**
 * Le COMPTE DES IMAGES de l'ouverture — exigence de Damien (21/10) : ultra
 * fluide, sans une image perdue, prouvé par la mesure. L'horloge (fil
 * d'interface) note l'écart entre chaque image et la phase où il tombe ; ce
 * module pur en tire le bilan : fréquence de l'écran, images perdues, pire
 * écart, par phase. Module pur, testé.
 */

/**
 * Les phases de l'ouverture : le poulpe s'assemble, attend sur son bouton, puis ta-dum et la
 * plongée ; `settle`, l'encre immobile avant le début (`introStart`) — ses écarts ne se voient
 * pas, ils ne comptent pas dans le total. L'indice est le code noté par l'horloge : jamais réordonné.
 */
export const INTRO_FRAME_PHASES = ["assembly", "hold", "dive", "settle"] as const;
export type IntroFramePhase = (typeof INTRO_FRAME_PHASES)[number];

/** Un écart entre deux images (ms) et sa phase (indice dans `INTRO_FRAME_PHASES`) : deux nombres, à plat. */
export type IntroFrameLog = readonly number[];

export interface IntroPhaseFrames {
  /** Images affichées. */
  frames: number;
  /** Images que l'écran attendait et qui n'ont pas été produites. */
  dropped: number;
  /** Le pire écart entre deux images (ms). */
  worstMs: number;
  /** La durée de la phase (ms). */
  durationMs: number;
}

export interface IntroFrameReport {
  /** La fréquence de l'écran déduite des écarts (60, 120…). */
  hz: number;
  /** Le pas d'une image (ms). */
  periodMs: number;
  phases: Record<IntroFramePhase, IntroPhaseFrames>;
  /** Toute l'ouverture VISIBLE (l'encre du début exclue). */
  total: IntroPhaseFrames;
}

/** Les fréquences d'écran connues : le pas mesuré s'y arrondit (la gigue des horodatages ne crée pas un 117 Hz). */
const KNOWN_HZ = [30, 48, 50, 60, 72, 90, 96, 100, 120, 144] as const;

/** Le pas d'une image : le 10e centile des écarts (robuste aux images perdues), arrondi à une fréquence connue. */
export function introFramePeriod(gaps: readonly number[]): number {
  const sorted = gaps.filter((gap) => gap > 0).sort((a, b) => a - b);
  if (sorted.length === 0) return 1000 / 60;
  const typical = sorted[Math.floor((sorted.length - 1) * 0.1)] as number;
  const measured = 1000 / typical;
  const hz = KNOWN_HZ.reduce((best, candidate) => (Math.abs(candidate - measured) < Math.abs(best - measured) ? candidate : best), 60);
  return 1000 / hz;
}

/** Les images perdues pendant un écart : au-delà d'une image et demie, chaque pas manqué compte. */
export function droppedIn(gapMs: number, periodMs: number): number {
  if (gapMs < periodMs * 1.5) return 0;
  return Math.max(0, Math.round(gapMs / periodMs) - 1);
}

const empty = (): IntroPhaseFrames => ({ frames: 0, dropped: 0, worstMs: 0, durationMs: 0 });

/** Le bilan d'une ouverture, depuis le journal de l'horloge (`[phase, écart, phase, écart, …]`). */
export function introFrameReport(log: IntroFrameLog): IntroFrameReport {
  // Le pas de l'écran se lit sur les phases visibles (l'encre du début, ce sont justement les gros trous).
  const gaps: number[] = [];
  for (let index = 1; index < log.length; index += 2) if (INTRO_FRAME_PHASES[log[index - 1] as number] !== "settle") gaps.push(log[index] as number);
  const periodMs = introFramePeriod(gaps);
  const phases = { assembly: empty(), hold: empty(), dive: empty(), settle: empty() };
  const total = empty();
  for (let index = 0; index + 1 < log.length; index += 2) {
    const phase = INTRO_FRAME_PHASES[log[index] as number];
    const gap = log[index + 1] as number;
    if (!phase) continue;
    for (const bucket of phase === "settle" ? [phases.settle] : [phases[phase], total]) {
      bucket.frames += 1;
      bucket.dropped += droppedIn(gap, periodMs);
      bucket.worstMs = Math.max(bucket.worstMs, gap);
      bucket.durationMs += gap;
    }
  }
  return { hz: Math.round(1000 / periodMs), periodMs, phases, total };
}

/** Une ligne de journal : ce que le banc relève. */
export function formatIntroFrameReport(report: IntroFrameReport): string {
  const phase = (name: IntroFramePhase) => {
    const { frames, dropped, worstMs } = report.phases[name];
    return `${name} ${frames} img/${dropped} perdues/pire ${Math.round(worstMs)} ms`;
  };
  const { frames, dropped, worstMs } = report.total;
  const visible = INTRO_FRAME_PHASES.filter((name) => name !== "settle").map(phase).join(" ; ");
  const ink = `encre ${Math.round(report.phases.settle.durationMs)} ms, pire ${Math.round(report.phases.settle.worstMs)} ms`;
  return `[ouverture] ${report.hz} Hz — ${frames} images, ${dropped} perdues, pire écart ${Math.round(worstMs)} ms (${visible} ; ${ink})`;
}
