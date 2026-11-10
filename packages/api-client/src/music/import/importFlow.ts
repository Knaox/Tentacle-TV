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
import { missingOf, type ImportMissingTrack, type ImportOutsideOutcome } from "@tentacle-tv/shared/octave";
import { confideAbsent, type ConfideOutcome } from "./importConfide";

export { OUTSIDE_POLL_MS, OUTSIDE_WAIT_MS } from "./importConfide";
export const CORE_POLL_MS = 400;
const POLL_RETRIES = 5;
/** Les refus de l'extension qui laissent le cœur lire (sa page publique, bornée) quand elle devait lire d'abord. */
const READ_FIRST_FALLBACK: readonly ImportReadRefusal[] = ["unavailable", "budget", "unsupported"];

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
  /** L'extension lit-elle cette source EN ENTIER, avant le cœur (`importReadFirst`, 1.43.0) ? */
  readsFirst?: (source: MusicImportSource) => boolean;
  /** L'extension prend-elle les absents (`importTracks`) ? */
  canConfide: boolean;
  /** … par lots (`importBatches`, 1.43.0) ? */
  batches?: boolean;
  /** Un REFUS de l'extension (HTTP < 500), jamais relancé ; absent : rien n'est un refus (tout se relance). */
  isRefusal?: (error: unknown) => boolean;
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

/** Lire par l'extension d'abord ; ses refus « je ne peux pas » rendent la main au cœur (`null`). */
async function readFirst(port: ImportPort, url: string, base: Omit<MusicImportRequest, "url" | "text" | "playlist">, signal: AbortSignal, emit: (patch: Partial<ImportFlowState>) => void): Promise<MusicImportJob | null> {
  const read = await port.read(url, signal);
  if (!read.ok) {
    if (READ_FIRST_FALLBACK.includes(read.refusal)) return null;
    throw new FlowStop(read.refusal);
  }
  emit({ source: read.playlist.source, name: read.playlist.name, total: read.playlist.tracks.length });
  return runCore(port, { ...base, playlist: read.playlist }, signal, emit);
}

/** Les absents qui ne sont PAS dans la playlist, chacun avec son motif ; un titre jamais confié dit `extensionLimit`. */
function missingAfter(absent: Parameters<typeof missingOf>[0], outside: ConfideOutcome): ImportMissingTrack[] {
  return missingOf(absent, outside.outcome).map((t) => (outside.overflow.has(t.index) ? { ...t, reason: "extensionLimit" as const } : t));
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
      const first = port.canRead(url.source) && port.readsFirst?.(url.source) ? await readFirst(port, url.url, base, signal, patch) : null;
      if (first) job = first;
      else if (!coreReadsImport(url.source, port.tentacleShare === true)) {
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
    let outside: ConfideOutcome = { added: 0, own: 0, outcome: { kind: "none" } as ImportOutsideOutcome, overflow: new Set() };
    if (result.absent.length > 0 && port.canConfide) {
      patch({ phase: "outside", outside: { total: result.absent.length, processed: 0, added: 0 } });
      const ctx = { playlistId: result.playlistId, source: extensionImportSource(result.source), importId: job.jobId, name: result.name, artworkUrl: result.artworkUrl ?? null };
      const confidePort = { ...port, isRefusal: port.isRefusal ?? (() => false) };
      outside = await confideAbsent(confidePort, ctx, result.absent, signal, (o) => patch({ outside: o }));
    }
    patch({
      phase: "done",
      summary: {
        playlistId: result.playlistId, name: result.name, source: result.source, total: result.total, inLibrary: result.added,
        outside: outside.added, own: outside.own, missing: missingAfter(result.absent, outside), truncated: result.truncated,
        outsideRefused: outside.outcome.kind === "refused",
      },
    });
  } catch (error) {
    if (signal.aborted) throw error;
    patch({ phase: "failed", failure: error instanceof FlowStop ? error.failure : "network" });
  }
  return state;
}
