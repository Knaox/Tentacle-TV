/**
 * Octave (mobile) — « Transition douce » : la durée du fondu en ms, « 0 » = coupée, ALLUMÉE à 3 s sur un appareil
 * qui n'a rien choisi (clé `tentacle_octave_crossfade`, la même que le bureau). La page « Réglages d'Octave » et le
 * contrôle du lecteur l'écrivent, le moteur la lit.
 *
 * ⚠️ À l'intégration du lot : m2-audio met la règle dans le partagé (`createCrossfadeSetting`,
 * `sanitizeCrossfadeMs` de `@tentacle-tv/shared/octave`) — ces bornes locales le cèdent alors à la sienne.
 */

import { deviceSetting } from "./deviceSetting";

export const CROSSFADE_STORAGE_KEY = "tentacle_octave_crossfade";
export const CROSSFADE_MIN_S = 2;
export const CROSSFADE_MAX_S = 12;
export const CROSSFADE_DEFAULT_MS = 3_000;

/** 0, ou 2 000 à 12 000 par pas d'une seconde (la règle du bureau). */
function sanitize(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(CROSSFADE_MAX_S, Math.max(CROSSFADE_MIN_S, Math.round(value / 1_000))) * 1_000;
}

const crossfade = deviceSetting<number>({
  key: CROSSFADE_STORAGE_KEY,
  read: (raw) => (raw === null || raw.trim() === "" ? CROSSFADE_DEFAULT_MS : sanitize(Number(raw))),
  write: (ms) => String(ms),
});

export const getCrossfadeMs = crossfade.get;
export const subscribeCrossfade = crossfade.subscribe;
export const useCrossfadeMs = crossfade.use;

export function setCrossfadeMs(next: number): void {
  crossfade.set(sanitize(next));
}
