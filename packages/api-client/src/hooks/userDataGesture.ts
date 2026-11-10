/**
 * Le déroulé commun des bascules d'un titre (vu, favori, Ma liste) : le geste
 * répond à l'écran AVANT le serveur, sur tout écran qui montre le titre.
 *
 *  1. `begin` — les chargements qui écraseraient le geste sont interrompus (la
 *     fiche, l'ensemble de séries), les caches sont patchés, et le geste est
 *     TENU (`pendingUserData`) pour les cartes qu'aucun cache ne sert ;
 *  2. `fail` — les caches reviennent, le geste est relâché ;
 *  3. `settle` — la vérité du serveur est redemandée (par l'appelant, puis ici
 *     pour la fiche quand rien d'autre ne porte le titre), et SEULEMENT alors
 *     le geste est relâché : l'état ne retombe jamais entre les deux.
 */

import type { QueryClient } from "@tanstack/react-query";
import type { MediaItem } from "@tentacle-tv/shared";
import { patchSeriesIdSet, restoreFromSnapshot, updateItemUserDataInCache, type CacheTarget } from "./cacheUtils";
import { holdPendingUserData, type PendingUserData } from "./pendingUserData";

export interface UserDataGestureContext {
  snapshot: Map<string, unknown>;
  release: () => void;
}

export interface SeriesSetChange {
  key: readonly unknown[];
  seriesId: string | undefined;
  add: boolean;
}

export async function beginUserDataGesture(
  qc: QueryClient,
  options: { itemId: string | undefined; target: CacheTarget; patch: PendingUserData; seriesSet?: SeriesSetChange },
): Promise<UserDataGestureContext> {
  const { itemId, target, patch, seriesSet } = options;
  await qc.cancelQueries({ queryKey: ["item", itemId] });
  // L'ensemble en cours de chargement porterait l'état d'AVANT le geste.
  if (seriesSet?.seriesId) await qc.cancelQueries({ queryKey: seriesSet.key, exact: true });
  const snapshot = updateItemUserDataInCache(qc, target, () => patch);
  if (seriesSet) patchSeriesIdSet(qc, seriesSet.key, seriesSet.seriesId, seriesSet.add, snapshot);
  return { snapshot, release: holdPendingUserData(itemId, patch) };
}

export function failUserDataGesture(qc: QueryClient, context: UserDataGestureContext | undefined): void {
  if (context === undefined) return;
  restoreFromSnapshot(qc, context.snapshot);
  context.release();
}

/** Un identifiant fabriqué pour une carte hors bibliothèque (`reco:…`) n'a pas de fiche. */
const isLibraryId = (itemId: string): boolean => !itemId.includes(":");

/**
 * À appeler après les invalidations de l'appelant. `refetches` : ce qu'elles
 * ont relancé et dont l'état affiché dépend (l'ensemble de séries).
 */
export async function settleUserDataGesture(
  qc: QueryClient,
  context: UserDataGestureContext | undefined,
  options: { itemId: string | undefined; fetchItem?: (itemId: string) => Promise<MediaItem>; refetches?: Promise<unknown>[] },
): Promise<void> {
  if (context === undefined) return;
  const { itemId, fetchItem, refetches = [] } = options;
  const waits: Promise<unknown>[] = [...refetches];
  if (itemId) {
    const key = ["item", itemId] as const;
    // Fiche observée : son rechargement dira la vérité.
    waits.push(qc.invalidateQueries({ queryKey: key, exact: true, refetchType: "active" }));
    // Aucun cache ne porte le titre : la fiche est demandée, pour que l'état
    // survive au geste (la carte de recommandation la lit sans la demander).
    const orphan = context.snapshot.size === 0 && qc.getQueryData(key) === undefined;
    if (orphan && fetchItem && isLibraryId(itemId)) {
      waits.push(qc.fetchQuery({ queryKey: key, queryFn: () => fetchItem(itemId), staleTime: 0, retry: false }));
    }
  }
  await Promise.allSettled(waits);
  context.release();
}
