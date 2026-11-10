/**
 * Les éditions optimistes des LISTES d'appartenance (Ma liste, favoris) :
 * l'ensemble des séries, et les rangées où un titre entre ou sort. Extraites
 * de `cacheUtils`, qui dépassait sa taille ; il les réexporte.
 */

import type { QueryClient } from "@tanstack/react-query";
import type { MediaItem } from "@tentacle-tv/shared";

/**
 * Met à jour optimiste un Set d'IDs de séries en cache (string[] : liste des
 * SeriesId likées / favorites). No-op si la query n'est pas encore chargée :
 * un ensemble inventé (cette seule série) effacerait la pastille des autres —
 * c'est le geste tenu (`pendingUserData`) qui répond alors, et le refetch
 * onSettled apporte l'ensemble. Enregistre l'état précédent dans le snapshot
 * fourni pour rollback.
 */
export function patchSeriesIdSet(
  qc: QueryClient,
  queryKey: readonly unknown[],
  seriesId: string | undefined,
  add: boolean,
  snapshot?: Map<string, unknown>,
): void {
  if (!seriesId) return;
  const data = qc.getQueryData<string[]>(queryKey);
  if (data === undefined) return;

  const has = data.includes(seriesId);
  if (add === has) return; // déjà dans l'état voulu

  const keyStr = JSON.stringify(queryKey);
  if (snapshot && !snapshot.has(keyStr)) snapshot.set(keyStr, data);

  qc.setQueryData<string[]>(
    queryKey,
    add ? [...data, seriesId] : data.filter((id) => id !== seriesId),
  );
}

/**
 * Insère un item en tête des listes flat fournies (Ma liste / Favoris) s'il est
 * absent. Mise à jour optimiste → le carrousel se met à jour instantanément.
 */
export function addItemToLists(
  qc: QueryClient,
  listKeys: readonly (readonly unknown[])[],
  item: MediaItem,
  snapshot?: Map<string, unknown>,
): void {
  for (const key of listKeys) {
    const data = qc.getQueryData<MediaItem[]>(key);
    if (!Array.isArray(data) || data.some((i) => i.Id === item.Id)) continue;
    const keyStr = JSON.stringify(key);
    if (snapshot && !snapshot.has(keyStr)) snapshot.set(keyStr, data);
    qc.setQueryData<MediaItem[]>(key, [item, ...data]);
  }
}

/** Retire un item (par id) des listes flat fournies. Mise à jour optimiste. */
export function removeItemFromLists(
  qc: QueryClient,
  listKeys: readonly (readonly unknown[])[],
  id: string | undefined,
  snapshot?: Map<string, unknown>,
): void {
  if (!id) return;
  for (const key of listKeys) {
    const data = qc.getQueryData<MediaItem[]>(key);
    if (!Array.isArray(data) || !data.some((i) => i.Id === id)) continue;
    const keyStr = JSON.stringify(key);
    if (snapshot && !snapshot.has(keyStr)) snapshot.set(keyStr, data);
    qc.setQueryData<MediaItem[]>(key, data.filter((i) => i.Id !== id));
  }
}
