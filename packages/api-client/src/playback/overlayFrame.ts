import type { PlaybackSettings, SkipCandidateInput } from "@tentacle-tv/shared";
import type { PlaybackOverlayInput } from "./playbackOverlay.types";

/** La même forme d'entrée pour le candidat ET l'éligibilité — décrite une fois. */
export function buildFrameInput(p: PlaybackOverlayInput, settings: PlaybackSettings): SkipCandidateInput {
  return {
    segments: p.segments,
    positionMs: Math.round(p.positionSeconds * 1000),
    hasStarted: p.hasStarted,
    isEpisode: p.isEpisode,
    hasNextEpisode: p.hasNextEpisode,
    settings,
  };
}
