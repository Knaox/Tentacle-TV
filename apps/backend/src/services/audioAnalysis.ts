/**
 * L'analyse audio inter-épisodes : quand la lancer, dans quel ordre, et où
 * ranger sa réponse. Jumelle de `frameAnalysis.ts`, avec les mêmes trois
 * règles — à la demande au lancement, une fois par média, le lecteur n'attend
 * JAMAIS (`analysisPending`) — et quatre de plus, parce qu'ici on fait
 * travailler Jellyfin :
 *
 *  1. **UN slot pour tout le serveur.** Une analyse à la fois, une file courte ;
 *     au-delà on ignore, la prochaine lecture redemandera ;
 *  2. **la politesse.** Rien ne part tant qu'un autre spectateur est en train
 *     de transcoder une vidéo — le job est différé, deux minutes, cinq fois ;
 *  3. **les échecs se classent.** Un 404 veut dire « ce serveur ne sait pas
 *     faire » : on se tait vingt-quatre heures. Un serveur trop lent met la
 *     fonction au repos une heure. Une erreur transitoire refroidit l'épisode
 *     une heure — et le serveur entier après trois de suite ;
 *  4. **le « rien » se garde, mais pas n'importe lequel.** Un verdict vide est
 *     rangé seulement après une VRAIE comparaison ; « pas de voisin » ou
 *     « Jellyfin muet » ne sont que des refroidissements en mémoire. Et un
 *     verdict vide de plus d'un jour fait revérifier les voisins : une série en
 *     cours de diffusion n'avait qu'un voisin le jour de sa sortie.
 *
 * L'ordre du travail : la tête de l'épisode, les têtes des voisins, puis les
 * queues — ce qui sert le plus tôt d'abord. Un seul verdict, en fin de job.
 */

import type { AudioVerdict } from "../playback/audioVerdict";
import type { PlaybackSegmentsResponse } from "../playback/segmentTypes";
import { detectFingerprintTool, fingerprintToolKnownMissing } from "./audioFingerprintTool";
import { ensureEpisodeFingerprint, type EpisodeFingerprint, type FingerprintFailure, type FingerprintNeed } from "./audioFingerprint";
import { compareWindows } from "./audioMatch";
import { combineComparisons, pickIntro, pickOutro, type NeighbourComparison } from "./audioVerdictRules";
import { isAudioAnalysisEnabled } from "./configStore";
import { getPrisma, hasPrisma } from "./db";
import { fetchEpisodeNeighbours, neighbourKey, type NeighbourEpisode } from "./episodeNeighbours";
import type { EpisodeContext, SegmentSourceBundle } from "./jellyfinSegments";
import { readSessions } from "./watchTime/sessions";

/** Règles du verdict : monter ce numéro périme toutes les lignes en base. */
export const AUDIO_ANALYSIS_VERSION = 1;

export const AUDIO_QUEUE_MAX = 4;
export const ITEM_COOLDOWN_MS = 3600_000;
export const NO_NEIGHBOUR_COOLDOWN_MS = 3600_000;
export const HEAVY_SOURCE_COOLDOWN_MS = 24 * 3600_000;
export const SERVER_DISABLED_MS = 24 * 3600_000;
export const GLOBAL_COOLDOWN_MS = 3600_000;
export const GLOBAL_FAILURES_BEFORE_COOLDOWN = 3;
export const BUSY_DEFER_MS = 120_000;
export const BUSY_MAX_DEFERRALS = 5;
/** Au-delà, les entrées/sorties valent des gigaoctets par fenêtre (remux 4K). */
export const MAX_SOURCE_BITRATE_BPS = 25_000_000;
/** Un greffon installé passe la nuit : on lui laisse un jour sur un item frais. */
export const PLUGIN_GRACE_MS = 24 * 3600_000;
/** Un verdict vide plus vieux que ça fait revérifier les voisins. */
export const EMPTY_VERDICT_RECHECK_MS = 24 * 3600_000;
export const NEIGHBOUR_GAP_MS = 2_000;
const MAX_COOLDOWN_ENTRIES = 500;

export interface AudioAnalysisRequest {
  itemId: string;
  runtimeMs: number;
  mediaSourceId: string | null;
  episode: EpisodeContext;
  need: FingerprintNeed;
  pluginInstalled: boolean;
  /** La clé des voisins du verdict précédent, quand on revérifie. */
  previousNeighbourKey: string | null;
  jellyfinUrl: string;
  apiKey: string;
}

export interface StoredAudioVerdict {
  verdict: AudioVerdict;
  createdAt: Date;
}

export interface AudioAnalysisCounters {
  jobs: number;
  windows: number;
  bytes: number;
  seconds: number;
  verdicts: number;
  silent: number;
  deferred: number;
}

interface QueuedJob extends AudioAnalysisRequest {
  deferrals: number;
}

const queue: QueuedJob[] = [];
const queued = new Set<string>();
let running = false;
const cooldownUntil = new Map<string, number>();
let serverDisabledUntil = 0;
let globalCooldownUntil = 0;
let consecutiveFailures = 0;
let gapMs = NEIGHBOUR_GAP_MS;
const counters: AudioAnalysisCounters = { jobs: 0, windows: 0, bytes: 0, seconds: 0, verdicts: 0, silent: 0, deferred: 0 };

export function audioAnalysisCounters(): AudioAnalysisCounters {
  return { ...counters };
}

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
  for (const key of Object.keys(counters) as Array<keyof AudioAnalysisCounters>) counters[key] = 0;
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
  queue.push({ ...request, deferrals: 0 });
  void pump();
}

async function pump(): Promise<void> {
  if (running) return;
  running = true;
  try {
    for (let job = queue.shift(); job !== undefined; job = queue.shift()) {
      let deferred = false;
      try {
        deferred = await run(job);
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

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Un autre spectateur transcode-t-il une vidéo en ce moment ? */
async function serverBusy(itemId: string): Promise<boolean> {
  const sessions = await readSessions();
  if (sessions === null) return false;
  return sessions.some(
    (s) =>
      s.NowPlayingItem?.Id !== undefined &&
      s.NowPlayingItem.Id !== itemId &&
      s.PlayState?.IsPaused !== true &&
      s.TranscodingInfo?.IsVideoDirect === false,
  );
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

const mmss = (ms: number): string =>
  `${String(Math.floor(ms / 60_000))}:${String(Math.floor((ms / 1000) % 60)).padStart(2, "0")}`;

function describe(verdict: AudioVerdict, runtimeMs: number): string {
  const parts: string[] = [];
  if (verdict.intro) parts.push(`intro ${mmss(verdict.intro.startMs)}→${mmss(verdict.intro.endMs)}`);
  if (verdict.outro) {
    const end = verdict.outro.endMs >= runtimeMs ? "fin" : mmss(verdict.outro.endMs);
    parts.push(`ending ${mmss(verdict.outro.startMs)}→${end}`);
  }
  if (parts.length === 0) return `aucun verdict (${verdict.reason ?? "?"})`;
  return `${parts.join(", ")} (confirmé par ${String(verdict.confirmedBy)})${verdict.reason ? ` ; ${verdict.reason}` : ""}`;
}

/** Le job. Rend `true` quand il s'est différé lui-même (il reste en file). */
async function run(job: QueuedJob): Promise<boolean> {
  const tool = await detectFingerprintTool();
  if (tool === null) return false;

  if (await serverBusy(job.itemId)) {
    job.deferrals += 1;
    counters.deferred += 1;
    if (job.deferrals > BUSY_MAX_DEFERRALS) {
      console.info(`[audio] ${job.itemId} : serveur occupé cinq fois de suite — analyse remise à plus tard`);
      coolDown(job.itemId, ITEM_COOLDOWN_MS);
      return false;
    }
    setTimeout(() => {
      queue.push(job);
      void pump();
    }, BUSY_DEFER_MS);
    return true;
  }

  const startedAt = Date.now();
  const neighbours = await fetchEpisodeNeighbours(job.jellyfinUrl, job.apiKey, job.episode, job.itemId);
  if (neighbours === null) {
    noteFailure(job.itemId, "transient");
    return false;
  }
  if (neighbours.length === 0) {
    coolDown(job.itemId, NO_NEIGHBOUR_COOLDOWN_MS);
    return false;
  }
  const key = neighbourKey(neighbours);
  if (job.previousNeighbourKey !== null && job.previousNeighbourKey === key) {
    // Rien de neuf dans la saison : le verdict vide reste vrai un jour de plus.
    await store(job.itemId, job.runtimeMs, { intro: null, outro: null, confirmedBy: 0, neighbourKey: key, reason: "voisins inchangés" });
    return false;
  }

  counters.jobs += 1;
  const cost = { transcoded: 0, reused: 0, bytes: 0, elapsedMs: 0 };
  const fingerprint = async (itemId: string, runtimeMs: number, mediaSourceId: string | null) => {
    const outcome = await ensureEpisodeFingerprint({
      itemId, runtimeMs, mediaSourceId, need: job.need, jellyfinUrl: job.jellyfinUrl, apiKey: job.apiKey, tool,
    });
    const present = (outcome.fingerprint.head ? 1 : 0) + (outcome.fingerprint.tail ? 1 : 0);
    cost.transcoded += outcome.fetched;
    cost.reused += Math.max(0, present - outcome.fetched);
    cost.bytes += outcome.bytes;
    cost.elapsedMs += outcome.elapsedMs;
    counters.windows += outcome.fetched;
    counters.bytes += outcome.bytes;
    counters.seconds += outcome.elapsedMs / 1000;
    return outcome;
  };

  const current = await fingerprint(job.itemId, job.runtimeMs, job.mediaSourceId);
  if (current.failure !== null) {
    noteFailure(job.itemId, current.failure);
    return false;
  }
  const witnesses: Array<{ neighbour: NeighbourEpisode; fingerprint: EpisodeFingerprint }> = [];
  for (const neighbour of neighbours) {
    await sleep(gapMs);
    const outcome = await fingerprint(neighbour.id, neighbour.runtimeMs, neighbour.mediaSourceId);
    if (outcome.failure === "not-supported" || outcome.failure === "too-slow") {
      noteFailure(job.itemId, outcome.failure);
      return false;
    }
    if (outcome.failure === null) witnesses.push({ neighbour, fingerprint: outcome.fingerprint });
  }
  if (witnesses.length === 0) {
    noteFailure(job.itemId, "transient");
    return false;
  }

  const comparisons: NeighbourComparison[] = [];
  for (const { neighbour, fingerprint: witness } of witnesses) {
    const comparison: NeighbourComparison = {
      neighbourId: neighbour.id, introCompared: false, outroCompared: false, intro: null, outro: null, duplicate: false,
    };
    const head = current.fingerprint.head;
    const tail = current.fingerprint.tail;
    if (job.need.head && head !== null && witness.head !== null) {
      comparison.introCompared = true;
      const picked = pickIntro(await compareWindows(head, witness.head), head.lengthMs);
      comparison.intro = picked.candidate;
      comparison.duplicate = comparison.duplicate || picked.duplicate;
    }
    if (job.need.tail && tail !== null && witness.tail !== null) {
      comparison.outroCompared = true;
      const picked = pickOutro(await compareWindows(tail, witness.tail), tail.lengthMs, job.runtimeMs);
      comparison.outro = picked.candidate;
      comparison.duplicate = comparison.duplicate || picked.duplicate;
    }
    comparisons.push(comparison);
  }
  consecutiveFailures = 0;

  const verdict = combineComparisons(comparisons, key);
  await store(job.itemId, job.runtimeMs, verdict);
  if (isEmpty(verdict)) counters.silent += 1;
  else counters.verdicts += 1;
  const season = job.episode.seasonNumber !== null && job.episode.indexNumber !== null
    ? ` S${String(job.episode.seasonNumber).padStart(2, "0")}E${String(job.episode.indexNumber).padStart(2, "0")}`
    : "";
  console.info(
    `[audio] ${job.itemId}${season} : ${String(witnesses.length)} voisin(s), ` +
      `${String(cost.transcoded)} fenêtre(s) transcodée(s) (${(cost.bytes / 1e6).toFixed(1)} Mo, ` +
      `${(cost.elapsedMs / 1000).toFixed(1)} s), ${String(cost.reused)} réutilisée(s) — ` +
      `${describe(verdict, job.runtimeMs)}, ${String(Math.round((Date.now() - startedAt) / 1000))} s`,
  );
  return false;
}
