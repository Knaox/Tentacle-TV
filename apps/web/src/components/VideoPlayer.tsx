import { useRef, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { PlayerControls } from "./PlayerControls";
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
  /** Offset in seconds when transcoded stream starts at a seek position */
  streamOffset?: number;
  onAudioChange: (index: number) => void;
  onSubtitleChange: (index: number | null) => void;
  onQualityChange: (bitrate: number | null) => void;
  onProgress?: (seconds: number, paused: boolean) => void;
  onStarted?: () => void;
  /** Called when seeking on transcoded streams — parent rebuilds URL */
  onSeekRequest?: (seconds: number) => void;
  hasNextEpisode?: boolean;
  hasPreviousEpisode?: boolean;
  nextEpisodeTitle?: string;
  onNextEpisode?: () => void;
  onPreviousEpisode?: () => void;
  introSegment?: SegmentTimestamps | null;
  creditsSegment?: SegmentTimestamps | null;
  /** When false, video loads but waits to play until this becomes true (e.g., transition animation) */
  readyToPlay?: boolean;
}

const DBG = "[Tentacle:VideoPlayer]";

/** Safely play video — always tries unmuted first (SPA navigation counts as user interaction) */
function attemptPlay(
  v: HTMLVideoElement,
  onPolicyMuted: () => void,
  onPlayFailed: () => void,
) {
  v.muted = false;
  v.play().then(() => {
    console.debug(DBG, "play OK (unmuted)");
  }).catch(() => {
    console.debug(DBG, "unmuted play rejected, retrying muted");
    v.muted = true;
    v.play().then(() => {
      onPolicyMuted();
    }).catch((err) => {
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
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const navigate = useNavigate();

  const [playing, setPlaying] = useState(false);
  const [rawTime, setRawTime] = useState(0);
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
  const [showPlayButton, setShowPlayButton] = useState(false);
  const [policyMuted, setPolicyMuted] = useState(false);
  const pendingPlayRef = useRef(false);
  const readyToPlayRef = useRef(readyToPlay);
  readyToPlayRef.current = readyToPlay;

  // Real playback time = offset (from transcoded seek) + video element time
  const currentTime = streamOffset + rawTime;
  const duration = jellyfinDuration && jellyfinDuration > 0 ? jellyfinDuration : videoDuration;

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {}); else v.pause();
  }, []);

  const handleSeek = useCallback((targetSeconds: number) => {
    console.debug(DBG, "seek", { targetSeconds, isDirectPlay });
    if (isDirectPlay) {
      const v = videoRef.current;
      if (v) v.currentTime = targetSeconds;
    } else {
      onSeekRequest?.(targetSeconds);
    }
  }, [isDirectPlay, onSeekRequest]);

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

  // Seek on load: initial start position or resume after source change
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const isSourceChange = hasStartedRef.current;
    const savedTime = rawTime;
    console.debug(DBG, "src changed", { src: src.substring(0, 100), isSourceChange, savedTime, isDirectPlay, startPositionSeconds, streamOffset });
    // Block progress reporting during source transition to prevent position=0 corruption
    sourceChangingRef.current = true;
    setLoading(true);
    if (isSourceChange) setRawTime(0);
    const seekTo = isSourceChange ? (isDirectPlay ? savedTime : 0) : (startPositionSeconds ?? 0);
    console.debug(DBG, "will seek to", { seekTo });
    if (isSourceChange) v.load();

    // Safety timeout: if loadedmetadata never fires (stream fails to load), recover after 15s
    const failsafe = setTimeout(() => {
      if (sourceChangingRef.current) {
        console.error(DBG, "loadedmetadata timeout — source change recovery");
        sourceChangingRef.current = false;
        setLoading(false);
        setShowPlayButton(true);
      }
    }, 15_000);

    const onLoaded = () => {
      clearTimeout(failsafe);
      console.debug(DBG, "loadedmetadata fired", { seekTo, videoDuration: v.duration });
      if (seekTo > 0) v.currentTime = seekTo;
      sourceChangingRef.current = false;
      setLoading(false);
      // Source changes (seek, audio switch) play immediately.
      // Initial load waits for the transition animation to finish.
      if (isSourceChange || readyToPlayRef.current) {
        attemptPlay(
          v,
          () => setPolicyMuted(true),
          () => setShowPlayButton(true),
        );
      } else {
        pendingPlayRef.current = true;
      }
    };
    v.addEventListener("loadedmetadata", onLoaded, { once: true });
    // If metadata already loaded (cached source on first load), trigger immediately
    if (!isSourceChange && v.readyState >= 1) {
      v.removeEventListener("loadedmetadata", onLoaded);
      onLoaded();
    }
    return () => { v.removeEventListener("loadedmetadata", onLoaded); clearTimeout(failsafe); };
  }, [src]); // eslint-disable-line react-hooks/exhaustive-deps

  // When transition animation finishes, start deferred playback
  useEffect(() => {
    if (readyToPlay && pendingPlayRef.current) {
      pendingPlayRef.current = false;
      const v = videoRef.current;
      if (v) {
        console.debug(DBG, "animation done — starting playback");
        attemptPlay(
          v,
          () => setPolicyMuted(true),
          () => setShowPlayButton(true),
        );
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

  // Fullscreen detection
  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  // Keep currentTimeRef in sync (avoids putting currentTime in keyboard effect deps)
  currentTimeRef.current = currentTime;

  // Track any user interaction globally — needed for browser autoplay policy
  useEffect(() => {
    const mark = () => { userInteractedRef.current = true; };
    document.addEventListener("pointerdown", mark, { once: true, capture: true });
    document.addEventListener("keydown", mark, { once: true, capture: true });
    return () => {
      document.removeEventListener("pointerdown", mark, { capture: true });
      document.removeEventListener("keydown", mark, { capture: true });
    };
  }, []);

  // Keyboard shortcuts — uses ref to avoid re-attaching listener every 250ms
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

  // Auto-play cleanup
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

  // Skip intro/credits detection
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
        // If muted by browser policy and playing, first click unmutes instead of pausing
        if (policyMuted && v && !v.paused) {
          v.muted = false;
          setPolicyMuted(false);
          return;
        }
        togglePlay();
      }}
      onTouchStart={() => { userInteractedRef.current = true; }}
      className="relative flex h-screen w-screen items-center justify-center bg-black">
      <video ref={videoRef} src={src} className="h-full w-full"
        onTimeUpdate={(e) => {
          const t = e.currentTarget.currentTime;
          setRawTime(t);
          // Block progress reporting during source transitions to prevent position=0 corruption
          if (!sourceChangingRef.current) onProgress?.(streamOffset + t, e.currentTarget.paused);
        }}
        onProgress={() => {
          const v = videoRef.current;
          if (!v || !v.duration) return;
          const buf = v.buffered;
          if (buf.length > 0) setBuffered(buf.end(buf.length - 1) / v.duration);
        }}
        onLoadedMetadata={(e) => { console.debug(DBG, "metadata", { duration: e.currentTarget.duration }); setVideoDuration(e.currentTarget.duration); }}
        onPlay={() => {
          console.debug(DBG, "play event", { muted: videoRef.current?.muted });
          setPlaying(true); setLoading(false); setShowPlayButton(false);
          if (!hasStartedRef.current) {
            hasStartedRef.current = true;
            onStarted?.();
          }
        }}
        onPause={() => { console.debug(DBG, "pause event"); setPlaying(false); }}
        onWaiting={() => { console.debug(DBG, "waiting/buffering"); setLoading(true); }}
        onCanPlay={() => { console.debug(DBG, "canplay"); setLoading(false); }}
        onError={(e) => { console.error(DBG, "video error", e.currentTarget.error?.message, e.currentTarget.error?.code); }}
        onEnded={() => { console.debug(DBG, "ended"); if (hasNextEpisode) startAutoPlay(); else navigate(-1); }}
        crossOrigin="anonymous"
      >
        {subtitleTracks.map((t) => (
          <track key={t.index} kind="subtitles" src={t.url} label={t.label} />
        ))}
      </video>

      {/* Loading/buffering spinner */}
      {loading && playing && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/30 border-t-white" />
        </div>
      )}

      {/* Play button overlay — shown when autoplay is blocked by browser policy */}
      {showPlayButton && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60"
          onClick={(e) => {
            e.stopPropagation();
            userInteractedRef.current = true;
            const v = videoRef.current;
            if (v) { v.muted = false; v.play().then(() => { setShowPlayButton(false); setPolicyMuted(false); }).catch(() => {}); }
          }}>
          <div className="flex flex-col items-center gap-3">
            <svg className="h-20 w-20 text-white/90" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            <span className="text-sm text-white/70">Appuyez pour lire</span>
          </div>
        </div>
      )}

      {/* Unmute indicator — shown when browser policy forced muted playback */}
      {policyMuted && playing && !showPlayButton && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            userInteractedRef.current = true;
            const v = videoRef.current;
            if (v) { v.muted = false; setPolicyMuted(false); }
          }}
          className="absolute left-4 top-4 z-20 flex items-center gap-2 rounded-full bg-black/60 px-4 py-2 text-sm text-white/80 ring-1 ring-white/20 backdrop-blur-sm transition-all hover:bg-black/80"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
          </svg>
          Appuyez pour le son
        </button>
      )}

      {/* Skip intro/credits buttons */}
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

      {/* Controls overlay */}
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

      {/* Auto-play overlay */}
      {autoPlayCountdown !== null && (
        <AutoPlayOverlay
          countdown={autoPlayCountdown}
          episodeTitle={nextEpisodeTitle}
          onPlay={() => onNextEpisode?.()}
          onCancel={() => { clearInterval(autoPlayTimerRef.current); setAutoPlayCountdown(null); }}
        />
      )}
    </div>
  );
}

function AutoPlayOverlay({ countdown, episodeTitle, onPlay, onCancel }: {
  countdown: number; episodeTitle?: string; onPlay: () => void; onCancel: () => void;
}) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/80" onClick={(e) => e.stopPropagation()}>
      <div className="flex flex-col items-center gap-6 text-center">
        <p className="text-lg text-white/70">Prochain épisode dans</p>
        <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-tentacle-accent">
          <span className="text-4xl font-bold text-white">{countdown}</span>
        </div>
        {episodeTitle && <p className="text-sm text-white/50">{episodeTitle}</p>}
        <div className="flex gap-4">
          <button onClick={onPlay} className="rounded-lg bg-tentacle-accent px-6 py-2.5 text-sm font-semibold text-white hover:bg-tentacle-accent/80">
            Lire maintenant
          </button>
          <button onClick={onCancel} className="rounded-lg bg-white/10 px-6 py-2.5 text-sm text-white/70 hover:bg-white/20">
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
