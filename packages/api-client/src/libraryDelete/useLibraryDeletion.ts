/**
 * Supprimer une sélection de titres : par LOTS du contrat, l'un après l'autre, la
 * progression entre deux, un sort par titre. Jamais d'arrêt silencieux : un lot
 * perdu (réseau, serveur) est retenté une fois, puis ses titres comptent en échec,
 * et la suite continue. « Arrêter » ne coupe qu'entre deux lots : ce qui n'a pas
 * été tenté est dit comme tel.
 *
 * Les titres partis quittent les caches à chaque lot (la grille suit), et tout se
 * relit à la fin (`forgetDeletedItems`).
 */

import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  deletionBatches,
  summarizeDeletion,
  type DeletionSummary,
  type LibraryDeleteItemResult,
} from "@tentacle-tv/shared";
import { postLibraryDeletion } from "./libraryDeleteApi";
import { dropDeletedFromCaches, forgetDeletedItems } from "./deletionCache";

export interface DeletionRunSummary extends DeletionSummary {
  /** Jamais tentés : la suppression a été arrêtée avant leur lot. */
  skipped: string[];
}

export type DeletionRunState =
  | { phase: "idle" }
  | { phase: "running"; total: number; processed: number; stopping: boolean }
  | { phase: "done"; total: number; summary: DeletionRunSummary };

const IDLE: DeletionRunState = { phase: "idle" };
const RETRY_AFTER_MS = 1_500;

type Poster = (ids: readonly string[]) => Promise<{ results: LibraryDeleteItemResult[] }>;

/** Un lot : retenté une fois s'il se perd (un lot déjà passé rend alors « déjà absent ») ; sinon, en échec. */
export async function deleteBatch(post: Poster, batch: readonly string[], wait = RETRY_AFTER_MS): Promise<LibraryDeleteItemResult[]> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return (await post(batch)).results;
    } catch {
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }
  return batch.map((id) => ({ id, outcome: "failed" }));
}

const removedOf = (results: readonly LibraryDeleteItemResult[]) =>
  results.filter((r) => r.outcome === "deleted" || r.outcome === "gone").map((r) => r.id);

export function useLibraryDeletion() {
  const qc = useQueryClient();
  const [state, setState] = useState<DeletionRunState>(IDLE);
  const busy = useRef(false);
  const stopRequested = useRef(false);

  const run = useCallback(async (ids: readonly string[]): Promise<DeletionRunSummary | null> => {
    if (busy.current || ids.length === 0) return null;
    busy.current = true;
    stopRequested.current = false;
    setState({ phase: "running", total: ids.length, processed: 0, stopping: false });
    const attempted: string[] = [];
    const results: LibraryDeleteItemResult[] = [];
    try {
      for (const batch of deletionBatches(ids)) {
        if (stopRequested.current) break;
        const batchResults = await deleteBatch(postLibraryDeletion, batch);
        attempted.push(...batch);
        results.push(...batchResults);
        dropDeletedFromCaches(qc, removedOf(batchResults));
        setState((prev) => (prev.phase === "running" ? { ...prev, processed: attempted.length } : prev));
      }
    } finally {
      busy.current = false;
    }
    const tried = new Set(attempted);
    const summary: DeletionRunSummary = { ...summarizeDeletion(attempted, results), skipped: ids.filter((id) => !tried.has(id)) };
    forgetDeletedItems(qc, summary.removed);
    setState({ phase: "done", total: ids.length, summary });
    return summary;
  }, [qc]);

  const stop = useCallback(() => {
    stopRequested.current = true;
    setState((prev) => (prev.phase === "running" ? { ...prev, stopping: true } : prev));
  }, []);

  const reset = useCallback(() => {
    if (!busy.current) setState(IDLE);
  }, []);

  return { state, run, stop, reset };
}
