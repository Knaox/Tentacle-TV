import { useRef } from "react";
import { TICKS_PER_SECOND } from "@tentacle-tv/shared";
import type { MediaItem } from "@tentacle-tv/shared";

/**
 * Position de DÉMARRAGE du player (fragment #tnt-start lu par le natif) :
 * reprise initiale (UserData, FIGÉE au premier calcul — un refetch de l'item
 * en cours de lecture ne doit pas changer l'URL) ou position courante posée
 * par un changement de piste/qualité (startTicks).
 */
export function useTVInitialResume(args: {
  item?: MediaItem | null;
  startTicks: number;
}) {
  const { item, startTicks } = args;

  const initialResumeSecondsRef = useRef<number | null>(null);
  if (initialResumeSecondsRef.current === null && item) {
    initialResumeSecondsRef.current = (item.UserData?.PlaybackPositionTicks ?? 0) / TICKS_PER_SECOND;
  }
  const startSeconds = startTicks > 0
    ? startTicks / TICKS_PER_SECOND
    : (initialResumeSecondsRef.current ?? 0);

  return { initialResumeSecondsRef, startSeconds };
}
