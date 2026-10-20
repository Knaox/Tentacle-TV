/**
 * QUAND le poulpe commence à s'assembler (mobile). Mesuré en Release (21/10,
 * testeur-mobile) : le démarrage de l'app — premier montage, polices,
 * hydratation — fige le fil d'interface 0,26 s (iPad) à 0,7 s (iPhone), et
 * tombait sur les PREMIÈRES images du poulpe : 30 à 75 images perdues.
 * L'ouverture reste donc sur l'encre (la première image, immobile : aucun
 * à-coup visible) tant que l'app n'est pas prête ET que le fil d'interface
 * n'a pas rendu quelques images régulières d'affilée ; jamais plus de
 * `maxWaitMs`. La TV ne l'emploie pas (son démarrage précède l'ouverture).
 * Module pur, testé ; son jumeau sur le fil d'interface est
 * `introStartStepWorklet` (brand-intro-native).
 */

export const INTRO_START = {
  /** Images régulières d'affilée, l'app prête, avant de commencer. */
  calmFrames: 6,
  /** Au-delà, on commence quand même (une app lente à démarrer n'immobilise pas l'encre). */
  maxWaitMs: 1500,
  /** Un écart de plus d'une image et demie n'est pas régulier. */
  calmRatio: 1.5,
} as const;

export interface IntroStartState {
  /** Le temps passé sur l'encre (ms). */
  waitedMs: number;
  /** Images régulières d'affilée depuis que l'app est prête. */
  calm: number;
  /** Le plus court écart vu : le pas d'une image de cet écran. */
  periodMs: number;
}

export const INTRO_START_FRESH: IntroStartState = { waitedMs: 0, calm: 0, periodMs: Number.POSITIVE_INFINITY };

/** Une image de plus sur l'encre : le nouvel état, et s'il est temps de commencer. */
export function introStartStep(state: IntroStartState, elapsedMs: number, appReady: boolean): { state: IntroStartState; start: boolean } {
  const periodMs = Math.min(state.periodMs, elapsedMs);
  const calm = appReady && elapsedMs < periodMs * INTRO_START.calmRatio ? state.calm + 1 : 0;
  const waitedMs = state.waitedMs + elapsedMs;
  const start = (appReady && calm >= INTRO_START.calmFrames) || waitedMs >= INTRO_START.maxWaitMs;
  return { state: { waitedMs, calm, periodMs }, start };
}
