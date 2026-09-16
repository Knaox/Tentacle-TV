import { useCallback, useRef, type MutableRefObject } from "react";
import type { SegmentType, SkipCandidate } from "@tentacle-tv/shared";
import type { PlaybackOverlayInput } from "./playbackOverlay.types";

/**
 * En séance Watch Together, le décompte d'un passage n'est pas local : ce
 * lecteur PROPOSE le saut à la salle dès qu'il entre dans un passage que les
 * réglages de l'hôte sautent tout seuls, et le serveur arme un décompte pour
 * tout le monde (dédupliqué par passage : tous proposent, un seul gagne).
 * Une fois par entrée dans le passage — en ressortir puis y revenir le
 * redemande, et c'est le serveur qui sait s'il est réglé.
 */
export function useGroupSkipProposal(
  inputRef: MutableRefObject<PlaybackOverlayInput>,
  mutedRef: MutableRefObject<ReadonlyMap<SegmentType, number>>,
): (candidate: SkipCandidate | null) => void {
  const proposedRef = useRef<string | null>(null);
  return useCallback((candidate) => {
    const p = inputRef.current;
    if (!candidate) { proposedRef.current = null; return; }
    if (p.groupSession !== true || !p.onSkipPropose || p.scrubbing) return;
    if (candidate.settings.action !== "auto" || candidate.action.kind !== "seek") return;
    if (mutedRef.current.has(candidate.segment.type)) return;
    const key = `${p.itemId ?? ""}:${candidate.segment.type}:${candidate.segment.startMs}`;
    if (proposedRef.current === key) return;
    proposedRef.current = key;
    p.onSkipPropose({
      segmentType: candidate.segment.type,
      isEpisode: p.isEpisode,
      segmentStartMs: candidate.segment.startMs,
      toMs: candidate.action.toMs,
    });
  }, [inputRef, mutedRef]);
}
