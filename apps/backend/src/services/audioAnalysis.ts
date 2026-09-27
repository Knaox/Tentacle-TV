/**
 * L'analyse audio inter-épisodes : quand la lancer, dans quel ordre, et où
 * ranger sa réponse. Jumelle de l'analyse de fin de média (`tailAnalysis/`),
 * avec les mêmes trois règles — à la demande au lancement, une fois par
 * média, le lecteur n'attend JAMAIS (`analysisPending`) — et quatre de plus,
 * parce qu'ici on fait travailler Jellyfin :
 *
 *  1. **UN slot pour tout le serveur.** Une analyse à la fois, une file courte ;
 *     au-delà on ignore, la prochaine lecture redemandera ;
 *  2. **la politesse.** Rien ne part tant qu'un autre spectateur est en train
 *     de transcoder une vidéo — le job est différé, deux minutes, cinq fois ;
 *  3. **les échecs se classent.** Un 404 veut dire « ce serveur ne sait pas
 *     faire » : on se tait vingt-quatre heures. Un serveur trop lent met la
 *     fonction au repos une heure. Une erreur transitoire refroidit l'épisode
 *     une heure — et le serveur entier après trois de suite ;
 *  4. **le « rien » ne pèse pas sur le serveur.** Seul un verdict qui a trouvé
 *     quelque chose est rangé en base ; un verdict vide n'est qu'un
 *     refroidissement EN MÉMOIRE d'un jour, avec la clé des voisins comparés.
 *     Passé ce jour, les voisins sont revérifiés : une série en cours de
 *     diffusion n'avait qu'un voisin le jour de sa sortie.
 *
 * Le créneau, la politesse et les compteurs sont partagés avec l'analyse de fin
 * de média (`audioJobs.ts`) : jamais deux transcodages audio à la fois.
 *
 * Le job lui-même — voisins, empreintes, comparaisons — vit dans
 * `audioNeighbourJob.ts` ; ce module garde la file, les refroidissements et la
 * base.
 */

import type { AudioVerdict } from "../playback/audioVerdict";
import type { PlaybackSegmentsResponse } from "../playback/segmentTypes";
import { fingerprintToolKnownMissing } from "./audioFingerprintTool";
import type { FingerprintFailure, FingerprintNeed } from "./audioFingerprint";
import { resetAudioCountersForTests, withAudioSlot } from "./audioJobs";
import { ITEM_COOLDOWN_MS, runNeighbourJob, type AudioAnalysisRequest, type JobContext, type QueuedJob } from "./audioNeighbourJob";
import { isAudioAnalysisEnabled } from "./configStore";
import { getPrisma, hasPrisma } from "./db";
import type { SegmentSourceBundle } from "./jellyfinSegments";

export { audioAnalysisCounters, type AudioAnalysisCounters } from "./audioJobs";
export {
  BUSY_DEFER_MS,
  BUSY_MAX_DEFERRALS,
  ITEM_COOLDOWN_MS,
  NO_NEIGHBOUR_COOLDOWN_MS,
  type AudioAnalysisRequest,
} from "./audioNeighbourJob";

/** Règles du verdict : monter ce numéro périme toutes les lignes en base. */
export const AUDIO_ANALYSIS_VERSION = 1;

export const AUDIO_QUEUE_MAX = 4;
export const HEAVY_SOURCE_COOLDOWN_MS = 24 * 3600_000;
export const SERVER_DISABLED_MS = 24 * 3600_000;
export const GLOBAL_COOLDOWN_MS = 3600_000;
export const GLOBAL_FAILURES_BEFORE_COOLDOWN = 3;
/** Au-delà, les entrées/sorties valent des gigaoctets par fenêtre (remux 4K). */
export const MAX_SOURCE_BITRATE_BPS = 25_000_000;
/** Un greffon installé passe la nuit : on lui laisse un jour sur un item frais. */
export const PLUGIN_GRACE_MS = 24 * 3600_000;
/** Un verdict vide plus vieux que ça fait revérifier les voisins. */
export const EMPTY_VERDICT_RECHECK_MS = 24 * 3600_000;
export const NEIGHBOUR_GAP_MS = 2_000;
const MAX_COOLDOWN_ENTRIES = 500;

export interface StoredAudioVerdict {
  verdict: AudioVerdict;
  createdAt: Date;
}

const queue: QueuedJob[] = [];
const queued = new Set<string>();
let running = false;
const cooldownUntil = new Map<string, number>();
let serverDisabledUntil = 0;
let globalCooldownUntil = 0;
let consecutiveFailures = 0;
let gapMs = NEIGHBOUR_GAP_MS;
/** Les verdicts vides, en mémoire seulement : quand, et avec quels voisins. */
const emptyVerdicts = new Map<string, { at: number; neighbourKey: string }>();

/** Pour les tests : file, refroidissements, compteurs — et le souffle entre voisins. */
export function resetAudioAnalysisForTests(options: { gapMs?: number } = {}): void {
  queue.length = 0;
  queued.clear();
  running = false;
  cooldownUntil.clear();
  serverDisabledUntil = 0;
  globalCooldownUntil = 0;
  consecutiveFailures = 0;
  gapMs = options.gapMs ?? NEIGHBOUR_GAP_MS;
  emptyVerdicts.clear();
  resetAudioCountersForTests();
}

/** Retient un verdict vide sans l'écrire : un jour de silence, puis revérification. */
function rememberEmpty(itemId: string, key: string, now = Date.now()): void {
  if (emptyVerdicts.size >= MAX_COOLDOWN_ENTRIES) {
    const oldest = emptyVerdicts.keys().next().value;
    if (oldest !== undefined) emptyVerdicts.delete(oldest);
  }
  emptyVerdicts.delete(itemId);
  emptyVerdicts.set(itemId, { at: now, neighbourKey: key });
}

function coolDown(itemId: string, ms: number, now = Date.now()): void {
  if (cooldownUntil.size >= MAX_COOLDOWN_ENTRIES) {
    const oldest = cooldownUntil.keys().next().value;
    if (oldest !== undefined) cooldownUntil.delete(oldest);
  }
  cooldownUntil.set(itemId, now + ms);
}

const coolingDown = (itemId: string, now = Date.now()): boolean => (cooldownUntil.get(itemId) ?? 0) > now;

/** Ce que l'audio pourrait encore apporter à ce contrat. */
export function audioNeeds(resolved: PlaybackSegmentsResponse): FingerprintNeed {
  return {
    head: !resolved.segments.some((s) => s.type === "Intro"),
    tail: !resolved.segments.some((s) => s.type === "Outro"),
  };
}

const isEmpty = (verdict: AudioVerdict): boolean => verdict.intro === null && verdict.outro === null;

/**
 * Faut-il lancer (ou relancer) l'analyse ? L'épisode d'abord — les tests des
 * films et des items sans saison court-circuitent avant toute autre lecture.
 */
export function needsAudioAnalysis(
  resolved: PlaybackSegmentsResponse,
  bundle: SegmentSourceBundle,
  stored: StoredAudioVerdict | undefined,
  now = Date.now(),
): boolean {
  const episode = bundle.episode;
  if (episode === null || (episode.seasonNumber !== null && episode.seasonNumber < 1)) return false;
  if (resolved.runtimeMs <= 0) return false;
  const need = audioNeeds(resolved);
  if (!need.head && !need.tail) return false;
  if (!isAudioAnalysisEnabled() || fingerprintToolKnownMissing()) return false;
  if (serverDisabledUntil > now || globalCooldownUntil > now || coolingDown(resolved.itemId, now)) return false;
  const empty = emptyVerdicts.get(resolved.itemId);
  if (empty !== undefined && now - empty.at < EMPTY_VERDICT_RECHECK_MS) return false;
  if (stored !== undefined) {
    // Un verdict plein, ou vide et récent, est définitif.
    if (!isEmpty(stored.verdict) || now - stored.createdAt.getTime() < EMPTY_VERDICT_RECHECK_MS) return false;
  }
  if (episode.sourceBitrate !== null && episode.sourceBitrate > MAX_SOURCE_BITRATE_BPS) {
    console.info(`[audio] ${resolved.itemId} : fichier trop lourd (${String(Math.round(episode.sourceBitrate / 1e6))} Mbit/s) — pas d'analyse`);
    coolDown(resolved.itemId, HEAVY_SOURCE_COOLDOWN_MS, now);
    return false;
  }
  if (bundle.sources.pluginDict != null && episode.createdAt !== null) {
    const age = now - Date.parse(episode.createdAt);
    if (Number.isFinite(age) && age < PLUGIN_GRACE_MS) {
      coolDown(resolved.itemId, PLUGIN_GRACE_MS - age, now);
      return false;
    }
  }
  return true;
}

/** Le verdict rangé, ou `undefined` quand ce média n'a jamais été analysé. */
export async function readStoredAudioVerdict(
  itemId: string,
  runtimeMs: number,
): Promise<StoredAudioVerdict | undefined> {
  if (!hasPrisma() || runtimeMs <= 0) return undefined;
  try {
    const row = await getPrisma().mediaAudioAnalysis.findUnique({ where: { itemId } });
    if (!row || row.version !== AUDIO_ANALYSIS_VERSION) return undefined;
    if (Math.abs(row.runtimeMs - runtimeMs) > 1_000) return undefined;
    const verdict: AudioVerdict = row.verdict === null
      ? { intro: null, outro: null, confirmedBy: 0, neighbourKey: "" }
      : (JSON.parse(row.verdict) as AudioVerdict);
    return { verdict, createdAt: row.createdAt };
  } catch {
    return undefined;
  }
}

async function store(itemId: string, runtimeMs: number, verdict: AudioVerdict): Promise<void> {
  if (!hasPrisma()) return;
  const row = { version: AUDIO_ANALYSIS_VERSION, runtimeMs, verdict: JSON.stringify(verdict), createdAt: new Date() };
  try {
    await getPrisma().mediaAudioAnalysis.upsert({ where: { itemId }, update: row, create: { itemId, ...row } });
  } catch (error) {
    console.warn(`[audio] ${itemId} : verdict non enregistré (${String(error)})`);
  }
}

/** Les verdicts vides rangés avant qu'on cesse de les écrire — au démarrage. */
export async function purgeEmptyAudioVerdicts(): Promise<number> {
  if (!hasPrisma()) return 0;
  try {
    const { count } = await getPrisma().mediaAudioAnalysis.deleteMany({
      where: { OR: [{ verdict: null }, { verdict: { contains: '"intro":null,"outro":null' } }] },
    });
    if (count > 0) console.info(`[audio] purge : ${String(count)} verdicts vides`);
    return count;
  } catch (error) {
    console.warn(`[audio] purge échouée (${String(error)})`);
    return 0;
  }
}

/** Une analyse est-elle en file ou en cours pour ce média ? (pour `analysisPending`) */
export function audioAnalysisPending(itemId: string): boolean {
  return queued.has(itemId);
}

/** Met l'analyse en file. Rend la main tout de suite. */
export function enqueueAudioAnalysis(request: AudioAnalysisRequest): void {
  if (queued.has(request.itemId)) return;
  if (queue.length >= AUDIO_QUEUE_MAX) {
    console.info(`[audio] ${request.itemId} : file pleine, analyse remise à une prochaine lecture`);
    return;
  }
  queued.add(request.itemId);
  const previousNeighbourKey = request.previousNeighbourKey ?? emptyVerdicts.get(request.itemId)?.neighbourKey ?? null;
  queue.push({ ...request, previousNeighbourKey, deferrals: 0 });
  void pump();
}

async function pump(): Promise<void> {
  if (running) return;
  running = true;
  try {
    for (let job = queue.shift(); job !== undefined; job = queue.shift()) {
      let deferred = false;
      try {
        deferred = await withAudioSlot(() => runNeighbourJob(job, jobContext));
      } catch (error) {
        console.warn(`[audio] ${job.itemId} : analyse abandonnée (${String(error)})`);
      } finally {
        if (!deferred) queued.delete(job.itemId);
      }
    }
  } finally {
    running = false;
  }
}

function noteFailure(itemId: string, failure: FingerprintFailure, now = Date.now()): void {
  if (failure === "not-supported") {
    if (serverDisabledUntil <= now) console.warn("[audio] Jellyfin refuse le flux audio d'un épisode — analyse suspendue 24 h");
    serverDisabledUntil = now + SERVER_DISABLED_MS;
    return;
  }
  if (failure === "too-slow") {
    console.warn("[audio] serveur trop lent ou trop chargé pour transcoder — analyse au repos 1 h");
    globalCooldownUntil = now + GLOBAL_COOLDOWN_MS;
    return;
  }
  coolDown(itemId, ITEM_COOLDOWN_MS, now);
  consecutiveFailures += 1;
  if (consecutiveFailures >= GLOBAL_FAILURES_BEFORE_COOLDOWN) {
    console.warn(`[audio] ${String(consecutiveFailures)} échecs de suite — analyse au repos 1 h`);
    globalCooldownUntil = now + GLOBAL_COOLDOWN_MS;
    consecutiveFailures = 0;
  }
}

/** Ce que le job peut toucher de l'état de ce module. */
const jobContext: JobContext = {
  get gapMs() {
    return gapMs;
  },
  noteFailure: (itemId, failure) => noteFailure(itemId, failure),
  coolDown: (itemId, ms) => coolDown(itemId, ms),
  rememberEmpty: (itemId, key) => rememberEmpty(itemId, key),
  store,
  resetFailures: () => {
    consecutiveFailures = 0;
  },
  requeue: (job) => {
    queue.push(job);
    void pump();
  },
};
