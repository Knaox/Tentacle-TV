/**
 * La chorégraphie de l'ouverture ÉCHANTILLONNÉE pour l'interface de la TV :
 * des tableaux réguliers (un échantillon toutes les `step` ms) que la vue lit
 * sur le fil d'interface, image par image, sans rien recalculer — ni courbe,
 * ni caméra, ni JavaScript du démarrage dérangé. Calculés UNE fois, ici, à
 * partir du pur partagé (`@tentacle-tv/shared/brandIntro`).
 *
 * Unités : déplacements en UNITÉS DU LOGO (la vue les multiplie par le zoom de
 * sa pièce), rotations en degrés, zoom de la caméra en points par unité.
 */
import {
  INTRO_TIMING,
  cameraAtTime,
  frontArmsAway,
  introHoldLoops,
  introTracks,
  loopPoseAt,
  poseAt,
  revealAt,
  zoomEasedAt,
  type IntroCameraPlan,
  type IntroGeometry,
  type IntroLoop,
  type IntroPartId,
  type IntroPose,
  type IntroTrack,
  type IntroTransformKey,
} from "@tentacle-tv/shared/brandIntro";

/** Un canal par fonction de transformation de la pièce, et son opacité. */
export interface IntroChannels {
  order: readonly IntroTransformKey[];
  values: Readonly<Partial<Record<IntroTransformKey, readonly number[]>>>;
  opacity: readonly number[];
}

export interface IntroSamples {
  step: number;
  /** Le nombre d'échantillons de la chorégraphie (0 → fin, bornes comprises). */
  count: number;
  parts: Readonly<Record<IntroPartId, IntroChannels>>;
  camera: { zoom: readonly number[]; offsetX: readonly number[]; offsetY: readonly number[] };
  /** L'ouverture de la vitre, 0 → 1. */
  reveal: readonly number[];
  /** La parallaxe des bras avant pendant la plongée. */
  armsAway: { scale: readonly number[]; opacity: readonly number[] };
}

/** Une boucle de l'attente, échantillonnée sur UNE mesure. */
export interface IntroLoopSamples extends IntroChannels {
  period: number;
  delay: number;
  baseOpacity: number;
  count: number;
}

export interface IntroHoldSamples {
  step: number;
  play: IntroLoopSamples;
  ring: IntroLoopSamples;
  sparkles: readonly IntroLoopSamples[];
  eyes: readonly IntroLoopSamples[];
}

/** 120 échantillons par seconde : entre deux, l'interpolation linéaire ne se voit pas. */
export const INTRO_SAMPLE_STEP_MS = 1000 / 120;

function channelsOf(order: readonly IntroTransformKey[], poses: readonly IntroPose[]): IntroChannels {
  const values: Partial<Record<IntroTransformKey, number[]>> = {};
  for (const key of order) values[key] = poses.map((pose) => pose.transform[key]);
  return { order, values, opacity: poses.map((pose) => pose.opacity) };
}

export function sampleIntro(geometry: IntroGeometry, plan: IntroCameraPlan, maxStep = INTRO_SAMPLE_STEP_MS): IntroSamples {
  // Un pas qui tombe juste sur la fin : le dernier échantillon EST l'arrivée.
  const count = Math.ceil(INTRO_TIMING.end / maxStep) + 1;
  const step = INTRO_TIMING.end / (count - 1);
  const times = Array.from({ length: count }, (_, index) => index * step);
  const tracks = introTracks(geometry);
  const parts = Object.fromEntries(
    (Object.entries(tracks) as [IntroPartId, IntroTrack][]).map(([id, track]) => [id, channelsOf(track.order, times.map((t) => poseAt(track, t)))]),
  ) as Record<IntroPartId, IntroChannels>;
  const cameras = times.map((t) => cameraAtTime(t, plan));
  const away = times.map((t) => frontArmsAway(zoomEasedAt(t)));
  return {
    step,
    count,
    parts,
    camera: { zoom: cameras.map((c) => c.zoom), offsetX: cameras.map((c) => c.offsetX), offsetY: cameras.map((c) => c.offsetY) },
    reveal: times.map(revealAt),
    armsAway: { scale: away.map((a) => a.scale), opacity: away.map((a) => a.opacity) },
  };
}

function sampleLoop(loop: IntroLoop, step: number): IntroLoopSamples {
  const count = Math.ceil(loop.period / step) + 1;
  // Répartis régulièrement sur la mesure, bornes comprises : le dernier rejoint le premier.
  const poses = Array.from({ length: count }, (_, index) => loopPoseAt(loop, loop.delay + (index * loop.period) / (count - 1)));
  return { ...channelsOf(loop.order, poses), period: loop.period, delay: loop.delay, baseOpacity: loop.baseOpacity, count };
}

export function sampleIntroHold(geometry: IntroGeometry, step = INTRO_SAMPLE_STEP_MS): IntroHoldSamples {
  const loops = introHoldLoops(geometry);
  return {
    step,
    play: sampleLoop(loops.play, step),
    ring: sampleLoop(loops.ring, step),
    sparkles: loops.sparkles.map((loop) => sampleLoop(loop, step)),
    eyes: loops.eyes.map((loop) => sampleLoop(loop, step)),
  };
}

/** La valeur d'un canal à t (ms), entre ses deux échantillons — le jumeau pur de la lecture du fil d'interface. */
export function sampleValue(values: readonly number[], step: number, t: number): number {
  const last = values.length - 1;
  const position = Math.max(0, Math.min(last, t / step));
  const index = Math.floor(position);
  const from = values[index] as number;
  const to = values[Math.min(last, index + 1)] as number;
  return from + (to - from) * (position - index);
}

/** La valeur d'une boucle, `idle` ms après le début de l'attente (sa base avant son délai). */
export function loopValue(loop: IntroLoopSamples, values: readonly number[], idle: number, base: number): number {
  const local = idle - loop.delay;
  if (local < 0) return base;
  return sampleValue(values, loop.period / (loop.count - 1), local % loop.period);
}
