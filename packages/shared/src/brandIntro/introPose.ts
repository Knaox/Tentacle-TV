/**
 * Le modèle d'une pièce animée de l'ouverture, et sa POSE à un instant donné —
 * la règle des animations Web (WAAPI) que le site emploie, réécrite en pur :
 *
 * - une animation a un départ, une durée, une courbe sur l'avancement, un
 *   REMPLISSAGE (`both` : son état de départ vaut avant son tour, son état
 *   d'arrivée après ; `forwards` : seulement après ; `none` : pendant) et des
 *   images clés (positions `offset` réparties comme en CSS quand elles
 *   manquent) ;
 * - deux groupes de propriétés se règlent à part : la TRANSFORMATION (entière,
 *   comme la propriété CSS) et l'OPACITÉ ;
 * - pour chaque groupe, la DERNIÈRE animation de la liste qui a effet l'emporte ;
 *   sans aucune, la valeur de base de la pièce.
 *
 * Unités : déplacements en unités du logo, rotations en degrés. La
 * transformation s'applique autour du PIVOT de la pièce, dans l'ordre `order`.
 */
import { introEasing, type IntroEasingName } from "./easing";
import type { IntroPoint } from "./introGeometry";

export interface IntroTransform {
  x: number;
  y: number;
  rotate: number;
  scale: number;
  scaleY: number;
}

export type IntroTransformKey = keyof IntroTransform;

export const IDENTITY: Readonly<IntroTransform> = { x: 0, y: 0, rotate: 0, scale: 1, scaleY: 1 };

export interface IntroFrame {
  offset?: number;
  /** Présent (même `{}`, l'identité) : une image clé de la transformation. */
  t?: Partial<IntroTransform>;
  opacity?: number;
}

export type IntroFill = "both" | "forwards" | "none";

export interface IntroAnimation {
  at: number;
  dur: number;
  easing: IntroEasingName;
  fill: IntroFill;
  frames: readonly IntroFrame[];
}

export interface IntroTrack {
  pivot: IntroPoint;
  /** L'ordre des fonctions de transformation (celui des listes CSS du site). */
  order: readonly IntroTransformKey[];
  /** L'opacité de la pièce quand aucune animation n'a effet. */
  baseOpacity: number;
  animations: readonly IntroAnimation[];
}

export interface IntroPose {
  transform: IntroTransform;
  opacity: number;
}

/** Les positions calculées des images clés : 0, 1, et un partage égal entre deux positions connues. */
export function computedOffsets(frames: readonly IntroFrame[]): number[] {
  const offsets = frames.map((frame) => frame.offset);
  const last = frames.length - 1;
  if (offsets[0] === undefined) offsets[0] = 0;
  if (last > 0 && offsets[last] === undefined) offsets[last] = 1;
  let start = 0;
  for (let index = 1; index <= last; index += 1) {
    const known = offsets[index];
    if (known === undefined) continue;
    const from = offsets[start] as number;
    for (let gap = start + 1; gap < index; gap += 1) offsets[gap] = from + ((known - from) * (gap - start)) / (index - start);
    start = index;
  }
  return offsets as number[];
}

/** L'avancement (après courbe) d'une animation à t, ou null si elle n'a pas d'effet. */
export function animationProgress(animation: IntroAnimation, t: number): number | null {
  const { at, dur, fill } = animation;
  if (t < at) return fill === "both" ? 0 : null;
  if (t >= at + dur) return fill === "none" ? null : 1;
  return introEasing(animation.easing)((t - at) / dur);
}

const lerp = (from: number, to: number, x: number) => from + (to - from) * x;

const fullTransform = (partial: Partial<IntroTransform>): IntroTransform => ({ ...IDENTITY, ...partial });

function lerpTransform(from: IntroTransform, to: IntroTransform, x: number): IntroTransform {
  return {
    x: lerp(from.x, to.x, x),
    y: lerp(from.y, to.y, x),
    rotate: lerp(from.rotate, to.rotate, x),
    scale: lerp(from.scale, to.scale, x),
    scaleY: lerp(from.scaleY, to.scaleY, x),
  };
}

/** La valeur d'un groupe à l'avancement p, entre ses images clés (interpolation linéaire, comme en CSS). */
function sample<T>(
  frames: readonly IntroFrame[],
  offsets: readonly number[],
  p: number,
  pick: (frame: IntroFrame) => T | undefined,
  mix: (from: T, to: T, x: number) => T,
): T | undefined {
  const keyed = frames
    .map((frame, index) => ({ value: pick(frame), offset: offsets[index] as number }))
    .filter((entry): entry is { value: T; offset: number } => entry.value !== undefined);
  if (keyed.length === 0) return undefined;
  const first = keyed[0] as { value: T; offset: number };
  if (p <= first.offset) return first.value;
  for (let index = 1; index < keyed.length; index += 1) {
    const to = keyed[index] as { value: T; offset: number };
    if (p <= to.offset) {
      const from = keyed[index - 1] as { value: T; offset: number };
      const span = to.offset - from.offset;
      return mix(from.value, to.value, span > 0 ? (p - from.offset) / span : 1);
    }
  }
  return (keyed[keyed.length - 1] as { value: T; offset: number }).value;
}

/** La pose d'une pièce à l'instant t (ms depuis le début de l'ouverture). */
export function poseAt(track: IntroTrack, t: number): IntroPose {
  let transform: IntroTransform | undefined;
  let opacity: number | undefined;
  for (let index = track.animations.length - 1; index >= 0 && (transform === undefined || opacity === undefined); index -= 1) {
    const animation = track.animations[index] as IntroAnimation;
    const p = animationProgress(animation, t);
    if (p === null) continue;
    const offsets = computedOffsets(animation.frames);
    if (transform === undefined) {
      transform = sample(animation.frames, offsets, p, (frame) => (frame.t ? fullTransform(frame.t) : undefined), lerpTransform);
    }
    if (opacity === undefined) opacity = sample(animation.frames, offsets, p, (frame) => frame.opacity, lerp);
  }
  return { transform: transform ?? { ...IDENTITY }, opacity: opacity ?? track.baseOpacity };
}

/** Une boucle de l'attente : une mesure qui se répète, après un délai (rien avant). */
export interface IntroLoop {
  pivot: IntroPoint;
  order: readonly IntroTransformKey[];
  period: number;
  delay: number;
  easing: IntroEasingName;
  frames: readonly IntroFrame[];
  /** L'opacité avant le délai (une étincelle éteinte). */
  baseOpacity: number;
}

/** La pose d'une boucle, `idle` ms après le début de l'attente. */
export function loopPoseAt(loop: IntroLoop, idle: number): IntroPose {
  const local = idle - loop.delay;
  if (local < 0) return { transform: { ...IDENTITY }, opacity: loop.baseOpacity };
  const p = introEasing(loop.easing)((local % loop.period) / loop.period);
  const offsets = computedOffsets(loop.frames);
  return {
    transform: sample(loop.frames, offsets, p, (frame) => (frame.t ? fullTransform(frame.t) : undefined), lerpTransform) ?? { ...IDENTITY },
    opacity: sample(loop.frames, offsets, p, (frame) => frame.opacity, lerp) ?? loop.baseOpacity,
  };
}
