/**
 * Octave — le DÉROULÉ d'un import de sortie, sans React ni réseau (un port les apporte : testable) :
 * - un lien : on le confie, puis on suit le job jusqu'à l'album ;
 * - des fichiers : on annonce le lot, on envoie chaque fichier par morceaux (`RELEASE_CHUNK_BYTES`), chacun à sa
 *   place ; une coupure se réessaie seule (le serveur dit d'où repartir), puis met l'import EN PAUSE — « Reprendre »
 *   rejoue le même job sans renvoyer ce qui est déjà reçu ; un fichier refusé n'arrête pas les autres ;
 * - puis on suit la lecture des tags jusqu'aux albums créés.
 */

import type { ReleaseFilesRequest, ReleaseImportJob, ReleaseRefusal, ReleaseUploadProgress } from "@tentacle-tv/shared/music";
import { RELEASE_DEFAULT_CHUNK_BYTES, remainingChunks } from "./releaseModel";
import { ReleaseRequestError, toReleaseError } from "./releaseRequests";

/** Un fichier choisi sur l'appareil : son nom, sa taille, et la lecture d'une tranche (web : `Blob.slice`). */
export interface ReleaseLocalFile {
  name: string;
  size: number;
  /** Type MIME connu de l'appareil, ou "". */
  type: string;
  read: (start: number, end: number) => Promise<BodyInit>;
}

export interface ReleasePort {
  startLink: (url: string, signal: AbortSignal) => Promise<ReleaseImportJob>;
  startFiles: (request: ReleaseFilesRequest, signal: AbortSignal) => Promise<ReleaseImportJob>;
  putChunk: (uploadId: string, offset: number, body: BodyInit, signal: AbortSignal) => Promise<ReleaseUploadProgress>;
  uploaded: (uploadId: string, signal: AbortSignal) => Promise<ReleaseUploadProgress>;
  job: (jobId: string, signal: AbortSignal) => Promise<ReleaseImportJob>;
  sleep: (ms: number, signal: AbortSignal) => Promise<void>;
  /**
   * Un morceau au plus, côté APPAREIL (sous `chunkBytes` du job) : le mobile lit et encode chaque morceau sur son
   * fil JavaScript — des morceaux plus petits n'y bloquent rien de visible.
   */
  chunkLimit?: number;
}

export type ReleasePhase = "starting" | "sending" | "reading" | "paused" | "done" | "failed";

export interface ReleaseFlowState {
  phase: ReleasePhase;
  source: "bandcamp" | "files";
  job: ReleaseImportJob | null;
  /** Octets envoyés (reçus par le serveur), sur le total du lot. */
  sentBytes: number;
  totalBytes: number;
  /** Le fichier en cours d'envoi (son rang dans le lot), `null` hors envoi. */
  sending: number | null;
  refusal: ReleaseRefusal | null;
}

/**
 * Réessais d'un morceau avant la pause (0,2 s, 1 s, 3 s, 8 s). Le premier, presque immédiat : mesuré au banc
 * (29/10), le relais rend un 502 au PREMIER morceau d'un fichier qui suit un autre (une connexion vers l'invité
 * réutilisée alors qu'il venait de la fermer) — la relance passe aussitôt.
 */
export const RELEASE_RETRY_DELAYS_MS = [200, 1000, 3000, 8000] as const;
/** Suivi du job : une question par seconde, puis toutes les deux secondes. */
const POLL_FAST_MS = 1000;
const POLL_SLOW_MS = 2000;
const POLL_FAST_COUNT = 20;
/** Au-delà (lecture de la page Bandcamp, des tags), l'import est donné en échec. */
const POLL_MAX = 600;

type Emit = (state: ReleaseFlowState) => void;

function base(source: ReleaseFlowState["source"]): ReleaseFlowState {
  return { phase: "starting", source, job: null, sentBytes: 0, totalBytes: 0, sending: null, refusal: null };
}

const settled = (job: ReleaseImportJob) => job.state === "done" || job.state === "failed";

function finalOf(state: ReleaseFlowState, job: ReleaseImportJob): ReleaseFlowState {
  // Fini sans album (un lot de doublons) n'est pas un échec : l'interface dit « déjà là ».
  const failed = job.state === "failed";
  return { ...state, job, phase: failed ? "failed" : "done", sending: null, refusal: failed ? (job.refusal ?? "failed") : null };
}

async function follow(port: ReleasePort, state: ReleaseFlowState, emit: Emit, signal: AbortSignal): Promise<ReleaseFlowState> {
  let current = { ...state, phase: "reading" as const, sending: null };
  emit(current);
  let job = state.job!;
  for (let i = 0; i < POLL_MAX && !settled(job); i++) {
    await port.sleep(i < POLL_FAST_COUNT ? POLL_FAST_MS : POLL_SLOW_MS, signal);
    try {
      job = await port.job(job.jobId, signal);
    } catch (error) {
      if (signal.aborted) throw error;
      if (!toReleaseError(error).transient) return { ...current, phase: "failed", refusal: toReleaseError(error).refusal };
      continue;
    }
    current = { ...current, job };
    emit(current);
  }
  return settled(job) ? finalOf(current, job) : { ...current, phase: "failed", refusal: "failed" };
}

export async function runReleaseLink(port: ReleasePort, url: string, emit: Emit, signal: AbortSignal): Promise<ReleaseFlowState> {
  const state = base("bandcamp");
  emit(state);
  let job: ReleaseImportJob;
  try {
    job = await port.startLink(url, signal);
  } catch (error) {
    if (signal.aborted) throw error;
    const failed = { ...state, phase: "failed" as const, refusal: toReleaseError(error).refusal };
    emit(failed);
    return failed;
  }
  const final = settled(job) ? finalOf({ ...state, job }, job) : await follow(port, { ...state, job }, emit, signal);
  emit(final);
  return final;
}

/**
 * Un fichier, morceau après morceau, depuis `from` ; une coupure se réessaie (le serveur redit d'où repartir), une
 * coupure qui dure lève l'erreur (l'appelant met en pause). Rend le job quand le dernier morceau l'a porté.
 */
async function sendFile(port: ReleasePort, file: ReleaseLocalFile, uploadId: string, from: number, chunk: number, onReceived: (n: number) => void, signal: AbortSignal): Promise<ReleaseImportJob | null> {
  let received = from;
  let attempt = 0;
  let job: ReleaseImportJob | null = null;
  while (received < file.size) {
    const { start, end } = remainingChunks(file.size, received, chunk)[0];
    try {
      const progress = await port.putChunk(uploadId, start, await file.read(start, end), signal);
      received = Math.max(received, progress.received);
      if (progress.done) {
        job = progress.job;
        received = file.size;
      }
      attempt = 0;
    } catch (error) {
      if (signal.aborted) throw error;
      const refusal = toReleaseError(error);
      // Mauvais offset (409) : le serveur dit ce qu'il tient, on repart de là sans attendre.
      if (refusal.received !== null) {
        received = refusal.received;
        onReceived(received);
        continue;
      }
      if (!refusal.transient || attempt >= RELEASE_RETRY_DELAYS_MS.length) throw refusal;
      await port.sleep(RELEASE_RETRY_DELAYS_MS[attempt++], signal);
      // Après une coupure, ce qu'il a vraiment reçu (le morceau a pu arriver sans que la réponse revienne).
      received = await port.uploaded(uploadId, signal).then((p) => (p.done ? file.size : p.received)).catch(() => received);
    }
    onReceived(received);
  }
  return job;
}

/**
 * Des fichiers. `resume` : le job d'un envoi mis en pause (mêmes fichiers, même ordre) — on demande au serveur ce
 * qu'il tient de chacun et on repart de là.
 */
export async function runReleaseFiles(port: ReleasePort, files: ReleaseLocalFile[], emit: Emit, signal: AbortSignal, resume?: ReleaseImportJob, albumHint?: string): Promise<ReleaseFlowState> {
  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
  let state: ReleaseFlowState = { ...base("files"), totalBytes, job: resume ?? null, phase: resume ? "sending" : "starting" };
  emit(state);
  let job: ReleaseImportJob;
  try {
    const request: ReleaseFilesRequest = { files: files.map(({ name, size, type }) => ({ name, size, type })) };
    if (albumHint) request.albumHint = albumHint;
    job = resume ?? (await port.startFiles(request, signal));
  } catch (error) {
    if (signal.aborted) throw error;
    state = { ...state, phase: "failed", refusal: toReleaseError(error).refusal };
    emit(state);
    return state;
  }
  const entries = job.files ?? [];
  const chunk = Math.min(job.chunkBytes && job.chunkBytes > 0 ? job.chunkBytes : RELEASE_DEFAULT_CHUNK_BYTES, port.chunkLimit ?? Number.POSITIVE_INFINITY);
  const pending = (f: (typeof entries)[number]) => f.state === "waiting" || f.state === "receiving";
  const received = entries.map((f) => (pending(f) ? f.received : f.size));
  const total = () => received.reduce((sum, n) => sum + n, 0);
  state = { ...state, job, phase: "sending", sentBytes: total() };
  emit(state);

  for (let i = 0; i < files.length && i < entries.length; i++) {
    const entry = entries[i];
    if (!pending(entry)) continue;
    state = { ...state, sending: i };
    emit(state);
    try {
      if (resume) {
        const known = await port.uploaded(entry.uploadId, signal);
        received[i] = known.done ? entry.size : known.received;
      }
      const after = await sendFile(port, files[i], entry.uploadId, received[i], chunk, (n) => {
        received[i] = n;
        state = { ...state, sentBytes: total() };
        emit(state);
      }, signal);
      if (after) state = { ...state, job: after };
    } catch (error) {
      if (signal.aborted) throw error;
      const refusal = error instanceof ReleaseRequestError ? error : toReleaseError(error);
      if (refusal.transient) {
        // La coupure dure : on garde le job, « Reprendre » repartira d'ici.
        state = { ...state, phase: "paused", sending: null, refusal: refusal.refusal };
        emit(state);
        return state;
      }
      // Ce fichier est refusé (trop gros, expiré, illisible) : les autres continuent.
      received[i] = entry.size;
      const marked = (state.job?.files ?? []).map((f, k) => (k === i ? { ...f, state: "refused" as const, refusal: refusal.refusal } : f));
      state = { ...state, job: state.job ? { ...state.job, files: marked } : null, sentBytes: total() };
      emit(state);
    }
  }
  const last = state.job!;
  const final = settled(last) ? finalOf(state, last) : await follow(port, { ...state, sentBytes: totalBytes }, emit, signal);
  emit(final);
  return final;
}
