/**
 * Le câblage web de la coquille d'overlay partagée — miroir de
 * `useDesktopSegmentsOverlay` : l'arbitre reçoit la position affichée, et
 * Watch Together y est tenu — le refus local part au groupe par le bus
 * existant, le refus distant s'applique au réducteur sans ré-annonce.
 * Extrait de `VideoPlayer.tsx` pour le ramener sous les 300 lignes.
 */

import { useEffect, useRef } from "react";
import { usePlaybackOverlay, type PlaybackOverlayResult } from "@tentacle-tv/api-client";
import type { ResolvedSegment } from "@tentacle-tv/shared";
import { announceLocalRefusal, useIntroSkipRefusal } from "../watchTogether/introSkipRefusal";

interface UseWebSegmentsOverlayArgs {
  itemId: string;
  isEpisode: boolean;
  hasNextEpisode?: boolean;
  positionSeconds: number;
  durationSeconds: number;
  hasStarted: boolean;
  playbackEnded: boolean;
  segments: readonly ResolvedSegment[];
  runtimeMs: number;
  /** Bibliothèque du média — les règles « avant la fin » ciblées la lisent. */
  libraryId: string | null;
  /** Les contrôles du lecteur sont-ils à l'écran ? (un passage mis en sourdine
   *  par la croix n'est plus rendu qu'avec eux). */
  controlsVisible: boolean;
  onSeekSeconds: (seconds: number) => void;
  onNextEpisode?: () => void;
  onEndOfPlayback: () => void;
  onAutoNextDismiss?: () => void;
  /** Watch Together — une séance est active (refus ⇒ décompte annulé). */
  inGroupSession?: boolean;
  /** Watch Together — ce lecteur est celui de l'hôte (le seul décompte qui va au bout). */
  inGroupHost?: boolean;
}

export function useWebSegmentsOverlay({
  itemId, isEpisode, hasNextEpisode, positionSeconds, durationSeconds,
  hasStarted, playbackEnded, segments, runtimeMs, libraryId, controlsVisible,
  onSeekSeconds, onNextEpisode, onEndOfPlayback, onAutoNextDismiss, inGroupSession, inGroupHost,
}: UseWebSegmentsOverlayArgs): PlaybackOverlayResult {
  // ── L'arbitre partagé : boutons de saut, carte, affiche de fin — toutes les
  // décisions (fenêtres, priorités, décomptes, réglages) viennent de la
  // coquille commune aux six surfaces. ──
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
    libraryId,
    groupSession: inGroupSession, groupHost: inGroupHost,
    controlsVisible,
    onSeekSeconds,
    onNextEpisode: () => onNextEpisode?.(),
    onEndOfPlayback,
    // Watch Together : le refus local part au groupe par le bus existant.
    onSegmentDismissNotify: (type) => { announceLocalRefusal(type); },
    onNextDismissNotify: onAutoNextDismiss,
  });

  // Watch Together entrant : un membre a refusé un saut — on s'aligne, sur le
  // passage qu'IL a gardé (un client d'avant la refonte dit « Intro »).
  const remoteRefusals = useIntroSkipRefusal();
  const seenRefusalsRef = useRef(remoteRefusals.counter);
  const { signalRemoteSegmentDismiss } = playback;
  useEffect(() => {
    if (remoteRefusals.counter === seenRefusalsRef.current) return;
    seenRefusalsRef.current = remoteRefusals.counter;
    signalRemoteSegmentDismiss(remoteRefusals.type);
  }, [remoteRefusals, signalRemoteSegmentDismiss]);

  return playback;
}
