import { useRef, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { TrackSelector } from "./TrackSelector";

export interface SubtitleTrack { index: number; label: string; url: string }
export interface AudioTrack { index: number; label: string }

interface VideoPlayerProps {
  src: string;
  title: string;
  subtitle?: string;
  startPositionSeconds?: number;
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
}

export function VideoPlayer({
  src, title, subtitle, startPositionSeconds,
  subtitleTracks = [], audioTracks = [],
  currentAudio, currentSubtitle, currentQuality,
  onAudioChange, onSubtitleChange, onQualityChange,
  onProgress, onStarted,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const navigate = useNavigate();

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [volume, setVolume] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

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

  // Seek to start position
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !startPositionSeconds) return;
    const onLoaded = () => { v.currentTime = startPositionSeconds; };
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") { e.preventDefault(); togglePlay(); }
      if (e.code === "KeyF") toggleFullscreen();
      if (e.code === "Escape") { if (document.fullscreenElement) document.exitFullscreen(); else navigate(-1); }
      if (e.code === "ArrowRight") { const v = videoRef.current; if (v) v.currentTime += 10; }
      if (e.code === "ArrowLeft") { const v = videoRef.current; if (v) v.currentTime -= 10; }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, toggleFullscreen, navigate]);

  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const t = e.currentTarget.currentTime;
    setCurrentTime(t);
    onProgress?.(t, e.currentTarget.paused);
  };

  const fmt = (s: number) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
    return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
  };

  const progress = duration > 0 ? currentTime / duration : 0;
  const hasSettings = audioTracks.length > 0 || subtitleTracks.length > 0;

  return (
    <div ref={containerRef} onMouseMove={scheduleHide} onClick={() => { togglePlay(); setShowSettings(false); }}
      className="relative flex h-screen w-screen items-center justify-center bg-black">
      <video ref={videoRef} src={src} className="h-full w-full"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onPlay={() => { setPlaying(true); onStarted?.(); }}
        onPause={() => setPlaying(false)}
        onEnded={() => navigate(-1)} autoPlay crossOrigin="anonymous"
      >
        {subtitleTracks.map((t) => (
          <track key={t.index} kind="subtitles" src={t.url} label={t.label} />
        ))}
      </video>

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
          <div className="group/bar mb-3 flex h-1.5 cursor-pointer items-center rounded-full bg-white/20 transition-all hover:h-2.5"
            onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); seek((e.clientX - r.left) / r.width); }}>
            <div className="relative h-full rounded-full bg-tentacle-accent" style={{ width: `${progress * 100}%` }}>
              <div className="absolute -right-1.5 -top-0.5 h-3.5 w-3.5 rounded-full bg-white opacity-0 shadow transition-opacity group-hover/bar:opacity-100" />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={togglePlay} className="rounded-full p-2 hover:bg-white/10">{playing ? <PauseIcon /> : <PlayIcon />}</button>
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
