import { useRef, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Hls from "hls.js";
import { AnimatePresence } from "framer-motion";
import { PlayerControls } from "./PlayerControls";
import { AutoPlayOverlay } from "./AutoPlayOverlay";
import type { SegmentTimestamps } from "@tentacle-tv/shared";

export interface SubtitleTrack { index: number; label: string; url: string; lang?: string; codec?: string }
export interface AudioTrack { index: number; label: string; lang?: string }

interface VideoPlayerProps {
  src: string;
  itemId: string;
  title: string;
  subtitle?: string;
  startPositionSeconds?: number;
  jellyfinDuration?: number;
  subtitleTracks?: SubtitleTrack[];
  audioTracks?: AudioTrack[];
  currentAudio: number;
  currentSubtitle: number | null;
  currentQuality: number | null;
  isDirectPlay?: boolean;
  streamOffset?: number;
  onAudioChange: (index: number) => void;
  onSubtitleChange: (index: number | null) => void;
  onQualityChange: (bitrate: number | null) => void;
  onProgress?: (seconds: number, paused: boolean) => void;
  onStarted?: () => void;
  onSeekRequest?: (seconds: number) => void;
  onSeekComplete?: (seconds: number, paused: boolean) => void;
  hasNextEpisode?: boolean;
  hasPreviousEpisode?: boolean;
  nextEpisodeTitle?: string;
  nextEpisodeImageUrl?: string;
  nextEpisodeDescription?: string;
  autoplayCreditsSeconds?: number;
  onNextEpisode?: () => void;
  onPreviousEpisode?: () => void;
  introSegment?: SegmentTimestamps | null;
  creditsSegment?: SegmentTimestamps | null;
}

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
  v.muted = false;
  v.play().then(() => {
    console.debug(DBG, "play OK (unmuted)");
  }).catch(() => {
    console.debug(DBG, "unmuted play rejected, retrying muted");
    v.muted = true;
    v.play().then(onPolicyMuted).catch((err) => {
      console.error(DBG, "muted play also failed:", err);
      onPlayFailed();
    });
  });
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

export function VideoPlayer({
  src, itemId, title, subtitle, startPositionSeconds, jellyfinDuration,
  subtitleTracks = [], audioTracks = [],
  currentAudio, currentSubtitle, currentQuality,
  isDirectPlay = true, streamOffset = 0,
  onAudioChange, onSubtitleChange, onQualityChange,
  onProgress, onStarted, onSeekRequest, onSeekComplete,
  hasNextEpisode, hasPreviousEpisode, nextEpisodeTitle,
  nextEpisodeImageUrl, nextEpisodeDescription,
  autoplayCreditsSeconds,
  onNextEpisode, onPreviousEpisode,
  introSegment, creditsSegment,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const navigate = useNavigate();
  const { t } = useTranslation("player");

  const [playing, setPlaying] = useState(false);
  const rawTimeRef = useRef(0);
  const [displayTime, setDisplayTime] = useState(0);
  const lastKnownPositionRef = useRef(0);

  // CopyTimestamps=true preserves the original container's PTS base.
  // Some media have a non-zero PTS start (e.g., broadcast recordings with PTS offset 677s).
  // effectiveOffsetRef subtracts this so displayed time = movie position (0 to duration).
  // containerPtsOffsetRef stores the raw offset for converting seek targets back to PTS.
  const effectiveOffsetRef = useRef(0);
  const containerPtsOffsetRef = useRef(0);
  const offsetDetectedRef = useRef(false);

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

  const [videoDuration, setVideoDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [volume, setVolume] = useState(() => {
    const s = localStorage.getItem("tentacle_player_volume");
    if (s != null) { const v = Number(s); if (!Number.isNaN(v)) return Math.min(1, Math.max(0, v / 100)); }
    return 1;
  });
  useEffect(() => { if (videoRef.current) videoRef.current.volume = volume; }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // 1Hz display timer — reduces re-renders from ~4Hz (onTimeUpdate) to 1Hz.
  // rawTimeRef is updated every onTimeUpdate; displayTime only triggers renders at 1Hz.
  useEffect(() => {
    const id = setInterval(() => setDisplayTime(rawTimeRef.current), 1000);
    return () => clearInterval(id);
  }, []);
  const [fullscreen, setFullscreen] = useState(false);
  const [buffered, setBuffered] = useState(0);
  const [loading, setLoading] = useState(true);
  const [autoPlayCountdown, setAutoPlayCountdown] = useState<number | null>(null);
  const autoPlayTimerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const hasStartedRef = useRef(false);
  const sourceChangingRef = useRef(false);
  const currentTimeRef = useRef(0);
  const userInteractedRef = useRef(false);
  const waitingTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [showPlayButton, setShowPlayButton] = useState(false);
  const [policyMuted, setPolicyMuted] = useState(false);
  const seekTargetRef = useRef<number | null>(null);
  const seekStallTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const currentTime = effectiveOffsetRef.current + displayTime;
  const duration = jellyfinDuration && jellyfinDuration > 0 ? jellyfinDuration : videoDuration;

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {}); else v.pause();
  }, []);

  // 3-level smart seek — handles direct play, HLS, and progressive transcode streams.
  //
  // All targets from PlayerControls are in "movie position" (0 to duration).
  // CopyTimestamps streams have a container PTS offset — v.currentTime and v.buffered
  // are in PTS space (offset + movie_position). containerPtsOffsetRef bridges this gap.
  //
  // Level 1: target in HTML5 buffer → v.currentTime (instant)
  // Level 2: HLS/Direct Play → v.currentTime, hls.js fetches segment (fast, ~1-2s)
  //          with stall watcher: if segment unavailable after 3s → fallback to level 3
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

    console.debug(DBG, "seek", { target: targetSeconds, clamped, ptsTarget, ptsOffset, isDirectPlay, streamOffset, isHlsStream });

    // --- LEVEL 1: Target in HTML5 buffer → instant seek ---
    if (isTimeInBuffered(v, ptsTarget)) {
      console.debug(DBG, "seek level 1: in buffer (instant)");
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
      console.debug(DBG, "seek level 2: HLS, trying currentTime with stall watcher");
      v.currentTime = ptsTarget;
      onSeekComplete?.(clamped, v.paused);

      // --- LEVEL 3 fallback: stall watcher ---
      // If after 3s the position hasn't reached the target, the segment doesn't
      // exist yet (ffmpeg hasn't transcoded that far). Kill the current transcode
      // and restart with StartTimeTicks at the target position.
      seekStallTimer.current = setTimeout(() => {
        const el = videoRef.current;
        if (!el) return;
        if (Math.abs(el.currentTime - ptsTarget) > 2) {
          console.debug(DBG, "seek level 3: HLS stall detected, rebuilding URL",
            { currentTime: el.currentTime, ptsTarget, clamped });
          seekTargetRef.current = clamped;
          onSeekRequest?.(clamped);
        }
      }, 8000);
      return;
    }

    // --- Progressive transcode: always full restart (level 3) ---
    // No in-stream seek support — must rebuild URL with new StartTimeTicks.
    console.debug(DBG, "seek level 3: progressive transcode, rebuilding URL", { clamped });
    seekTargetRef.current = clamped;
    onSeekRequest?.(clamped);
  }, [isDirectPlay, streamOffset, src, onSeekRequest, onSeekComplete]);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) { document.exitFullscreen(); return; }
    const el = containerRef.current;
    if (!el) return;
    if (el.requestFullscreen) { el.requestFullscreen(); return; }
    // iOS Safari fallback: requestFullscreen not available on container div,
    // use webkitEnterFullscreen on the video element directly.
    const v = videoRef.current as HTMLVideoElement & { webkitEnterFullscreen?: () => void } | null;
    if (v?.webkitEnterFullscreen) v.webkitEnterFullscreen();
  }, []);

  const scheduleHide = useCallback(() => {
    clearTimeout(hideTimer.current);
    setShowControls(true);
    hideTimer.current = setTimeout(() => { if (playing) setShowControls(false); }, 3000);
  }, [playing]);

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
    console.debug(DBG, "src changed", { isSourceChange, isHlsUrl, isDirectPlay, seekTo, streamOffset });

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
      console.debug(DBG, "ready", { seekTo, isHlsUrl, isSourceChange, isDirectPlay, streamOffset, ptsOffset, duration: v.duration });
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
          console.debug(DBG, "skip explicit seek — progressive stream starts at correct PTS", { seekTo, streamOffset });
        } else if (!isHlsUrl || isSourceChange || (isHlsUrl && HAS_NATIVE_HLS)) {
          // Add container PTS offset to convert movie position → PTS
          // HAS_NATIVE_HLS: Safari native HLS has no startPosition param, needs explicit seek
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

    if (isHlsUrl && HAS_NATIVE_HLS) {
      // Safari: use native HLS player — Safari's MSE is buggy (freezes, buffer errors).
      // HAS_NATIVE_HLS is false on Chrome/Brave/Firefox/Edge → this block is dead code there.
      console.debug(DBG, "native HLS (Safari)", { seekTo, isSourceChange });
      v.src = src;
      if (isSourceChange) v.load();
      v.addEventListener("canplay", onReady, { once: true });
    } else if (isHlsUrl && Hls.isSupported()) {
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
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          console.debug(DBG, "HLS manifest parsed, waiting for canplay");
        });
        v.addEventListener("canplay", onReady, { once: true });
      }
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          console.error(DBG, "HLS fatal error:", data.type, data.details);
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
          else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
          else { clearTimeout(failsafe); sourceChangingRef.current = false; setLoading(false); setShowPlayButton(true); }
        }
      });
      hls.loadSource(src);
      hls.attachMedia(v);
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
          console.debug(DBG, "canplaythrough timeout — playing on best-effort");
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

  // Subtitle track visibility — re-apply after source change and when tracks load
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const apply = () => {
      for (let i = 0; i < v.textTracks.length; i++) v.textTracks[i].mode = "hidden";
      if (currentSubtitle != null) {
        const idx = subtitleTracks.findIndex((s) => s.index === currentSubtitle);
        if (idx >= 0 && v.textTracks[idx]) v.textTracks[idx].mode = "showing";
      }
    };
    apply();
    // Re-apply when browser finishes loading <track> elements after source change
    v.textTracks.addEventListener("addtrack", apply);
    return () => v.textTracks.removeEventListener("addtrack", apply);
  }, [currentSubtitle, subtitleTracks, src]);

  // jellyfin-web pattern (plugin.js:setAudioStreamIndex): In Direct Play, switch
  // audio tracks natively via HTML5 audioTracks API. This avoids URL rebuild and
  // stream interruption. Supported in Firefox/Safari; Chrome requires transcoding
  // fallback (handled by Watch.tsx rebuilding the URL when native switch unavailable).
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !isDirectPlay) return;
    // HTMLMediaElement.audioTracks is not in standard TS lib — access via type cast.
    const elemTracks = (v as HTMLVideoElement & {
      audioTracks?: { readonly length: number; [i: number]: { enabled: boolean } };
    }).audioTracks;
    if (!elemTracks || elemTracks.length < 2) return;
    // Map Jellyfin stream index to position in the <video> element's audioTracks list.
    // audioTracks prop contains only Audio-type streams, in file order — same order
    // as the browser's audioTracks on the <video> element.
    const targetPos = audioTracks.findIndex((t) => t.index === currentAudio);
    if (targetPos === -1 || targetPos >= elemTracks.length) return;
    for (let i = 0; i < elemTracks.length; i++) {
      elemTracks[i].enabled = (i === targetPos);
    }
    console.debug(DBG, "native audio switch", { targetPos, currentAudio, total: elemTracks.length });
  }, [currentAudio, isDirectPlay, audioTracks]);

  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  currentTimeRef.current = currentTime;

  useEffect(() => {
    const mark = () => { userInteractedRef.current = true; };
    document.addEventListener("pointerdown", mark, { once: true, capture: true });
    document.addEventListener("keydown", mark, { once: true, capture: true });
    return () => {
      document.removeEventListener("pointerdown", mark, { capture: true });
      document.removeEventListener("keydown", mark, { capture: true });
    };
  }, []);

  const handleVolumeChange = useCallback((val: number) => {
    setVolume(val);
    if (videoRef.current) videoRef.current.volume = val;
    try { localStorage.setItem("tentacle_player_volume", String(Math.round(val * 100))); } catch {}
  }, []);

  const handleToggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    if (!v.muted) setPolicyMuted(false);
    setVolume(v.muted ? 0 : 1);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") { e.preventDefault(); togglePlay(); }
      if (e.code === "KeyF") toggleFullscreen();
      if (e.code === "Escape") { if (document.fullscreenElement) document.exitFullscreen(); else navigate(-1); }
      if (e.code === "ArrowRight") handleSeek(currentTimeRef.current + 30);
      if (e.code === "ArrowLeft") handleSeek(Math.max(0, currentTimeRef.current - 10));
      if (e.code === "ArrowUp") { e.preventDefault(); handleVolumeChange(Math.min(1, volume + 0.1)); }
      if (e.code === "ArrowDown") { e.preventDefault(); handleVolumeChange(Math.max(0, volume - 0.1)); }
      if (e.code === "KeyM") handleToggleMute();
      if (e.code === "KeyN" && hasNextEpisode) onNextEpisode?.();
      if (e.code === "KeyP" && hasPreviousEpisode) onPreviousEpisode?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, toggleFullscreen, navigate, handleSeek, handleVolumeChange, handleToggleMute, volume, hasNextEpisode, hasPreviousEpisode, onNextEpisode, onPreviousEpisode]);

  useEffect(() => () => { clearInterval(autoPlayTimerRef.current); }, []);

  const startAutoPlay = useCallback(() => {
    if (!hasNextEpisode || !onNextEpisode) return;
    setAutoPlayCountdown(10);
    clearInterval(autoPlayTimerRef.current);
    autoPlayTimerRef.current = setInterval(() => {
      setAutoPlayCountdown((prev) => {
        if (prev === null || prev <= 1) { clearInterval(autoPlayTimerRef.current); onNextEpisode(); return null; }
        return prev - 1;
      });
    }, 1000);
  }, [hasNextEpisode, onNextEpisode]);

  // Show overlay when entering credits (or last 2 min fallback for episodes)
  const creditsAutoPlayTriggered = useRef(false);
  useEffect(() => {
    if (creditsAutoPlayTriggered.current || autoPlayCountdown !== null) return;
    if (!hasNextEpisode || !hasStartedRef.current) return;
    // Use detected credits segment, or fallback to configured time before end for episodes > 5 min
    const fallbackSeconds = autoplayCreditsSeconds ?? 120;
    const triggerAt = creditsSegment ? creditsSegment.start
      : (fallbackSeconds > 0 && duration > 300 ? duration - fallbackSeconds : null);
    if (triggerAt != null && currentTime >= triggerAt) {
      creditsAutoPlayTriggered.current = true;
      startAutoPlay();
    }
  }, [currentTime, creditsSegment, hasNextEpisode, autoPlayCountdown, startAutoPlay, duration]);

  const showSkipIntro = introSegment && currentTime >= introSegment.start && currentTime < introSegment.end - 1;
  const showSkipCredits = creditsSegment && currentTime >= creditsSegment.start && currentTime < creditsSegment.end - 1;

  return (
    <div ref={containerRef} onMouseMove={scheduleHide}
      onClick={() => {
        userInteractedRef.current = true;
        const v = videoRef.current;
        if (policyMuted && v && !v.paused) { v.muted = false; setPolicyMuted(false); return; }
        togglePlay();
      }}
      onTouchStart={() => { userInteractedRef.current = true; }}
      className="relative flex h-screen w-screen items-center justify-center bg-black">
      <video ref={videoRef} className="h-full w-full" playsInline preload="auto"
        onTimeUpdate={(e) => {
          const t = e.currentTarget.currentTime;
          rawTimeRef.current = t;
          // Detect container PTS offset on first timeupdate.
          // CopyTimestamps=true preserves the original container's PTS base, which
          // may be non-zero (e.g., 677s for broadcast recordings). Subtract it
          // so displayed time shows movie position (0 to duration), not raw PTS.
          if (!offsetDetectedRef.current && t > 0) {
            offsetDetectedRef.current = true;
            const expectedStart = startPositionSeconds || 0;
            const detectedOffset = t - expectedStart;
            // Significant offset (> 5s) = real container PTS base, not timing jitter
            if (detectedOffset > 5) {
              containerPtsOffsetRef.current = Math.round(detectedOffset);
              effectiveOffsetRef.current = -containerPtsOffsetRef.current;
              console.debug(DBG, "container PTS offset detected", { t, expectedStart, offset: containerPtsOffsetRef.current });
            } else {
              console.debug(DBG, "no PTS offset", { t, expectedStart });
            }
          }
          const absoluteTime = effectiveOffsetRef.current + t;
          lastKnownPositionRef.current = absoluteTime;
          if (!sourceChangingRef.current) onProgress?.(absoluteTime, e.currentTarget.paused);
        }}
        onProgress={() => {
          const v = videoRef.current;
          if (!v || !v.duration) return;
          const buf = v.buffered;
          if (buf.length > 0) {
            // Show buffered range ahead of current position (not stale high-water mark)
            let bufEnd = 0;
            for (let i = 0; i < buf.length; i++) {
              if (v.currentTime >= buf.start(i) - 0.5 && v.currentTime <= buf.end(i) + 0.5) {
                bufEnd = buf.end(i); break;
              }
            }
            if (bufEnd === 0) bufEnd = buf.end(buf.length - 1);
            setBuffered(bufEnd / v.duration);
          }
        }}
        onLoadedMetadata={(e) => { setVideoDuration(e.currentTarget.duration); }}
        onPlay={() => {
          sourceChangingRef.current = false;
          setPlaying(true); setLoading(false); setShowPlayButton(false);
          if (!hasStartedRef.current) { hasStartedRef.current = true; onStarted?.(); }
        }}
        onPause={() => setPlaying(false)}
        onWaiting={() => {
          clearTimeout(waitingTimer.current);
          waitingTimer.current = setTimeout(() => setLoading(true), 800);
        }}
        onSeeked={() => { clearTimeout(seekStallTimer.current); }}
        onPlaying={() => { clearTimeout(waitingTimer.current); clearTimeout(seekStallTimer.current); if (!sourceChangingRef.current) setLoading(false); }}
        onCanPlay={() => { clearTimeout(waitingTimer.current); if (!sourceChangingRef.current) setLoading(false); }}
        onError={(e) => { console.error(DBG, "video error", e.currentTarget.error?.message); }}
        onEnded={() => { if (hasNextEpisode && autoPlayCountdown === null) startAutoPlay(); else if (!hasNextEpisode) navigate(`/media/${itemId}`, { replace: true }); }}
        crossOrigin={HAS_NATIVE_HLS ? undefined : "anonymous"}
      >
        {subtitleTracks.map((t) => (
          <track key={`${src}-${t.index}`} kind="subtitles" src={t.url} label={t.label} />
        ))}
      </video>

      {loading && (playing || sourceChangingRef.current) && (
        <div className={`pointer-events-none absolute inset-0 z-10 flex items-center justify-center ${sourceChangingRef.current && !hasStartedRef.current ? "bg-black" : ""}`} onClick={(e) => e.stopPropagation()}>
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/30 border-t-white" />
        </div>
      )}

      {showPlayButton && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60"
          onClick={(e) => {
            e.stopPropagation(); userInteractedRef.current = true;
            const v = videoRef.current;
            if (v) { v.muted = false; v.play().then(() => { setShowPlayButton(false); setPolicyMuted(false); }).catch(() => {}); }
          }}>
          <div className="flex flex-col items-center gap-3">
            <svg className="h-20 w-20 text-white/90" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            <span className="text-sm text-white/70">{t("player:pressToPlay")}</span>
          </div>
        </div>
      )}

      {policyMuted && playing && !showPlayButton && (
        <button onClick={(e) => { e.stopPropagation(); userInteractedRef.current = true; const v = videoRef.current; if (v) { v.muted = false; setPolicyMuted(false); } }}
          className="absolute left-4 top-4 z-20 flex items-center gap-2 rounded-full bg-black/60 px-4 py-2 text-sm text-white/80 ring-1 ring-white/20 backdrop-blur-sm transition-all hover:bg-black/80">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
          </svg>
          {t("player:pressForSound")}
        </button>
      )}

      {showSkipIntro && introSegment && (
        <button onClick={(e) => { e.stopPropagation(); handleSeek(introSegment.end); }}
          className="absolute bottom-28 right-6 z-50 rounded-lg border border-white/20 bg-black/60 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-md transition-all hover:bg-white/20">
          {t("player:skipIntro")}
        </button>
      )}
      {showSkipCredits && creditsSegment && !autoPlayCountdown && (
        <button onClick={(e) => { e.stopPropagation(); if (hasNextEpisode) { creditsAutoPlayTriggered.current = true; startAutoPlay(); } else handleSeek(creditsSegment.end); }}
          className="absolute bottom-28 right-6 z-50 rounded-lg border border-white/20 bg-black/60 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-md transition-all hover:bg-white/20">
          {hasNextEpisode ? t("player:nextEpisodeLabel") : t("player:skipCredits")}
        </button>
      )}

      <div className={`absolute inset-0 transition-opacity duration-300 ${showControls ? "opacity-100" : "pointer-events-none opacity-0"}`}>
        <PlayerControls
          playing={playing} currentTime={currentTime} duration={duration}
          buffered={buffered} volume={volume} fullscreen={fullscreen}
          title={title} subtitle={subtitle}
          audioTracks={audioTracks} subtitleTracks={subtitleTracks}
          currentAudio={currentAudio} currentSubtitle={currentSubtitle} currentQuality={currentQuality}
          hasNextEpisode={hasNextEpisode} hasPreviousEpisode={hasPreviousEpisode}
          onTogglePlay={togglePlay} onSeek={handleSeek}
          onVolumeChange={handleVolumeChange} onToggleMute={handleToggleMute}
          onToggleFullscreen={toggleFullscreen} onBack={() => navigate(-1)}
          onAudioChange={onAudioChange} onSubtitleChange={onSubtitleChange} onQualityChange={onQualityChange}
          onNextEpisode={onNextEpisode} onPreviousEpisode={onPreviousEpisode}
        />
      </div>

      <AnimatePresence>
        {autoPlayCountdown !== null && (
          <AutoPlayOverlay
            countdown={autoPlayCountdown} episodeTitle={nextEpisodeTitle}
            episodeDescription={nextEpisodeDescription} episodeImageUrl={nextEpisodeImageUrl}
            onPlay={() => onNextEpisode?.()} onCancel={() => { clearInterval(autoPlayTimerRef.current); setAutoPlayCountdown(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
