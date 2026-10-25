/**
 * Octave — la musique GARDÉE sur cet appareil, pour le compte de l'appareil
 * (capacité `offline.music`, bureau) : la liste que tient le moteur des films
 * (`downloads_music_list`), relue à chaque « quelque chose a changé » du moteur,
 * la progression suivie en direct. Lue SANS React par le lecteur (la copie
 * gardée d'abord, `keptSources.ts`) et par l'interface (`useKeptMusic`).
 *
 * Le hors ligne appartient au COMPTE DE L'APPAREIL (`offlineOwner.ts`) : la liste
 * est toujours la sienne, jamais celle d'un profil ouvert.
 */

import type { KeptMusicCollection, KeptMusicTrack } from "@tentacle-tv/offline-core";
import { invoke, listen } from "../../../desktop/bridge";
import { supportsMusicOffline } from "../../../desktop/capabilities";
import { readOfflineOwner } from "../../../offline/offlineOwner";

export interface KeptMusicState {
  /** La liste a été lue au moins une fois (sinon « on ne sait pas encore »). */
  loaded: boolean;
  userId: string | null;
  tracks: readonly KeptMusicTrack[];
  collections: readonly KeptMusicCollection[];
  byKey: ReadonlyMap<string, KeptMusicTrack>;
}

const EMPTY: KeptMusicState = { loaded: false, userId: null, tracks: [], collections: [], byKey: new Map() };

let state: KeptMusicState = EMPTY;
let started = false;
let inFlight: Promise<void> | null = null;
let again = false;
const listeners = new Set<() => void>();

function publish(next: KeptMusicState): void {
  state = next;
  for (const listener of listeners) listener();
}

/** Ce qu'une rangée montre d'un titre gardé : inchangé, l'objet d'avant est gardé (la rangée ne se redessine pas). */
function sameShown(a: KeptMusicTrack, b: KeptMusicTrack): boolean {
  return a.fileId === b.fileId && a.status === b.status && a.bytesDone === b.bytesDone && a.expectedSize === b.expectedSize
    && a.errorCode === b.errorCode && a.pausedByUser === b.pausedByUser && a.coverRel === b.coverRel;
}

function reconcile(previous: ReadonlyMap<string, KeptMusicTrack>, tracks: readonly KeptMusicTrack[]): KeptMusicTrack[] {
  return tracks.map((t) => {
    const before = previous.get(t.trackKey);
    return before && sameShown(before, t) ? before : t;
  });
}

function withTracks(userId: string, tracks: readonly KeptMusicTrack[], collections: readonly KeptMusicCollection[]): KeptMusicState {
  return { loaded: true, userId, tracks, collections, byKey: new Map(tracks.map((t) => [t.trackKey, t])) };
}

/** Relit la liste du compte de l'appareil ; une relecture demandée pendant une autre la suit (jamais deux à la fois). */
export function refreshKeptMusic(): Promise<void> {
  if (!supportsMusicOffline()) return Promise.resolve();
  if (inFlight) {
    again = true;
    return inFlight;
  }
  const userId = readOfflineOwner()?.userId ?? null;
  if (!userId) {
    publish({ ...EMPTY, loaded: true });
    return Promise.resolve();
  }
  inFlight = invoke<{ tracks: KeptMusicTrack[]; collections: KeptMusicCollection[] }>("downloads_music_list", { userId })
    .then((list) => publish(withTracks(userId, reconcile(state.byKey, list.tracks), list.collections)))
    .catch(() => {
      // Base indisponible : ce qu'on savait reste vrai.
      if (!state.loaded) publish({ ...EMPTY, loaded: true, userId });
    })
    .finally(() => {
      inFlight = null;
      if (again) {
        again = false;
        void refreshKeptMusic();
      }
    });
  return inFlight;
}

/** La progression d'un transfert : la rangée et la vue avancent sans relire la liste. */
function onProgress(fileId: number, bytesDone: number, expectedSize: number | null): void {
  const index = state.tracks.findIndex((t) => t.fileId === fileId);
  if (index < 0 || state.userId === null) return;
  const tracks = [...state.tracks];
  const current = tracks[index]!;
  tracks[index] = { ...current, status: "downloading", bytesDone, expectedSize: expectedSize ?? current.expectedSize };
  publish(withTracks(state.userId, tracks, state.collections));
}

/** Branche le magasin sur le moteur, une fois par page. */
export function startKeptMusic(): void {
  if (started || !supportsMusicOffline()) return;
  started = true;
  void listen("downloads://changed", () => void refreshKeptMusic());
  void listen<{ fileId: number; bytesDone: number; expectedSize: number | null }>("downloads://progress", (event) =>
    onProgress(event.payload.fileId, event.payload.bytesDone, event.payload.expectedSize),
  );
  void refreshKeptMusic();
}

export function keptMusicState(): KeptMusicState {
  return state;
}

export function subscribeKeptMusic(listener: () => void): () => void {
  startKeptMusic();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** La copie COMPLÈTE de ce titre, gardée par le compte de l'appareil ; `null` sinon. */
export function completeKeptTrack(trackKey: string): KeptMusicTrack | null {
  const kept = state.byKey.get(trackKey);
  return kept && kept.status === "complete" ? kept : null;
}
