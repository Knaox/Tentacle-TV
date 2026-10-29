/**
 * Octave — le DÉROULÉ d'un import, règle pure (sans React, horloge et réseau
 * injectés) : lire (le cœur, ou l'extension pour une source qu'il ne lit pas),
 * rapprocher et créer (le cœur), puis confier les absents à l'extension qui
 * déclare `importTracks` — sinon les lister, jamais les ajouter.
 */

import {
  coreReadsImport,
  extensionImportSource,
  recognizeImportUrl,
  type ImportAbsentTrack,
  type ImportedPlaylist,
  type ImportReadRefusal,
  type ImportTracksAccepted,
  type ImportTracksProgress,
  type ImportTracksRequest,
  type MusicImportFailure,
  type MusicImportJob,
  type MusicImportRequest,
  type MusicImportSource,
} from "@tentacle-tv/shared/music";
import { missingOf, skippedOf, type ImportMissingTrack, type ImportOutsideOutcome } from "@tentacle-tv/shared/octave";

export const CORE_POLL_MS = 400;
export const OUTSIDE_POLL_MS = 700;
/** L'extension a au plus ce temps pour dire où elle en est ; au-delà, le résumé part et elle continue seule. */
export const OUTSIDE_WAIT_MS = 90_000;
const POLL_RETRIES = 5;

export type ImportUserInput = { kind: "url"; url: string } | { kind: "text"; text: string };

/** Liste FERMÉE : le client a ses mots pour chacune. */
export type ImportFlowFailure = MusicImportFailure | ImportReadRefusal | "busy" | "needsExtension" | "network";

export type ImportPhase = "reading" | "matching" | "creating" | "outside" | "done" | "failed";

export interface ImportSummary {
  playlistId: string;
  name: string;
  source: MusicImportSource;
  total: number;
  /** Titres de la bibliothèque entrés dans la playlist. */
  inLibrary: number;
  /** Titres hors bibliothèque entrés par l'extension (jouables). */
  outside: number;
  /** Parmi eux, ceux que le compte avait déjà importés (ses fichiers) : le reste est « en cloud ». */
  own: number;
  /** Ce qui n'est PAS dans la playlist (sans extension : tous les absents), chacun avec son motif. */
  missing: ImportMissingTrack[];
  truncated: boolean;
  /** L'extension n'a pas pu prendre les absents (refus, panne) : ils sont dans `missing`. */
  outsideRefused: boolean;
}

export interface ImportFlowState {
  phase: ImportPhase;
  source: MusicImportSource | null;
  name: string | null;
  total: number;
  matched: number;
  found: number;
  outside: { total: number; processed: number; added: number } | null;
  failure: ImportFlowFailure | null;
  summary: ImportSummary | null;
}

export interface ImportPort {
  startCore: (request: MusicImportRequest, signal: AbortSignal) => Promise<string>;
  core: (jobId: string, signal: AbortSignal) => Promise<MusicImportJob>;
  /** Le code d'un refus du cœur (`busy`, `unsupported_url`…), ou `null`. */
  refusal: (error: unknown) => string | null;
  /** Le serveur lit-il les liens de partage d'un autre Tentacle (capacité `music.playlistShare`) ? */
  tentacleShare?: boolean;
  /** L'extension lit-elle cette source (`importRead` + `importSources`) ? */
  canRead: (source: MusicImportSource) => boolean;
  read: (url: string, signal: AbortSignal) => Promise<{ ok: true; playlist: ImportedPlaylist } | { ok: false; refusal: ImportReadRefusal }>;
  /** L'extension prend-elle les absents (`importTracks`) ? */
  canConfide: boolean;
  confide: (request: ImportTracksRequest, signal: AbortSignal) => Promise<ImportTracksAccepted | null>;
  progress: (operationId: string, signal: AbortSignal) => Promise<ImportTracksProgress>;
  cancel: (operationId: string) => void;
  sleep: (ms: number, signal: AbortSignal) => Promise<void>;
  now: () => number;
}

export const IMPORT_IDLE: ImportFlowState = { phase: "reading", source: null, name: null, total: 0, matched: 0, found: 0, outside: null, failure: null, summary: null };

class FlowStop extends Error {
  constructor(readonly failure: ImportFlowFailure) {
    super(failure);
  }
}

async function pollCore(port: ImportPort, jobId: string, signal: AbortSignal, emit: (patch: Partial<ImportFlowState>) => void): Promise<MusicImportJob> {
  let misses = 0;
  for (;;) {
    let job: MusicImportJob;
    try {
      job = await port.core(jobId, signal);
      misses = 0;
    } catch (error) {
      if (signal.aborted) throw error;
      if (++misses > POLL_RETRIES) throw new FlowStop("network");
      await port.sleep(CORE_POLL_MS, signal);
      continue;
    }
    emit({ phase: job.stage === "done" || job.stage === "failed" ? "creating" : job.stage, source: job.source, name: job.name, total: job.total, matched: job.matched, found: job.found });
    if (job.stage === "done" || job.stage === "failed") return job;
    await port.sleep(CORE_POLL_MS, signal);
  }
}

async function runCore(port: ImportPort, request: MusicImportRequest, signal: AbortSignal, emit: (patch: Partial<ImportFlowState>) => void): Promise<MusicImportJob> {
  let jobId: string;
  try {
    jobId = await port.startCore(request, signal);
  } catch (error) {
    if (signal.aborted) throw error;
    const code = port.refusal(error);
    throw new FlowStop(code === "busy" ? "busy" : code === "unsupported_url" ? "unsupported" : "network");
  }
  return pollCore(port, jobId, signal, emit);
}

async function readThenImport(port: ImportPort, url: string, base: Omit<MusicImportRequest, "url" | "text" | "playlist">, signal: AbortSignal, emit: (patch: Partial<ImportFlowState>) => void) {
  const read = await port.read(url, signal);
  if (!read.ok) throw new FlowStop(read.refusal);
  emit({ source: read.playlist.source, name: read.playlist.name, total: read.playlist.tracks.length });
  return runCore(port, { ...base, playlist: read.playlist }, signal, emit);
}

/** Les absents confiés à l'extension ; rend ce qu'elle a pris et ce qu'elle n'a pas trouvé. */
async function confide(port: ImportPort, playlistId: string, source: MusicImportSource, absent: ImportAbsentTrack[], signal: AbortSignal, emit: (patch: Partial<ImportFlowState>) => void) {
  const accepted = await port.confide({ playlistId, source: extensionImportSource(source), tracks: absent }, signal).catch((error: unknown) => {
    if (signal.aborted) throw error;
    return null;
  });
  if (!accepted) return { added: 0, own: 0, outcome: { kind: "refused", reason: null } as ImportOutsideOutcome };
  const deadline = port.now() + OUTSIDE_WAIT_MS;
  let last: ImportTracksProgress | null = null;
  try {
    while (port.now() < deadline) {
      last = await port.progress(accepted.operationId, signal).catch((error: unknown) => {
        if (signal.aborted) throw error;
        return last;
      });
      if (last) emit({ outside: { total: last.total, processed: last.processed, added: last.added } });
      if (last && last.state !== "running") break;
      await port.sleep(OUTSIDE_POLL_MS, signal);
    }
  } catch (error) {
    port.cancel(accepted.operationId);
    throw error;
  }
  const failed = last?.state === "failed" && (last?.added ?? 0) === 0;
  const outcome: ImportOutsideOutcome = failed ? { kind: "refused", reason: last?.reason ?? null } : { kind: "done", skipped: skippedOf(last) };
  return { added: last?.added ?? 0, own: last?.own ?? 0, outcome };
}

/** Le déroulé ENTIER ; chaque étape se dit par `emit` (état complet). Rejette seulement si `signal` est annulé. */
export async function runImport(input: ImportUserInput, port: ImportPort, emit: (state: ImportFlowState) => void, signal: AbortSignal, name?: string): Promise<ImportFlowState> {
  let state: ImportFlowState = { ...IMPORT_IDLE };
  const patch = (next: Partial<ImportFlowState>) => {
    state = { ...state, ...next };
    emit(state);
  };
  const base = { ...(name ? { name } : {}), keepEmpty: port.canConfide };
  try {
    let job: MusicImportJob;
    if (input.kind === "text") job = await runCore(port, { ...base, text: input.text }, signal, patch);
    else {
      const url = recognizeImportUrl(input.url);
      if (!url) throw new FlowStop("unsupported");
      patch({ source: url.source });
      // Un lien Tentacle face à un serveur qui ne les lit pas : aucune extension ne le lirait mieux.
      if (url.source === "tentacle" && !port.tentacleShare) throw new FlowStop("unsupported");
      if (!coreReadsImport(url.source, port.tentacleShare === true)) {
        if (!port.canRead(url.source)) throw new FlowStop("needsExtension");
        job = await readThenImport(port, url.url, base, signal, patch);
      } else {
        job = await runCore(port, { ...base, url: input.url }, signal, patch);
        // Le cœur ne lit plus cette page (forme changée, refus) : l'extension qui la lit prend le relais.
        if (job.failure === "unavailable" && port.canRead(url.source)) job = await readThenImport(port, url.url, base, signal, patch);
      }
    }
    if (job.stage === "failed" || !job.result) throw new FlowStop(job.failure ?? "failed");
    const result = job.result;
    let outside: { added: number; own: number; outcome: ImportOutsideOutcome } = { added: 0, own: 0, outcome: { kind: "none" } };
    if (result.absent.length > 0 && port.canConfide) {
      patch({ phase: "outside", outside: { total: result.absent.length, processed: 0, added: 0 } });
      outside = await confide(port, result.playlistId, result.source, result.absent, signal, patch);
    }
    patch({
      phase: "done",
      summary: {
        playlistId: result.playlistId, name: result.name, source: result.source, total: result.total, inLibrary: result.added,
        outside: outside.added, own: outside.own, missing: missingOf(result.absent, outside.outcome), truncated: result.truncated,
        outsideRefused: outside.outcome.kind === "refused",
      },
    });
  } catch (error) {
    if (signal.aborted) throw error;
    patch({ phase: "failed", failure: error instanceof FlowStop ? error.failure : "network" });
  }
  return state;
}
