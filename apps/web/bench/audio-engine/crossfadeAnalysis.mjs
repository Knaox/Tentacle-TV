/**
 * L'analyse d'un fondu enregistré (banc de la transition douce, web et bureau) : le MÉLANGE de deux tons purs,
 * A à 440 Hz et B à 660 Hz, au même niveau. Par fenêtres de 50 ms (22 et 33 périodes entières à 44,1 et 48 kHz :
 * les deux tons ne bavent pas l'un sur l'autre), Goertzel lit l'amplitude de chacun — le GAIN de chaque titre au
 * fil du temps. On en tire : la puissance totale (gA² + gB², 1 = constante), le plus grand pas de gain d'une
 * fenêtre à l'autre, le moindre blanc, et un détecteur de CLIC : l'énergie au-dessus de 4 kHz, par 5 ms (les
 * deux tons n'en ont aucune, un saut de gain en fait une large bande), en dB sous le niveau d'un ton.
 */

const WINDOW_S = 0.05;
const HOP_S = 0.01;

function goertzel(x, start, n, freq, sr) {
  const w = (2 * Math.PI * freq) / sr;
  const c = 2 * Math.cos(w);
  let s1 = 0;
  let s2 = 0;
  for (let i = 0; i < n; i += 1) {
    const s0 = x[start + i] + c * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  const re = s1 - s2 * Math.cos(w);
  const im = s2 * Math.sin(w);
  return (2 * Math.sqrt(re * re + im * im)) / n;
}

/** Les gains de A et B, fenêtre par fenêtre (`t` en s, au centre de la fenêtre). */
export function gains(samples, sr, { fa = 440, fb = 660, level } = {}) {
  const n = Math.round(WINDOW_S * sr);
  const hop = Math.round(HOP_S * sr);
  const out = [];
  for (let s = 0; s + n <= samples.length; s += hop) {
    out.push({ t: (s + n / 2) / sr, a: goertzel(samples, s, n, fa, sr) / level, b: goertzel(samples, s, n, fb, sr) / level });
  }
  return out;
}

/** Passe-haut à 4 kHz (sinus cardinal fenêtré, 129 coefficients), puis le plus fort RMS par 5 ms sur [from, to) (s), en dB rel. `level`. */
function hfPeakDb(x, sr, from, to, level) {
  const taps = 129;
  const half = (taps - 1) / 2;
  const fc = 4000 / sr;
  const k = new Float64Array(taps);
  for (let i = 0; i < taps; i += 1) {
    const m = i - half;
    const lowpass = m === 0 ? 2 * fc : Math.sin(2 * Math.PI * fc * m) / (Math.PI * m);
    k[i] = (m === 0 ? 1 : 0) - lowpass * (0.42 - 0.5 * Math.cos((2 * Math.PI * i) / (taps - 1)) + 0.08 * Math.cos((4 * Math.PI * i) / (taps - 1)));
  }
  const w = Math.round(0.005 * sr);
  let peak = 0;
  for (let s0 = Math.max(taps, Math.round(from * sr)); s0 + w < Math.min(x.length, Math.round(to * sr)); s0 += w) {
    let acc = 0;
    for (let n = s0; n < s0 + w; n += 1) {
      let y = 0;
      for (let j = 0; j < taps; j += 1) y += k[j] * x[n - j];
      acc += y * y;
    }
    peak = Math.max(peak, Math.sqrt(acc / w));
  }
  return peak > 0 ? Math.round(20 * Math.log10(peak / level) * 10) / 10 : -Infinity;
}

const r3 = (v) => (v === null ? null : Math.round(v * 1000) / 1000);

/** Le verdict d'un fondu de A vers B. `level` : l'amplitude d'un ton seul (mesurée sur la lecture stable). */
export function analyseCrossfade(samples, sr, { level: given, expectedS = null, pause = false } = {}) {
  const probe = gains(samples, sr, { level: 1 });
  const level = given ?? Math.max(...probe.map((g) => g.a));
  let g = probe.map((p) => ({ t: p.t, a: p.a / level, b: p.b / level }));
  // Une PAUSE voulue au milieu du fondu : ses fenêtres (et celles qui la touchent, à moins de 50 ms) sont ôtées,
  // les courbes doivent reprendre où elles étaient.
  let pausedMs = 0;
  if (pause) {
    const quiet = g.map((p) => p.a ** 2 + p.b ** 2 < 0.01);
    const firstLoud = quiet.indexOf(false);
    const near = (i) => quiet.slice(Math.max(0, i - 5), i + 6).some(Boolean);
    pausedMs = quiet.filter((q, i) => q && i > firstLoud + 10).length * HOP_S * 1000;
    g = g.filter((_, i) => i > firstLoud + 10 && !near(i));
  }
  // Le fondu commence quand A, jusque-là stable, baisse pendant que B paraît.
  const firstA = g.findIndex((p) => p.a > 0.99);
  const start = g.findIndex((p, i) => i > firstA && p.a < 0.995 && p.b > 0.01);
  const end = start < 0 ? -1 : g.findIndex((p, i) => i > start && p.b > 0.995);
  // La durée lue sur la courbe de B : sin(π/2·x) vaut 0,259 à x = 1/6 et 0,966 à x = 5/6.
  const cross = (v) => g.find((p, i) => i >= start && p.b >= v)?.t ?? null;
  const [t1, t5] = [cross(0.259), cross(0.966)];
  let worstStep = 0;
  let pMin = Infinity;
  let pMax = 0;
  let silent = 0;
  let silentMax = 0;
  const lo = Math.max(0, start - 50);
  const hi = end < 0 ? g.length : Math.min(g.length, end + 50);
  for (let i = lo; i < hi; i += 1) {
    const p = g[i];
    const power = p.a ** 2 + p.b ** 2;
    pMin = Math.min(pMin, power);
    pMax = Math.max(pMax, power);
    if (i > lo) worstStep = Math.max(worstStep, Math.abs(p.a - g[i - 1].a), Math.abs(p.b - g[i - 1].b));
    silent = power < 0.01 ? silent + 1 : 0;
    silentMax = Math.max(silentMax, silent);
  }
  const tStart = start < 0 ? null : g[start].t;
  const tEnd = end < 0 ? null : g[end].t;
  const steadyHf = tStart === null ? null : hfPeakDb(samples, sr, Math.max(0.5, tStart - 2), tStart - 0.1, level);
  const fadeHf = tStart === null || tEnd === null ? null : hfPeakDb(samples, sr, tStart - 0.1, tEnd + 0.5, level);
  return {
    level: r3(level),
    fadeStartS: r3(tStart),
    fadeS: t1 === null || t5 === null ? null : r3((t5 - t1) * 1.5),
    expectedS,
    powerMin: r3(pMin),
    powerMax: r3(pMax),
    powerSpanDb: pMin > 0 ? r3(10 * Math.log10(pMax / pMin)) : null,
    worstGainStepPer10ms: r3(worstStep),
    longestSilenceMs: silentMax * HOP_S * 1000,
    ...(pause ? { pausedMs } : {}),
    hfSteadyDb: steadyHf,
    hfFadeDb: fadeHf,
    envelope: g.filter((_, i) => i >= lo && i < hi && (i - lo) % 25 === 0).map((p) => `${p.t.toFixed(2)}:${p.a.toFixed(3)}/${p.b.toFixed(3)}`),
  };
}

/** La sortie d'un titre quitté par un geste : durée de sa descente (90 % → 1 %) et clic. */
export function analyseCut(samples, sr) {
  const probe = gains(samples, sr, { level: 1 });
  const level = Math.max(...probe.map((p) => p.a));
  const g = probe.map((p) => ({ t: p.t, a: p.a / level, b: p.b / level }));
  const first = g.findIndex((p) => p.a > 0.95);
  const i90 = g.findIndex((p, i) => i > first && p.a < 0.9);
  const i01 = g.findIndex((p, i) => i > i90 && p.a < 0.01);
  const t90 = i90 < 0 ? null : g[i90].t;
  // Le clic se cherche dans la descente de A seulement : l'attaque de B (le début d'un titre) n'en est pas un.
  const bAt = g.find((p, i) => i > first && p.b > 0.01)?.t ?? Infinity;
  const steadyHf = t90 === null ? null : hfPeakDb(samples, sr, Math.max(0.5, t90 - 1.5), t90 - 0.1, level);
  const cutHf = t90 === null ? null : hfPeakDb(samples, sr, t90 - 0.05, Math.min(t90 + 0.3, bAt - 0.03), level);
  return { cutMs: i90 < 0 || i01 < 0 ? null : Math.round((g[i01].t - t90) * 1000), hfSteadyDb: steadyHf, hfCutDb: cutHf };
}
