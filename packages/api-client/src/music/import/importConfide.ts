/**
 * Octave — CONFIER les absents d'un import à l'extension (`importTracks`), règle pure (réseau et horloge injectés).
 *
 * Extension qui déclare `importBatches` (lot « pg », 1.43.0, `musicImportExtension.ts`) : des lots de
 * `MUSIC_IMPORT_BATCH.size` titres, `parallel` en vol, chacun avec `importId` (le suivi du cœur), `total` et les
 * `index` globaux ; un lot que le RÉSEAU a fait tomber est relancé (`retries`), jamais un refus de l'extension. Ses
 * titres perdus sont dits « indisponible ». Extension d'avant : UN appel, comme avant, au plus `legacyCap` titres ;
 * les autres sont dits `extensionLimit`. Puis la progression de l'opération est suivie jusqu'à `OUTSIDE_WAIT_MS`.
 */

import {
  importBatchesOf,
  MUSIC_IMPORT_BATCH,
  type ImportAbsentTrack,
  type ImportSkipReason,
  type ImportTracksAccepted,
  type ImportTracksProgress,
  type ImportTracksRequest,
  type MusicImportSource,
} from "@tentacle-tv/shared/music";
import { skippedOf, type ImportOutsideOutcome } from "@tentacle-tv/shared/octave";

export const OUTSIDE_POLL_MS = 700;
/** L'extension a au plus ce temps pour dire où elle en est ; au-delà, le résumé part et elle continue seule. */
export const OUTSIDE_WAIT_MS = 90_000;

export interface ConfidePort {
  /** L'extension reçoit-elle les absents par lots (`importBatches`) ? */
  batches?: boolean;
  confide: (request: ImportTracksRequest, signal: AbortSignal) => Promise<ImportTracksAccepted | null>;
  progress: (operationId: string, signal: AbortSignal) => Promise<ImportTracksProgress>;
  cancel: (operationId: string) => void;
  /** Un REFUS de l'extension (une réponse HTTP < 500) — jamais relancé ; sinon (coupure, 5xx) le lot repart. */
  isRefusal: (error: unknown) => boolean;
  sleep: (ms: number, signal: AbortSignal) => Promise<void>;
  now: () => number;
}

export interface ConfideContext {
  playlistId: string;
  /** La source dite à l'extension (`extensionImportSource`). */
  source: MusicImportSource;
  /** L'import entier : l'identifiant du suivi du cœur. */
  importId: string;
  name: string;
  artworkUrl: string | null;
}

export interface ConfideOutcome {
  added: number;
  own: number;
  outcome: ImportOutsideOutcome;
  /** Les titres jamais confiés (extension d'avant, au-delà de `legacyCap`) : leur motif est `extensionLimit`. */
  overflow: ReadonlySet<number>;
}

type Emit = (outside: { total: number; processed: number; added: number }) => void;

/** Un lot, relancé sur coupure du réseau ; `null` : refusé, ou perdu après les relances. */
async function sendBatch(port: ConfidePort, request: ImportTracksRequest, signal: AbortSignal): Promise<ImportTracksAccepted | null> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await port.confide(request, signal);
    } catch (error) {
      if (signal.aborted) throw error;
      if (port.isRefusal(error) || attempt >= MUSIC_IMPORT_BATCH.retries) return null;
      await port.sleep(400 * (attempt + 1), signal);
    }
  }
}

/** Les lots, `parallel` en vol ; rend l'opération (la première rendue) et les `index` des lots perdus. */
async function sendBatches(port: ConfidePort, ctx: ConfideContext, absent: readonly ImportAbsentTrack[], signal: AbortSignal) {
  const batches = importBatchesOf(absent);
  const lost: number[] = [];
  let operationId: string | null = null;
  let next = 0;
  const worker = async () => {
    while (next < batches.length) {
      const tracks = batches[next++]!;
      const request: ImportTracksRequest = { playlistId: ctx.playlistId, source: ctx.source, tracks, importId: ctx.importId, total: absent.length, name: ctx.name, artworkUrl: ctx.artworkUrl };
      const accepted = await sendBatch(port, request, signal);
      if (accepted) operationId ??= accepted.operationId;
      else lost.push(...tracks.map((t) => t.index));
    }
  };
  await Promise.all(Array.from({ length: Math.min(MUSIC_IMPORT_BATCH.parallel, batches.length) }, worker));
  return { operationId, lost };
}

/** Sonde l'opération jusqu'à sa fin ou l'échéance ; DELETE si l'appelant abandonne. */
async function follow(port: ConfidePort, operationId: string, signal: AbortSignal, emit: Emit): Promise<ImportTracksProgress | null> {
  const deadline = port.now() + OUTSIDE_WAIT_MS;
  let last: ImportTracksProgress | null = null;
  try {
    while (port.now() < deadline) {
      last = await port.progress(operationId, signal).catch((error: unknown) => {
        if (signal.aborted) throw error;
        return last;
      });
      if (last) emit({ total: last.total, processed: last.processed, added: last.added });
      if (last && last.state !== "running") break;
      await port.sleep(OUTSIDE_POLL_MS, signal);
    }
  } catch (error) {
    port.cancel(operationId);
    throw error;
  }
  return last;
}

/** Les absents confiés à l'extension ; rend ce qu'elle a pris et, pour chaque titre non posé, son motif. */
export async function confideAbsent(port: ConfidePort, ctx: ConfideContext, absent: readonly ImportAbsentTrack[], signal: AbortSignal, emit: Emit): Promise<ConfideOutcome> {
  let operationId: string | null;
  const lost = new Set<number>();
  const overflow = new Set<number>();
  if (port.batches) {
    const sent = await sendBatches(port, ctx, absent, signal);
    operationId = sent.operationId;
    for (const index of sent.lost) lost.add(index);
  } else {
    // Extension d'avant : la requête d'avant, telle quelle (aucun champ qu'elle ne connaîtrait), bornée.
    const tracks = absent.slice(0, MUSIC_IMPORT_BATCH.legacyCap);
    for (const t of absent.slice(MUSIC_IMPORT_BATCH.legacyCap)) overflow.add(t.index);
    const accepted = await port.confide({ playlistId: ctx.playlistId, source: ctx.source, tracks }, signal).catch((error: unknown) => {
      if (signal.aborted) throw error;
      return null;
    });
    operationId = accepted?.operationId ?? null;
  }
  if (!operationId) return { added: 0, own: 0, outcome: { kind: "refused", reason: null }, overflow };
  const last = await follow(port, operationId, signal, emit);
  if (last?.state === "failed" && (last?.added ?? 0) === 0) return { added: 0, own: 0, outcome: { kind: "refused", reason: last?.reason ?? null }, overflow };
  const skipped = new Map<number, ImportSkipReason>(skippedOf(last));
  for (const index of lost) skipped.set(index, "unavailable");
  for (const index of overflow) skipped.set(index, "extensionLimit");
  return { added: last?.added ?? 0, own: last?.own ?? 0, outcome: { kind: "done", skipped }, overflow };
}
