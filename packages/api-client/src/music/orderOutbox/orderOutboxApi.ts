/**
 * Octave — ce que la file d'envoi des ordres demande au serveur (`orderOutbox.ts`), et ce qu'un envoi réussi
 * fait relire : la préférence, la playlist, les rubriques — même rangées dans le cache sans observateur (la page
 * d'une playlist gardée, relue hors ligne). Les routes sont celles du contrat ; aucun crochet ici (les crochets
 * d'ordre l'importent).
 */

import type { QueryClient } from "@tanstack/react-query";
import { MUSIC_LIST_ROUTES, MUSIC_SHELF_ROUTES, parseListKey, type MusicLibraryShelves, type MusicListKey, type MusicListPrefs, type MusicShelfSection } from "@tentacle-tv/shared/music";
import { pendingListPrefs, pendingShelfOrder, type OrderWrite } from "@tentacle-tv/shared/octave";
import { tentacleApiFetch } from "../../hooks/usePreferences";
import { musicApi } from "../musicApi";
import { musicKeys } from "../musicQueryKeys";
import { orderOutboxQueue, type OrderOutboxApi } from "./orderOutbox";

const at = (route: string, name: string, value: string) => route.replace(`:${name}`, encodeURIComponent(value));

export const orderOutboxApi: OrderOutboxApi = {
  prefs: (key) => tentacleApiFetch<MusicListPrefs>(at(MUSIC_LIST_ROUTES.prefs, "key", key)),
  savePrefs: (key, prefs) => tentacleApiFetch(at(MUSIC_LIST_ROUTES.prefs, "key", key), { method: "PUT", body: JSON.stringify(prefs) }),
  playlist: (id) => musicApi.playlist(id),
  reorderPlaylist: (id, entryIds) => tentacleApiFetch(at(MUSIC_LIST_ROUTES.playlistOrder, "id", id), { method: "PUT", body: JSON.stringify({ entryIds }) }),
  shelves: () => tentacleApiFetch<MusicLibraryShelves>(MUSIC_SHELF_ROUTES.shelves),
  shelfOrder: (section: MusicShelfSection, keys) => tentacleApiFetch(MUSIC_SHELF_ROUTES.order.replace(":section", section), { method: "PUT", body: JSON.stringify({ keys }) }),
};

/** La préférence lue du serveur, sauf si un geste de cet appareil attend encore de partir : il fait foi à l'écran. */
export async function readListPrefs(key: MusicListKey, signal?: AbortSignal): Promise<MusicListPrefs> {
  const remote = await tentacleApiFetch<MusicListPrefs>(at(MUSIC_LIST_ROUTES.prefs, "key", key), { signal });
  return pendingListPrefs(orderOutboxQueue(), key) ?? remote;
}

/** Les rubriques lues du serveur, l'ordre en attente de cet appareil posé par-dessus. */
export async function readShelves(signal?: AbortSignal): Promise<MusicLibraryShelves> {
  const remote = await tentacleApiFetch<MusicLibraryShelves>(MUSIC_SHELF_ROUTES.shelves, { signal });
  const queue = orderOutboxQueue();
  if (queue.length === 0) return remote;
  const order = { ...remote.order };
  for (const section of Object.keys(order) as MusicShelfSection[]) order[section] = pendingShelfOrder(queue, section) ?? order[section];
  return { ...remote, order };
}

export type OrderPage = { kind: "prefs"; key: MusicListKey } | { kind: "playlist"; id: string } | { kind: "shelves" } | { kind: "playlists" };

function keyOf(page: OrderPage): readonly unknown[] {
  if (page.kind === "prefs") return musicKeys.listPrefs(page.key);
  if (page.kind === "playlist") return musicKeys.playlist(page.id);
  return page.kind === "shelves" ? musicKeys.shelves() : musicKeys.playlists();
}

function readerOf(page: OrderPage): () => Promise<unknown> {
  if (page.kind === "prefs") return () => readListPrefs(page.key);
  if (page.kind === "playlist") return () => musicApi.playlist(page.id);
  return page.kind === "shelves" ? () => readShelves() : () => musicApi.playlists();
}

/**
 * Relire une page d'ordre et la rendre au cache — `fetchQuery`, pas une invalidation : une page restaurée du
 * disque n'a pas d'observateur (ni de `queryFn`), l'invalidation ne la relirait pas, et la copie gardée hors
 * ligne resterait celle d'avant.
 */
export function refetchOrderPage(qc: QueryClient, page: OrderPage): Promise<unknown> {
  return qc.fetchQuery({ queryKey: keyOf(page), queryFn: readerOf(page), staleTime: 0 }).catch(() => undefined);
}

/**
 * Un évènement a changé cette page ailleurs : montée, l'invalidation la relit déjà ; rangée SANS observateur (la
 * copie d'une playlist gardée, que l'on ouvrira hors ligne), elle se relit ici — jamais une page jamais vue.
 */
export function refreshIdleOrderPage(qc: QueryClient, page: OrderPage): void {
  const query = qc.getQueryCache().find({ queryKey: keyOf(page), exact: true });
  if (query && query.getObserversCount() === 0) void refetchOrderPage(qc, page);
}

/**
 * Les pages d'ordre des collections gardées (`playlist:jf:<id>`, `playlist:liked`) et celles de la bibliothèque
 * (liste des playlists, rubriques) relues au démarrage en ligne et au retour du réseau : hors ligne, chaque
 * playlist gardée s'ouvre dans le DERNIER ordre du compte, même changé sur un autre appareil.
 */
export async function refreshKeptOrderPages(
  qc: QueryClient,
  collectionKeys: readonly string[],
  // Les capacités du serveur : sans elles, ni préférence ni rubrique ne se demandent (un serveur d'avant).
  capable: { listOrder: boolean; shelves: boolean } = { listOrder: true, shelves: true },
): Promise<void> {
  const pages: OrderPage[] = [{ kind: "playlists" }];
  if (capable.shelves) pages.push({ kind: "shelves" });
  for (const key of collectionKeys) {
    if (key === "playlist:liked" && capable.listOrder) pages.push({ kind: "prefs", key: "liked" });
    if (!key.startsWith("playlist:jf:")) continue;
    const id = key.slice("playlist:jf:".length);
    const listKey = parseListKey(`playlist:${id}`);
    pages.push({ kind: "playlist", id });
    if (listKey && capable.listOrder) pages.push({ kind: "prefs", key: listKey });
  }
  // Une à la fois : quelques requêtes légères, jamais une rafale au retour du réseau.
  for (const page of pages) await refetchOrderPage(qc, page);
}

/** Après un envoi réussi : la vérité du serveur (fusionnée) revient à l'écran et dans la copie gardée. */
export function refetchAfterOrderWrite(qc: QueryClient, write: OrderWrite): void {
  if (write.kind === "listPrefs") void refetchOrderPage(qc, { kind: "prefs", key: write.key as MusicListKey });
  else if (write.kind === "playlistOrder") void refetchOrderPage(qc, { kind: "playlist", id: write.playlistId });
  else void refetchOrderPage(qc, { kind: "shelves" });
}
