/**
 * Octave — la musique GARDÉE sur cet appareil, pour le compte de l'appareil
 * (capacité `offline.music`, bureau) : le magasin commun
 * (`@tentacle-tv/offline-core/music`, `createKeptMusicStore`) branché sur la
 * coquille — la liste que tient le moteur des films (`downloads_music_list`),
 * relue à chaque « quelque chose a changé », la progression suivie en direct.
 *
 * Le hors ligne appartient au COMPTE DE L'APPAREIL (`offlineOwner.ts`) : la liste
 * est toujours la sienne, jamais celle d'un profil ouvert.
 */

import type { KeptMusicCollection, KeptMusicTrack } from "@tentacle-tv/offline-core";
import { createKeptMusicStore, type KeptMusicState } from "@tentacle-tv/offline-core/music";
import { invoke, listen } from "../../../desktop/bridge";
import { supportsMusicOffline } from "../../../desktop/capabilities";
import { readOfflineOwner } from "../../../offline/offlineOwner";

export type { KeptMusicState };

const store = createKeptMusicStore({
  enabled: () => supportsMusicOffline(),
  ownerUserId: () => readOfflineOwner()?.userId ?? null,
  list: (userId) => invoke<{ tracks: KeptMusicTrack[]; collections: KeptMusicCollection[] }>("downloads_music_list", { userId }),
  listen: (onChanged, onProgress) => {
    void listen("downloads://changed", onChanged);
    void listen<{ fileId: number; bytesDone: number; expectedSize: number | null }>("downloads://progress", (event) =>
      onProgress(event.payload.fileId, event.payload.bytesDone, event.payload.expectedSize),
    );
  },
});

/** Le magasin lui-même (la tenue à jour le prend tel quel). */
export const keptMusicStore = store;

/** Les identités changées que l'extension a dites (ses attentes, `MusicOfflineScope`) ; la liste se réindexe. */
export const setKeptRenames = store.setRenames;
/** Relit la liste du compte de l'appareil ; une relecture demandée pendant une autre la suit (jamais deux à la fois). */
export const refreshKeptMusic = store.refresh;
/** Branche le magasin sur le moteur, une fois par page. */
export const startKeptMusic = store.start;
export const keptMusicState = store.state;
export const subscribeKeptMusic = store.subscribe;
/** La copie COMPLÈTE de ce titre, gardée par le compte de l'appareil ; `null` sinon. */
export const completeKeptTrack = store.completeTrack;
