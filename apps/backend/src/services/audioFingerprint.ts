/**
 * L'EMPREINTE d'un épisode — sa tête et sa queue — lue en base, sinon
 * calculée, puis rangée. C'est l'unité de travail que l'analyse répète pour
 * l'épisode et pour chacun de ses voisins.
 *
 * # Un transcodage par épisode et par saison
 *
 * La ligne d'un épisode est écrite une fois et relue par ses voisins : sur une
 * saison de N épisodes regardés dans l'ordre, chaque lancement ne coûte que
 * les fenêtres du voisin encore inconnu. Une colonne par fenêtre, écrite dès
 * qu'elle est prête : un redémarrage au milieu laisse une ligne « à
 * compléter », jamais une ligne fausse. Le verdict, lui, n'est écrit qu'en fin
 * de job (`audioAnalysis.ts`).
 *
 * # Ce qui invalide une ligne
 *
 * La version (outil, débit, géométrie) et la durée du fichier, à une seconde
 * près — même témoin que les vignettes. Un `mediaSourceId` différent ne suffit
 * pas à lui seul : c'est la durée qui dit « autre fichier ».
 *
 * # Deux contrôles sur ce qu'on a entendu
 *
 * La tête est lue avec dix pour cent de marge : on la RAMÈNE à la fenêtre. Et
 * une fenêtre dont l'audio est plus court que prévu (flux tronqué, erreur de
 * Jellyfin en cours de route) est refusée, jamais rangée — une empreinte qui
 * s'arrête avant l'ending vaudrait un verdict faux.
 *
 * Les octets d'une empreinte sont ceux des uint32 en boutisme natif — écrits et
 * relus sur la même machine. Prisma rend un `Uint8Array` dont l'offset n'est
 * pas forcément multiple de quatre : on COPIE avant de voir en uint32.
 */

import { mkdtemp, readdir, rm, stat } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import {
  POINTS_PER_SECOND,
  fingerprintFile,
  type FingerprintTool,
} from "./audioFingerprintTool";
import {
  analysisWindows,
  fetchAudioWindowToFile,
  type AudioWindow,
  type WindowFetchFailure,
} from "./audioWindows";
import { getPrisma, hasPrisma } from "./db";

/** Outil, débit, géométrie des fenêtres : monter ce numéro périme les lignes. */
export const AUDIO_FINGERPRINT_VERSION = 1;

/** Une saison se regarde en semaines ; au-delà, l'empreinte se recalcule. */
export const FINGERPRINT_RETENTION_MS = 90 * 24 * 3600_000;
const PURGE_INTERVAL_MS = 24 * 3600_000;

/** Une fenêtre plus courte que prévu de plus de cinq secondes est tronquée. */
export const WINDOW_DURATION_TOLERANCE_S = 5;

/** Le préfixe des dossiers temporaires — balayés au démarrage passé une heure. */
export const TEMP_PREFIX = "tentacle-audio-";
const STALE_TEMP_MS = 3600_000;

/** Souffle entre deux fenêtres : le serveur n'enchaîne pas deux transcodages à 100 %. */
export const AUDIO_WINDOW_GAP_MS = 2_000;

export interface WindowFingerprint {
  startMs: number;
  lengthMs: number;
  points: Uint32Array;
}

export interface EpisodeFingerprint {
  itemId: string;
  runtimeMs: number;
  head: WindowFingerprint | null;
  tail: WindowFingerprint | null;
}

/** Ce que l'analyse veut de cet épisode — seulement les fenêtres qui manquent. */
export interface FingerprintNeed {
  head: boolean;
  tail: boolean;
}

export type FingerprintFailure = WindowFetchFailure | "tool" | "duration";

export interface FingerprintOutcome {
  fingerprint: EpisodeFingerprint;
  /** Fenêtres transcodées pour cette demande (0 = tout venait de la base). */
  fetched: number;
  bytes: number;
  elapsedMs: number;
  failure: FingerprintFailure | null;
}

export interface FingerprintRequest {
  itemId: string;
  runtimeMs: number;
  mediaSourceId: string | null;
  need: FingerprintNeed;
  jellyfinUrl: string;
  apiKey: string;
  tool: FingerprintTool;
  /** Injectables pour les tests : le souffle entre deux fenêtres, la racine des temporaires. */
  sleep?: (ms: number) => Promise<void>;
  workRoot?: string;
}

const defaultSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Une vue uint32 sur une copie ALIGNÉE des octets rangés. */
function toPoints(raw: Uint8Array): Uint32Array {
  const copy = new Uint8Array(raw);
  return new Uint32Array(copy.buffer, 0, Math.floor(copy.byteLength / 4));
}

/** Une copie franche des octets : Prisma veut un `Uint8Array<ArrayBuffer>`, pas une vue. */
function toBytes(points: Uint32Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(points.byteLength);
  out.set(new Uint8Array(points.buffer, points.byteOffset, points.byteLength));
  return out;
}

interface StoredRow {
  version: number;
  runtimeMs: number;
  headStartMs: number | null;
  headWindowMs: number | null;
  head: Uint8Array | null;
  tailStartMs: number | null;
  tailWindowMs: number | null;
  tail: Uint8Array | null;
}

function storedWindow(
  startMs: number | null,
  lengthMs: number | null,
  raw: Uint8Array | null,
): WindowFingerprint | null {
  if (startMs === null || lengthMs === null || raw === null || raw.byteLength < 4) return null;
  return { startMs, lengthMs, points: toPoints(raw) };
}

/** La ligne de l'épisode, si elle est de la bonne version et du même fichier. */
export async function readStoredFingerprint(
  itemId: string,
  runtimeMs: number,
): Promise<EpisodeFingerprint | null> {
  if (!hasPrisma() || runtimeMs <= 0) return null;
  try {
    const row = (await getPrisma().mediaAudioFingerprint.findUnique({
      where: { itemId },
    })) as StoredRow | null;
    if (!row || row.version !== AUDIO_FINGERPRINT_VERSION) return null;
    if (Math.abs(row.runtimeMs - runtimeMs) > 1_000) return null;
    return {
      itemId,
      runtimeMs,
      head: storedWindow(row.headStartMs, row.headWindowMs, row.head),
      tail: storedWindow(row.tailStartMs, row.tailWindowMs, row.tail),
    };
  } catch {
    return null;
  }
}

/** Range UNE fenêtre ; la ligne est créée au besoin, l'autre colonne intacte. */
async function storeWindow(
  request: FingerprintRequest,
  window: AudioWindow,
  fingerprint: WindowFingerprint,
): Promise<void> {
  if (!hasPrisma()) return;
  // Annoté explicitement : un objet conditionnel inférerait `tail?: undefined`,
  // que Prisma refuse sous `exactOptionalPropertyTypes`.
  const columns: {
    headStartMs?: number; headWindowMs?: number; head?: Uint8Array<ArrayBuffer>;
    tailStartMs?: number; tailWindowMs?: number; tail?: Uint8Array<ArrayBuffer>;
  } =
    window.kind === "head"
      ? { headStartMs: fingerprint.startMs, headWindowMs: fingerprint.lengthMs, head: toBytes(fingerprint.points) }
      : { tailStartMs: fingerprint.startMs, tailWindowMs: fingerprint.lengthMs, tail: toBytes(fingerprint.points) };
  const base = {
    version: AUDIO_FINGERPRINT_VERSION,
    runtimeMs: request.runtimeMs,
    mediaSourceId: request.mediaSourceId,
  };
  try {
    await getPrisma().mediaAudioFingerprint.upsert({
      where: { itemId: request.itemId },
      // Une ligne d'une autre version ou d'un autre fichier repart de zéro.
      update: { ...base, ...columns, createdAt: new Date() },
      create: { itemId: request.itemId, ...base, ...columns },
    });
  } catch (error) {
    console.warn(`[audio] ${request.itemId} : empreinte non enregistrée (${String(error)})`);
  }
}

/** Ramène les points à la fenêtre (la tête est lue avec de la marge). */
function trimToWindow(points: Uint32Array, lengthMs: number): Uint32Array {
  const wanted = Math.ceil((lengthMs / 1000) * POINTS_PER_SECOND);
  return points.length > wanted ? points.slice(0, wanted) : points;
}

/**
 * L'empreinte de l'épisode, avec les fenêtres demandées — lues en base, sinon
 * transcodées EN SÉRIE, chacune rangée dès qu'elle est prête. Au premier
 * échec on s'arrête et on le dit : l'appelant décide du refroidissement.
 */
export async function ensureEpisodeFingerprint(request: FingerprintRequest): Promise<FingerprintOutcome> {
  const sleep = request.sleep ?? defaultSleep;
  const stored = await readStoredFingerprint(request.itemId, request.runtimeMs);
  const fingerprint: EpisodeFingerprint = stored ?? {
    itemId: request.itemId, runtimeMs: request.runtimeMs, head: null, tail: null,
  };
  const outcome: FingerprintOutcome = { fingerprint, fetched: 0, bytes: 0, elapsedMs: 0, failure: null };

  const windows = analysisWindows(request.runtimeMs);
  const missing: AudioWindow[] = [];
  if (request.need.head && fingerprint.head === null) missing.push(windows.head);
  if (request.need.tail && fingerprint.tail === null) missing.push(windows.tail);
  if (missing.length === 0 || request.runtimeMs <= 0) return outcome;

  const workDir = await mkdtemp(join(request.workRoot ?? tmpdir(), TEMP_PREFIX));
  try {
    for (const window of missing) {
      if (outcome.fetched > 0) await sleep(AUDIO_WINDOW_GAP_MS);
      const filePath = join(workDir, `${window.kind}.mp3`);
      const fetched = await fetchAudioWindowToFile({
        jellyfinUrl: request.jellyfinUrl,
        apiKey: request.apiKey,
        itemId: request.itemId,
        mediaSourceId: request.mediaSourceId,
        window,
        filePath,
      });
      if (!fetched.ok) {
        outcome.failure = fetched.failure;
        return outcome;
      }
      outcome.fetched += 1;
      outcome.bytes += fetched.bytes;
      outcome.elapsedMs += fetched.elapsedMs;

      let points: Uint32Array;
      let durationS: number;
      try {
        ({ points, durationS } = await fingerprintFile(request.tool, filePath, window.lengthMs / 1000, workDir));
      } catch (error) {
        console.warn(`[audio] ${request.itemId} : empreinte impossible (${String(error)})`);
        outcome.failure = "tool";
        return outcome;
      }
      if (durationS < window.lengthMs / 1000 - WINDOW_DURATION_TOLERANCE_S) {
        console.warn(
          `[audio] ${request.itemId} : ${window.kind} tronquée — ${durationS.toFixed(1)} s ` +
            `entendues pour ${String(Math.round(window.lengthMs / 1000))} s attendues`,
        );
        outcome.failure = "duration";
        return outcome;
      }
      const ready: WindowFingerprint = {
        startMs: window.startMs,
        lengthMs: window.lengthMs,
        points: trimToWindow(points, window.lengthMs),
      };
      if (window.kind === "head") fingerprint.head = ready;
      else fingerprint.tail = ready;
      await storeWindow(request, window, ready);
    }
    return outcome;
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

/** Les dossiers d'une analyse interrompue par un redémarrage, passé une heure. */
export async function sweepStaleTempDirs(now = Date.now(), base = tmpdir()): Promise<number> {
  let removed = 0;
  try {
    for (const name of await readdir(base)) {
      if (!name.startsWith(TEMP_PREFIX)) continue;
      const path = join(base, name);
      try {
        const info = await stat(path);
        if (!info.isDirectory() || now - info.mtimeMs < STALE_TEMP_MS) continue;
        await rm(path, { recursive: true, force: true });
        removed += 1;
      } catch {
        // Un dossier qui disparaît sous nos pieds n'est pas un problème.
      }
    }
  } catch {
    // tmpdir illisible : rien à balayer.
  }
  return removed;
}

let purgeTimer: ReturnType<typeof setInterval> | null = null;

/** Purge quotidienne des empreintes de plus de 90 jours — le modèle des annonces. */
export function startFingerprintPurge(): void {
  if (purgeTimer) return;
  purgeTimer = setInterval(() => void purgeFingerprints(), PURGE_INTERVAL_MS);
  setTimeout(() => void purgeFingerprints(), 60_000);
}

export function stopFingerprintPurge(): void {
  if (purgeTimer) {
    clearInterval(purgeTimer);
    purgeTimer = null;
  }
}

export async function purgeFingerprints(now = Date.now()): Promise<number> {
  if (!hasPrisma()) return 0;
  try {
    const cutoff = new Date(now - FINGERPRINT_RETENTION_MS);
    const { count } = await getPrisma().mediaAudioFingerprint.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    if (count > 0) console.info(`[audio] purge : ${String(count)} empreintes de plus de 90 jours`);
    return count;
  } catch (error) {
    console.warn(`[audio] purge échouée (${String(error)})`);
    return 0;
  }
}
