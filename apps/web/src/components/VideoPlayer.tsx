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
  const [autoPlayCountdown, setAutoPlayCountdown] = useState<number | null>(null);
  const autoPlayTimerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const hasStartedRef = useRef(false);

  // Real playback time = offset (from transcoded seek) + video element time
  const currentTime = streamOffset + rawTime;
  const duration = jellyfinDuration && jellyfinDuration > 0 ? jellyfinDuration : videoDuration;

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {}); else v.pause();
  }, []);

  const handleSeek = useCallback((targetSeconds: number) => {
    if (isDirectPlay) {
      const v = videoRef.current;
      if (v) v.currentTime = targetSeconds;
    } else {
      // Transcoded: request new stream from target position
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
    // Reset raw time immediately so display reflects new streamOffset (no stale flicker)
    if (isSourceChange) setRawTime(0);
    // Direct play: restore position after reload. Transcoded: server starts at startTicks.
    const seekTo = isSourceChange ? (isDirectPlay ? savedTime : 0) : (startPositionSeconds ?? 0);
    if (isSourceChange) v.load();
    const onLoaded = () => {
      if (seekTo > 0) v.currentTime = seekTo;
      if (isSourceChange) v.play().catch(() => {});
    };
    v.addEventListener("loadedmetadata", onLoaded, { once: true });
    return () => v.removeEventListener("loadedmetadata", onLoaded);
  }, [src]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") { e.preventDefault(); togglePlay(); }
      if (e.code === "KeyF") toggleFullscreen();
      if (e.code === "Escape") { if (document.fullscreenElement) document.exitFullscreen(); else navigate(-1); }
      if (e.code === "ArrowRight") handleSeek(currentTime + 10);
      if (e.code === "ArrowLeft") handleSeek(Math.max(0, currentTime - 10));
      if (e.code === "KeyN" && hasNextEpisode) onNextEpisode?.();
      if (e.code === "KeyP" && hasPreviousEpisode) onPreviousEpisode?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, toggleFullscreen, navigate, currentTime, handleSeek, hasNextEpisode, hasPreviousEpisode, onNextEpisode, onPreviousEpisode]);

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
    setVolume(v.muted ? 0 : 1);
  }, []);

  return (
    <div ref={containerRef} onMouseMove={scheduleHide} onClick={togglePlay}
      className="relative flex h-screen w-screen items-center justify-center bg-black">
      <video ref={videoRef} src={src} className="h-full w-full"
        onTimeUpdate={(e) => {
          const t = e.currentTarget.currentTime;
          setRawTime(t);
          onProgress?.(streamOffset + t, e.currentTarget.paused);
        }}
        onProgress={() => {
          const v = videoRef.current;
          if (!v || !v.duration) return;
          const buf = v.buffered;
          if (buf.length > 0) setBuffered(buf.end(buf.length - 1) / v.duration);
        }}
        onLoadedMetadata={(e) => setVideoDuration(e.currentTarget.duration)}
        onPlay={() => { setPlaying(true); if (!hasStartedRef.current) { hasStartedRef.current = true; onStarted?.(); } }}
        onPause={() => setPlaying(false)}
        onEnded={() => { if (hasNextEpisode) startAutoPlay(); else navigate(-1); }}
        autoPlay crossOrigin="anonymous"
      >
        {subtitleTracks.map((t) => (
          <track key={t.index} kind="subtitles" src={t.url} label={t.label} />
        ))}
      </video>

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
