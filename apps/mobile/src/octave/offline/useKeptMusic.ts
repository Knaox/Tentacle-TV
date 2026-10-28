/**
 * Octave (mobile) — la musique gardée vue par l'interface (`keptMusic.ts`) : la
 * liste entière, ou l'état d'un titre (la rangée ne se redessine que si SON état change).
 */

import { useSyncExternalStore } from "react";
import type { KeptMusicTrack } from "@tentacle-tv/offline-core";
import type { KeptMusicState } from "@tentacle-tv/offline-core/music";
import { keptMusicStore, subscribeKeptMusic } from "./keptMusic";

export function useKeptMusic(): KeptMusicState {
  return useSyncExternalStore(subscribeKeptMusic, keptMusicStore.state, keptMusicStore.state);
}

export function useKeptTrack(trackKey: string): KeptMusicTrack | null {
  const read = () => keptMusicStore.state().byKey.get(trackKey) ?? null;
  return useSyncExternalStore(subscribeKeptMusic, read, read);
}
