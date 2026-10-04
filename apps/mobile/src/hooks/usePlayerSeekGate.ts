import { useEffect, type MutableRefObject } from "react";
import { useTranscodeSeek, type TranscodeSeek } from "@tentacle-tv/api-client";
import type { PlaybackFailureReport } from "../player/problems/playbackFailure";

/**
 * Le saut pendant un transcodage sur le mobile et l'iPad — la règle partagée
 * (`useTranscodeSeek`) pour les deux moteurs (mpv et lecteur système) : des
 * « ±10/30 s » rapides et un double toucher répété font UN seul seek, donc
 * un seul ffmpeg relancé par Jellyfin ; l'attente se voit jusqu'à ce que la
 * vidéo avance au passage visé, et au délai dépassé, le modèle d'erreur
 * (`seekTimeout`) — « Réessayer » reprend à ce passage (`positionRef`).
 */
export function usePlayerSeekGate({ transcoding, duration, positionRef, currentTime, buffering, seek, report }: {
  transcoding: boolean;
  duration: number;
  /** La position du film, tenue par le lecteur (progression et sauts). */
  positionRef: MutableRefObject<number>;
  currentTime: number;
  buffering: boolean;
  /** Le seek du moteur (`usePlayerHandlers`) : borné, décalé, rapporté. */
  seek: (seconds: number) => void;
  report: (failure: PlaybackFailureReport) => void;
}): TranscodeSeek {
  const gate = useTranscodeSeek({ transcoding, duration, position: () => positionRef.current, apply: seek });
  const { observe, reset, phase } = gate;

  useEffect(() => { observe(currentTime, buffering); }, [observe, currentTime, buffering]);

  useEffect(() => {
    if (phase !== "failed") return;
    reset();
    report({ from: "marker", marker: "seekTimeout" });
  }, [phase, reset, report]);

  return gate;
}
