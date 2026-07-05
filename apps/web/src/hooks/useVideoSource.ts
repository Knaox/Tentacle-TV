import { useRef, useState, useEffect, type MutableRefObject } from "react";
import Hls from "hls.js";
import { useJellyfinClient } from "@tentacle-tv/api-client";

const DBG = "[Tentacle:VideoPlayer]";

/** Safari-only: native HLS support detected via canPlayType.
 *  Returns "" on Chrome/Brave/Firefox/Edge → all Safari-specific code paths are inert. */
const HAS_NATIVE_HLS = typeof document !== "undefined"
  && document.createElement("video").canPlayType("application/vnd.apple.mpegurl") !== "";

/** Max time (ms) to wait for canplaythrough before falling back to play anyway.
 *  Progressive transcode: video=copy is instant but audio transcode takes 1-3s.
 *  canplaythrough fires when the browser has decoded enough audio+video. */
const BUFFER_GATE_TIMEOUT = 8_000;

function attemptPlay(v: HTMLVideoElement, onPolicyMuted: () => void, onPlayFailed: () => void) {
  // Respecte le mute choisi par l'utilisateur (persisté) — sinon un changement
  // d'épisode/média rétablirait le son (gênant à 2 players sur une machine).
  const wantMuted = localStorage.getItem("tentacle_player_muted") === "1";
  v.muted = wantMuted;
  v.play().catch(() => {
    v.muted = true;
    v.play().then(() => { if (!wantMuted) onPolicyMuted(); }).catch((err) => {
      console.error(DBG, "muted play also failed:", err);
      onPlayFailed();
    });
  });
}

interface UseVideoSourceOptions {
  videoRef: MutableRefObject<HTMLVideoElement | null>;
  src: string;
  isDirectPlay: boolean;
  streamOffset: number;
  useNativeHls?: boolean;
  startPositionSeconds?: number;
  effectiveOffsetRef: MutableRefObject<number>;
  containerPtsOffsetRef: MutableRefObject<number>;
  offsetDetectedRef: MutableRefObject<boolean>;
  seekTargetRef: MutableRefObject<number | null>;
  seekStallTimer: MutableRefObject<ReturnType<typeof setTimeout> | undefined>;
  sourceChangingRef: MutableRefObject<boolean>;
  hasStartedRef: MutableRefObject<boolean>;
  lastKnownPositionRef: MutableRefObject<number>;
  currentTimeRef: MutableRefObject<number>;
  onSeekRequest?: (seconds: number) => void;
}

export function useVideoSource({
  videoRef, src, isDirectPlay, streamOffset, useNativeHls, startPositionSeconds,
  effectiveOffsetRef, containerPtsOffsetRef, offsetDetectedRef,
  seekTargetRef, seekStallTimer, sourceChangingRef, hasStartedRef,
  lastKnownPositionRef, currentTimeRef, onSeekRequest,
}: UseVideoSourceOptions) {
  const hlsRef = useRef<Hls | null>(null);
  const jfClient = useJellyfinClient();

  const [loading, setLoading] = useState(true);
  const [showPlayButton, setShowPlayButton] = useState(false);
  const [policyMuted, setPolicyMuted] = useState(false);

  // Synchronously reset state when src changes
  const [prevSrc, setPrevSrc] = useState(src);
  if (prevSrc !== src) {
    setPrevSrc(src);
    // jellyfin-web pattern: don't reset displayed time during stream changes
    // (quality/audio switch). Keep showing the last known position until the
    // new source provides timeupdate events with the correct absolute time.
    // Full reset only happens on episode switch (key={itemId} triggers remount).
    // Container PTS offset persists across source changes (same media).
    offsetDetectedRef.current = true;
    effectiveOffsetRef.current = -containerPtsOffsetRef.current;
  }

  // Source loading — handles both HLS (transcoded) and direct play
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const isSourceChange = hasStartedRef.current;
    const isHlsUrl = src.includes(".m3u8");
    let bufferGateTimer: ReturnType<typeof setTimeout> | undefined;
    sourceChangingRef.current = true;
    setLoading(true);
    // Don't reset hasStartedRef on source changes (seek, audio, quality).
    // reportStart should fire only ONCE per episode mount — subsequent changes
    // are reported via periodic progress updates. Resetting it here caused
    // a new Sessions/Playing on every seek, creating phantom Jellyfin sessions.
    // Direct play: seek explicitly to saved position (source change) or resume point (initial).
    // HLS: use startPosition to seek within the absolute-PTS manifest.
    // key={itemId} on VideoPlayer ensures episode switches remount cleanly.
    // seekTargetRef: when a seek triggered URL rebuild, use the seek target, not the old position.
    const seekTo = seekTargetRef.current != null
      ? seekTargetRef.current
      : isSourceChange
        ? lastKnownPositionRef.current
        : (startPositionSeconds ?? 0);
    seekTargetRef.current = null;

    const wasHls = !!hlsRef.current;
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }

    // Full reset only when HLS is involved (old or new source).
    // For progressive → progressive (e.g. audio track change), skip destruction
    // to reduce the audio gap — just changing v.src is faster.
    if (isSourceChange && (wasHls || isHlsUrl)) {
      v.pause();
      v.removeAttribute("src");
      v.load();
    }

    const failsafe = setTimeout(() => {
      if (sourceChangingRef.current) {
        console.error(DBG, "loadedmetadata timeout — recovery");
        sourceChangingRef.current = false;
        setLoading(false);
        setShowPlayButton(true);
      }
    }, 15_000);

    const onReady = () => {
      clearTimeout(failsafe);
      const ptsOffset = containerPtsOffsetRef.current;
      // jellyfin-web pattern: explicit seek for frame-accurate positioning.
      // For HLS initial load: startPosition is segment-boundary accurate — good enough,
      // skip explicit seek so play() fires faster (reduces audio delay).
      // For HLS source changes (audio/quality switch): explicit seek corrects the
      // segment-boundary offset (startPosition can be a few seconds off).
      // For direct play: always seek (HTTP Range supports it).
      // For progressive transcode: stream already starts at seekTo (via StartTimeTicks)
      // with CopyTimestamps, so v.currentTime naturally lands at the right PTS.
      if (seekTo > 0) {
        const isProgressiveTranscode = !isHlsUrl && !isDirectPlay;
        if (isProgressiveTranscode && streamOffset > 0) {
          // Progressive with CopyTimestamps: stream naturally starts at correct PTS
        } else if (!isHlsUrl || isSourceChange || useNativeHls) {
          // Add container PTS offset to convert movie position → PTS.
          // Native HLS (WKWebView): manifest starts at seekTo via StartTimeTicks
          // but explicit seek ensures frame-accurate positioning (segment boundaries
          // may not align exactly with the resume point).
          v.currentTime = seekTo + ptsOffset;
        }
      }
      // Keep sourceChangingRef=true and loading=true so the spinner stays visible
      // until actual playback starts (onPlay). This prevents the black-screen gap
      // between metadata/canplay and real audio+video output.
      attemptPlay(v, () => setPolicyMuted(true), () => {
        // Play completely blocked — show manual play button, clear loading state.
        sourceChangingRef.current = false;
        setLoading(false);
        setShowPlayButton(true);
      });
    };

    if (isHlsUrl && !useNativeHls && Hls.isSupported()) {
      // hls.js: works on Chrome/Brave/Firefox/Edge (MSE) AND Safari 17.1+ (ManagedMediaSource).
      // Since hls.js v1.5, Hls.isSupported() returns true on Safari 17.1+ via ManagedMediaSource
      // → full buffer control, seeking, quality selection — same as Chrome.
      const hls = new Hls({
        enableWorker: true,
        startPosition: seekTo > 0 ? seekTo : -1, // Seek to saved position in absolute-PTS manifest
        lowLatencyMode: false,        // jellyfin-web pattern: disable low-latency mode
        backBufferLength: Infinity,    // VOD: keep all played segments — instant backward seek
        maxBufferLength: 30,          // buffer 30s ahead for smooth playback
        maxMaxBufferLength: 120,      // allow up to 120s buffer for sustained streaming
        startFragPrefetch: true,      // prefetch next fragment during current load
        // A/V sync: fix audio desync with transcoded streams (fMP4/TS segments).
        // stretchShortVideoTrack extends the last audio frame to fill micro-gaps between segments.
        // maxAudioFramesDrift forces audio resync when drift exceeds 1 frame.
        // forceKeyFrameOnDiscontinuity forces keyframe at discontinuity points (seek, segment switch).
        stretchShortVideoTrack: true,
        maxAudioFramesDrift: 1,
        forceKeyFrameOnDiscontinuity: true,
        fragLoadPolicy: {
          default: {
            maxTimeToFirstByteMs: 20_000,
            maxLoadTimeMs: 60_000,
            timeoutRetry: { maxNumRetry: 5, retryDelayMs: 1000, maxRetryDelayMs: 8000 },
            errorRetry: { maxNumRetry: 8, retryDelayMs: 1000, maxRetryDelayMs: 8000 },
          },
        },
      });
      hlsRef.current = hls;
      // HLS play timing:
      // - Source change (audio/quality switch): play immediately on MANIFEST_PARSED
      //   for fast switching. Explicit seek handles frame-accurate positioning.
      // - Initial load: wait for canplay (audio+video data buffered) so the user
      //   hears audio immediately when the video appears, instead of seeing video
      //   with delayed audio while the first TS segment's audio track decodes.
      if (isSourceChange) {
        hls.on(Hls.Events.MANIFEST_PARSED, onReady);
      } else {
        v.addEventListener("canplay", onReady, { once: true });
      }
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          console.error(DBG, "HLS fatal error:", data.type, data.details);
          // CORS / cross-origin direct streaming blocked the manifest fetch.
          // Disable DS for this session (admin config stays ON) and ask the
          // parent to re-fetch PlaybackInfo, which will now go through the
          // same-origin proxy at /api/jellyfin/* (no CORS).
          if (
            data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR &&
            jfClient.getDirectStreaming()
          ) {
            console.warn(
              DBG,
              "manifestLoadError on direct streaming — disabling DS for this session and falling back to proxy",
            );
            jfClient.setDirectStreaming(null);
            clearTimeout(failsafe);
            sourceChangingRef.current = false;
            hls.destroy();
            hlsRef.current = null;
            onSeekRequest?.(currentTimeRef.current);
            return;
          }
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
          else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
          else { clearTimeout(failsafe); sourceChangingRef.current = false; setLoading(false); setShowPlayButton(true); }
        }
      });
      hls.loadSource(src);
      hls.attachMedia(v);
    } else if (isHlsUrl && HAS_NATIVE_HLS) {
      // Native HLS: WKWebView/AVFoundation (macOS Tauri) or older Safari (< 17.1).
      v.src = src;
      if (isSourceChange) v.load();
      v.addEventListener("canplay", onReady, { once: true });
    } else {
      v.src = src;
      // Explicit load only after full reset (HLS transition); for progressive → progressive
      // setting v.src already triggers loading — double-load would add latency.
      if (isSourceChange && (wasHls || isHlsUrl)) v.load();

      const isProgressiveTranscode = !isHlsUrl && !isDirectPlay;
      const isQuickSwitch = isSourceChange && seekTo > 0;

      if (isProgressiveTranscode && !isQuickSwitch) {
        // Progressive transcode: video=copy arrives instantly but audio transcode
        // (EAC3→AAC) takes 1-3s. canplaythrough fires when the browser has decoded
        // enough audio+video data to play without interruption — the strongest
        // guarantee that audio is actually available before we call play().
        v.addEventListener("canplaythrough", onReady, { once: true });
        bufferGateTimer = setTimeout(() => {
          v.removeEventListener("canplaythrough", onReady);
          onReady();
        }, BUFFER_GATE_TIMEOUT);
        // readyState 4 = HAVE_ENOUGH_DATA = canplaythrough already fired
        if (!isSourceChange && v.readyState >= 4) {
          clearTimeout(bufferGateTimer);
          v.removeEventListener("canplaythrough", onReady);
          onReady();
        }
      } else {
        // Direct play / source changes: loadedmetadata is sufficient (no audio delay).
        v.addEventListener("loadedmetadata", onReady, { once: true });
        if (!isSourceChange && v.readyState >= 1) {
          v.removeEventListener("loadedmetadata", onReady);
          onReady();
        }
      }
    }

    return () => {
      clearTimeout(failsafe);
      clearTimeout(bufferGateTimer);
      clearTimeout(seekStallTimer.current);
      v.removeEventListener("loadedmetadata", onReady);
      v.removeEventListener("canplay", onReady);
      v.removeEventListener("canplaythrough", onReady);
    };
  }, [src]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { hlsRef.current?.destroy(); clearTimeout(seekStallTimer.current); }, []);

  return { loading, setLoading, showPlayButton, setShowPlayButton, policyMuted, setPolicyMuted };
}
