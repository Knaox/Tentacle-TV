/**
 * Octave — la houle suit l'ÉNERGIE de la musique, PURE. Un niveau RMS (dBFS)
 * mesuré quelques fois par seconde sur le son qui joue devient une énergie
 * entre 0 et 1, LISSÉE (montée ~0,6 s, descente ~1,2 s : aucun à-coup), puis une
 * vitesse et une amplitude bornées de 0,7× à 1,4× de la houle de toujours.
 *
 * L'énergie mêle deux choses, à parts égales :
 * - le niveau ABSOLU (un morceau fort roule plus vite qu'un morceau doux) ;
 * - le niveau RELATIF à la moyenne glissante du morceau (~20 s) : dans un même
 *   titre, le refrain soulève la mer, le couplet la calme — un morceau calme a
 *   ses vagues aussi.
 *
 * Sans mesure (web, pause, mode exclusif du bureau), rien ne bouge : l'énergie
 * reste où elle est, et la houle revient à son allure de toujours (`NEUTRAL_*`).
 */

export interface EnergyState {
  /** 0 (mer d'huile) → 1 (houle forte). */
  energy: number;
  /** La moyenne glissante du niveau (dBFS), `null` avant la première mesure. */
  meanDb: number | null;
}

export const ENERGY_TUNING = {
  /** Sous ce niveau, l'énergie absolue est nulle ; au-dessus du plafond, pleine. */
  floorDb: -42,
  ceilDb: -8,
  /** L'écart à la moyenne qui fait passer le relatif de 0,5 à 0 ou 1. */
  relativeSpanDb: 9,
  meanMs: 20_000,
  riseMs: 600,
  fallMs: 1_200,
  minFactor: 0.7,
  maxFactor: 1.4,
} as const;

/** L'énergie qui donne exactement l'allure de toujours (facteur 1). */
export const NEUTRAL_ENERGY = (1 - ENERGY_TUNING.minFactor) / (ENERGY_TUNING.maxFactor - ENERGY_TUNING.minFactor);

export const ENERGY_START: EnergyState = { energy: NEUTRAL_ENERGY, meanDb: null };

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);
/** La part du chemin parcourue en `dtMs` par un lissage de constante `tauMs`. */
const follow = (dtMs: number, tauMs: number): number => 1 - Math.exp(-dtMs / tauMs);

/** Une mesure de plus (`levelDb` : `null` = pas de mesure, l'état ne bouge pas). */
export function stepEnergy(state: EnergyState, levelDb: number | null, dtMs: number): EnergyState {
  if (levelDb === null || !Number.isFinite(levelDb)) return state;
  const t = ENERGY_TUNING;
  // Un écart de temps aberrant (fenêtre endormie, horloge) ne vaut pas plus de deux secondes.
  const dt = dtMs <= 0 ? 0 : dtMs > 2_000 ? 2_000 : dtMs;
  const absolute = clamp01((levelDb - t.floorDb) / (t.ceilDb - t.floorDb));
  // Un silence (entre deux titres, une fin) ne tire pas la moyenne du morceau vers le bas.
  const audible = levelDb >= t.floorDb;
  const meanDb = state.meanDb === null ? (audible ? levelDb : null) : audible ? state.meanDb + (levelDb - state.meanDb) * follow(dt, t.meanMs) : state.meanDb;
  const relative = meanDb === null ? 0 : clamp01(0.5 + (levelDb - meanDb) / (2 * t.relativeSpanDb));
  const target = (absolute + relative) / 2;
  const tau = target > state.energy ? t.riseMs : t.fallMs;
  return { energy: state.energy + (target - state.energy) * follow(dt, tau), meanDb };
}

/** Le facteur de la houle (vitesse comme amplitude) : 0,7 → 1,4, arrondi au centième. */
export function swellFactor(energy: number): number {
  const t = ENERGY_TUNING;
  return Math.round((t.minFactor + (t.maxFactor - t.minFactor) * clamp01(energy)) * 100) / 100;
}

export interface SwellDrive {
  /** Vitesse des animations (`playbackRate`). */
  rate: number;
  /** Amplitude (`--ocean-amp`, lue par les `scaleY` de la feuille). */
  amplitude: number;
}

export const NEUTRAL_DRIVE: SwellDrive = { rate: 1, amplitude: 1 };

export function driveOf(energy: number): SwellDrive {
  const factor = swellFactor(energy);
  return { rate: factor, amplitude: factor };
}

/** Vaut-il la peine de pousser ce nouvel état (un centième de plus, au moins) ? */
export function driveChanged(a: SwellDrive, b: SwellDrive): boolean {
  return Math.abs(a.rate - b.rate) >= 0.02 || Math.abs(a.amplitude - b.amplitude) >= 0.02;
}
