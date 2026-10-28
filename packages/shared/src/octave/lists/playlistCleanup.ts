/**
 * Octave — ce que devient une playlist supprimée chez l'extension (pur) : ses entrées EN ATTENTE (ajouts hors
 * bibliothèque, titres importés pas encore entrés) se retirent une à une par le geste existant de l'extension
 * (`DELETE <pending>/<operationId>` : chez Sillon, l'entrée part et sa demande à Lidarr s'abandonne —
 * `importRequests.entryRemoved`). Quatre à la fois au plus ; un échec n'arrête pas les autres.
 */

import type { PendingMusicItem } from "../../music";

const fold = (id: string) => id.replace(/-/g, "").toLowerCase();

/** Les attentes de CETTE playlist (ajouts et entrées importées). */
export function waitingOf(pending: readonly PendingMusicItem[], playlistId: string): PendingMusicItem[] {
  const id = fold(playlistId);
  return pending.filter((p) => p.kind === "playlistAdd" && typeof p.playlistId === "string" && fold(p.playlistId) === id);
}

/** Retire chaque attente (`remove` rend vrai si l'extension l'a retirée) ; rend le nombre de retraits réussis. */
export async function removeWaiting(operationIds: readonly string[], remove: (operationId: string) => Promise<boolean>, concurrency = 4): Promise<number> {
  let next = 0;
  let removed = 0;
  const worker = async () => {
    while (next < operationIds.length) {
      const id = operationIds[next++]!;
      try {
        if (await remove(id)) removed += 1;
      } catch {
        // Une attente qui refuse reste chez l'extension ; les autres partent quand même.
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, operationIds.length) }, worker));
  return removed;
}
