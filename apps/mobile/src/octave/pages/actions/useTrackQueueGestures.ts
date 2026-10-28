/**
 * Octave mobile — « Lire ensuite » et « Ajouter à la file » d'UN titre, tels que les rangées les offrent
 * (balayage, actions du lecteur d'écran) : les gestes du lecteur (`queueActions`, ceux de la feuille « ⋯ »),
 * suivis d'un avis bref. `null` sans lecteur ou si le titre ne peut pas se lire ici (hors ligne, pas gardé).
 */

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { MusicTrack } from "@tentacle-tv/shared/music";
import { usePagesPlayer } from "../env/pagesPlayer";
import { enqueueWithNotice, playNextWithNotice } from "./queueNotice";

export interface TrackQueueGestures {
  playNext: () => void;
  enqueue: () => void;
}

export function useTrackQueueGestures(track: MusicTrack, playable: boolean): TrackQueueGestures | null {
  const player = usePagesPlayer();
  const { t } = useTranslation("musicLists");
  return useMemo(() => {
    if (!player || !playable) return null;
    return {
      playNext: () => playNextWithNotice(player, track, t),
      enqueue: () => enqueueWithNotice(player, track, t),
    };
  }, [playable, player, t, track]);
}
