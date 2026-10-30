/**
 * Octave (mobile) — la VAGUE du lecteur plein écran, pure (`waveDrive.test.ts`).
 *
 * Elle suit le NIVEAU RÉEL du son (`audio_level` du moteur natif, dBFS, dix mesures par seconde) :
 * - l'ÉNERGIE, la règle de la houle du bureau (`stepEnergy`, partagée) : normalisée sur le titre en cours,
 *   attaque ~0,2 s, relâchement ~1 s — la vitesse et la hauteur de fond de la vague ;
 * - l'IMPULSION : ce qui dépasse le niveau du moment (un coup de grosse caisse, une attaque) — montée en
 *   ~60 ms, retombée en ~280 ms : la crête qui saute avec le son.
 * Sans mesure (iOS : le mpv embarqué n'a pas de filtre de mesure ; un ancien build ; pause), rien n'est
 * inventé : la vague garde une houle calme qui ne prétend suivre aucun rythme (`WAVE_CALM`).
 *
 * La géométrie (`wavePath`) est une fonction de travail : elle tourne sur le fil d'interface, à chaque image.
 */

import { ENERGY_START, ENERGY_TUNING, newTrack, stepEnergy, type EnergyState } from "@tentacle-tv/shared/octave";

export interface WaveState {
  energy: EnergyState;
  /** 0..1 : la crête du moment. */
  punch: number;
  /** Le niveau « de fond » rapide (dBFS) auquel l'impulsion se compare, `null` avant la première mesure. */
  fastDb: number | null;
}

export const WAVE_START: WaveState = { energy: ENERGY_START, punch: 0, fastDb: null };

export const WAVE_TUNING = {
  /** La moyenne rapide qui sert de référence à l'impulsion. */
  fastMs: 450,
  /** Un dépassement de tant de dB fait une impulsion pleine. */
  punchFullDb: 6,
  punchRiseMs: 60,
  punchFallMs: 280,
  /** Sous ce niveau : un silence (pas d'impulsion). */
  floorDb: -50,
} as const;

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);
const follow = (dtMs: number, tauMs: number): number => 1 - Math.exp(-dtMs / tauMs);

export function waveNewTrack(state: WaveState): WaveState {
  return { energy: newTrack(state.energy), punch: state.punch, fastDb: null };
}

/** Une mesure de plus (`null` : pas de mesure, l'état ne bouge pas). */
export function stepWave(state: WaveState, levelDb: number | null, dtMs: number): WaveState {
  if (levelDb === null || !Number.isFinite(levelDb)) return state;
  const t = WAVE_TUNING;
  const dt = dtMs <= 0 ? 0 : dtMs > 2_000 ? 2_000 : dtMs;
  const energy = stepEnergy(state.energy, levelDb, dt);
  const audible = levelDb >= t.floorDb;
  const fastDb = !audible ? state.fastDb : state.fastDb === null ? levelDb : state.fastDb + (levelDb - state.fastDb) * follow(dt, t.fastMs);
  const target = audible && state.fastDb !== null ? clamp01((levelDb - state.fastDb) / t.punchFullDb) : 0;
  const tau = target > state.punch ? t.punchRiseMs : t.punchFallMs;
  return { energy, punch: state.punch + (target - state.punch) * follow(dt, tau), fastDb };
}

/** L'allure de la vague : phase (radians par seconde) et hauteur (part de la hauteur de la bande). */
export interface WaveMotion {
  speed: number;
  height: number;
}

/** Sans mesure : une houle calme, lente, basse — jamais un rythme supposé. */
export const WAVE_CALM: WaveMotion = { speed: 0.9, height: 0.16 };

const MIN_RATE = ENERGY_TUNING.minRate;
const RATE_SPAN = ENERGY_TUNING.maxRate / ENERGY_TUNING.minRate;

/**
 * L'allure mesurée, mêlée au calme selon `measured` (0..1 : la mesure arrive ou s'éteint en fondu). La vitesse est
 * celle de la houle du bureau (`swellRate` : ×0,5 → ×2,5, géométrique), recopiée ici parce qu'elle tourne sur le
 * fil d'interface.
 */
export function waveMotion(energy: number, punch: number, measured = 1): WaveMotion {
  "worklet";
  const e = energy < 0 ? 0 : energy > 1 ? 1 : energy;
  const p = punch < 0 ? 0 : punch > 1 ? 1 : punch;
  const m = measured < 0 ? 0 : measured > 1 ? 1 : measured;
  const speed = 1.4 * MIN_RATE * RATE_SPAN ** e;
  const height = Math.min(1, 0.14 + 0.32 * e + 0.34 * p);
  return { speed: WAVE_CALM.speed + (speed - WAVE_CALM.speed) * m, height: WAVE_CALM.height + (height - WAVE_CALM.height) * m };
}

/** Les trois lignes : fréquence (ondes sur la largeur), décalage de phase, part de la hauteur. */
export const WAVE_LINES = [
  { cycles: 1.6, offset: 0, scale: 1 },
  { cycles: 2.3, offset: 2.1, scale: 0.72 },
  { cycles: 3.1, offset: 4.2, scale: 0.48 },
] as const;

export const WAVE_POINTS = 48;

/**
 * Le tracé d'une ligne sur `width` × `height` : une sinusoïde sous une enveloppe nulle aux bords (sin²), centrée
 * verticalement. `closed` : fermée par le bas, pour le voile de couleur sous la première ligne.
 */
export function wavePath(width: number, height: number, phase: number, amplitude: number, cycles: number, offset: number, closed: boolean): string {
  "worklet";
  const mid = height / 2;
  const reach = Math.max(0, Math.min(1, amplitude)) * (height / 2 - 2);
  let d = "";
  for (let i = 0; i <= WAVE_POINTS; i++) {
    const u = i / WAVE_POINTS;
    const envelope = Math.sin(Math.PI * u) ** 2;
    const y = mid - reach * envelope * Math.sin(2 * Math.PI * cycles * u + phase + offset);
    d += `${i === 0 ? "M" : "L"}${(u * width).toFixed(1)} ${y.toFixed(1)}`;
  }
  return closed ? `${d}L${width.toFixed(1)} ${height.toFixed(1)}L0 ${height.toFixed(1)}Z` : d;
}
