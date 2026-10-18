#!/usr/bin/env node
/**
 * Dérive le FICHIER du « ta-dum » de l'ouverture depuis sa synthèse partagée
 * (`packages/shared/src/brandIntro/introSynth.ts`) — un actif dérivé, comme
 * les PNG des icônes : régénéré, jamais retouché à la main.
 *
 *   1. Un petit serveur local sert la synthèse (TypeScript dépouillé de ses
 *      types par Node) à Chrome sans tête, qui la joue dans un
 *      `OfflineAudioContext` (le vrai Web Audio, celui du site) ;
 *   2. la page renvoie les échantillons ; on les met à une crête de −9 dBFS
 *      (rien de saturé) et on écrit un WAV 24 bits ;
 *   3. `afconvert` (macOS) l'encode en AAC (.m4a), qu'on redécode pour
 *      vérifier la crête et le calage du début.
 *
 * Usage : node apps/tv/scripts/render-intro-sound.mjs [--keep-wav]
 * Sortie : apps/tv/assets/sound/boot-tadum.m4a (Copy Bundle Resources de l'app tvOS).
 */
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { createServer } from "node:http";
import { stripTypeScriptTypes } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../../..");
const SOURCES = join(ROOT, "packages/shared/src/brandIntro");
const OUT_DIR = join(ROOT, "apps/tv/assets/sound");
const OUT = join(OUT_DIR, "boot-tadum.m4a");
const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const RATE = 48_000;
const TARGET_PEAK_DB = -9;
const AAC_BITRATE = 160_000;

const PAGE = `<!doctype html><meta charset="utf-8"><script type="module">
import { scheduleIntroSound, INTRO_SOUND_SECONDS } from "/m/introSynth";
import { INTRO_SOUND_TA_OFFSET_S } from "/m/introScore";
const ctx = new OfflineAudioContext(2, Math.ceil(${RATE} * INTRO_SOUND_SECONDS), ${RATE});
// Le « ta » à la fin de l'avance de la vague : le fichier commence par elle.
scheduleIntroSound(ctx, INTRO_SOUND_TA_OFFSET_S);
const buffer = await ctx.startRendering();
const left = buffer.getChannelData(0), right = buffer.getChannelData(1);
const body = new Float32Array(left.length * 2);
body.set(left, 0); body.set(right, left.length);
await fetch("/done", { method: "POST", body: body.buffer });
</script>`;

/** Le TypeScript d'un module de la synthèse, servi comme JavaScript. */
function moduleSource(name) {
  const file = join(SOURCES, `${name}.ts`);
  if (!/^[A-Za-z]+$/.test(name) || !existsSync(file)) return null;
  return stripTypeScriptTypes(readFileSync(file, "utf8"), { mode: "strip" });
}

function renderInChrome() {
  return new Promise((resolvePromise, reject) => {
    const profile = mkdtempSync(join(tmpdir(), "tentacle-intro-sound-"));
    let chrome = null;
    const timer = setTimeout(() => finish(new Error("Chrome n'a rien rendu en 60 s")), 60_000);
    const server = createServer((request, response) => {
      if (request.url === "/") {
        response.writeHead(200, { "content-type": "text/html" }).end(PAGE);
      } else if (request.url?.startsWith("/m/")) {
        const source = moduleSource(request.url.slice(3));
        if (source === null) response.writeHead(404).end();
        else response.writeHead(200, { "content-type": "text/javascript" }).end(source);
      } else if (request.url === "/done" && request.method === "POST") {
        const chunks = [];
        request.on("data", (chunk) => chunks.push(chunk));
        request.on("end", () => {
          response.writeHead(204).end();
          const bytes = Buffer.concat(chunks);
          finish(null, new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4));
        });
      } else {
        response.writeHead(404).end();
      }
    });
    function finish(error, samples) {
      clearTimeout(timer);
      // Arrêté par son PID, jamais par son nom : d'autres Chrome tournent peut-être.
      chrome?.kill("SIGTERM");
      server.close();
      setTimeout(() => rmSync(profile, { recursive: true, force: true }), 500);
      if (error) reject(error);
      else resolvePromise(samples);
    }
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--no-first-run", `--user-data-dir=${profile}`, `http://127.0.0.1:${port}/`], {
        stdio: "ignore",
      });
      chrome.on("error", (error) => finish(error));
    });
  });
}

function peakOf(channels) {
  let peak = 0;
  for (const channel of channels) for (const value of channel) peak = Math.max(peak, Math.abs(value));
  return peak;
}

const db = (value) => 20 * Math.log10(value);

/** Un WAV PCM 24 bits stéréo. */
function wavOf(left, right) {
  const frames = left.length;
  const data = Buffer.alloc(frames * 6);
  for (let i = 0; i < frames; i += 1) {
    for (const [index, channel] of [left, right].entries()) {
      const value = Math.max(-1, Math.min(1, channel[i]));
      data.writeIntLE(Math.round(value * 8_388_607), i * 6 + index * 3, 3);
    }
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(2, 22);
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 6, 28);
  header.writeUInt16LE(6, 32);
  header.writeUInt16LE(24, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

/** Les échantillons d'un WAV relu (16 ou 24 bits, ou flottant 32 bits). */
function readWav(file) {
  const bytes = readFileSync(file);
  let offset = 12;
  let format = null;
  while (offset < bytes.length) {
    const id = bytes.toString("ascii", offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4);
    if (id === "fmt ") format = { code: bytes.readUInt16LE(offset + 8), channels: bytes.readUInt16LE(offset + 10), bits: bytes.readUInt16LE(offset + 22) };
    if (id === "data" && format) {
      const width = format.bits / 8;
      const frames = size / (width * format.channels);
      const channels = Array.from({ length: format.channels }, () => new Float32Array(frames));
      for (let i = 0; i < frames; i += 1) {
        for (let c = 0; c < format.channels; c += 1) {
          const at = offset + 8 + (i * format.channels + c) * width;
          channels[c][i] =
            format.code === 3 ? bytes.readFloatLE(at) : width === 3 ? bytes.readIntLE(at, 3) / 8_388_608 : bytes.readInt16LE(at) / 32_768;
        }
      }
      return channels;
    }
    offset += 8 + size + (size % 2);
  }
  throw new Error(`WAV illisible : ${file}`);
}

/** Le premier échantillon audible (au-dessus de −60 dBFS), en ms : le début est-il resté calé ? */
const onsetMs = (channels) => {
  const threshold = 10 ** (-60 / 20);
  const length = channels[0].length;
  for (let i = 0; i < length; i += 1) if (channels.some((channel) => Math.abs(channel[i]) > threshold)) return (i / RATE) * 1000;
  return Number.NaN;
};

const samples = await renderInChrome();
const frames = samples.length / 2;
const left = samples.slice(0, frames);
const right = samples.slice(frames);
const rawPeak = peakOf([left, right]);
const gain = 10 ** (TARGET_PEAK_DB / 20) / rawPeak;
for (const channel of [left, right]) for (let i = 0; i < channel.length; i += 1) channel[i] *= gain;

const work = mkdtempSync(join(tmpdir(), "tentacle-intro-wav-"));
const wav = join(work, "boot-tadum.wav");
writeFileSync(wav, wavOf(left, right));
mkdirSync(OUT_DIR, { recursive: true });
execFileSync("afconvert", ["-f", "m4af", "-d", "aac", "-b", String(AAC_BITRATE), "-q", "127", wav, OUT]);
const decoded = join(work, "decoded.wav");
execFileSync("afconvert", ["-f", "WAVE", "-d", "LEI24", OUT, decoded]);
const back = readWav(decoded);
const report = {
  synthPeakDb: db(rawPeak).toFixed(2),
  wavPeakDb: db(peakOf([left, right])).toFixed(2),
  aacPeakDb: db(peakOf(back)).toFixed(2),
  onsetWavMs: onsetMs([left, right]).toFixed(1),
  onsetAacMs: onsetMs(back).toFixed(1),
  seconds: (frames / RATE).toFixed(3),
  bytes: readFileSync(OUT).length,
};
console.log(JSON.stringify(report, null, 2));
if (peakOf(back) >= 1) throw new Error("le fichier AAC sature");
if (process.argv.includes("--keep-wav")) console.log(`WAV gardé : ${wav}`);
else rmSync(work, { recursive: true, force: true });
console.log(`→ ${OUT.replace(`${ROOT}/`, "")}`);
