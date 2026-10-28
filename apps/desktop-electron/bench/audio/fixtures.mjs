/**
 * Fichiers témoins du banc audio — générés, jamais versionnés.
 *
 * Le signal est DÉTERMINISTE et NON PÉRIODIQUE (deux glissandos), pour qu'un
 * décalage de quelques échantillons se mesure sans ambiguïté par
 * comparaison avec la référence brute : un blanc, une coupe ou un saut au
 * raccord d'un enchaînement, d'une bascule, se voient à l'échantillon près.
 *
 * - `album-1..3.flac` : un album CONTINU (un seul signal découpé en trois, à
 *   des frontières qui ne tombent sur aucune trame) + `album.ref.s16` (la
 *   référence brute, s16le stéréo 44,1 kHz) ;
 * - `formats/*` : FLAC 24/96, ALAC, WAV, Opus, AAC, MP3, DSF (DSD64, écrit ici :
 *   ffmpeg n'a pas d'encodeur DSD) ;
 * - `onset.flac` : un signal plein dès l'échantillon 0 (latence clic → son).
 *
 * Usage : node fixtures.mjs <dossier>  (ffmpeg dans le PATH)
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export const RATE = 44100;
/** Frontières de l'album, en échantillons (par canal) — volontairement « tordues ». */
export const ALBUM_CUTS = [176423, 352911];
export const ALBUM_SAMPLES = 529_271;

/**
 * Un bruit DÉTERMINISTE (hachage entier de l'indice) : sans lui, le glissando
 * est presque périodique sur quelques dizaines de millisecondes et une
 * corrélation hésite d'une période à l'autre (banc web, mesuré).
 */
function noise(i, channel) {
  let x = (Math.imul(i, 2654435761) ^ (channel * 0x9e3779b9)) >>> 0;
  x ^= x >>> 15;
  x = Math.imul(x, 0x2c1b3c6d) >>> 0;
  x ^= x >>> 12;
  return (x / 0xffffffff) * 2 - 1;
}

/** Le signal de référence : deux glissandos à −8 dBFS et un bruit à −26 dBFS. */
export function sample(i, channel) {
  const t = i / RATE;
  const f0 = channel === 0 ? 220 : 330;
  const k = channel === 0 ? 70 : 45; // Hz par seconde
  return 0.36 * Math.sin(2 * Math.PI * (f0 * t + (k * t * t) / 2)) + 0.05 * noise(i, channel);
}

function pcm(from, to) {
  const buf = Buffer.alloc((to - from) * 4);
  for (let i = from; i < to; i += 1) {
    for (let c = 0; c < 2; c += 1) {
      buf.writeInt16LE(Math.round(sample(i, c) * 32767), (i - from) * 4 + c * 2);
    }
  }
  return buf;
}

function ffmpeg(input, args, out) {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-f", "s16le", "-ar", String(RATE), "-ac", "2", "-i", input, ...args, out]);
  if (r.status !== 0) throw new Error(`ffmpeg ${out} : ${r.stderr}`);
}

/** Un DSF DSD64 stéréo minimal (sigma-delta d'ordre 2 sur le même signal). */
function writeDsf(file, seconds) {
  const dsdRate = 2_822_400;
  const block = 4096; // octets par canal et par bloc, imposé par le format
  const bits = Math.ceil((dsdRate * seconds) / (block * 8)) * block * 8;
  const bytesPerChannel = bits / 8;
  const data = Buffer.alloc(bytesPerChannel * 2);
  for (let c = 0; c < 2; c += 1) {
    let i1 = 0, i2 = 0, y = 0;
    for (let n = 0; n < bits; n += 1) {
      const x = sample((n * RATE) / dsdRate, c) * 0.5;
      i1 += x - y;
      i2 += i1 - y;
      y = i2 >= 0 ? 1 : -1;
      if (y > 0) {
        const byteIndex = Math.floor(n / 8);
        const blockIndex = Math.floor(byteIndex / block);
        const offset = blockIndex * block * 2 + c * block + (byteIndex % block);
        data[offset] |= 1 << (n % 8); // LSB d'abord (DSF)
      }
    }
  }
  const head = Buffer.alloc(28 + 52 + 12);
  head.write("DSD ", 0); head.writeBigUInt64LE(28n, 4);
  head.writeBigUInt64LE(BigInt(92 + data.length), 12); head.writeBigUInt64LE(0n, 20);
  head.write("fmt ", 28); head.writeBigUInt64LE(52n, 32);
  head.writeUInt32LE(1, 40); head.writeUInt32LE(0, 44); head.writeUInt32LE(2, 48);
  head.writeUInt32LE(2, 52); head.writeUInt32LE(dsdRate, 56); head.writeUInt32LE(1, 60);
  head.writeBigUInt64LE(BigInt(bits), 64); head.writeUInt32LE(block, 72); head.writeUInt32LE(0, 76);
  head.write("data", 80); head.writeBigUInt64LE(BigInt(12 + data.length), 84);
  writeFileSync(file, Buffer.concat([head, data]));
}

/**
 * Un témoin brut écrit s'il manque, sans « existe ? » puis « écris » (CodeQL js/file-system-race) : `wx` refuse
 * un fichier déjà là, gardé tel quel. Le signal est recalculé à chaque passage (quelques millisecondes).
 */
function writeOnce(file, make) {
  try {
    writeFileSync(file, make(), { flag: "wx" });
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
  }
}

/**
 * Le dossier GARDÉ d'un banc (ses témoins se réutilisent d'un passage à l'autre) : `BENCH_DIR`, sinon le cache
 * de l'utilisateur — jamais un nom fixe dans le dossier temporaire, qu'un autre compte de la machine pourrait
 * préparer d'avance (CodeQL js/insecure-temporary-file).
 */
export function benchDir(name) {
  const dir = process.env.BENCH_DIR ?? path.join(os.homedir(), ".cache", "tentacle-bench", name);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  return dir;
}

export function generate(dir) {
  mkdirSync(path.join(dir, "formats"), { recursive: true });
  const ref = path.join(dir, "album.ref.s16");
  writeOnce(ref, () => pcm(0, ALBUM_SAMPLES));
  const bounds = [0, ...ALBUM_CUTS, ALBUM_SAMPLES];
  for (let k = 0; k < 3; k += 1) {
    const out = path.join(dir, `album-${k + 1}.flac`);
    if (existsSync(out)) continue;
    const raw = path.join(dir, `album-${k + 1}.s16`);
    writeFileSync(raw, pcm(bounds[k], bounds[k + 1]));
    ffmpeg(raw, ["-c:a", "flac", "-metadata", `track=${k + 1}`, "-metadata", "album=Banc continu",
      "-metadata", "REPLAYGAIN_TRACK_GAIN=-3.00 dB", "-metadata", "REPLAYGAIN_ALBUM_GAIN=-6.00 dB"], out);
  }
  const three = path.join(dir, "three.s16");
  writeOnce(three, () => pcm(0, RATE * 3));
  const formats = {
    "flac-24-96.flac": ["-c:a", "flac", "-sample_fmt", "s32", "-ar", "96000"],
    "alac.m4a": ["-c:a", "alac"],
    "pcm.wav": ["-c:a", "pcm_s24le"],
    "opus.opus": ["-c:a", "libopus", "-b:a", "160k"],
    "aac.m4a": ["-c:a", "aac", "-b:a", "256k"],
    "mp3.mp3": ["-c:a", "libmp3lame", "-b:a", "320k"],
  };
  for (const [name, args] of Object.entries(formats)) {
    const out = path.join(dir, "formats", name);
    if (!existsSync(out)) ffmpeg(three, args, out);
  }
  const dsf = path.join(dir, "formats", "dsd64.dsf");
  if (!existsSync(dsf)) writeDsf(dsf, 3);
  const onset = path.join(dir, "onset.flac");
  if (!existsSync(onset)) ffmpeg(three, ["-c:a", "flac"], onset);
  return dir;
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const dir = process.argv[2];
  if (!dir) throw new Error("usage : node fixtures.mjs <dossier>");
  console.log(generate(path.resolve(dir)));
}
