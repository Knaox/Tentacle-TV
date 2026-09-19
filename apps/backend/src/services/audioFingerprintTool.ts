/**
 * L'EMPREINTE d'un fichier audio — chromaprint, par un binaire externe.
 *
 * # Pourquoi un binaire, et lequel
 *
 * Chromaprint est LGPL, le projet est MIT : on ne le lie pas, on l'invoque,
 * comme yt-dlp (`routes/trailers.ts`). Deux outils la produisent à l'identique
 * (même bibliothèque derrière) :
 *
 *  - `fpcalc`, paquet Alpine `chromaprint` — c'est l'image Docker ;
 *  - `ffmpeg -f chromaprint`, quand ffmpeg est compilé avec — c'est le poste de
 *    dev, où fpcalc manque. Le muxer écrit les uint32 en boutisme NATIF, donc
 *    petit-boutiste sur x86-64 comme sur arm64.
 *
 * Les deux absents : l'analyse est désactivée, et on le dit UNE fois — jamais
 * une exception, jamais un silence.
 *
 * # Deux pièges de fpcalc
 *
 *  - `-length` vaut 120 s par défaut : sans lui, une fenêtre de dix minutes
 *    n'est empreintée que sur ses deux premières, en silence. On le passe
 *    TOUJOURS ;
 *  - `-raw` a imprimé les entiers en signé jusqu'à la 1.5 : on normalise.
 *
 * # La grille
 *
 * Chromaprint échantillonne à 11 025 Hz et avance de 1 365 échantillons par
 * point : 8,08 points par seconde, 32 bits chacun. La durée se relit dans le
 * JSON de fpcalc ; pour ffmpeg on la déduit du nombre de points.
 */

import { execFile } from "child_process";
import { readFile } from "fs/promises";

/** Points chromaprint par seconde d'audio (11 025 Hz / saut de 1 365). */
export const POINTS_PER_SECOND = 11025 / 1365;

export type FingerprintTool = { kind: "fpcalc"; command: string } | { kind: "ffmpeg"; command: string };

export interface FingerprintResult {
  points: Uint32Array;
  /** Durée d'audio réellement empreintée, en secondes. */
  durationS: number;
}

const EXEC_TIMEOUT_MS = 60_000;
const EXEC_MAX_BUFFER = 8 * 1024 * 1024;

/** Le JSON de fpcalc pour dix minutes pèse ~60 Ko ; on refuse l'absurde. */
const MAX_POINTS = 200_000;

let detection: Promise<FingerprintTool | null> | null = null;
let detected: FingerprintTool | null | undefined;

interface ExecResult {
  stdout: string;
}

/** `execFile` emballé comme dans `trailers.ts` — mockable par `vi.mock("child_process")`. */
function run(command: string, args: string[], timeoutMs = EXEC_TIMEOUT_MS): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout: timeoutMs, maxBuffer: EXEC_MAX_BUFFER }, (err, stdout) => {
      if (err) return reject(err);
      resolve({ stdout: String(stdout ?? "") });
    });
  });
}

/** Le chemin de fpcalc, surchargeable (`FPCALC_PATH`) ; ffmpeg reste sur le PATH. */
function fpcalcCommand(): string {
  return process.env.FPCALC_PATH || "fpcalc";
}

/**
 * Cherche l'outil une fois par processus, et journalise le verdict une fois.
 * Les appels concurrents partagent la même promesse.
 */
export function detectFingerprintTool(): Promise<FingerprintTool | null> {
  if (detection === null) {
    detection = (async () => {
      const fpcalc = fpcalcCommand();
      try {
        const { stdout } = await run(fpcalc, ["-version"], 10_000);
        console.info(`[audio] empreintes par ${stdout.trim() || "fpcalc"}`);
        detected = { kind: "fpcalc", command: fpcalc };
        return detected;
      } catch {
        // Pas de fpcalc : ffmpeg avec chromaprint fait le même travail.
      }
      try {
        const { stdout } = await run("ffmpeg", ["-hide_banner", "-muxers"], 10_000);
        if (/\bchromaprint\b/.test(stdout)) {
          console.info("[audio] empreintes par ffmpeg (muxer chromaprint)");
          detected = { kind: "ffmpeg", command: "ffmpeg" };
          return detected;
        }
      } catch {
        // Pas de ffmpeg non plus.
      }
      console.warn(
        "[audio] aucun outil d'empreinte (fpcalc ou ffmpeg avec chromaprint) — " +
          "analyse audio des passages désactivée (image Docker : apk add chromaprint)",
      );
      detected = null;
      return null;
    })();
  }
  return detection;
}

/** Vrai quand la détection a CONCLU qu'aucun outil n'existe. */
export function fingerprintToolKnownMissing(): boolean {
  return detected === null;
}

/** Pour les tests : oublie la détection. */
export function resetFingerprintToolForTests(): void {
  detection = null;
  detected = undefined;
}

/** `{"duration": 600.1, "fingerprint": [..]}` — entiers signés ou non. */
export function parseFpcalcJson(stdout: string): FingerprintResult {
  const parsed = JSON.parse(stdout) as { duration?: unknown; fingerprint?: unknown };
  if (!Array.isArray(parsed.fingerprint) || parsed.fingerprint.length > MAX_POINTS) {
    throw new Error("fpcalc : empreinte absente ou absurde");
  }
  const points = new Uint32Array(parsed.fingerprint.length);
  for (let i = 0; i < points.length; i++) {
    const value = parsed.fingerprint[i];
    if (typeof value !== "number" || !Number.isInteger(value)) throw new Error("fpcalc : point illisible");
    points[i] = value >>> 0;
  }
  const duration = typeof parsed.duration === "number" && parsed.duration > 0
    ? parsed.duration
    : points.length / POINTS_PER_SECOND;
  return { points, durationS: duration };
}

/** Le fichier brut du muxer ffmpeg : des uint32 petit-boutistes, rien d'autre. */
export function parseRawFingerprint(raw: Buffer): FingerprintResult {
  if (raw.length % 4 !== 0) throw new Error("ffmpeg : empreinte tronquée");
  const count = raw.length / 4;
  if (count > MAX_POINTS) throw new Error("ffmpeg : empreinte absurde");
  const points = new Uint32Array(count);
  for (let i = 0; i < count; i++) points[i] = raw.readUInt32LE(i * 4);
  return { points, durationS: count / POINTS_PER_SECOND };
}

/**
 * Empreinte un fichier audio. `lengthS` borne fpcalc (marge de cinq secondes) ;
 * `workDir` reçoit le fichier brut du repli ffmpeg.
 */
export async function fingerprintFile(
  tool: FingerprintTool,
  filePath: string,
  lengthS: number,
  workDir: string,
): Promise<FingerprintResult> {
  if (tool.kind === "fpcalc") {
    const { stdout } = await run(tool.command, [
      "-raw", "-json", "-length", String(Math.ceil(lengthS) + 5), filePath,
    ]);
    return parseFpcalcJson(stdout);
  }
  const outPath = `${workDir}/fingerprint.bin`;
  await run(tool.command, [
    "-v", "error", "-y", "-i", filePath, "-ac", "1", "-ar", "11025",
    "-f", "chromaprint", "-fp_format", "raw", outPath,
  ]);
  return parseRawFingerprint(await readFile(outPath));
}
