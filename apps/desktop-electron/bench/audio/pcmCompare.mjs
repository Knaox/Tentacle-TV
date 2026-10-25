/**
 * Compare une sortie PCM (s16le stéréo) à sa référence, à l'échantillon près.
 *
 * On suit la sortie avec un DÉCALAGE courant (`ref = sortie + décalage`) tant
 * que les trames coïncident (±1 : l'arrondi flottant → entier). À la première
 * qui diffère, on cherche le nouveau décalage où 64 trames coïncident :
 * - décalage qui DIMINUE de N : N trames de trop dans la sortie — un blanc
 *   inséré (`silentFrames` les compte) ou une répétition ;
 * - décalage qui AUGMENTE : des trames de la référence sautées.
 * Un enchaînement ou une bascule parfaits ne laissent AUCUN évènement.
 */

import { readFileSync } from "node:fs";

const FRAME = 4;
const MATCH = 64;
const SEARCH = 96_000;

function frameAt(buf, i) {
  if (i < 0 || (i + 1) * FRAME > buf.length) return null;
  return [buf.readInt16LE(i * FRAME), buf.readInt16LE(i * FRAME + 2)];
}

function same(a, b) {
  return a !== null && b !== null && Math.abs(a[0] - b[0]) <= 1 && Math.abs(a[1] - b[1]) <= 1;
}

function matchesAt(out, ref, i, lag) {
  for (let k = 0; k < MATCH; k += 1) if (!same(frameAt(out, i + k), frameAt(ref, i + k + lag))) return false;
  return true;
}

function silent(f) {
  return f !== null && Math.abs(f[0]) <= 2 && Math.abs(f[1]) <= 2;
}

/** Le nouveau décalage, cherché du plus proche au plus loin. */
function findLag(out, ref, i, lag) {
  for (let d = 1; d <= SEARCH; d += 1) {
    if (matchesAt(out, ref, i, lag - d)) return lag - d;
    if (matchesAt(out, ref, i, lag + d)) return lag + d;
  }
  return null;
}

export function comparePcm(outFile, refFile, { startFrame = 0 } = {}) {
  const out = readFileSync(outFile);
  const ref = readFileSync(refFile);
  const frames = Math.floor(out.length / FRAME);
  const events = [];
  let lag = startFrame;
  let i = 0;
  while (i < frames) {
    if (same(frameAt(out, i), frameAt(ref, i + lag))) {
      i += 1;
      continue;
    }
    if (frameAt(ref, i + lag) === null) break; // fin de la référence
    let silentFrames = 0;
    while (silent(frameAt(out, i + silentFrames)) && i + silentFrames < frames) silentFrames += 1;
    const next = findLag(out, ref, i + silentFrames, lag - silentFrames);
    if (next === null) {
      events.push({ frame: i, jump: null, silentFrames });
      break;
    }
    events.push({ frame: i, jump: next - lag, silentFrames });
    lag = next;
    i += silentFrames + MATCH;
  }
  const refFrames = Math.floor(ref.length / FRAME);
  return { frames, refFrames, lagAtEnd: lag, events, exact: events.length === 0 && frames + startFrame === refFrames };
}

/** Le niveau RMS d'une sortie (vérifie qu'un format a bien produit du son). */
export function rmsOf(outFile) {
  const out = readFileSync(outFile);
  let sum = 0;
  const n = Math.floor(out.length / 2);
  for (let i = 0; i < n; i += 1) {
    const v = out.readInt16LE(i * 2) / 32768;
    sum += v * v;
  }
  return n === 0 ? 0 : Math.sqrt(sum / n);
}
