import { useEffect, type MutableRefObject } from "react";
import { TICKS_PER_SECOND } from "@tentacle-tv/shared";
import type { MobileGroupStart } from "@/watchTogether/player/useMobileGroupStart";
import type { usePlayerPlayback } from "./usePlayerPlayback";

/**
 * La première négociation du flux d'un titre (PlaybackInfo), une fois sa fiche
 * chargée : gardes et états du lecteur remis à zéro, puis le flux demandé à la
 * position de REPRISE — sa reprise Jellyfin, ou, en séance Watch Together,
 * la position du groupe (`useMobileGroupStart`) : un flux transcodé démarre
 * directement là, sans double chargement. En séance, tant que cette position
 * n'est pas connue (`hold`), on ne négocie pas.
 */
export function usePlayerStartFetch({
  itemId, pb, groupStart, resumeApplied, retryCount, setIsBuffering, setPaused, setBufferedTime,
}: {
  itemId: string;
  pb: ReturnType<typeof usePlayerPlayback>;
  groupStart: MobileGroupStart;
  resumeApplied: MutableRefObject<boolean>;
  retryCount: MutableRefObject<number>;
  setIsBuffering: (buffering: boolean) => void;
  setPaused: (paused: boolean) => void;
  setBufferedTime: (seconds: number) => void;
}): void {
  useEffect(() => {
    if (!pb.item || groupStart.hold) return;
    resumeApplied.current = false;
    retryCount.current = 0;
    setIsBuffering(true);
    setPaused(false);
    setBufferedTime(0);

    const resumeTicks = groupStart.override ? groupStart.ticks : pb.item.UserData?.PlaybackPositionTicks;
    const resumeSeconds = resumeTicks && resumeTicks > 0 ? resumeTicks / TICKS_PER_SECOND : 0;
    // La position de reprise, gardée : changer d'audio ou de sous-titres la préserve.
    // `currentTime` n'est pas posé ici : la progression dira la vraie position.
    pb.positionRef.current = resumeSeconds;

    pb.fetchPlaybackInfo({
      startTimeTicks: resumeTicks && resumeTicks > 0 ? resumeTicks : undefined,
    });
  }, [itemId, pb.item?.Id, groupStart.hold]); // eslint-disable-line react-hooks/exhaustive-deps
}
