/**
 * Mobile motion helpers — pont entre tokens partagés (bezier 4-tuples) et
 * Reanimated 3 (`Easing.bezier`, springs, withTiming).
 *
 * Tous les nouveaux composants animés DOIVENT consommer ces helpers pour
 * garantir une cinématique cohérente cross-platform.
 */

import { AccessibilityInfo } from "react-native";
import { Easing } from "react-native-reanimated";
import { DURATIONS, EASINGS_BEZIER, SPRINGS } from "@tentacle-tv/shared";

export const Durations = DURATIONS;
export const Springs = SPRINGS;

/** Reanimated `Easing` instances dérivées des bezier 4-tuples partagés. */
export const Easings = {
  out: Easing.bezier(...EASINGS_BEZIER.out),
  inOut: Easing.bezier(...EASINGS_BEZIER.inOut),
  spring: Easing.bezier(...EASINGS_BEZIER.spring),
  sheet: Easing.bezier(...EASINGS_BEZIER.sheet),
} as const;

/**
 * Retourne 0 si `prefers-reduced-motion` est actif, sinon la durée passée.
 * À utiliser au moment de la composition de l'animation (jamais en worklet,
 * où l'API n'est pas dispo).
 */
let reducedMotionCached: boolean | null = null;
AccessibilityInfo.isReduceMotionEnabled?.().then((v) => { reducedMotionCached = v; }).catch(() => {});
AccessibilityInfo.addEventListener?.("reduceMotionChanged", (v: boolean) => { reducedMotionCached = v; });

export function respectReducedMotion(duration: number): number {
  return reducedMotionCached === true ? 0 : duration;
}

export function isReducedMotion(): boolean {
  return reducedMotionCached === true;
}
