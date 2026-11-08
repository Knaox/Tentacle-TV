/**
 * Octave (mobile) — la position du lecteur vue par ce qui la DESSINE, règle pure : une GRAINE qui ne change que si
 * l'image change. Le moteur donne la position quatre fois par seconde ; le filet du mini-lecteur n'avance que d'un
 * point à la fois, l'horloge du lecteur d'une seconde. Redessiner entre deux, c'est un commit Fabric pour rien
 * (lot « bat », batterie).
 */

import type { PositionState } from "@tentacle-tv/shared/octave";

/** La fraction jouée (0 → 1), `0` sans durée connue. */
export function playedFraction(positionMs: number, durationMs: number | null): number {
  if (durationMs === null || durationMs <= 0) return 0;
  return Math.min(1, Math.max(0, positionMs / durationMs));
}

/** Les points remplis d'une ligne de `width` points : un entier, la ligne avance d'un point à la fois. */
export function filledPoints(position: PositionState, width: number): number {
  if (width <= 0) return 0;
  return Math.round(playedFraction(position.positionMs, position.durationMs) * width);
}

/**
 * La graine de la barre de position : la seconde écoulée, la seconde RESTANTE (une durée qui ne tombe pas sur une
 * seconde ronde la fait changer à un autre moment) et le point de la piste. Même graine → même image.
 */
export function seekBarTick(position: PositionState, width: number): string {
  const elapsed = Math.floor(Math.max(0, position.positionMs) / 1000);
  const remaining = position.durationMs === null ? "" : Math.floor(Math.max(0, position.durationMs - position.positionMs) / 1000);
  return `${elapsed}|${remaining}|${filledPoints(position, width)}`;
}
