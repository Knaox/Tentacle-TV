import type { CardDeviceState } from "@tentacle-tv/shared";
import type { DownloadListEntry } from "../core/listing";
import type { DownloadStatus } from "../core/store";

/**
 * Ce que CET appareil garde d'un titre, lu d'un coup d'œil — le « sur cet
 * appareil » des cartes, des lignes d'épisode et du plateau de survol, sur le
 * bureau comme sur le mobile.
 *
 * Une seule source : la liste locale du compte (la requête partagée
 * `downloads-list` du bureau, `offline-list` du mobile). Chaque carte la lit à
 * travers un `select` qui ne rend qu'une valeur, et cet index est construit
 * UNE fois par version des données (`WeakMap` indexée sur le tableau du
 * cache) : une saison de deux cents lignes interroge une `Map`, jamais un
 * `find()` sur toute la liste — c'était du O(N·M) sur le fil JS à chaque
 * évènement du moteur.
 */

/** L'état d'un item : prêt à lire, en route (file, transfert, pause), ou en échec. */
export type DeviceItemState = "complete" | "active" | "error";

export interface DeviceIndex {
  /**
   * L'état d'un film ou d'un épisode. Un même titre peut avoir plusieurs
   * fichiers (original, version allégée, transfert annulé) : la copie
   * COMPLÈTE l'emporte, puis un transfert en route, puis un échec — la même
   * priorité que `stateForItem`, qui sert la fiche.
   */
  itemState(itemId: string): DeviceItemState | null;
  /** Nombre d'épisodes complets d'une série, ou d'une saison. */
  keptIn(groupId: string): number;
  /** Nombre d'épisodes en route (file, transfert, pause — pas l'échec) d'une série ou d'une saison. */
  activeIn(groupId: string): number;
}

const RANK: Partial<Record<DownloadStatus, { state: DeviceItemState; rank: number }>> = {
  complete: { state: "complete", rank: 3 },
  queued: { state: "active", rank: 2 },
  downloading: { state: "active", rank: 2 },
  paused: { state: "active", rank: 2 },
  error: { state: "error", rank: 1 },
};

const indexes = new WeakMap<readonly DownloadListEntry[], DeviceIndex>();

function build(entries: readonly DownloadListEntry[]): DeviceIndex {
  const items = new Map<string, { state: DeviceItemState; rank: number }>();
  const kept = new Map<string, number>();
  for (const entry of entries) {
    const found = RANK[entry.status];
    if (!found) continue; // annulé : plus rien sur l'appareil
    const best = items.get(entry.itemId);
    if (!best || found.rank > best.rank) items.set(entry.itemId, found);
  }
  // Les groupes comptent chaque ÉPISODE une fois, sous son meilleur état —
  // deux fichiers du même épisode ne font pas deux épisodes.
  const active = new Map<string, number>();
  const counted = new Set<string>();
  for (const entry of entries) {
    if (counted.has(entry.itemId)) continue;
    const state = items.get(entry.itemId)?.state;
    const bucket = state === "complete" ? kept : state === "active" ? active : null;
    if (!bucket) continue;
    counted.add(entry.itemId);
    for (const group of [entry.seriesId, entry.seasonId]) {
      if (group) bucket.set(group, (bucket.get(group) ?? 0) + 1);
    }
  }
  return {
    itemState: (itemId) => items.get(itemId)?.state ?? null,
    keptIn: (groupId) => kept.get(groupId) ?? 0,
    activeIn: (groupId) => active.get(groupId) ?? 0,
  };
}

/** L'index d'une liste — construit une fois par tableau, puis relu. */
export function deviceIndexOf(entries: readonly DownloadListEntry[]): DeviceIndex {
  let index = indexes.get(entries);
  if (!index) {
    index = build(entries);
    indexes.set(entries, index);
  }
  return index;
}

/**
 * Ce qu'une CARTE dit de l'appareil : le titre entier (film, épisode gardé),
 * ou quelques épisodes (série, saison — une série reste ouverte aux épisodes
 * à venir, elle n'est jamais « entière »). Un transfert en route ne se marque
 * pas au repos : seul ce qui se LIT hors ligne compte.
 */
export function cardDeviceState(index: DeviceIndex, item: { Id: string; Type: string }): CardDeviceState | null {
  if (item.Type === "Series" || item.Type === "Season") return index.keptIn(item.Id) > 0 ? "some" : null;
  if (item.Type === "Movie" || item.Type === "Episode") return index.itemState(item.Id) === "complete" ? "all" : null;
  return null;
}
