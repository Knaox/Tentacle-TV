/**
 * Le mode d'affichage qui sert une cadence de film sans pulldown — la règle de
 * `DisplayModeSwitcher.kt` (Android TV), écrite ici en pur pour le mobile et
 * testée. Le natif ne fait que lister les modes et appliquer l'identifiant.
 *
 * Candidats de MÊME définition physique que le mode courant (jamais de
 * changement de définition). Palier 0 : la cadence exacte ; palier 1 : le plus
 * petit multiple entier k = 2..5
 * (23,976 → 48 | 72 | 96 | 120 ; 25 → 50 | 75 | 100 ; 29,97 → 60 | 90 | 120).
 * Aucun repli « fréquence la plus proche » : pour 23,976 sur un écran 50/60,
 * ce serait 50 Hz — pire que le pulldown. Sans mode exact ni multiple : rien.
 *
 * « Exact » à 0,15 % près, en RELATIF : au-dessus de l'écart NTSC (1000/1001,
 * 0,1 %) — 24 Hz vaut pour 23,976, 60 pour 59,94, 120 pour 119,88 —, bien
 * en dessous de ce qui sépare deux cadences (24/25 : 4 %). La TV tient une
 * tolérance absolue de 0,05 Hz, qui refusait 59,94 → 60.
 */
export interface DisplayModeInfo {
  id: number;
  width: number;
  height: number;
  refreshRate: number;
}

export const DISPLAY_MODE_RELATIVE_TOLERANCE = 0.0015;
const MAX_MULTIPLE = 5;

export function pickDisplayMode(
  fps: number,
  currentId: number,
  modes: readonly DisplayModeInfo[],
): DisplayModeInfo | null {
  const current = modes.find((m) => m.id === currentId);
  if (!current || !(fps > 0)) return null;
  const candidates = modes.filter((m) => m.width === current.width && m.height === current.height);
  for (let k = 1; k <= MAX_MULTIPLE; k += 1) {
    const target = k * fps;
    let best: DisplayModeInfo | null = null;
    for (const mode of candidates) {
      const gap = Math.abs(mode.refreshRate - target);
      if (gap > DISPLAY_MODE_RELATIVE_TOLERANCE * target) continue;
      if (!best || gap < Math.abs(best.refreshRate - target)) best = mode;
    }
    if (best) return best;
  }
  return null;
}
