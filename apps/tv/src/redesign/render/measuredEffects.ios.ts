import type { MeasuredEffect } from "./measuredEffects";

/** Les interrupteurs de mesure des effets (lot Lite) : aucun sur l'Apple TV —
 *  le jumeau Android (`measuredEffects.ts`) les lit dans l'app de mesure. */
export type { MeasuredEffect };

export function effectOff(_name: MeasuredEffect): boolean {
  return false;
}
