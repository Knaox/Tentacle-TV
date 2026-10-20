import type { RefObject } from "react";
import type { MediaStream as JfStream, MediaItem } from "@tentacle-tv/shared";
import type { PlayerEngineHandle } from "./engine/types";
import { useCastSession, type CastSession } from "./cast/useCastSession";
import { usePlayerScreenPip } from "./pip/usePlayerScreenPip";
import type { PlayerPip } from "./pip/usePlayerPip";

interface Args {
  itemId: string;
  item: MediaItem | undefined;
  pb: Parameters<typeof useCastSession>[0]["pb"] & { streams: readonly JfStream[] };
  engineRef: RefObject<PlayerEngineHandle | null>;
  paused: boolean;
  setPaused: (paused: boolean) => void;
  seekBy: (delta: number) => void;
  started: boolean;
  ended: boolean;
  failed: boolean;
  airPlaying: boolean;
  leave: () => void;
  hideOverlay: () => void;
}

/**
 * Où va l'image du lecteur serveur, hors de l'écran plein : sur une TV
 * (diffusion Google Cast, Android) ou dans la petite fenêtre (image dans
 * l'image). Les deux s'excluent : une image sur la TV n'a pas de petite fenêtre.
 */
export function usePlayerModes(args: Args): { cast: CastSession; pip: PlayerPip } {
  const { itemId, item, pb, engineRef, paused, setPaused, seekBy, started, ended, failed, airPlaying, leave, hideOverlay } = args;
  const cast = useCastSession({ itemId, item, pb, setPaused, onFinished: leave });
  const pip = usePlayerScreenPip({
    engineRef, paused, started, ended, failed, remote: airPlaying || cast.active,
    streams: pb.streams, setPaused, seekBy, onClosed: leave, hideOverlay,
  });
  return { cast, pip };
}
