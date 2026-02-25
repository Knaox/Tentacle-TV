import { useRef, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Hls from "hls.js";
import { PlayerControls } from "./PlayerControls";
import { AutoPlayOverlay } from "./AutoPlayOverlay";
import type { SegmentTimestamps } from "@tentacle/shared";

export interface SubtitleTrack { index: number; label: string; url: string }
export interface AudioTrack { index: number; label: string }

interface VideoPlayerProps {
  src: string;
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
  hasNextEpisode?: boolean;
  hasPreviousEpisode?: boolean;
  nextEpisodeTitle?: string;
  onNextEpisode?: () => void;
  onPreviousEpisode?: () => void;
  introSegment?: SegmentTimestamps | null;
  creditsSegment?: SegmentTimestamps | null;
  readyToPlay?: boolean;
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
  src, title, subtitle, startPositionSeconds, jellyfinDuration,
  subtitleTracks = [], audioTracks = [],
  currentAudio, currentSubtitle, currentQuality,
  isDirectPlay = true, streamOffset = 0,
  onAudioChange, onSubtitleChange, onQualityChange,
  onProgress, onStarted, onSeekRequest,
  hasNextEpisode, hasPreviousEpisode, nextEpisodeTitle,
  onNextEpisode, onPreviousEpisode,
  introSegment, creditsSegment,
  readyToPlay = true,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const navigate = useNavigate();

  const [playing, setPlaying] = useState(false);
  const [rawTime, setRawTime] = useState(0);
  const lastKnownPositionRef = useRef(0);

  // Synchronously reset rawTime when src changes to prevent one-frame glitch
  // where currentTime = newStreamOffset + oldRawTime (double-counted).
  const [prevSrc, setPrevSrc] = useState(src);
  if (prevSrc !== src) {
    setPrevSrc(src);
    setRawTime(0);
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
  const pendingPlayRef = useRef(false);
  const readyToPlayRef = useRef(readyToPlay);
  readyToPlayRef.current = readyToPlay;

  const currentTime = streamOffset + rawTime;
  const duration = jellyfinDuration && jellyfinDuration > 0 ? jellyfinDuration : videoDuration;

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {}); else v.pause();
  }, []);

  // Unified seek — native v.currentTime for both Direct Play and HLS.
  // HLS.js handles segment-based seeking natively; only fall back to URL
  // rebuild when the target is before the current stream start (rare).
  const handleSeek = useCallback((targetSeconds: number) => {
    const v = videoRef.current;
    if (!v) return;
    console.debug(DBG, "seek", { targetSeconds, isDirectPlay, streamOffset });
    if (isDirectPlay) {
      v.currentTime = targetSeconds;
    } else if (targetSeconds >= streamOffset) {
      // Seek within current HLS stream — no URL rebuild
      v.currentTime = targetSeconds - streamOffset;
    } else {
      // Target is before stream start — need URL rebuild
      onSeekRequest?.(targetSeconds);
    }
  }, [isDirectPlay, streamOffset, onSeekRequest]);

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
    // rawTime is already synchronously reset to 0 by the prevSrc check above.
    // Use lastKnownPositionRef for direct-play seek restore (holds absolute position).
    const seekTo = isSourceChange
      ? (isDirectPlay ? lastKnownPositionRef.current : 0)
      : (startPositionSeconds ?? 0);
    console.debug(DBG, "src changed", { isSourceChange, isHlsUrl, isDirectPlay, seekTo });

    // Cleanup previous HLS instance
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }

    // Fully reset the video element on source change to prevent stale MSE/src state
    if (isSourceChange) {
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
      console.debug(DBG, "ready", { seekTo, duration: v.duration });
      if (seekTo > 0) v.currentTime = seekTo;
      sourceChangingRef.current = false;
      setLoading(false);
      if (isSourceChange || readyToPlayRef.current) {
        attemptPlay(v, () => setPolicyMuted(true), () => setShowPlayButton(true));
      } else {
        pendingPlayRef.current = true;
      }
    };

    if (isHlsUrl && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        startPosition: seekTo > 0 ? seekTo : -1,
        // Jellyfin transcodes may take a few seconds to produce the first segment.
        // Retry aggressively so HLS.js doesn't give up before it's ready.
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
      // Register handlers BEFORE loading to prevent missing fast/cached manifests
      hls.on(Hls.Events.MANIFEST_PARSED, onReady);
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          console.error(DBG, "HLS fatal error:", data.type, data.details);
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            console.debug(DBG, "attempting HLS network recovery");
            hls.startLoad();
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            console.debug(DBG, "attempting HLS media recovery");
            hls.recoverMediaError();
          } else {
            clearTimeout(failsafe);
            sourceChangingRef.current = false;
            setLoading(false);
            setShowPlayButton(true);
          }
        }
      });
      hls.loadSource(src);
      hls.attachMedia(v);
    } else {
      // Direct play or native HLS (Safari)
      v.src = src;
      if (isSourceChange) v.load();
      v.addEventListener("loadedmetadata", onReady, { once: true });
      if (!isSourceChange && v.readyState >= 1) {
        v.removeEventListener("loadedmetadata", onReady);
        onReady();
      }
    }

    return () => {
      clearTimeout(failsafe);
      v.removeEventListener("loadedmetadata", onReady);
    };
  }, [src]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup HLS on unmount
  useEffect(() => () => { hlsRef.current?.destroy(); }, []);

  // When transition animation finishes, start deferred playback
  useEffect(() => {
    if (readyToPlay && pendingPlayRef.current) {
      pendingPlayRef.current = false;
      const v = videoRef.current;
      if (v) {
        console.debug(DBG, "animation done — starting playback");
        attemptPlay(v, () => setPolicyMuted(true), () => setShowPlayButton(true));
      }
    }
  }, [readyToPlay]);

  // Subtitle track visibility
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    for (let i = 0; i < v.textTracks.length; i++) v.textTracks[i].mode = "hidden";
    if (currentSubtitle != null) {
      const idx = subtitleTracks.findIndex((s) => s.index === currentSubtitle);
      if (idx >= 0 && v.textTracks[idx]) v.textTracks[idx].mode = "showing";
    }
  }, [currentSubtitle, subtitleTracks]);

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") { e.preventDefault(); togglePlay(); }
      if (e.code === "KeyF") toggleFullscreen();
      if (e.code === "Escape") { if (document.fullscreenElement) document.exitFullscreen(); else navigate(-1); }
      if (e.code === "ArrowRight") handleSeek(currentTimeRef.current + 10);
      if (e.code === "ArrowLeft") handleSeek(Math.max(0, currentTimeRef.current - 10));
      if (e.code === "KeyN" && hasNextEpisode) onNextEpisode?.();
      if (e.code === "KeyP" && hasPreviousEpisode) onPreviousEpisode?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, toggleFullscreen, navigate, handleSeek, hasNextEpisode, hasPreviousEpisode, onNextEpisode, onPreviousEpisode]);

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
      <video ref={videoRef} className="h-full w-full"
        onTimeUpdate={(e) => {
          const t = e.currentTarget.currentTime;
          setRawTime(t);
          const absoluteTime = streamOffset + t;
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
          setPlaying(true); setLoading(false); setShowPlayButton(false);
          if (!hasStartedRef.current) { hasStartedRef.current = true; onStarted?.(); }
        }}
        onPause={() => setPlaying(false)}
        onWaiting={() => {
          clearTimeout(waitingTimer.current);
          waitingTimer.current = setTimeout(() => setLoading(true), 300);
        }}
        onCanPlay={() => { clearTimeout(waitingTimer.current); setLoading(false); }}
        onError={(e) => { console.error(DBG, "video error", e.currentTarget.error?.message); }}
        onEnded={() => { if (hasNextEpisode) startAutoPlay(); else navigate(-1); }}
        crossOrigin="anonymous"
      >
        {subtitleTracks.map((t) => (
          <track key={t.index} kind="subtitles" src={t.url} label={t.label} />
        ))}
      </video>

      {loading && (playing || sourceChangingRef.current) && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
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
            <span className="text-sm text-white/70">Appuyez pour lire</span>
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
          Appuyez pour le son
        </button>
      )}

      {showSkipIntro && introSegment && (
        <button onClick={(e) => { e.stopPropagation(); handleSeek(introSegment.end); }}
          className="absolute bottom-28 right-6 z-20 rounded-lg border border-white/20 bg-black/60 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-md transition-all hover:bg-white/20">
          Passer l'intro
        </button>
      )}
      {showSkipCredits && creditsSegment && (
        <button onClick={(e) => { e.stopPropagation(); handleSeek(creditsSegment.end); }}
          className="absolute bottom-28 right-6 z-20 rounded-lg border border-white/20 bg-black/60 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-md transition-all hover:bg-white/20">
          Passer le générique
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
