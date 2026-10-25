/**
 * Où en est un enregistrement par rapport à la référence, au fil du temps.
 *
 * L'enregistrement (fréquence du contexte, souvent 48 kHz) est comparé à la
 * référence de l'album (s16, 44,1 kHz) rééchantillonnée : par fenêtres
 * successives, on cherche le décalage qui les aligne (corrélation normalisée).
 * Un décalage qui SAUTE entre deux fenêtres est une discontinuité : positif,
 * du temps a été ajouté (un blanc) ; négatif, du son a été sauté (ou les deux
 * éléments se sont chevauchés). Les fenêtres silencieuses ne s'alignent pas :
 * elles sont comptées à part.
 */

import { readFileSync } from "node:fs";

export function referenceAt(refFile, rate) {
  const raw = readFileSync(refFile);
  const n = Math.floor(raw.length / 4);
  const src = new Float32Array(n);
  for (let i = 0; i < n; i += 1) src[i] = raw.readInt16LE(i * 4) / 32768;
  const out = new Float32Array(Math.floor((n * rate) / 44100));
  for (let i = 0; i < out.length; i += 1) {
    const x = (i * 44100) / rate;
    const k = Math.floor(x);
    out[i] = (src[k] ?? 0) + ((src[k + 1] ?? 0) - (src[k] ?? 0)) * (x - k);
  }
  return out;
}

function rms(a, from, len) {
  let s = 0;
  for (let i = from; i < from + len; i += 1) s += (a[i] ?? 0) ** 2;
  return Math.sqrt(s / len);
}

/** Le décalage `lag` (rec[i] ≈ ref[i + lag]) le mieux corrélé autour de `guess`. */
function bestLag(rec, ref, from, len, guess, span) {
  let best = { lag: guess, score: -Infinity };
  for (let lag = guess - span; lag <= guess + span; lag += 1) {
    if (from + lag < 0 || from + lag + len > ref.length) continue;
    let dot = 0, ea = 0, eb = 0;
    for (let i = from; i < from + len; i += 4) {
      const a = rec[i] ?? 0, b = ref[i + lag] ?? 0;
      dot += a * b; ea += a * a; eb += b * b;
    }
    const score = dot / Math.sqrt(ea * eb + 1e-12);
    if (score > best.score) best = { lag, score };
  }
  return best;
}

/** Les sauts de décalage le long de l'enregistrement, en ms. */
export function trackLag(rec, ref, rate, { windowMs = 40, stepMs = 20, threshold = 0.004 } = {}) {
  const len = Math.round((windowMs / 1000) * rate);
  const step = Math.round((stepMs / 1000) * rate);
  const jumps = [];
  let lag = null;
  let silentWindows = 0;
  for (let from = 0; from + len < rec.length; from += step) {
    if (rms(rec, from, len) < threshold) {
      silentWindows += lag === null ? 0 : 1;
      continue;
    }
    // Première fenêtre sonore : recherche large (le son commence n'importe où).
    const found = lag === null ? bestLag(rec, ref, from, len, 0, rate * 2) : bestLag(rec, ref, from, len, lag, Math.round(rate * 0.4));
    if (found.score < 0.9) continue;
    if (lag !== null && Math.abs(found.lag - lag) > 2) {
      jumps.push({ atMs: Math.round((from / rate) * 1000), jumpMs: Number(((-(found.lag - lag) / rate) * 1000).toFixed(1)) });
    }
    lag = found.lag;
  }
  // Le BILAN de chaque raccord : la somme des sauts d'une même grappe (les
  // fenêtres à cheval sur deux sons s'alignent tantôt sur l'un, tantôt sur
  // l'autre ; seul le total dit le blanc, ou le chevauchement s'il est négatif).
  const net = [];
  for (const j of jumps) {
    const last = net[net.length - 1];
    if (last !== undefined && j.atMs - last.endMs <= 200) {
      last.netMs = Number((last.netMs + j.jumpMs).toFixed(1));
      last.endMs = j.atMs;
    } else net.push({ atMs: j.atMs, endMs: j.atMs, netMs: j.jumpMs });
  }
  return { junctions: net, silentMsAfterStart: Math.round(silentWindows * stepMs) };
}
