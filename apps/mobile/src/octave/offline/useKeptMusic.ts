/**
 * Octave (mobile) — la musique gardée vue par l'interface (`keptMusic.ts`) : la
 * liste entière, ou l'état d'un titre (la rangée ne se redessine que si SON état change).
 */

import { useSyncExternalStore } from "react";
import type { KeptMusicTrack } from "@tentacle-tv/offline-core";
import type { KeptMusicState } from "@tentacle-tv/offline-core/music";
import { keptMusicResourceUri } from "@/offline/engineMusicApi";
import { keptMusicStore, subscribeKeptMusic } from "./keptMusic";

export function useKeptMusic(): KeptMusicState {
  return useSyncExternalStore(subscribeKeptMusic, keptMusicStore.state, keptMusicStore.state);
}

/** La pochette gardée sur l'appareil avec ce titre (fichier local), sinon `null` : lue comme une chaîne. */
export function useKeptCover(trackKey: string): string | null {
  const read = () => keptMusicStore.state().byKey.get(trackKey)?.coverRel ?? null;
  const rel = useSyncExternalStore(subscribeKeptMusic, read, read);
  return rel ? keptMusicResourceUri(rel) : null;
}

export function useKeptTrack(trackKey: string): KeptMusicTrack | null {
  const read = () => keptMusicStore.state().byKey.get(trackKey) ?? null;
  return useSyncExternalStore(subscribeKeptMusic, read, read);
}
