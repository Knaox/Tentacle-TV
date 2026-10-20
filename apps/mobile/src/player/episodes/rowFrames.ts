/**
 * Le compte des IMAGES d'un défilement de la rangée des épisodes — exigence du
 * 21/10 : la carte qui s'ouvre ne perd pas une image en glissant vite, prouvé
 * par la mesure. Le fil d'interface note l'écart entre deux images ; ce module
 * pur en tire le bilan (même méthode que l'ouverture du démarrage).
 */

export interface RowFrameReport {
  /** La fréquence de l'écran déduite des écarts (60, 120…). */
  hz: number;
  frames: number;
  /** Les images que l'écran attendait et qui n'ont pas été produites. */
  dropped: number;
  /** Le pire écart entre deux images (ms). */
  worstMs: number;
}

const KNOWN_HZ = [30, 48, 50, 60, 72, 90, 96, 100, 120, 144] as const;

/** Le pas d'une image : le 10e centile des écarts (robuste aux pertes), arrondi à une fréquence connue. */
export function framePeriod(gaps: readonly number[]): number {
  const sorted = gaps.filter((gap) => gap > 0).sort((a, b) => a - b);
  if (sorted.length === 0) return 1000 / 60;
  const typical = sorted[Math.floor((sorted.length - 1) * 0.1)] as number;
  const measured = 1000 / typical;
  const hz = KNOWN_HZ.reduce((best, candidate) => (Math.abs(candidate - measured) < Math.abs(best - measured) ? candidate : best), 60);
  return 1000 / hz;
}

/** Les images perdues dans un écart : au-delà d'une image et demie, chaque pas manqué compte. */
export function droppedIn(gapMs: number, periodMs: number): number {
  if (gapMs < periodMs * 1.5) return 0;
  return Math.max(0, Math.round(gapMs / periodMs) - 1);
}

export function rowFrameReport(gaps: readonly number[]): RowFrameReport {
  const period = framePeriod(gaps);
  return {
    hz: Math.round(1000 / period),
    frames: gaps.length,
    dropped: gaps.reduce((sum, gap) => sum + droppedIn(gap, period), 0),
    worstMs: Math.round(gaps.reduce((worst, gap) => Math.max(worst, gap), 0)),
  };
}
