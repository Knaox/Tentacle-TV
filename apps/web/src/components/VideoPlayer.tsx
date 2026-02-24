import { useRef, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { TrackSelector } from "./TrackSelector";
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
  onAudioChange: (index: number) => void;
  onSubtitleChange: (index: number | null) => void;
  onQualityChange: (bitrate: number | null) => void;
  onProgress?: (seconds: number, paused: boolean) => void;
  onStarted?: () => void;
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
  onAudioChange, onSubtitleChange, onQualityChange,
  onProgress, onStarted,
  hasNextEpisode, hasPreviousEpisode, nextEpisodeTitle,
  onNextEpisode, onPreviousEpisode,
  introSegment, creditsSegment,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const navigate = useNavigate();

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  // Prefer Jellyfin metadata duration, fallback to video element duration
  const duration = jellyfinDuration && jellyfinDuration > 0 ? jellyfinDuration : videoDuration;
  const [showControls, setShowControls] = useState(true);
  const [volume, setVolume] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [buffered, setBuffered] = useState(0);
  const [autoPlayCountdown, setAutoPlayCountdown] = useState<number | null>(null);
  const autoPlayTimerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const playbackTimeRef = useRef(0);
  const hasStartedRef = useRef(false);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play(); else v.pause();
  }, []);

  const seek = (pct: number) => {
    const v = videoRef.current;
    if (!v || !duration) return;
    v.currentTime = pct * duration;
  };

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

  // Seek to correct position on source change (quality/audio switch) or initial load
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const isSourceChange = hasStartedRef.current;
    const seekTo = isSourceChange ? playbackTimeRef.current : startPositionSeconds;
    // Force reload when source changes mid-playback
    if (isSourceChange) v.load();
    if (!seekTo) return;
    const onLoaded = () => {
      v.currentTime = seekTo;
      if (isSourceChange) v.play().catch(() => {});
    };
    v.addEventListener("loadedmetadata", onLoaded, { once: true });
    return () => v.removeEventListener("loadedmetadata", onLoaded);
  }, [src, startPositionSeconds]);

  // Manage subtitle tracks visibility
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

  // Auto-play countdown cleanup
  useEffect(() => {
    return () => { clearInterval(autoPlayTimerRef.current); };
  }, []);

  const startAutoPlayCountdown = useCallback(() => {
    if (!hasNextEpisode || !onNextEpisode) return;
    setAutoPlayCountdown(10);
    clearInterval(autoPlayTimerRef.current);
    autoPlayTimerRef.current = setInterval(() => {
      setAutoPlayCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(autoPlayTimerRef.current);
          onNextEpisode();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }, [hasNextEpisode, onNextEpisode]);

  const cancelAutoPlay = useCallback(() => {
    clearInterval(autoPlayTimerRef.current);
    setAutoPlayCountdown(null);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") { e.preventDefault(); togglePlay(); }
      if (e.code === "KeyF") toggleFullscreen();
      if (e.code === "Escape") { if (document.fullscreenElement) document.exitFullscreen(); else navigate(-1); }
      if (e.code === "ArrowRight") { const v = videoRef.current; if (v) v.currentTime += 10; }
      if (e.code === "ArrowLeft") { const v = videoRef.current; if (v) v.currentTime -= 10; }
      if (e.code === "KeyN" && hasNextEpisode) onNextEpisode?.();
      if (e.code === "KeyP" && hasPreviousEpisode) onPreviousEpisode?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, toggleFullscreen, navigate, hasNextEpisode, hasPreviousEpisode, onNextEpisode, onPreviousEpisode]);

  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const t = e.currentTarget.currentTime;
    setCurrentTime(t);
    playbackTimeRef.current = t;
    onProgress?.(t, e.currentTarget.paused);
  };

  const handleProgress = () => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    const buf = v.buffered;
    if (buf.length > 0) {
      setBuffered(buf.end(buf.length - 1) / v.duration);
    }
  };

  const fmt = (s: number) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
    return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
  };

  const progress = duration > 0 ? currentTime / duration : 0;
  const hasSettings = audioTracks.length > 0 || subtitleTracks.length > 0;

  // Skip intro/credits detection
  const showSkipIntro = introSegment && currentTime >= introSegment.start && currentTime < introSegment.end - 1;
  const showSkipCredits = creditsSegment && currentTime >= creditsSegment.start && currentTime < creditsSegment.end - 1;

  const handleSkip = (endTime: number) => {
    const v = videoRef.current;
    if (v) v.currentTime = endTime;
  };

  return (
    <div ref={containerRef} onMouseMove={scheduleHide} onClick={() => { togglePlay(); setShowSettings(false); }}
      className="relative flex h-screen w-screen items-center justify-center bg-black">
      <video ref={videoRef} src={src} className="h-full w-full"
        onTimeUpdate={handleTimeUpdate}
        onProgress={handleProgress}
        onLoadedMetadata={(e) => setVideoDuration(e.currentTarget.duration)}
        onPlay={() => { setPlaying(true); hasStartedRef.current = true; onStarted?.(); }}
        onPause={() => setPlaying(false)}
        onEnded={() => { if (hasNextEpisode) startAutoPlayCountdown(); else navigate(-1); }}
        autoPlay crossOrigin="anonymous"
      >
        {subtitleTracks.map((t) => (
          <track key={t.index} kind="subtitles" src={t.url} label={t.label} />
        ))}
      </video>

      {/* Skip intro/credits buttons */}
      {showSkipIntro && introSegment && (
        <button onClick={(e) => { e.stopPropagation(); handleSkip(introSegment.end); }}
          className="absolute bottom-28 right-6 z-20 rounded-lg border border-white/20 bg-black/60 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-md transition-all hover:bg-white/20">
          Passer l'intro
        </button>
      )}
      {showSkipCredits && creditsSegment && (
        <button onClick={(e) => { e.stopPropagation(); handleSkip(creditsSegment.end); }}
          className="absolute bottom-28 right-6 z-20 rounded-lg border border-white/20 bg-black/60 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-md transition-all hover:bg-white/20">
          Passer le générique
        </button>
      )}

      {/* Controls */}
      <div className={`absolute inset-0 flex flex-col justify-between transition-opacity duration-300 ${showControls ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={(e) => e.stopPropagation()}>
        {/* Top */}
        <div className="bg-gradient-to-b from-black/70 to-transparent px-6 pb-10 pt-5">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="rounded-full p-2 hover:bg-white/10"><BackIcon /></button>
            <div>
              <h2 className="text-lg font-semibold text-white">{title}</h2>
              {subtitle && <p className="text-sm text-white/50">{subtitle}</p>}
            </div>
          </div>
        </div>
        {/* Bottom */}
        <div className="relative bg-gradient-to-t from-black/70 to-transparent px-6 pb-5 pt-10">
          <AnimatePresence>
            {showSettings && hasSettings && (
              <TrackSelector audioTracks={audioTracks} subtitleTracks={subtitleTracks}
                currentAudio={currentAudio} currentSubtitle={currentSubtitle} currentQuality={currentQuality}
                onAudioChange={onAudioChange} onSubtitleChange={onSubtitleChange} onQualityChange={onQualityChange}
                onClose={() => setShowSettings(false)} />
            )}
          </AnimatePresence>
          {/* Progress bar */}
          <div className="group/bar relative mb-3 h-1.5 cursor-pointer rounded-full bg-white/20 transition-all hover:h-2.5"
            onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); seek((e.clientX - r.left) / r.width); }}>
            {/* Buffer bar */}
            <div className="absolute inset-y-0 left-0 rounded-full bg-white/30" style={{ width: `${buffered * 100}%` }} />
            {/* Playback bar */}
            <div className="relative h-full rounded-full bg-tentacle-accent" style={{ width: `${progress * 100}%` }}>
              <div className="absolute -right-1.5 -top-0.5 h-3.5 w-3.5 rounded-full bg-white opacity-0 shadow transition-opacity group-hover/bar:opacity-100" />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {hasPreviousEpisode && (
                <button onClick={onPreviousEpisode} className="rounded-full p-2 hover:bg-white/10" title="Épisode précédent (P)"><PrevEpIcon /></button>
              )}
              <button onClick={() => { const v = videoRef.current; if (v) v.currentTime = Math.max(0, v.currentTime - 10); }}
                className="rounded-full p-1.5 hover:bg-white/10" title="-10s">
                <span className="text-xs font-bold text-white/70">-10</span>
              </button>
              <button onClick={togglePlay} className="rounded-full p-2 hover:bg-white/10">{playing ? <PauseIcon /> : <PlayIcon />}</button>
              <button onClick={() => { const v = videoRef.current; if (v) v.currentTime = Math.min(v.duration, v.currentTime + 30); }}
                className="rounded-full p-1.5 hover:bg-white/10" title="+30s">
                <span className="text-xs font-bold text-white/70">+30</span>
              </button>
              {hasNextEpisode && (
                <button onClick={onNextEpisode} className="rounded-full p-2 hover:bg-white/10" title="Épisode suivant (N)"><NextEpIcon /></button>
              )}
              <div className="group/vol flex items-center gap-2">
                <button onClick={() => { const v = videoRef.current; if (v) { v.muted = !v.muted; setVolume(v.muted ? 0 : 1); } }}
                  className="rounded-full p-2 hover:bg-white/10">{volume === 0 ? <MuteIcon /> : <VolumeIcon />}</button>
                <input type="range" min={0} max={1} step={0.05} value={volume}
                  onChange={(e) => { const val = Number(e.target.value); setVolume(val); if (videoRef.current) videoRef.current.volume = val; }}
                  className="hidden w-20 accent-tentacle-accent group-hover/vol:block" />
              </div>
              <span className="text-sm text-white/60">{fmt(currentTime)} / {fmt(duration)}</span>
            </div>
            <div className="flex items-center gap-2">
              {hasSettings && (
                <button onClick={() => setShowSettings((p) => !p)} className="rounded-full p-2 hover:bg-white/10"><GearIcon /></button>
              )}
              <button onClick={toggleFullscreen} className="rounded-full p-2 hover:bg-white/10">{fullscreen ? <ExitFsIcon /> : <FsIcon />}</button>
            </div>
          </div>
        </div>
      </div>

      {/* Auto-play next episode overlay */}
      {autoPlayCountdown !== null && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/80" onClick={(e) => e.stopPropagation()}>
          <div className="flex flex-col items-center gap-6 text-center">
            <p className="text-lg text-white/70">Prochain épisode dans</p>
            <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-tentacle-accent">
              <span className="text-4xl font-bold text-white">{autoPlayCountdown}</span>
            </div>
            {nextEpisodeTitle && (
              <p className="text-sm text-white/50">{nextEpisodeTitle}</p>
            )}
            <div className="flex gap-4">
              <button
                onClick={() => onNextEpisode?.()}
                className="rounded-lg bg-tentacle-accent px-6 py-2.5 text-sm font-semibold text-white hover:bg-tentacle-accent/80"
              >
                Lire maintenant
              </button>
              <button
                onClick={cancelAutoPlay}
                className="rounded-lg bg-white/10 px-6 py-2.5 text-sm text-white/70 hover:bg-white/20"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BackIcon() { return <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>; }
function PlayIcon() { return <svg className="h-7 w-7 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>; }
function PauseIcon() { return <svg className="h-7 w-7 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>; }
function VolumeIcon() { return <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M12 6l-4 4H4v4h4l4 4V6z" /></svg>; }
function MuteIcon() { return <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707A1 1 0 0112 5.586v12.828a1 1 0 01-1.707.707L5.586 15z" /><path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>; }
function GearIcon() { return <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>; }
function FsIcon() { return <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4" /></svg>; }
function ExitFsIcon() { return <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 4v4H4M16 4v4h4M8 20v-4H4M16 20v-4h4" /></svg>; }
function PrevEpIcon() { return <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" /></svg>; }
function NextEpIcon() { return <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" /></svg>; }
