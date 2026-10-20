import type { IntroChannels, IntroLoopSamples } from "@tentacle-tv/shared/brandIntro";
import type { SharedValue } from "react-native-reanimated";

/**
 * La lecture des tableaux de l'ouverture SUR LE FIL D'INTERFACE (worklets) :
 * le jumeau de tv-core `sampleValue` / `loopValue`, que les tests tiennent.
 * Aucun calcul de courbe ni de caméra ici — des tableaux, une interpolation.
 */

export interface IntroClock {
  /** L'instant de la chorégraphie (ms). */
  scene: SharedValue<number>;
  /** Le temps passé à attendre sur le bouton lecture (ms). */
  idle: SharedValue<number>;
  /** Le poids des boucles de l'attente (1 : elles jouent ; 0 : éteintes). */
  idleWeight: SharedValue<number>;
  /** L'écran est arrivé (ou l'ouverture a renoncé) : tout vaut l'identité. */
  landed: SharedValue<number>;
  /**
   * 1 tant que l'ouverture reste sur l'encre (mobile, `waitForApp`) : la scène et l'app se
   * dessinent déjà, entières, SOUS un voile d'encre opaque — accueil enregistré, textures et
   * plaques envoyées au processeur graphique avant que rien ne bouge. 0 ensuite (la TV : toujours).
   */
  prewarm: SharedValue<number>;
}

export function sampleAt(values: readonly number[], step: number, t: number): number {
  "worklet";
  const last = values.length - 1;
  const position = Math.max(0, Math.min(last, t / step));
  const index = Math.floor(position);
  const from = values[index] as number;
  const to = values[Math.min(last, index + 1)] as number;
  return from + (to - from) * (position - index);
}

export function loopAt(loop: IntroLoopSamples, values: readonly number[], idle: number, base: number): number {
  "worklet";
  const local = idle - loop.delay;
  if (local < 0) return base;
  return sampleAt(values, loop.period / (loop.count - 1), local % loop.period);
}

type TransformEntry =
  | { translateX: number }
  | { translateY: number }
  | { rotate: string }
  | { scale: number }
  | { scaleY: number };

/** Une fonction de la transformation, en points (`zoom` : points par unité du logo de la pièce). */
export function entryOf(key: string, value: number, zoom: number): TransformEntry {
  "worklet";
  if (key === "x") return { translateX: value * zoom };
  if (key === "y") return { translateY: value * zoom };
  if (key === "rotate") return { rotate: `${value}deg` };
  if (key === "scaleY") return { scaleY: value };
  return { scale: value };
}

/** La pose d'une pièce à t : sa transformation (dans l'ordre de sa piste) et son opacité. */
export function partStyleAt(channels: IntroChannels, step: number, t: number, zoom: number) {
  "worklet";
  const transform: TransformEntry[] = [];
  for (const key of channels.order) {
    const values = channels.values[key];
    if (values) transform.push(entryOf(key, sampleAt(values, step, t), zoom));
  }
  return { opacity: sampleAt(channels.opacity, step, t), transform };
}

/** La pose d'une boucle de l'attente, pondérée (0 : sa pose neutre ; 1 : la boucle). */
export function loopStyleAt(loop: IntroLoopSamples, idle: number, weight: number, zoom: number) {
  "worklet";
  const transform: TransformEntry[] = [];
  for (const key of loop.order) {
    const values = loop.values[key];
    if (!values) continue;
    const neutral = key === "scale" || key === "scaleY" ? 1 : 0;
    const value = loopAt(loop, values, idle, neutral);
    transform.push(entryOf(key, neutral + (value - neutral) * weight, zoom));
  }
  const opacity = loopAt(loop, loop.opacity, idle, loop.baseOpacity);
  return { opacity: loop.baseOpacity + (opacity - loop.baseOpacity) * weight, transform };
}

export interface IntroStartWorkletState {
  waitedMs: number;
  calm: number;
  periodMs: number;
}

/**
 * Une image de plus sur l'encre avant le début (mobile) : le jumeau sur le fil
 * d'interface de shared `introStartStep`, que ses tests tiennent — mêmes
 * constantes (`INTRO_START`), même règle.
 */
export function introStartStepWorklet(
  state: IntroStartWorkletState,
  elapsedMs: number,
  appReady: boolean,
  rule: { calmFrames: number; maxWaitMs: number; calmRatio: number },
): { state: IntroStartWorkletState; start: boolean } {
  "worklet";
  const periodMs = Math.min(state.periodMs, elapsedMs);
  const calm = appReady && elapsedMs < periodMs * rule.calmRatio ? state.calm + 1 : 0;
  const waitedMs = state.waitedMs + elapsedMs;
  const start = (appReady && calm >= rule.calmFrames) || waitedMs >= rule.maxWaitMs;
  return { state: { waitedMs, calm, periodMs }, start };
}
