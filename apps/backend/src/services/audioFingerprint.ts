/**
 * L'EMPREINTE d'un épisode — sa tête et sa queue — gardée en mémoire, sinon
 * calculée. C'est l'unité de travail que l'analyse répète pour l'épisode et
 * pour chacun de ses voisins.
 *
 * # En mémoire, plus en base
 *
 * Une empreinte n'est qu'un INTERMÉDIAIRE de calcul : elle ne dit rien au
 * spectateur. Depuis que le serveur ne range plus que ce qu'une analyse a
 * trouvé, elles vivent dans un cache borné du processus — une centaine
 * d'épisodes, environ 2 Mo. Sur une saison regardée dans l'ordre, les voisins
 * y sont encore : chaque lancement ne coûte que les fenêtres de l'épisode
 * inconnu. Un redémarrage vide le cache, et c'est tout ce qu'il coûte.
 *
 * # Ce qui invalide une empreinte
 *
 * La durée du fichier, à une seconde près — même témoin que les vignettes. Un
 * `mediaSourceId` différent ne suffit pas à lui seul : c'est la durée qui dit
 * « autre fichier ».
 *
 * # Deux contrôles sur ce qu'on a entendu
 *
 * La tête est lue avec dix pour cent de marge : on la RAMÈNE à la fenêtre. Et
 * une fenêtre dont l'audio est plus court que prévu (flux tronqué, erreur de
 * Jellyfin en cours de route) est refusée, jamais gardée — une empreinte qui
 * s'arrête avant l'ending vaudrait un verdict faux.
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

/** Les épisodes gardés en mémoire : environ 20 Ko chacun, têtes et queues comprises. */
export const FINGERPRINT_CACHE_MAX = 96;

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
  /** Fenêtres transcodées pour cette demande (0 = tout venait du cache). */
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

const cache = new Map<string, EpisodeFingerprint>();

/** Pour les tests. */
export function clearFingerprintCacheForTests(): void {
  cache.clear();
}

/** L'empreinte gardée pour cet épisode, si c'est le même fichier. La plus récemment servie reste. */
export function readCachedFingerprint(itemId: string, runtimeMs: number): EpisodeFingerprint | null {
  const found = cache.get(itemId);
  if (found === undefined) return null;
  cache.delete(itemId);
  if (Math.abs(found.runtimeMs - runtimeMs) > 1_000) return null;
  cache.set(itemId, found);
  return found;
}

function keep(fingerprint: EpisodeFingerprint): void {
  cache.delete(fingerprint.itemId);
  cache.set(fingerprint.itemId, fingerprint);
  while (cache.size > FINGERPRINT_CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

/** Ramène les points à la fenêtre (la tête est lue avec de la marge). */
function trimToWindow(points: Uint32Array, lengthMs: number): Uint32Array {
  const wanted = Math.ceil((lengthMs / 1000) * POINTS_PER_SECOND);
  return points.length > wanted ? points.slice(0, wanted) : points;
}

/**
 * L'empreinte de l'épisode, avec les fenêtres demandées — relues du cache,
 * sinon transcodées EN SÉRIE, chacune gardée dès qu'elle est prête. Au premier
 * échec on s'arrête et on le dit : l'appelant décide du refroidissement.
 */
export async function ensureEpisodeFingerprint(request: FingerprintRequest): Promise<FingerprintOutcome> {
  const sleep = request.sleep ?? defaultSleep;
  const cached = readCachedFingerprint(request.itemId, request.runtimeMs);
  const fingerprint: EpisodeFingerprint = cached ?? {
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
      keep(fingerprint);
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
