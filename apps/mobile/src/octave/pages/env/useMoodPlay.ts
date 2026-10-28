/**
 * Octave mobile — lire une ambiance D'UN GESTE (bouton Lecture de sa carte) :
 * sa playlist demandée sous la clé de sa vue (l'ouvrir ensuite est immédiat),
 * lue depuis le début. Les crochets sont ceux du bureau (api-client).
 */

import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { moodContextId, useMusicMoodTracks } from "@tentacle-tv/api-client";
import { useOctavePagesProvider } from "./pagesEnv";
import { usePagesPlayer } from "./pagesPlayer";

export function useMoodPlay(): (moodId: string) => Promise<void> {
  const { i18n } = useTranslation();
  const player = usePagesPlayer();
  const mixOf = useMusicMoodTracks(useOctavePagesProvider(), i18n.language);
  return useCallback(
    async (moodId: string) => {
      const mix = await mixOf(moodId).catch(() => null);
      if (player && mix && mix.tracks.length > 0) player.playList(mix.tracks, 0, moodContextId(moodId));
    },
    [mixOf, player],
  );
}
