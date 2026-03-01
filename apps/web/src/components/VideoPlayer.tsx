import { useRef, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Hls from "hls.js";
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
  onNextEpisode?: () => void;
  onPreviousEpisode?: () => void;
  introSegment?: SegmentTimestamps | null;
  creditsSegment?: SegmentTimestamps | null;
}

const DBG = "[Tentacle:VideoPlayer]";

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

export function VideoPlayer({
  src, itemId, title, subtitle, startPositionSeconds, jellyfinDuration,
  subtitleTracks = [], audioTracks = [],
  currentAudio, currentSubtitle, currentQuality,
  isDirectPlay = true, streamOffset = 0,
  onAudioChange, onSubtitleChange, onQualityChange,
  onProgress, onStarted, onSeekRequest, onSeekComplete,
  hasNextEpisode, hasPreviousEpisode, nextEpisodeTitle,
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
  const [rawTime, setRawTime] = useState(0);
  const lastKnownPositionRef = useRef(0);

  // Auto-detect whether Jellyfin HLS uses absolute or relative timestamps.
  // Jellyfin often preserves original PTS (absolute), making v.currentTime ≈ streamOffset
  // instead of starting from 0.  effectiveOffset corrects for this.
  const effectiveOffsetRef = useRef(0);
  const offsetDetectedRef = useRef(false);

  // Synchronously reset state when src changes
  const [prevSrc, setPrevSrc] = useState(src);
  if (prevSrc !== src) {
    setPrevSrc(src);
    setRawTime(0);
    // Jellyfin HLS manifests always contain the full media timeline (absolute PTS).
    // effectiveOffset is always 0 — no auto-detection needed.
    offsetDetectedRef.current = true;
    effectiveOffsetRef.current = 0;
  }

  const [videoDuration, setVideoDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [volume, setVolume] = useState(1);
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
  const currentTime = effectiveOffsetRef.current + rawTime;
  const duration = jellyfinDuration && jellyfinDuration > 0 ? jellyfinDuration : videoDuration;

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {}); else v.pause();
  }, []);

  // Unified seek — handles direct play, HLS, and progressive transcode streams
  const handleSeek = useCallback((targetSeconds: number) => {
    const v = videoRef.current;
    if (!v) return;
    const clamped = Math.max(0, Math.min(targetSeconds, v.duration || Infinity));
    const isHlsStream = src.includes(".m3u8");
    console.debug(DBG, "seek", { clamped, isDirectPlay, streamOffset, isHlsStream });

    // Direct play: HTTP Range requests support random seek — always works
    if (isDirectPlay) {
      v.currentTime = clamped;
      onSeekComplete?.(clamped, v.paused);
      return;
    }

    // HLS: HLS.js loads the correct segment on seek — works natively
    if (isHlsStream) {
      if (streamOffset > 0 && clamped < streamOffset - 5) {
        seekTargetRef.current = clamped;
        onSeekRequest?.(clamped);
        return;
      }
      v.currentTime = clamped;
      onSeekComplete?.(clamped, v.paused);
      return;
    }

    // Progressive transcode: can only seek within the downloaded buffer.
    // Check the actual buffered ranges instead of an arbitrary threshold.
    const buffered = v.buffered;
    let isInBuffer = false;
    for (let i = 0; i < buffered.length; i++) {
      if (clamped >= buffered.start(i) - 1 && clamped <= buffered.end(i) + 1) {
        isInBuffer = true;
        break;
      }
    }

    if (isInBuffer) {
      v.currentTime = clamped;
      onSeekComplete?.(clamped, v.paused);
    } else {
      // Target outside buffer — rebuild URL with new StartTimeTicks
      seekTargetRef.current = clamped;
      onSeekRequest?.(clamped);
    }
  }, [isDirectPlay, streamOffset, src, onSeekRequest, onSeekComplete]);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) el.requestFullscreen(); else document.exitFullscreen();
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
    sourceChangingRef.current = true;
    setLoading(true);
    if (isSourceChange) { hasStartedRef.current = false; }
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
      console.debug(DBG, "ready", { seekTo, isHlsUrl, duration: v.duration });
      // For HLS: startPosition in HLS config handles seeking.
      // For direct play: explicit seek.
      if (seekTo > 0 && !isHlsUrl) {
        v.currentTime = seekTo;
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

    if (isHlsUrl && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        startPosition: seekTo > 0 ? seekTo : -1, // Seek to saved position in absolute-PTS manifest
        maxBufferLength: 15,          // default 30 — less buffering before playback starts
        startFragPrefetch: true,      // prefetch next fragment during current load
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
      hls.on(Hls.Events.MANIFEST_PARSED, onReady);
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
      // Progressive transcode (stream.mp4): wait for canplay so both audio and
      // video data are buffered before playing — prevents the "video without audio"
      // gap that occurs when attemptPlay is called at loadedmetadata (too early).
      // Direct play / source changes with preserved position: loadedmetadata is fine.
      const isProgressiveTranscode = !isHlsUrl && !isDirectPlay;
      const isQuickSwitch = isSourceChange && seekTo > 0;
      const readyEvt = isProgressiveTranscode && !isQuickSwitch ? "canplay" : "loadedmetadata";
      v.addEventListener(readyEvt, onReady, { once: true });
      // If data is already available (e.g. cached), fire immediately.
      // readyState >= 3 (HAVE_FUTURE_DATA) matches canplay; >= 1 matches loadedmetadata.
      const readyStateThreshold = isProgressiveTranscode ? 3 : 1;
      if (!isSourceChange && v.readyState >= readyStateThreshold) {
        v.removeEventListener(readyEvt, onReady);
        onReady();
      }
    }

    return () => { clearTimeout(failsafe); v.removeEventListener("loadedmetadata", onReady); v.removeEventListener("canplay", onReady); };
  }, [src]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { hlsRef.current?.destroy(); }, []);

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
          setRawTime(t);
          // Jellyfin HLS manifests always use absolute PTS (full media timeline).
          // Set offset to 0 on first timeupdate if not already done by sync reset.
          if (!offsetDetectedRef.current) {
            offsetDetectedRef.current = true;
            effectiveOffsetRef.current = 0;
            console.debug(DBG, "offset: absolute PTS", { t, streamOffset });
          }
          const absoluteTime = effectiveOffsetRef.current + t;
          lastKnownPositionRef.current = absoluteTime;
          if (!sourceChangingRef.current) onProgress?.(absoluteTime, e.currentTarget.paused);
        }}
        onProgress={() => {
          const v = videoRef.current;
          if (!v || !v.duration) return;
          const buf = v.buffered;
          if (buf.length > 0) setBuffered(buf.end(buf.length - 1) / v.duration);
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
          waitingTimer.current = setTimeout(() => setLoading(true), 300);
        }}
        onPlaying={() => { clearTimeout(waitingTimer.current); if (!sourceChangingRef.current) setLoading(false); }}
        onCanPlay={() => { clearTimeout(waitingTimer.current); if (!sourceChangingRef.current) setLoading(false); }}
        onError={(e) => { console.error(DBG, "video error", e.currentTarget.error?.message); }}
        onEnded={() => { if (hasNextEpisode) startAutoPlay(); else navigate(`/media/${itemId}`, { replace: true }); }}
        crossOrigin="anonymous"
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
          className="absolute bottom-28 right-6 z-20 rounded-lg border border-white/20 bg-black/60 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-md transition-all hover:bg-white/20">
          {t("player:skipIntro")}
        </button>
      )}
      {showSkipCredits && creditsSegment && (
        <button onClick={(e) => { e.stopPropagation(); handleSeek(creditsSegment.end); }}
          className="absolute bottom-28 right-6 z-20 rounded-lg border border-white/20 bg-black/60 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-md transition-all hover:bg-white/20">
          {t("player:skipCredits")}
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

      {autoPlayCountdown !== null && (
        <AutoPlayOverlay
          countdown={autoPlayCountdown} episodeTitle={nextEpisodeTitle}
          onPlay={() => onNextEpisode?.()} onCancel={() => { clearInterval(autoPlayTimerRef.current); setAutoPlayCountdown(null); }}
        />
      )}
    </div>
  );
}
