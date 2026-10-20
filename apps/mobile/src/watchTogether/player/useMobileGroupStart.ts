import { useMemo, useRef } from "react";
import { useGroupPlaybackHandlers } from "@tentacle-tv/api-client";
import { TICKS_PER_SECOND } from "@tentacle-tv/shared";
import type { PlayerSessionCore } from "@/hooks/usePlayerPlayback";

/** Les gestionnaires d'épisode de l'écran, posés plus tard (`useMobileGroupPlayback`). */
export interface EpisodeHandlersRef {
  next: () => void;
  previous: () => void;
}

export interface MobileGroupStart {
  /** En séance, la position de départ du groupe n'est pas encore connue : ne pas négocier le flux. */
  hold: boolean;
  /** Position de départ imposée par la séance (ticks) — un flux TRANSCODÉ démarre directement là. */
  ticks: number | undefined;
  /** Ce que rend la séance pour la position de départ et les épisodes. */
  group: ReturnType<typeof useGroupPlaybackHandlers>;
  episodes: { current: EpisodeHandlersRef };
}

/**
 * La première moitié du lecteur en séance, appelée TÔT dans `PlayerScreen`
 * (avant la négociation du flux) : la position de départ du groupe
 * (`useGroupPlaybackHandlers`, api-client) — celle de la salle si on la
 * rejoint, sa propre reprise si on lance le titre pour elle. Les
 * gestionnaires d'épisode de l'écran n'existent pas encore à ce moment : ils
 * passent par une ref que `useMobileGroupPlayback` remplit.
 */
export function useMobileGroupStart(itemId: string, pb: PlayerSessionCore): MobileGroupStart {
  const episodes = useRef<EpisodeHandlersRef>({ next: () => undefined, previous: () => undefined });
  const resumeTicks = pb.item?.UserData?.PlaybackPositionTicks;
  const group = useGroupPlaybackHandlers({
    itemId,
    itemReady: !!pb.item,
    resumePositionSeconds: resumeTicks && resumeTicks > 0 ? resumeTicks / TICKS_PER_SECOND : undefined,
    nextEpisode: pb.episodeNav.nextEpisode,
    previousEpisode: pb.episodeNav.previousEpisode,
    handleNextEpisode: () => episodes.current.next(),
    handlePreviousEpisode: () => episodes.current.previous(),
    // Le mobile lit la position de départ au moment de négocier (`ticks`).
    setStartTicks: () => undefined,
  });
  const seconds = group.groupStartPositionSeconds;
  return useMemo(() => ({
    hold: group.groupActive && seconds === undefined,
    ticks: group.groupActive && seconds !== undefined && seconds > 1 ? Math.floor(seconds * TICKS_PER_SECOND) : undefined,
    group,
    episodes,
  }), [group, seconds]);
}
