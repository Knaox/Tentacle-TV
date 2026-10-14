import type { AvatarTemperament } from "@tentacle-tv/shared";

/**
 * Le tempérament d'un personnage, en GESTE : ce que fait son portrait quand on
 * le désigne — une fois, puis il se pose (le web le joue au survol, que le
 * doigt n'a pas). Seulement `transform` ; rien en mouvement réduit.
 *
 * Module PUR (des données) : la tuile les joue par Reanimated.
 */

export interface TemperamentMotion {
  property: "translateX" | "translateY" | "rotateDeg" | "scale";
  /** Les positions successives ; la dernière est le repos (0, ou 1 pour l'échelle). */
  values: readonly number[];
  /** La durée de chaque pas. */
  stepMs: number;
}

export const TEMPERAMENT_MOTION: Readonly<Record<AvatarTemperament, TemperamentMotion>> = {
  /** Flotter : il monte un peu, redescend. */
  float: { property: "translateY", values: [-5, 0], stepMs: 260 },
  /** Frétiller : quelques tours de tête, de plus en plus petits. */
  wiggle: { property: "rotateDeg", values: [-7, 6, -4, 2, 0], stepMs: 70 },
  /** Sursauter : un frisson de côté. */
  shiver: { property: "translateX", values: [-2, 2, -2, 2, -1, 0], stepMs: 40 },
  /** Rebondir : deux sauts, le second plus petit. */
  bounce: { property: "translateY", values: [-9, 0, -4, 0], stepMs: 120 },
  /** Se dandiner : d'un côté, de l'autre. */
  sway: { property: "rotateDeg", values: [-5, 5, 0], stepMs: 200 },
  /** Somnoler : il pique du nez, se reprend. */
  doze: { property: "scale", values: [0.94, 1], stepMs: 360 },
};

/** La position de repos d'une propriété. */
export function restOf(property: TemperamentMotion["property"]): number {
  return property === "scale" ? 1 : 0;
}
