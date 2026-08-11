import { useRef, useState, useEffect, useCallback, type MutableRefObject } from "react";
import type { SkipFlash } from "../components/SkipBadge";
import { jugerSaut, PERIODE_VEILLE_SAUT_MS } from "./calageSaut";

interface UseSmartSeekOptions {
  videoRef: MutableRefObject<HTMLVideoElement | null>;
  containerPtsOffsetRef: MutableRefObject<number>;
  seekTargetRef: MutableRefObject<number | null>;
  /** Veille de calage du saut — un INTERVALLE, cf. `calageSaut.ts`. */
  seekStallTimer: MutableRefObject<ReturnType<typeof setInterval> | undefined>;
  currentTimeRef: MutableRefObject<number>;
  src: string;
  isDirectPlay: boolean;
  streamOffset: number;
  onSeekRequest?: (seconds: number) => void;
  onSeekComplete?: (seconds: number, paused: boolean) => void;
}

/** Check if a time (in PTS space) falls within any buffered range of the video element. */
function isTimeInBuffered(video: HTMLVideoElement, time: number): boolean {
  for (let i = 0; i < video.buffered.length; i++) {
    if (time >= video.buffered.start(i) && time <= video.buffered.end(i)) {
      return true;
    }
  }
  return false;
}

export function useSmartSeek({
  videoRef, containerPtsOffsetRef, seekTargetRef, seekStallTimer, currentTimeRef,
  src, isDirectPlay, streamOffset, onSeekRequest, onSeekComplete,
}: UseSmartSeekOptions) {
  // 3-level smart seek — handles direct play, HLS, and progressive transcode streams.
  //
  // All targets from PlayerControls are in "movie position" (0 to duration).
  // CopyTimestamps streams have a container PTS offset — v.currentTime and v.buffered
  // are in PTS space (offset + movie_position). containerPtsOffsetRef bridges this gap.
  //
  // Level 1: target in HTML5 buffer → v.currentTime (instant)
  // Level 2: HLS/Direct Play → v.currentTime, hls.js fetches segment (fast, ~1-2s)
  //          with stall watcher (cf. `calageSaut.ts`) → fallback to level 3
  // Level 3: full restart → tuer l'encodage et renégocier une session à la
  //          position voulue (lent, 3-5 s). Le nom d'antan — « rebuild URL with
  //          StartTimeTicks » — décrivait un remède impossible : sur le chemin
  //          HLS, AUCUNE URL ne peut porter la position. La playlist de Jellyfin
  //          commence toujours au segment 0 (elle est bâtie sur la durée totale),
  //          et son gestionnaire de segments refuse tout `StartTimeTicks` non
  //          nul. Ce qui déplace vraiment la lecture est le nouveau POST
  //          `PlaybackInfo` déclenché par `onSeekRequest`.
  const handleSeek = useCallback((targetSeconds: number) => {
    const v = videoRef.current;
    if (!v) return;
    const isHlsStream = src.includes(".m3u8");
    const ptsOffset = containerPtsOffsetRef.current;

    // Cancel any pending stall watcher from a previous seek
    clearInterval(seekStallTimer.current);

    // Clamp to valid movie-position range.
    // For progressive transcode, v.duration is stream-relative (movieDuration - streamOffset).
    const isProgressiveTranscode = !isHlsStream && !isDirectPlay && streamOffset > 0;
    const movieMax = isProgressiveTranscode
      ? (v.duration || Infinity) + streamOffset
      : (v.duration || Infinity);
    const clamped = Math.max(0, Math.min(targetSeconds, movieMax));

    // Convert movie position to video-element PTS time
    const ptsTarget = clamped + ptsOffset;

    // --- LEVEL 1: Target in HTML5 buffer → instant seek ---
    if (isTimeInBuffered(v, ptsTarget)) {
      v.currentTime = ptsTarget;
      onSeekComplete?.(clamped, v.paused);
      return;
    }

    // Direct play: HTTP Range requests support random seek — always works
    if (isDirectPlay) {
      v.currentTime = ptsTarget;
      onSeekComplete?.(clamped, v.paused);
      return;
    }

    // --- LEVEL 2: HLS → try v.currentTime, hls.js fetches the segment ---
    // jellyfin-web pattern (playbackmanager.js:canPlayerSeek): HLS streams are
    // client-seekable — hls.js requests segments on demand. The existing ffmpeg
    // keeps running and serves segments as long as they've been transcoded.
    // If ffmpeg has advanced past this position (readrate=10x), the segment
    // already exists on disk and hls.js fetches it quickly.
    if (isHlsStream) {
      v.currentTime = ptsTarget;
      onSeekComplete?.(clamped, v.paused);

      // --- LEVEL 3 fallback: la veille de calage ---
      // Elle relève périodiquement plutôt que de conclure une seule fois, et le
      // fait sur `buffered` plutôt que sur `currentTime` : cf. `calageSaut.ts`,
      // qui porte la décision et explique pourquoi l'ancienne comparaison ne
      // pouvait rien détecter.
      const arme = Date.now();
      seekStallTimer.current = setInterval(() => {
        const el = videoRef.current;
        if (!el) {
          clearInterval(seekStallTimer.current);
          return;
        }
        const verdict = jugerSaut({
          cible: ptsTarget,
          couverte: isTimeInBuffered(el, ptsTarget),
          position: el.currentTime,
          enPause: el.paused,
          ecoule: Date.now() - arme,
        });
        if (verdict === "attendre") return;
        clearInterval(seekStallTimer.current);
        if (verdict === "renegocier") {
          seekTargetRef.current = clamped;
          onSeekRequest?.(clamped);
        }
      }, PERIODE_VEILLE_SAUT_MS);
      return;
    }

    // --- Progressive transcode: always full restart (level 3) ---
    // No in-stream seek support — must rebuild URL with new StartTimeTicks.
    seekTargetRef.current = clamped;
    onSeekRequest?.(clamped);
  }, [isDirectPlay, streamOffset, src, onSeekRequest, onSeekComplete]);

  // Badge « +30s / −10s » à chaque saut (boutons, flèches clavier, swipe)
  const [skipFlash, setSkipFlash] = useState<SkipFlash | null>(null);
  const skipFlashTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(skipFlashTimer.current), []);
  const skipBy = useCallback((delta: number) => {
    handleSeek(Math.max(0, currentTimeRef.current + delta));
    setSkipFlash({ delta, id: Date.now() });
    clearTimeout(skipFlashTimer.current);
    skipFlashTimer.current = setTimeout(() => setSkipFlash(null), 1000);
  }, [handleSeek]);

  return { handleSeek, skipBy, skipFlash };
}
