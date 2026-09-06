/**
 * Épisode précédent / suivant HORS LIGNE, depuis les téléchargements du compte.
 * La logique vit dans `localEpisodeNav.ts` (pure, testable) ; ce hook ne fait
 * que l'alimenter avec la liste locale.
 */

import { useMemo } from "react";
import { findAdjacentLocalEpisodes, type LocalEpisodeNavigation } from "@tentacle-tv/offline-core";
import { useDownloadsList } from "./useDownloadState";

export type { LocalEpisodeNavigation } from "@tentacle-tv/offline-core";

const NONE: LocalEpisodeNavigation = { previousEpisode: null, nextEpisode: null };

export function useLocalEpisodeNavigation(
  itemId: string | undefined,
  enabled: boolean,
): LocalEpisodeNavigation {
  const entries = useDownloadsList();
  return useMemo(
    () => (enabled ? findAdjacentLocalEpisodes(entries, itemId) : NONE),
    [entries, itemId, enabled],
  );
}
