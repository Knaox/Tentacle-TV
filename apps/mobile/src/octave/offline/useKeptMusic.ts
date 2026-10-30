/**
 * Octave (mobile) — la musique gardée vue par l'interface (`keptMusic.ts`) : la
 * liste entière, ou l'état d'un titre (la rangée ne se redessine que si SON état change).
 */

import { useSyncExternalStore } from "react";
import type { KeptMusicTrack } from "@tentacle-tv/offline-core";
import { localCoversByUrl, shownArtworkUrl, type KeptMusicState } from "@tentacle-tv/offline-core/music";
import { useOfflineMode } from "../../offline/useOfflineMode";
import { keptMusicResourceUri } from "../../offline/engineMusicApi";
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

/** La table « adresse du serveur → pochette gardée », recalculée seulement quand la musique gardée change. */
let coversFor: KeptMusicState | null = null;
let covers: ReadonlyMap<string, string> = new Map();

function keptCoversByUrl(): ReadonlyMap<string, string> {
  const state = keptMusicStore.state();
  if (state !== coversFor) {
    coversFor = state;
    covers = localCoversByUrl(state.tracks, keptMusicResourceUri);
  }
  return covers;
}

/** La pochette à montrer pour une adresse du serveur (`shownArtworkUrl`) : hors ligne, la gardée d'abord. */
export function keptArtworkFor(url: string | null | undefined, offline: boolean): string | null {
  return shownArtworkUrl(url, keptCoversByUrl(), offline);
}

/** La pochette gardée pour cette adresse, ou `null` (pour le pont audio : l'écran verrouillé, en ligne aussi). */
export function keptCoverForUrl(url: string | null | undefined): string | null {
  return url ? (keptCoversByUrl().get(url) ?? null) : null;
}

/** Le crochet : l'adresse à montrer, relue quand la musique gardée ou la connectivité change. */
export function useShownArtworkUrl(url: string | null | undefined): string | null {
  const offline = useOfflineMode();
  const read = () => keptArtworkFor(url, offline);
  return useSyncExternalStore(subscribeKeptMusic, read, read);
}
