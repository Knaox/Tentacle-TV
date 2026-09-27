/**
 * Le JOB de l'analyse audio des voisins de saison : les voisins, leurs
 * empreintes, les comparaisons, le verdict. L'ordre du travail : la tête de
 * l'épisode, les têtes des voisins, puis les queues — ce qui sert le plus tôt
 * d'abord. Un seul verdict, en fin de job.
 *
 * Extrait d'`audioAnalysis.ts`, qui passait les 300 lignes : l'état (file,
 * refroidissements, verdicts vides retenus en mémoire) reste là-bas, et ce
 * module n'y touche que par le contexte qu'on lui passe.
 */

import type { AudioVerdict } from "../playback/audioVerdict";
import { detectFingerprintTool } from "./audioFingerprintTool";
import { ensureEpisodeFingerprint, type EpisodeFingerprint, type FingerprintFailure, type FingerprintNeed } from "./audioFingerprint";
import { countAudioDeferral, countAudioJob, countAudioOutcome, countAudioWindow, otherViewerTranscoding } from "./audioJobs";
import { compareWindows } from "./audioMatch";
import { combineComparisons, pickIntro, pickOutro, type NeighbourComparison } from "./audioVerdictRules";
import { fetchEpisodeNeighbours, neighbourKey, type NeighbourEpisode } from "./episodeNeighbours";
import type { EpisodeContext } from "./jellyfinSegments";

export const ITEM_COOLDOWN_MS = 3600_000;
export const NO_NEIGHBOUR_COOLDOWN_MS = 3600_000;
export const BUSY_DEFER_MS = 120_000;
export const BUSY_MAX_DEFERRALS = 5;

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

export interface QueuedJob extends AudioAnalysisRequest {
  deferrals: number;
}

/** Ce que le job peut faire de l'état d'`audioAnalysis.ts`. */
export interface JobContext {
  gapMs: number;
  noteFailure(itemId: string, failure: FingerprintFailure): void;
  coolDown(itemId: string, ms: number): void;
  rememberEmpty(itemId: string, key: string): void;
  store(itemId: string, runtimeMs: number, verdict: AudioVerdict): Promise<void>;
  resetFailures(): void;
  requeue(job: QueuedJob): void;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
const isEmpty = (verdict: AudioVerdict): boolean => verdict.intro === null && verdict.outro === null;

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
export async function runNeighbourJob(job: QueuedJob, ctx: JobContext): Promise<boolean> {
  const tool = await detectFingerprintTool();
  if (tool === null) return false;

  if (await otherViewerTranscoding(job.itemId)) {
    job.deferrals += 1;
    countAudioDeferral();
    if (job.deferrals > BUSY_MAX_DEFERRALS) {
      console.info(`[audio] ${job.itemId} : serveur occupé cinq fois de suite — analyse remise à plus tard`);
      ctx.coolDown(job.itemId, ITEM_COOLDOWN_MS);
      return false;
    }
    setTimeout(() => ctx.requeue(job), BUSY_DEFER_MS);
    return true;
  }

  const startedAt = Date.now();
  const neighbours = await fetchEpisodeNeighbours(job.jellyfinUrl, job.apiKey, job.episode, job.itemId);
  if (neighbours === null) {
    ctx.noteFailure(job.itemId, "transient");
    return false;
  }
  if (neighbours.length === 0) {
    ctx.coolDown(job.itemId, NO_NEIGHBOUR_COOLDOWN_MS);
    return false;
  }
  const key = neighbourKey(neighbours);
  if (job.previousNeighbourKey !== null && job.previousNeighbourKey === key) {
    // Rien de neuf dans la saison : le verdict vide reste vrai un jour de plus.
    ctx.rememberEmpty(job.itemId, key);
    console.info(`[audio] ${job.itemId} : voisins inchangés — toujours rien, rien d'enregistré`);
    return false;
  }

  countAudioJob();
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
    if (outcome.fetched > 0) countAudioWindow(outcome.bytes, outcome.elapsedMs, outcome.fetched);
    return outcome;
  };

  const current = await fingerprint(job.itemId, job.runtimeMs, job.mediaSourceId);
  if (current.failure !== null) {
    ctx.noteFailure(job.itemId, current.failure);
    return false;
  }
  const witnesses: Array<{ neighbour: NeighbourEpisode; fingerprint: EpisodeFingerprint }> = [];
  for (const neighbour of neighbours) {
    await sleep(ctx.gapMs);
    const outcome = await fingerprint(neighbour.id, neighbour.runtimeMs, neighbour.mediaSourceId);
    if (outcome.failure === "not-supported" || outcome.failure === "too-slow") {
      ctx.noteFailure(job.itemId, outcome.failure);
      return false;
    }
    if (outcome.failure === null) witnesses.push({ neighbour, fingerprint: outcome.fingerprint });
  }
  if (witnesses.length === 0) {
    ctx.noteFailure(job.itemId, "transient");
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
  ctx.resetFailures();

  const verdict = combineComparisons(comparisons, key);
  // Seul ce qui a été trouvé s'écrit ; le « rien » refroidit en mémoire.
  if (isEmpty(verdict)) ctx.rememberEmpty(job.itemId, key);
  else await ctx.store(job.itemId, job.runtimeMs, verdict);
  countAudioOutcome(!isEmpty(verdict));
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
