import { useCallback, useEffect, useRef } from "react";
import { runOnJS, useFrameCallback, useSharedValue, type FrameInfo } from "react-native-reanimated";
import { postMeterResult, type MeterRequest } from "../control/benchRemote";

/**
 * Le compteur d'images du banc, sur le FIL D'INTERFACE : un rappel à chaque
 * image (`useFrameCallback` de Reanimated, battu par le CADisplayLink du fil
 * principal) compte les intervalles, les images perdues et les pires écarts,
 * sans un aller-retour JS pendant la mesure — le bilan part une fois, à la
 * fin. Un fil principal retenu (montage lourd, dessin d'un SVG, décodage
 * d'image) retarde l'image suivante : c'est ce qui se compte ici.
 *
 * En parallèle, la même chose côté JS (`requestAnimationFrame`) : un fil JS
 * chargé ne fait pas perdre d'image à une animation Reanimated, mais retarde
 * son DÉPART — de quoi savoir où chercher.
 *
 * Rien ne tourne hors mesure : le rappel n'est actif que pendant la mesure.
 */

/** Une image à 60 Hz — la cadence de l'Apple TV sur un téléviseur 1080p. */
const FRAME_MS = 1000 / 60;
/** Le temps laissé au rendu que la demande déclenche elle-même (le banc se
 *  redessine à chaque changement d'état) avant de compter. */
export const METER_SETTLE_MS = 800;
const WORST = 6;
/** Bornes de l'histogramme des intervalles, en ms. */
const BUCKETS = [20, 34, 50, 100];

interface Stats {
  frames: number;
  hitches: number;
  dropped: number;
  elapsed: number;
  histogram: number[];
  worst: number[];
  worstAt: number[];
}

const EMPTY: Stats = { frames: 0, hitches: 0, dropped: 0, elapsed: 0, histogram: [0, 0, 0, 0, 0], worst: [], worstAt: [] };

/** Un intervalle de plus : images perdues (un intervalle de trois images en
 *  perd deux), histogramme, pires écarts datés. */
function record(stats: Stats, dt: number, at: number): Stats {
  "worklet";
  const missed = dt > FRAME_MS * 1.5 ? Math.round(dt / FRAME_MS) - 1 : 0;
  const histogram = stats.histogram.slice();
  let bucket = 0;
  while (bucket < BUCKETS.length && dt >= BUCKETS[bucket]) bucket += 1;
  histogram[bucket] += 1;
  let worst = stats.worst;
  let worstAt = stats.worstAt;
  if (worst.length < WORST || dt > worst[worst.length - 1]) {
    const pairs = worst.map((value, i) => [value, worstAt[i]]);
    pairs.push([dt, at]);
    pairs.sort((a, b) => b[0] - a[0]);
    const kept = pairs.slice(0, WORST);
    worst = kept.map((pair) => pair[0]);
    worstAt = kept.map((pair) => pair[1]);
  }
  return { frames: stats.frames + 1, hitches: stats.hitches + (missed > 0 ? 1 : 0), dropped: stats.dropped + missed, elapsed: at, histogram, worst, worstAt };
}

const round = (value: number) => Math.round(value * 10) / 10;

function summarize(stats: Stats) {
  return {
    frames: stats.frames,
    seconds: round(stats.elapsed / 1000),
    fps: stats.elapsed > 0 ? round((stats.frames * 1000) / stats.elapsed) : 0,
    hitches: stats.hitches,
    dropped: stats.dropped,
    histogram: stats.histogram,
    worst: stats.worst.map((value, i) => ({ ms: round(value), atMs: Math.round(stats.worstAt[i]) })),
  };
}

/** La même mesure sur le fil JS, par `requestAnimationFrame`. */
function startJsProbe() {
  let active = true;
  let last = 0;
  let first = 0;
  let stats = EMPTY;
  const loop = (time: number) => {
    if (!active) return;
    if (!first) first = time;
    if (last) stats = record(stats, time - last, time - first);
    last = time;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  return () => {
    active = false;
    return summarize(stats);
  };
}

export function FrameMeter({ request }: { request: MeterRequest | null | undefined }) {
  const stats = useSharedValue<Stats>(EMPTY);
  const duration = useSharedValue(0);
  const running = useSharedValue(false);
  const current = useRef<{ id: number; stopJs: () => ReturnType<typeof summarize> } | null>(null);
  const meterRef = useRef<{ setActive: (active: boolean) => void } | null>(null);

  const finish = useCallback((ui: Stats) => {
    meterRef.current?.setActive(false);
    const run = current.current;
    current.current = null;
    if (run) postMeterResult({ id: run.id, ui: summarize(ui), js: run.stopJs() });
  }, []);

  const onFrame = useCallback(
    (info: FrameInfo) => {
      "worklet";
      if (!running.value || info.timeSincePreviousFrame === null) return;
      const next = record(stats.value, info.timeSincePreviousFrame, info.timeSinceFirstFrame);
      stats.value = next;
      if (info.timeSinceFirstFrame >= duration.value) {
        running.value = false;
        runOnJS(finish)(next);
      }
    },
    [running, stats, duration, finish],
  );
  const meter = useFrameCallback(onFrame, false);
  meterRef.current = meter;

  const id = request?.id;
  const seconds = request?.seconds ?? 0;
  useEffect(() => {
    if (id === undefined) return undefined;
    const timer = setTimeout(() => {
      stats.value = EMPTY;
      duration.value = seconds * 1000;
      running.value = true;
      current.current = { id, stopJs: startJsProbe() };
      meterRef.current?.setActive(true);
    }, METER_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [id, seconds, stats, duration, running]);

  return null;
}
