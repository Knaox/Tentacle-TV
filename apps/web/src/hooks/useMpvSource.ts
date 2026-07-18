import { useEffect, useState, type MutableRefObject } from "react";
import type { MpvState, PlayOptions } from "./useDesktopPlayer";
import { wtLog } from "../watchTogether/wtLog";

interface UseMpvSourceOptions {
  state: MpvState;
  ready: boolean;
  fileLoaded: boolean;
  src: string;
  startPositionSeconds?: number;
  isDirectPlay: boolean;
  streamOffset: number;
  play: (options: PlayOptions) => Promise<void>;
  onStarted?: () => void;
  onProgress?: (seconds: number, paused: boolean) => void;
  onSeekComplete?: (seconds: number, paused: boolean) => void;
  lastAbsolutePosRef: MutableRefObject<number>;
  effectiveMpvOffset: MutableRefObject<number>;
  offsetDetectedForSrc: MutableRefObject<string>;
  prevSrcRef: MutableRefObject<string>;
  hasStartedRef: MutableRefObject<boolean>;
  loadedExternalSubs: MutableRefObject<Map<number, number>>;
}

/**
 * Chargement de la source mpv + détection PTS + report de progression.
 * Retourne `sourceChanging` (overlay de chargement pendant un rebuild).
 */
export function useMpvSource({
  state, ready, fileLoaded, src, startPositionSeconds, isDirectPlay, streamOffset,
  play, onStarted, onProgress, onSeekComplete,
  lastAbsolutePosRef, effectiveMpvOffset, offsetDetectedForSrc, prevSrcRef,
  hasStartedRef, loadedExternalSubs,
}: UseMpvSourceOptions) {
  const [sourceChanging, setSourceChanging] = useState(false);
  // State (not ref!) — transitioning to true triggers preference effect re-runs
  const [initialLoaded, setInitialLoaded] = useState(false);

  // Load media when ready
  useEffect(() => {
    if (!ready || !src) return;
    const isSourceChange = initialLoaded && prevSrcRef.current !== src;
    prevSrcRef.current = src;

    // Show loading overlay during source changes (quality/audio switch)
    if (isSourceChange) setSourceChanging(true);

    // mpv must seek to the correct position for both direct play and transcode.
    // StartTimeTicks is stripped from HLS URLs (Jellyfin 10.10+ rejects it on segments),
    // so mpv always handles seeking client-side.
    const startPos = isSourceChange
      ? lastAbsolutePosRef.current
      : startPositionSeconds;

    wtLog("mpv-src", isSourceChange ? "REBUILD de source (qualité/audio/burn-in)" : "chargement initial", {
      src: src.substring(0, 110), startPosS: startPos?.toFixed(1) ?? "none",
      lastAbsolutePosS: lastAbsolutePosRef.current.toFixed(1), isDirectPlay,
    });
    // Don't pass audioTrack/subtitleTrack here — the preference effects handle
    // track selection AFTER file-loaded, avoiding races with pendingTracks.
    play({ url: src, startPosition: startPos });
    loadedExternalSubs.current.clear();
    // State transition triggers preference effects in the NEXT render
    if (!initialLoaded) setInitialLoaded(true);
  }, [ready, src]); // eslint-disable-line react-hooks/exhaustive-deps

  // Detect whether mpv reports absolute PTS (offset baked into HLS manifest) or
  // relative PTS (starting from 0).  Jellyfin HLS typically uses absolute PTS,
  // matching the web player behaviour (VideoPlayer.tsx effectiveOffset = 0).
  useEffect(() => {
    if (src === offsetDetectedForSrc.current) return;
    if (isDirectPlay || streamOffset === 0) {
      effectiveMpvOffset.current = 0;
      offsetDetectedForSrc.current = src;
      return;
    }
    // In transcode mode with streamOffset: wait for a meaningful position (> 5 s)
    if (state.position > 5) {
      offsetDetectedForSrc.current = src;
      if (state.position > streamOffset * 0.5) {
        // mpv reports absolute PTS — no additional offset needed
        effectiveMpvOffset.current = 0;
        wtLog("mpv-src", "détection PTS : absolus (offset 0)", { pos: state.position.toFixed(1), streamOffset });
      } else {
        // mpv reports relative PTS — must add offset
        effectiveMpvOffset.current = streamOffset;
        wtLog("mpv-src", "détection PTS : relatifs (offset appliqué)", { pos: state.position.toFixed(1), streamOffset });
      }
    }
  }, [state.position, src, isDirectPlay, streamOffset]); // eslint-disable-line react-hooks/exhaustive-deps

  // Report progress + track absolute position
  useEffect(() => {
    // Ignorer les événements du fichier PRÉCÉDENT : après un remount (changement
    // d'épisode), mpv rapporte encore position/paused de l'ancien média jusqu'au
    // chargement du nouveau — sans cette garde, la position de fin de l'ancien
    // épisode déclenche l'écran « épisode suivant » au début du nouveau.
    if (!fileLoaded) return;
    if (!state.playing && !hasStartedRef.current) return;
    if (state.playing && !hasStartedRef.current) { hasStartedRef.current = true; onStarted?.(); }
    const absolutePos = state.position + effectiveMpvOffset.current;
    const prevPos = lastAbsolutePosRef.current;
    lastAbsolutePosRef.current = absolutePos;
    onProgress?.(absolutePos, state.paused);
    // Watch Together : mpv n'a pas de callback central de seek — un saut de
    // position discontinu (hors changement de source) est un seek local.
    if (prevPos > 0 && !sourceChanging && Math.abs(absolutePos - prevPos) > 3) {
      wtLog("mpv-src", "saut de position détecté (seek local)", {
        fromS: prevPos.toFixed(1), toS: absolutePos.toFixed(1), paused: state.paused,
      });
      onSeekComplete?.(absolutePos, state.paused);
    }
  }, [state.position, state.paused, state.playing, fileLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear sourceChanging when playback resumes after a source change
  useEffect(() => {
    if (state.playing && sourceChanging) {
      wtLog("mpv-src", "rebuild terminé — lecture effective");
      setSourceChanging(false);
    }
  }, [state.playing, sourceChanging]);

  return { sourceChanging };
}
