/**
 * Octave — la musique gardée vue par l'interface (`keptMusicStore.ts`) : la
 * liste entière, ou l'état d'un titre et d'une collection.
 */

import { useSyncExternalStore } from "react";
import type { KeptMusicTrack } from "@tentacle-tv/offline-core";
import { keptMusicState, subscribeKeptMusic, type KeptMusicState } from "./keptMusicStore";

export function useKeptMusic(): KeptMusicState {
  return useSyncExternalStore(subscribeKeptMusic, keptMusicState, keptMusicState);
}

/** L'état gardé d'un titre (ou `null`) ; la rangée ne se redessine que si SON état change. */
export function useKeptTrack(trackKey: string): KeptMusicTrack | null {
  const read = () => keptMusicState().byKey.get(trackKey) ?? null;
  return useSyncExternalStore(subscribeKeptMusic, read, read);
}
