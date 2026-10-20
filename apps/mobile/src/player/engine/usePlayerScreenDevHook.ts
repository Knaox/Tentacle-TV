import { useMemo, type RefObject } from "react";
import type { PlayerPlayback } from "../../hooks/usePlayerPlayback";
import type { PlayerEngineHandle } from "./types";
import { usePlayerDevHook } from "./usePlayerDevHook";

interface Args {
  pb: PlayerPlayback;
  engineRef: RefObject<PlayerEngineHandle | null>;
  changeAudio: (index: number) => void;
  changeSubtitle: (index: number) => void;
  seek: (seconds: number) => void;
  setPaused: (paused: boolean) => void;
  simulateAirPlay: (active: boolean) => void;
  leave: () => void;
}

/** Le crochet de développement du lecteur serveur (`usePlayerDevHook`), monté d'après l'écran. */
export function usePlayerScreenDevHook({ pb, engineRef, changeAudio, changeSubtitle, seek, setPaused, simulateAirPlay, leave }: Args): void {
  usePlayerDevHook(useMemo(() => ({
    engine: pb.engine, audioIndex: pb.audioIndex, subtitleIndex: pb.subtitleIndex, isDirectPlay: pb.isDirectPlay,
    changeAudio, changeSubtitle, seek, setPaused, simulateAirPlay, leave,
    changeQuality: (key: string) => pb.changeQuality(key as Parameters<typeof pb.changeQuality>[0]),
    technicalInfo: () => engineRef.current?.getTechnicalInfo?.() ?? Promise.resolve({}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [pb.engine, pb.audioIndex, pb.subtitleIndex, pb.isDirectPlay, pb.changeQuality, changeAudio, changeSubtitle, seek, setPaused, simulateAirPlay, leave]));
}
