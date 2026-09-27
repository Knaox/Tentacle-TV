/**
 * ÉCOUTER la fin d'un média : l'extrait vient de Jellyfin, ffmpeg le décode,
 * `audioFeatures.ts` le mesure, `speechModel.ts` en tire la frise.
 *
 * # L'extrait
 *
 * Le même chemin que l'analyse des voisins de saison (`audioWindows.ts`) : un
 * MP3 mono à 64 kbit/s transcodé par Jellyfin, avec son `PlaySessionId` unique
 * et le `DELETE /Videos/ActiveEncodings` qui libère le transcodage. La fenêtre
 * court jusqu'au bout du fichier — dix à quinze minutes pour un film, soit 5 à
 * 7 Mo et quelques secondes de transcodage (environ 130 fois le temps réel,
 * mesuré).
 *
 * # Le décodage
 *
 * ffmpeg, en binaire invoqué comme fpcalc : l'image Docker l'embarque (paquet
 * Alpine tiré par yt-dlp, et nommé explicitement depuis cette analyse). Absent,
 * l'analyse se contente des vignettes — on le dit une fois, jamais d'exception.
 */

import { execFile, spawn } from "child_process";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { fetchAudioWindowToFile, type WindowFetchFailure } from "../audioWindows";
import { TEMP_PREFIX } from "../audioFingerprint";
import { SAMPLE_RATE, secondFeatures } from "./audioFeatures";
import { audioClasses } from "./speechModel";

/** Au-delà, on n'écoute pas tout : vingt minutes de fin suffisent à tout générique. */
export const MAX_TAIL_AUDIO_MS = 20 * 60_000;
const MAX_PCM_BYTES = (MAX_TAIL_AUDIO_MS / 1000 + 60) * SAMPLE_RATE * 2;
const DECODE_TIMEOUT_MS = 60_000;

let detection: Promise<boolean> | null = null;
let known: boolean | undefined;

/** ffmpeg est-il là ? Cherché une fois par processus, dit une fois. */
export function detectDecoder(): Promise<boolean> {
  if (detection === null) {
    detection = new Promise((resolve) => {
      execFile("ffmpeg", ["-hide_banner", "-version"], { timeout: 10_000 }, (err) => {
        known = !err;
        if (err) console.warn("[fin] ffmpeg introuvable — l'analyse de fin de média se contente des vignettes");
        resolve(known);
      });
    });
  }
  return detection;
}

/** Vrai quand la détection a CONCLU que ffmpeg manque. */
export function decoderKnownMissing(): boolean {
  return known === false;
}

/** Pour les tests. */
export function resetDecoderForTests(): void {
  detection = null;
  known = undefined;
}

/** Décode un fichier audio en PCM 16 bits mono à 16 kHz. */
export function decodeToPcm(filePath: string): Promise<Int16Array> {
  return new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", ["-v", "error", "-i", filePath, "-ac", "1", "-ar", String(SAMPLE_RATE), "-f", "s16le", "pipe:1"]);
    const chunks: Buffer[] = [];
    let size = 0;
    const timer = setTimeout(() => child.kill("SIGKILL"), DECODE_TIMEOUT_MS);
    child.stdout.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_PCM_BYTES) {
        child.kill("SIGKILL");
        return;
      }
      chunks.push(chunk);
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0 && size <= MAX_PCM_BYTES) return reject(new Error(`ffmpeg a rendu ${String(code)}`));
      const all = Buffer.concat(chunks);
      const samples = new Int16Array(Math.floor(all.length / 2));
      for (let i = 0; i < samples.length; i++) samples[i] = all.readInt16LE(i * 2);
      resolve(samples);
    });
  });
}

export interface TailListenRequest {
  itemId: string;
  mediaSourceId: string | null;
  runtimeMs: number;
  /** D'où écouter, en ms de média ; la fenêtre court jusqu'au bout. */
  fromMs: number;
  jellyfinUrl: string;
  apiKey: string;
}

export type TailListenResult =
  | { ok: true; fromMs: number; classes: string; bytes: number; elapsedMs: number }
  | { ok: false; failure: WindowFetchFailure | "decode" };

export async function listenToTail(request: TailListenRequest): Promise<TailListenResult> {
  const fromMs = Math.max(request.fromMs, request.runtimeMs - MAX_TAIL_AUDIO_MS);
  const lengthMs = request.runtimeMs - fromMs;
  if (lengthMs <= 0) return { ok: false, failure: "transient" };
  // Même préfixe que l'analyse des voisins : le balayage du démarrage les emporte aussi.
  const dir = await mkdtemp(join(tmpdir(), TEMP_PREFIX));
  try {
    const filePath = join(dir, "tail.mp3");
    const fetched = await fetchAudioWindowToFile({
      jellyfinUrl: request.jellyfinUrl,
      apiKey: request.apiKey,
      itemId: request.itemId,
      mediaSourceId: request.mediaSourceId,
      window: { kind: "tail", startMs: fromMs, lengthMs },
      filePath,
    });
    if (!fetched.ok) return { ok: false, failure: fetched.failure };
    let pcm: Int16Array;
    try {
      pcm = await decodeToPcm(filePath);
    } catch (error) {
      console.warn(`[fin] ${request.itemId} : décodage impossible (${String(error)})`);
      return { ok: false, failure: "decode" };
    }
    const classes = audioClasses(await secondFeatures(pcm));
    return { ok: true, fromMs, classes, bytes: fetched.bytes, elapsedMs: fetched.elapsedMs };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
