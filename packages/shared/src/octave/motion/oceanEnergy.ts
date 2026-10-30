/**
 * Octave — la houle suit l'ÉNERGIE de la musique, PURE. Un niveau RMS (dBFS)
 * mesuré cinq fois par seconde sur le son qui joue devient une énergie entre
 * 0 et 1, puis une vitesse et une amplitude qu'on SENT (Damien, 26/10 : « si la
 * musique est dynamique, on doit vraiment sentir une accélération ») :
 *
 * - NORMALISÉE sur le titre en cours : l'écart au niveau moyen DU TITRE
 *   (moyenne glissante, remise à zéro à chaque titre), rapporté à sa dispersion
 *   (écart moyen, plancher 3,5 dB : un morceau qui ne fait que respirer reste
 *   une houle, pas une tempête). Un morceau doux comme un morceau fort a ses
 *   creux et ses pics ; une petite part de niveau absolu garde l'idée qu'un
 *   morceau fort pousse un peu plus.
 * - RÉACTIVE : attaque ~0,2 s (une montée, un drop se voient aussitôt),
 *   relâchement ~1 s (pas de tremblote).
 * - Vitesse de 0,5× à 2,5×, GÉOMÉTRIQUE (×1 au niveau habituel du titre, chaque
 *   cran d'énergie multiplie l'allure d'autant) ; amplitude de 0,7× à 1,5×.
 *
 * Sans mesure (web, pause, mode exclusif du bureau), l'état ne bouge pas ; la
 * houle revient à son allure de toujours (`NEUTRAL_DRIVE`).
 *
 * Partagée : la houle du bureau (`apps/web/.../motion`) et la vague du lecteur
 * plein écran du mobile (niveau du moteur natif, `audio_level`).
 */

export interface EnergyState {
  /** 0 (mer d'huile) → 1 (houle forte). */
  energy: number;
  /** Le niveau moyen du titre (dBFS), `null` avant sa première mesure audible. */
  meanDb: number | null;
  /** Son écart moyen au niveau moyen (dB). */
  spreadDb: number;
  /** Depuis combien de temps le titre est mesuré (ms) : la moyenne s'installe vite au début. */
  heardMs: number;
}

export const ENERGY_TUNING = {
  /** Sous ce niveau : un silence (blanc, fin de titre) — ni énergie absolue, ni moyenne tirée vers le bas. */
  floorDb: -50,
  ceilDb: -8,
  /** La part du niveau absolu dans l'énergie (le reste : le relatif au titre). */
  absoluteShare: 0.15,
  /** La moyenne et la dispersion du titre suivent ses ~10 dernières secondes. */
  meanMs: 10_000,
  /** Plancher de la dispersion : un titre très égal ne fait pas danser le bruit de la mesure. */
  minSpreadDb: 3.5,
  /** À combien d'écarts moyens au-dessus (au-dessous) de la moyenne l'énergie est pleine (nulle). */
  fullScaleSpreads: 1.8,
  riseMs: 200,
  fallMs: 1_000,
  minRate: 0.5,
  maxRate: 2.5,
  minAmplitude: 0.7,
  maxAmplitude: 1.5,
} as const;

/** L'énergie qui donne exactement l'allure de toujours (vitesse ×1). */
export const NEUTRAL_ENERGY = Math.log(1 / ENERGY_TUNING.minRate) / Math.log(ENERGY_TUNING.maxRate / ENERGY_TUNING.minRate);

export const ENERGY_START: EnergyState = { energy: NEUTRAL_ENERGY, meanDb: null, spreadDb: ENERGY_TUNING.minSpreadDb * 2, heardMs: 0 };

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);
/** La part du chemin parcourue en `dtMs` par un lissage de constante `tauMs`. */
const follow = (dtMs: number, tauMs: number): number => 1 - Math.exp(-dtMs / tauMs);

/** Un nouveau titre : sa moyenne repart de zéro, l'énergie du moment est gardée (aucune retombée au raccord). */
export function newTrack(state: EnergyState): EnergyState {
  return { ...ENERGY_START, energy: state.energy };
}

/** Une mesure de plus (`levelDb` : `null` = pas de mesure, l'état ne bouge pas). */
export function stepEnergy(state: EnergyState, levelDb: number | null, dtMs: number): EnergyState {
  if (levelDb === null || !Number.isFinite(levelDb)) return state;
  const t = ENERGY_TUNING;
  // Un écart de temps aberrant (fenêtre endormie, horloge) ne vaut pas plus de deux secondes.
  const dt = dtMs <= 0 ? 0 : dtMs > 2_000 ? 2_000 : dtMs;
  const audible = levelDb >= t.floorDb;
  let { meanDb, spreadDb, heardMs } = state;
  if (audible) {
    heardMs += dt;
    // Au début du titre, une moyenne qui s'installe aussi vite que le titre est entendu.
    const k = follow(dt, Math.min(t.meanMs, Math.max(dt, heardMs)));
    meanDb = meanDb === null ? levelDb : meanDb + (levelDb - meanDb) * k;
    spreadDb += (Math.abs(levelDb - meanDb) - spreadDb) * k;
  }
  const spread = Math.max(t.minSpreadDb, spreadDb);
  const relative = meanDb === null || !audible ? 0 : clamp01(0.5 + (levelDb - meanDb) / (2 * t.fullScaleSpreads * spread));
  const absolute = clamp01((levelDb - t.floorDb) / (t.ceilDb - t.floorDb));
  const target = t.absoluteShare * absolute + (1 - t.absoluteShare) * relative;
  const tau = target > state.energy ? t.riseMs : t.fallMs;
  return { energy: state.energy + (target - state.energy) * follow(dt, tau), meanDb, spreadDb, heardMs };
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** La vitesse : 0,5× → 2,5×, géométrique (×1 à l'énergie neutre). */
export function swellRate(energy: number): number {
  const t = ENERGY_TUNING;
  return round2(t.minRate * (t.maxRate / t.minRate) ** clamp01(energy));
}

/** L'amplitude (hauteur des crêtes) : 0,7× → 1,5×. */
export function swellAmplitude(energy: number): number {
  const t = ENERGY_TUNING;
  return round2(t.minAmplitude + (t.maxAmplitude - t.minAmplitude) * clamp01(energy));
}

export interface SwellDrive {
  /** Vitesse des animations (`playbackRate`). */
  rate: number;
  /** Amplitude (`--ocean-amp`, lue par les `scaleY` de la feuille). */
  amplitude: number;
}

export const NEUTRAL_DRIVE: SwellDrive = { rate: 1, amplitude: 1 };

export function driveOf(energy: number): SwellDrive {
  return { rate: swellRate(energy), amplitude: swellAmplitude(energy) };
}

/** Vaut-il la peine de pousser ce nouvel état (3 % de vitesse, ou 0,02 d'amplitude) ? */
export function driveChanged(a: SwellDrive, b: SwellDrive): boolean {
  return Math.abs(a.rate - b.rate) >= 0.03 * a.rate || Math.abs(a.amplitude - b.amplitude) >= 0.02;
}
