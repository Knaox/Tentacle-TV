/**
 * Le câblage bureau de la coquille d'overlay partagée : l'arbitre reçoit la
 * position mpv corrigée d'offset, et Watch Together y est tenu — le refus
 * local part au groupe par le bus existant, le refus distant s'applique au
 * réducteur sans ré-annonce. La cible d'un seek se corrige de l'offset AU
 * MOMENT du saut (la valeur au rendu ne vaut rien).
 */

import { useEffect, useRef, type MutableRefObject } from "react";
import { usePlaybackOverlay, type PlaybackOverlayResult } from "@tentacle-tv/api-client";
import type { ResolvedSegment } from "@tentacle-tv/shared";
import { annoncerRefusLocal, useRefusSautIntro } from "../watchTogether/refusSautIntro";

interface UseDesktopSegmentsOverlayArgs {
  itemId?: string;
  isEpisode: boolean;
  hasNextEpisode?: boolean;
  positionSeconds: number;
  durationSeconds: number;
  hasStarted: boolean;
  playbackEnded: boolean;
  segments: readonly ResolvedSegment[];
  runtimeMs: number;
  serverAutoplayEnabled: boolean;
  scrubbing: boolean;
  isDirectPlay: boolean;
  effectiveMpvOffset: MutableRefObject<number>;
  seek: (pos: number) => Promise<void>;
  onNextEpisode?: () => void;
  onEndOfPlayback: () => void;
  onAutoNextDismiss?: () => void;
}

export function useDesktopSegmentsOverlay({
  itemId, isEpisode, hasNextEpisode, positionSeconds, durationSeconds,
  hasStarted, playbackEnded, segments, runtimeMs, serverAutoplayEnabled,
  scrubbing, isDirectPlay, effectiveMpvOffset, seek,
  onNextEpisode, onEndOfPlayback, onAutoNextDismiss,
}: UseDesktopSegmentsOverlayArgs): PlaybackOverlayResult {
  const playback = usePlaybackOverlay({
    itemId,
    isEpisode,
    hasNextEpisode: !!hasNextEpisode,
    positionSeconds,
    durationSeconds,
    hasStarted,
    playbackEnded,
    segments,
    runtimeMs,
    serverAutoplayEnabled,
    scrubbing,
    onSeekSeconds: (s) => { void seek(isDirectPlay ? s : Math.max(0, s - effectiveMpvOffset.current)); },
    onNextEpisode: () => onNextEpisode?.(),
    onEndOfPlayback,
    // Watch Together : le refus local part au groupe par le bus existant.
    onSegmentDismissNotify: () => annoncerRefusLocal(),
    onNextDismissNotify: onAutoNextDismiss,
  });

  // Watch Together entrant : un membre a refusé le saut d'intro — on s'aligne.
  const refusDistants = useRefusSautIntro();
  const refusVusRef = useRef(refusDistants);
  const { signalRemoteSegmentDismiss } = playback;
  useEffect(() => {
    if (refusDistants === refusVusRef.current) return;
    refusVusRef.current = refusDistants;
    signalRemoteSegmentDismiss("Intro");
  }, [refusDistants, signalRemoteSegmentDismiss]);

  return playback;
}
