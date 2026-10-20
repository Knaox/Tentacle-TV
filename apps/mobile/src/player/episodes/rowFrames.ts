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
  /** L'écart médian et le 90e centile (ms) : la régularité, lisible d'un coup d'œil. */
  medianMs: number;
  p90Ms: number;
  /** Les écarts qu'un œil voit à 60 Hz : au-delà de 25 ms (une image et demie). */
  over60: number;
}

const KNOWN_HZ = [30, 48, 50, 60, 72, 90, 96, 100, 120, 144] as const;

/**
 * Le pas d'une image : la MÉDIANE des écarts, arrondie à une fréquence connue —
 * robuste tant que moins de la moitié des images manque. (Un centile bas se
 * trompait : au simulateur, l'horloge à 120 Hz bat avec de la gigue, 7 puis
 * 10 ms, et passait pour un écran à 144 Hz.)
 */
export function framePeriod(gaps: readonly number[]): number {
  const sorted = gaps.filter((gap) => gap > 0).sort((a, b) => a - b);
  if (sorted.length === 0) return 1000 / 60;
  const typical = sorted[Math.floor((sorted.length - 1) * 0.5)] as number;
  const measured = 1000 / typical;
  const hz = KNOWN_HZ.reduce((best, candidate) => (Math.abs(candidate - measured) < Math.abs(best - measured) ? candidate : best), 60);
  return 1000 / hz;
}

/** Les images perdues dans un écart : au-delà d'une image et demie, chaque pas manqué compte. */
export function droppedIn(gapMs: number, periodMs: number): number {
  if (gapMs < periodMs * 1.5) return 0;
  return Math.max(0, Math.round(gapMs / periodMs) - 1);
}

const percentile = (sorted: readonly number[], share: number): number =>
  sorted.length === 0 ? 0 : Math.round((sorted[Math.floor((sorted.length - 1) * share)] as number) * 10) / 10;

export function rowFrameReport(gaps: readonly number[]): RowFrameReport {
  const period = framePeriod(gaps);
  const sorted = [...gaps].sort((a, b) => a - b);
  return {
    hz: Math.round(1000 / period),
    frames: gaps.length,
    dropped: gaps.reduce((sum, gap) => sum + droppedIn(gap, period), 0),
    worstMs: Math.round(gaps.reduce((worst, gap) => Math.max(worst, gap), 0)),
    medianMs: percentile(sorted, 0.5),
    p90Ms: percentile(sorted, 0.9),
    over60: gaps.filter((gap) => gap > 25).length,
  };
}
