import { useRef, useState, useEffect, useCallback, type MutableRefObject } from "react";
import type { SkipFlash } from "../components/SkipBadge";

interface UseSmartSeekOptions {
  videoRef: MutableRefObject<HTMLVideoElement | null>;
  containerPtsOffsetRef: MutableRefObject<number>;
  seekTargetRef: MutableRefObject<number | null>;
  seekStallTimer: MutableRefObject<ReturnType<typeof setTimeout> | undefined>;
  currentTimeRef: MutableRefObject<number>;
  src: string;
  isDirectPlay: boolean;
  streamOffset: number;
  onSeekRequest?: (seconds: number) => void;
  onSeekComplete?: (seconds: number, paused: boolean) => void;
}

/**
 * Au bout de combien de temps un saut HLS est considéré comme calé.
 *
 * Huit secondes, et non trois comme l'annonçaient les commentaires : la valeur
 * est là depuis toujours, seule sa documentation était fausse. Descendre
 * échangerait de l'attente contre un redémarrage de transcodage de trois à cinq
 * secondes — qui n'était pas nécessaire.
 */
const DELAI_CALAGE_SAUT_MS = 8000;

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
  //          with stall watcher (cf. DELAI_CALAGE_SAUT_MS) → fallback to level 3
  // Level 3: full restart → kill transcode + rebuild URL with StartTimeTicks (slow, 3-5s)
  const handleSeek = useCallback((targetSeconds: number) => {
    const v = videoRef.current;
    if (!v) return;
    const isHlsStream = src.includes(".m3u8");
    const ptsOffset = containerPtsOffsetRef.current;

    // Cancel any pending stall watcher from a previous seek
    clearTimeout(seekStallTimer.current);

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

      // --- LEVEL 3 fallback: stall watcher ---
      // If the position hasn't reached the target, the segment doesn't
      // exist yet (ffmpeg hasn't transcoded that far). Kill the current transcode
      // and restart with StartTimeTicks at the target position.
      seekStallTimer.current = setTimeout(() => {
        const el = videoRef.current;
        if (!el) return;
        if (Math.abs(el.currentTime - ptsTarget) > 2) {
          seekTargetRef.current = clamped;
          onSeekRequest?.(clamped);
        }
      }, DELAI_CALAGE_SAUT_MS);
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
