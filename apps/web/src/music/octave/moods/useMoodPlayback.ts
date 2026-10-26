/**
 * Octave — lire une ambiance D'UN GESTE (bouton Lecture de sa carte, résultat de recherche) : sa playlist demandée
 * sous la clé de sa vue (l'ouvrir ensuite est immédiat), lue depuis le début ; l'appui prépare le premier titre.
 */

import { useCallback } from "react";
import { useOctavePlayer } from "../player/OctavePlayerProvider";
import { useMoodTracks } from "./useMoods";

/** Le contexte de lecture d'une ambiance (la houle de sa carte, sa vue). */
export const moodContextId = (moodId: string) => `mood:${moodId}`;

export function useMoodPlayback() {
  const player = useOctavePlayer();
  const mixOf = useMoodTracks();
  const play = useCallback(
    async (moodId: string) => {
      const mix = await mixOf(moodId).catch(() => null);
      if (mix && mix.tracks.length > 0) player.playList(mix.tracks, 0, moodContextId(moodId));
    },
    [mixOf, player],
  );
  const warm = useCallback(
    (moodId: string, intent: "hover" | "press") => {
      const loading = mixOf(moodId).catch(() => null);
      if (intent === "press") void loading.then((mix) => mix?.tracks[0] && player.prefetch([mix.tracks[0]], "press"));
    },
    [mixOf, player],
  );
  return { play, warm };
}
