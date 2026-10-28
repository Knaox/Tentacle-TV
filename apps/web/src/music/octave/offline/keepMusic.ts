/**
 * Octave — garder des titres sur cet appareil, et les en retirer (bureau,
 * capacité `offline.music`) : les gestes communs au bureau et au mobile
 * (`@tentacle-tv/offline-core/music`, `createKeepActions`), branchés ici sur la
 * coquille (`downloads_music_*`). Un titre, un album, une playlist : un LOT, mis
 * en file d'un coup dans le moteur des films (refusé en bloc faute de place).
 *
 * Toujours au nom du COMPTE DE L'APPAREIL (son jeton), jamais d'un profil.
 */

import type { KeptMusicCollection, KeptMusicTrack } from "@tentacle-tv/offline-core";
import {
  createKeepActions,
  externalKeepPath,
  planLibrary as planLibraryWith,
  type KeepCollection,
  type KeepOutcome,
} from "@tentacle-tv/offline-core/music";
import { musicRouteUrl, tentacleApiFetch, type MusicProvider } from "@tentacle-tv/api-client";
import { MUSIC_ROUTES, type MusicOfflinePlanResponse, type MusicOfflineTrackPlan, type MusicTrack } from "@tentacle-tv/shared/music";
import { invoke } from "../../../desktop/bridge";
import { getBackendBase } from "../../../lib/backendBase";
import { readOfflineOwner } from "../../../offline/offlineOwner";
import { refreshKeptMusic } from "./keptMusicStore";

export type { KeepCollection, KeepOutcome };

const fetchPlan = (body: { ids: string[] }) =>
  tentacleApiFetch<MusicOfflinePlanResponse>(MUSIC_ROUTES.offlinePlan, { method: "POST", body: JSON.stringify(body) });

/** Les gestes communs, sur la coquille (la tenue à jour les prend tels quels). */
export const keepActions = createKeepActions({
  owner: () => {
    const owner = readOfflineOwner();
    return owner?.token ? { userId: owner.userId } : null;
  },
  fetchPlan,
  enqueue: async (userId, items, collection) => {
    const token = readOfflineOwner()?.token;
    if (!token) throw new Error("no-owner");
    return invoke<{ accepted: boolean; neededBytes: number }>("downloads_music_enqueue", { userId, serverUrl: getBackendBase(), token, items, collection });
  },
  remove: async (userId, fileIds, collectionKey) => {
    await invoke("downloads_music_remove", { userId, fileIds, collectionKey });
  },
  saveCollections: async (userId, save, remove) => {
    await invoke("downloads_music_collections", { userId, save, remove });
  },
  refresh: refreshKeptMusic,
});

export function planLibrary(ids: string[]): Promise<Map<string, MusicOfflineTrackPlan>> {
  return planLibraryWith(ids, fetchPlan);
}

/** Garde ces titres sur l'appareil (et la collection, si c'en est une). */
export function keepTracks(tracks: readonly MusicTrack[], provider: MusicProvider | null, collection: KeepCollection | null = null): Promise<KeepOutcome> {
  return keepActions.keepTracks(tracks, externalKeepPath(provider, musicRouteUrl), collection);
}

/** Retire ces titres de l'appareil (et la collection) ; un titre partagé avec un autre compte reste à lui. */
export function removeKept(kept: readonly KeptMusicTrack[], collectionKey: string | null = null): Promise<boolean> {
  return keepActions.removeKept(kept, collectionKey);
}

/** Retire ces fichiers de l'appareil (la tenue à jour : un titre qu'une playlist a perdu, une copie remplacée). */
export function removeKeptFiles(fileIds: readonly number[]): Promise<boolean> {
  return keepActions.removeKeptFiles(fileIds);
}

/** Réécrit ce qui retient des titres (collections) : la tenue à jour. */
export function saveKeptCollections(save: readonly KeptMusicCollection[], remove: readonly string[]): Promise<boolean> {
  return keepActions.saveKeptCollections(save, remove);
}
