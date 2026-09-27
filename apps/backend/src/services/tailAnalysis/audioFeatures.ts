/**
 * Les MESURES audio de la fin d'un média, seconde par seconde.
 *
 * C'est le portage exact des mesures du labo (`docs/SEGMENTS-LABO-FIN.md`) : le
 * modèle de `speechModel.ts` a été ajusté sur ELLES, à la virgule près. Changer
 * une borne de bande, une fenêtre ou un seuil ici sans réentraîner, c'est donner
 * au modèle des nombres qu'il ne sait pas lire.
 *
 * # Ce qu'on mesure, et pourquoi
 *
 * La question n'est pas « y a-t-il du son » mais « est-ce de la MUSIQUE » : un
 * générique se joue en musique, une scène se joue en paroles et en bruitages.
 * Treize mesures, chacune pour une raison mesurée :
 *
 *  - le rythme (`beat`) : l'autocorrélation des attaques entre 0,3 et 1,5 s —
 *    une batterie est périodique, une conversation ne l'est pas. C'est elle qui
 *    sépare le rap d'un générique (0,37 à 0,61) d'un dialogue (0,10 à 0,26) ;
 *  - la tenue des notes (`persist`) : un pic du spectre encore là 64 ms plus
 *    tard — une note tenue, pas une syllabe ;
 *  - les creux (`ler`, `pauses`) et la vie de l'enveloppe (`envstd`, `mod4`) :
 *    la parole respire, la musique non ;
 *  - le reste (flux spectral, centre de gravité, basses, aigus, passages par
 *    zéro) nuance, et le modèle leur donne peu de poids.
 *
 * # Le prix
 *
 * Une FFT de 512 points toutes les 16 ms : dix minutes d'audio, c'est 37 500
 * FFT. On rend la main à la boucle d'évènements par tranches — ce processus
 * relaie aussi les flux des téléviseurs.
 */

export const SAMPLE_RATE = 16_000;
const FRAME = 512;
const HOP = 256;
/** Trames par seconde : 62,5. */
const FPS = SAMPLE_RATE / HOP;
const BINS = FRAME / 2 + 1;
const BIN_HZ = SAMPLE_RATE / FRAME;
const FRAMES_PER_TICK = 2_000;

export const FEATURE_NAMES = [
  "db", "ler", "envstd", "beat", "persist", "flux", "fluxv", "mod4", "centroid", "bass", "pauses", "high", "zcrv",
] as const;
export const FEATURE_COUNT = FEATURE_NAMES.length;

/** Les cases d'une bande [loHz, hiHz], bornes comprises (comme le labo). */
function binRange(loHz: number, hiHz: number, hiInclusive = true): [number, number] {
  let lo = 0;
  while (lo * BIN_HZ < loHz) lo++;
  let hi = BINS - 1;
  while (hiInclusive ? hi * BIN_HZ > hiHz : hi * BIN_HZ >= hiHz) hi--;
  return [lo, hi];
}

const PEAK_BAND = binRange(100, 4_000);
const SPEECH_BAND = binRange(300, 3_400);
const TOTAL_BAND = binRange(30, 8_000, false);
const BASS_BAND = binRange(30, 200, false);
const HIGH_FROM = binRange(3_000, SAMPLE_RATE / 2)[0];
const PEAK_WIDTH = PEAK_BAND[1] - PEAK_BAND[0] + 1;
/** Un pic encore là quatre trames plus tard (64 ms) : une note tenue. */
const PEAK_LAG = 4;

const hann = (n: number): Float64Array => {
  const w = new Float64Array(n);
  if (n === 1) w[0] = 1;
  else for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
  return w;
};
const WINDOW = hann(FRAME);

/** FFT radix 2 en place, précalculée pour 512 points. */
const fft = (() => {
  const levels = Math.log2(FRAME);
  const rev = new Uint16Array(FRAME);
  for (let i = 0; i < FRAME; i++) {
    let r = 0;
    for (let b = 0; b < levels; b++) r |= ((i >> b) & 1) << (levels - 1 - b);
    rev[i] = r;
  }
  const cos = new Float64Array(FRAME / 2);
  const sin = new Float64Array(FRAME / 2);
  for (let i = 0; i < FRAME / 2; i++) {
    cos[i] = Math.cos((2 * Math.PI * i) / FRAME);
    sin[i] = -Math.sin((2 * Math.PI * i) / FRAME);
  }
  return (re: Float64Array, im: Float64Array): void => {
    for (let i = 0; i < FRAME; i++) {
      const j = rev[i];
      if (j > i) {
        const t = re[i]; re[i] = re[j]; re[j] = t;
        const u = im[i]; im[i] = im[j]; im[j] = u;
      }
    }
    for (let size = 2; size <= FRAME; size *= 2) {
      const half = size / 2;
      const step = FRAME / size;
      for (let start = 0; start < FRAME; start += size) {
        for (let k = 0; k < half; k++) {
          const wr = cos[k * step];
          const wi = sin[k * step];
          const a = start + k;
          const b = a + half;
          const tr = wr * re[b] - wi * im[b];
          const ti = wr * im[b] + wi * re[b];
          re[b] = re[a] - tr; im[b] = im[a] - ti;
          re[a] += tr; im[a] += ti;
        }
      }
    }
  };
})();

const yieldToLoop = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

/** Les séries par trame dont les mesures par seconde sont tirées. */
interface FrameSeries {
  count: number;
  power: Float64Array;
  pdb: Float64Array;
  flux: Float64Array;
  envDb: Float64Array;
  bass: Float64Array;
  high: Float64Array;
  centroid: Float64Array;
  zcr: Float64Array;
  onset: Float64Array;
  pnum: Float64Array;
  pden: Float64Array;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

async function frameSeries(pcm: Int16Array): Promise<FrameSeries> {
  const count = pcm.length >= FRAME ? 1 + Math.floor((pcm.length - FRAME) / HOP) : 0;
  const s: FrameSeries = {
    count,
    power: new Float64Array(count), pdb: new Float64Array(count), flux: new Float64Array(count),
    envDb: new Float64Array(count), bass: new Float64Array(count), high: new Float64Array(count),
    centroid: new Float64Array(count), zcr: new Float64Array(count), onset: new Float64Array(count),
    pnum: new Float64Array(count), pden: new Float64Array(count),
  };
  const re = new Float64Array(FRAME);
  const im = new Float64Array(FRAME);
  const mag = new Float64Array(BINS);
  const logs = new Float64Array(BINS);
  const prevLogs = new Float64Array(BINS);
  const norm = new Float64Array(PEAK_WIDTH);
  const prevNorm = new Float64Array(PEAK_WIDTH);
  const ring = Array.from({ length: PEAK_LAG + 1 }, () => new Uint8Array(PEAK_WIDTH));
  const bandLog: number[] = new Array<number>(PEAK_WIDTH).fill(0);

  for (let f = 0; f < count; f++) {
    if (f > 0 && f % FRAMES_PER_TICK === 0) await yieldToLoop();
    const offset = f * HOP;
    let energy = 0;
    let crossings = 0;
    let prevSign = Math.sign(pcm[offset]);
    for (let i = 0; i < FRAME; i++) {
      const raw = pcm[offset + i] / 32768;
      const v = raw * WINDOW[i];
      re[i] = v; im[i] = 0;
      energy += v * v;
      if (i > 0) {
        const sign = Math.sign(raw);
        if (sign !== prevSign) crossings++;
        prevSign = sign;
      }
    }
    s.power[f] = energy / FRAME;
    s.pdb[f] = 10 * Math.log10(s.power[f] + 1e-10);
    s.zcr[f] = crossings / (FRAME - 1);
    fft(re, im);
    let total = 0; let bass = 0; let high = 0; let all = 0; let weighted = 0; let speech = 0;
    for (let k = 0; k < BINS; k++) {
      const m = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
      mag[k] = m;
      logs[k] = Math.log10(m + 1e-6);
      all += m;
      weighted += m * k * BIN_HZ;
      if (k >= TOTAL_BAND[0] && k <= TOTAL_BAND[1]) total += m;
      if (k >= BASS_BAND[0] && k <= BASS_BAND[1]) bass += m;
      if (k >= HIGH_FROM) high += m;
      if (k >= SPEECH_BAND[0] && k <= SPEECH_BAND[1]) speech += m;
    }
    total += 1e-9;
    s.bass[f] = bass / total;
    s.high[f] = high / total;
    s.centroid[f] = weighted / (all + 1e-9) / 4_000;
    s.envDb[f] = Math.log10(speech + 1e-6);

    let onset = 0;
    if (f > 0) for (let k = 0; k < BINS; k++) onset += Math.max(0, logs[k] - prevLogs[k]);
    s.onset[f] = onset;
    prevLogs.set(logs);

    // Flux spectral et pics tonals, sur la bande 100 Hz - 4 kHz
    let bandSum = 0;
    for (let i = 0; i < PEAK_WIDTH; i++) bandSum += mag[PEAK_BAND[0] + i];
    let flux = 0;
    for (let i = 0; i < PEAK_WIDTH; i++) {
      norm[i] = mag[PEAK_BAND[0] + i] / (bandSum + 1e-9);
      bandLog[i] = Math.log10(mag[PEAK_BAND[0] + i] + 1e-6);
      if (f > 0) flux += (norm[i] - prevNorm[i]) ** 2;
    }
    s.flux[f] = f > 0 ? Math.sqrt(flux) : 0;
    prevNorm.set(norm);
    const threshold = median(bandLog) + 0.6;
    const peaks = ring[f % (PEAK_LAG + 1)];
    peaks.fill(0);
    let peakCount = 0;
    for (let i = 1; i < PEAK_WIDTH - 1; i++) {
      if (bandLog[i] > bandLog[i - 1] && bandLog[i] > bandLog[i + 1] && bandLog[i] > threshold) {
        peaks[i] = 1;
        peakCount++;
      }
    }
    s.pden[f] = peakCount;
    // Persistance de la trame f − 4 : ses pics, retrouvés (±1 case) dans la trame f
    if (f >= PEAK_LAG) s.pnum[f - PEAK_LAG] = persistence(ring[(f - PEAK_LAG) % (PEAK_LAG + 1)], peaks);
  }
  return s;
}

/** Les pics de `older` encore présents à ±1 case dans `newer` (voisinage circulaire). */
function persistence(older: Uint8Array, newer: Uint8Array): number {
  let n = 0;
  for (let i = 0; i < PEAK_WIDTH; i++) {
    if (!older[i]) continue;
    const left = newer[(i - 1 + PEAK_WIDTH) % PEAK_WIDTH];
    const right = newer[(i + 1) % PEAK_WIDTH];
    if (newer[i] || left || right) n++;
  }
  return n;
}

const mean = (a: ArrayLike<number>, from: number, to: number): number => {
  let sum = 0;
  for (let i = from; i < to; i++) sum += a[i];
  return to > from ? sum / (to - from) : 0;
};

const std = (a: ArrayLike<number>, from: number, to: number): number => {
  const m = mean(a, from, to);
  let sum = 0;
  for (let i = from; i < to; i++) sum += (a[i] - m) ** 2;
  return to > from ? Math.sqrt(sum / (to - from)) : 0;
};

/** Part de l'énergie de l'enveloppe entre 2,5 et 6 Hz — le débit syllabique. */
function syllabicModulation(env: ArrayLike<number>, from: number, to: number): number {
  const n = to - from;
  if (n <= 0) return 0;
  const m = mean(env, from, to);
  const w = hann(n);
  let tot = 0;
  let band = 0;
  for (let k = 0; k <= n >> 1; k++) {
    const hz = (k * FPS) / n;
    if (hz <= 0.5 || hz >= 20) continue;
    let re = 0; let im = 0;
    for (let i = 0; i < n; i++) {
      const v = (env[from + i] - m) * w[i];
      re += v * Math.cos((2 * Math.PI * k * i) / n);
      im -= v * Math.sin((2 * Math.PI * k * i) / n);
    }
    const p = re * re + im * im;
    tot += p;
    if (hz >= 2.5 && hz <= 6) band += p;
  }
  return band / (tot + 1e-9);
}

/** Le pic d'autocorrélation des attaques entre 0,3 et 1,5 s : la pulsation. */
function beatStrength(onset: ArrayLike<number>, from: number, to: number): number {
  const n = to - from;
  const m = mean(onset, from, to);
  let zero = 0;
  for (let i = from; i < to; i++) zero += (onset[i] - m) ** 2;
  const lo = Math.ceil(0.3 * FPS);
  const hi = Math.min(n - 1, Math.floor(1.5 * FPS));
  let best = -Infinity;
  for (let lag = lo; lag <= hi; lag++) {
    let sum = 0;
    for (let i = from; i + lag < to; i++) sum += (onset[i] - m) * (onset[i + lag] - m);
    best = Math.max(best, sum / (zero + 1e-9));
  }
  return Number.isFinite(best) ? best : 0;
}

/** Les treize mesures de chaque seconde, dans l'ordre de `FEATURE_NAMES`. */
export async function secondFeatures(pcm: Int16Array): Promise<Float64Array[]> {
  const s = await frameSeries(pcm);
  const secs = Math.floor(s.count / FPS);
  const out: Float64Array[] = [];
  for (let sec = 0; sec < secs; sec++) {
    if (sec > 0 && sec % 60 === 0) await yieldToLoop();
    const a = Math.floor(sec * FPS);
    const b = Math.floor((sec + 1) * FPS);
    const a2 = Math.floor(Math.max(0, sec - 0.5) * FPS);
    const b2 = Math.floor(Math.min(secs, sec + 1.5) * FPS);
    const a4 = Math.floor(Math.max(0, sec - 1.5) * FPS);
    const b4 = Math.floor(Math.min(secs, sec + 2.5) * FPS);
    const mp = mean(s.power, a, b);
    let low = 0;
    for (let i = a; i < b; i++) if (s.power[i] < 0.5 * mp) low++;
    let pnum = 0; let pden = 0;
    for (let i = a; i < b; i++) { pnum += s.pnum[i]; pden += s.pden[i]; }
    const window = Array.from(s.pdb.subarray(a2, b2));
    const floor = median(window) - 12;
    const row = new Float64Array(FEATURE_COUNT);
    row[0] = 10 * Math.log10(mp + 1e-10);
    row[1] = mp > 0 ? low / (b - a) : 1;
    row[2] = std(s.envDb, a2, b2);
    row[3] = beatStrength(s.onset, a4, b4);
    row[4] = pden > 0 ? pnum / pden : 0;
    row[5] = mean(s.flux, a, b);
    row[6] = std(s.flux, a, b);
    row[7] = syllabicModulation(s.envDb, a2, b2);
    row[8] = mean(s.centroid, a, b);
    row[9] = mean(s.bass, a, b);
    row[10] = window.filter((v) => v < floor).length / window.length;
    row[11] = mean(s.high, a, b);
    row[12] = std(s.zcr, a, b);
    out.push(row);
  }
  return out;
}
