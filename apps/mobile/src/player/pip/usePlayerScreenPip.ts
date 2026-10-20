import { useEffect, useRef, type RefObject } from "react";
import type { MediaStream as JfStream } from "@tentacle-tv/shared";
import type { PlayerEngineHandle } from "../engine/types";
import type { PipState } from "./pipPolicy";
import { usePlayerPip, type PlayerPip } from "./usePlayerPip";

interface Args extends PipState {
  engineRef: RefObject<PlayerEngineHandle | null>;
  /** Les flux de la source : le format de la petite fenêtre est celui de l'image. */
  streams: readonly JfStream[];
  setPaused: (paused: boolean) => void;
  seekBy: (delta: number) => void;
  onClosed: () => void;
  /** L'habillage n'a rien à faire dans la petite fenêtre. */
  hideOverlay: () => void;
}

/** L'image dans l'image d'un écran de lecteur (serveur ou fichier local). */
export function usePlayerScreenPip({ streams, hideOverlay, ...options }: Args): PlayerPip {
  const video = streams.find((s) => s.Type === "Video");
  const pip = usePlayerPip({ ...options, videoWidth: video?.Width, videoHeight: video?.Height });
  const hideRef = useRef(hideOverlay);
  hideRef.current = hideOverlay;
  useEffect(() => { if (pip.active) hideRef.current(); }, [pip.active]);
  return pip;
}
