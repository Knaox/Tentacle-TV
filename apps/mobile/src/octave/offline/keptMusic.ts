/**
 * Octave (mobile) — la musique GARDÉE sur ce téléphone, pour le compte de
 * l'appareil : le magasin et les gestes COMMUNS au bureau
 * (`@tentacle-tv/offline-core/music`), branchés ici sur le moteur du mobile
 * (`offline/engineMusicApi.ts`, appels directs). Lu SANS React par le lecteur
 * (`keptPlayback.ts`) et par l'interface (`useKeptMusic.ts`).
 *
 * Le hors ligne appartient au COMPTE DE L'APPAREIL (`offlineOwnerOf`) : la liste
 * est toujours la sienne, jamais celle d'un profil ouvert. Amorcé par
 * `configureMusicOffline(storage)` (`OfflineRuntimeSync`), sans effet au chargement.
 */

import type { StorageAdapter } from "@tentacle-tv/api-client";
import { tentacleApiFetch } from "@tentacle-tv/api-client";
import { offlineOwnerOf } from "@tentacle-tv/offline-core";
import { createKeepActions, createKeptMusicStore } from "@tentacle-tv/offline-core/music";
import { MUSIC_ROUTES, type MusicOfflinePlanResponse } from "@tentacle-tv/shared/music";
import { subscribeOfflineChanged, subscribeOfflineProgress } from "../../offline/engineRuntime";
import { keepMusicOffline, listKeptMusic, removeKeptMusic, saveKeptMusicCollections } from "../../offline/engineMusicApi";

let storage: Pick<StorageAdapter, "getItem"> | null = null;
/** Une vue s'est abonnée avant que le stockage soit prêt : le magasin démarre dès qu'il l'est. */
let wantedEarly = false;

/**
 * Le stockage de session est prêt : le magasin sait qui est le compte de l'appareil. Rien n'est lu ici — la base
 * ne s'ouvre qu'au premier abonnement (Octave, l'entrée de la musique gardée), jamais pour qui n'en a pas l'usage.
 */
export function configureMusicOffline(adapter: Pick<StorageAdapter, "getItem">): void {
  storage = adapter;
  if (wantedEarly) {
    wantedEarly = false;
    keptMusicStore.start();
  }
}

/** L'abonnement des vues (`useKeptMusic`) : il démarre le magasin, ou le fait attendre le stockage. */
export function subscribeKeptMusic(listener: () => void): () => void {
  if (storage === null) wantedEarly = true;
  return keptMusicStore.subscribe(listener);
}

const owner = () => (storage ? offlineOwnerOf(storage) : null);

export const keptMusicStore = createKeptMusicStore({
  enabled: () => storage !== null,
  ownerUserId: () => owner()?.userId ?? null,
  list: async (userId) => listKeptMusic(userId),
  listen: (onChanged, onProgress) => {
    subscribeOfflineChanged(onChanged);
    subscribeOfflineProgress((p) => onProgress(p.fileId, p.bytesDone, p.expectedSize ?? null));
  },
});

/** Le plan du serveur (`POST /api/music/offline/plan`) : d'où et sous quelle forme garder un titre de la bibliothèque. */
export const fetchMusicOfflinePlan = (body: { ids: string[] }): Promise<MusicOfflinePlanResponse> =>
  tentacleApiFetch<MusicOfflinePlanResponse>(MUSIC_ROUTES.offlinePlan, { method: "POST", body: JSON.stringify(body) });

/** Les gestes communs, sur le moteur du mobile (la tenue à jour les prend tels quels). */
export const keepActions = createKeepActions({
  owner: () => {
    const current = owner();
    return current?.token ? { userId: current.userId } : null;
  },
  fetchPlan: fetchMusicOfflinePlan,
  enqueue: async (userId, items, collection) => keepMusicOffline(userId, items, collection),
  remove: (userId, fileIds, collectionKey) => removeKeptMusic(userId, fileIds, collectionKey),
  saveCollections: async (userId, save, remove) => saveKeptMusicCollections(userId, save, remove),
  refresh: keptMusicStore.refresh,
});
