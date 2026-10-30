/**
 * Octave mobile — la géométrie du glisser, en WORKLETS (fil d'interface) : le MIROIR des règles pures de
 * `@tentacle-tv/shared/octave` (`dragGeometry.ts`), qu'un worklet ne peut pas appeler (fonctions du fil JS).
 * `reorderWorklets.test.ts` tient les deux égales, point par point : une règle se change dans shared, puis ici.
 */

import { EDGE_ACCEL, EDGE_ACCEL_MS, EDGE_MAX_SPEED, EDGE_MIN_SPEED, EDGE_PX } from "@tentacle-tv/shared/octave";

/** Recopiées en nombres : un worklet ne lit que ce qu'il capture. */
const EDGE = EDGE_PX;
const MAX = EDGE_MAX_SPEED;
const MIN = EDGE_MIN_SPEED;
const ACCEL = EDGE_ACCEL;
const ACCEL_MS = EDGE_ACCEL_MS;

export function targetOf(from: number, deltaPx: number, count: number, rowHeight: number): number {
  "worklet";
  return Math.max(0, Math.min(count - 1, from + Math.round(deltaPx / rowHeight)));
}

export function shiftOf(index: number, from: number, over: number, rowHeight: number): number {
  "worklet";
  if (index === from) return 0;
  if (from < over && index > from && index <= over) return -rowHeight;
  if (from > over && index >= over && index < from) return rowHeight;
  return 0;
}

export function edgeVelocity(pointerY: number, top: number, bottom: number, heldMs: number): number {
  "worklet";
  const room = Math.max(1, Math.min(EDGE, (bottom - top) / 3));
  let depth = 0;
  let sign = 0;
  if (pointerY < top + room) {
    depth = (top + room - pointerY) / room;
    sign = -1;
  } else if (pointerY > bottom - room) {
    depth = (pointerY - (bottom - room)) / room;
    sign = 1;
  }
  if (sign === 0) return 0;
  const p = Math.min(1, depth);
  const accel = 1 + (ACCEL - 1) * Math.min(1, Math.max(0, heldMs) / ACCEL_MS);
  return sign * (MIN + (MAX - MIN) * p * p) * accel;
}

export function stepOf(velocity: number, frameMs: number): number {
  "worklet";
  return (velocity * Math.min(Math.max(frameMs, 0), 34)) / 1000;
}

/** La fenêtre montée, encodée en un nombre (`first * 100000 + last`) : une réaction compare un nombre. */
export function windowCode(scroll: number, viewport: number, listTop: number, rowHeight: number, count: number, block: number, overscan: number): number {
  "worklet";
  if (count <= 0) return -1;
  const top = Math.floor(Math.max(0, scroll - listTop) / rowHeight);
  const bottom = Math.floor(Math.max(0, scroll + viewport - listTop) / rowHeight);
  const first = Math.min(Math.max(0, Math.floor(top / block) * block - overscan), count - 1);
  const last = Math.min(count - 1, (Math.floor(bottom / block) + 1) * block - 1 + overscan);
  return first * 100000 + last;
}

export function decodeWindow(code: number): { first: number; last: number } {
  if (code < 0) return { first: 0, last: -1 };
  return { first: Math.floor(code / 100000), last: code % 100000 };
}
