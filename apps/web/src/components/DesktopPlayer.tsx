import { useEffect, useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { TrackSelector } from "./TrackSelector";
import type { AudioTrack, SubtitleTrack } from "./VideoPlayer";
import { useDesktopPlayer, type PlayOptions } from "../hooks/useDesktopPlayer";

interface DesktopPlayerProps {
  src: string;
  title: string;
  subtitle?: string;
  startPositionSeconds?: number;
  audioTracks?: AudioTrack[];
  subtitleTracks?: SubtitleTrack[];
  currentAudio: number;
  currentSubtitle: number | null;
  currentQuality: number | null;
  onAudioChange: (index: number) => void;
  onSubtitleChange: (index: number | null) => void;
  onQualityChange: (bitrate: number | null) => void;
  onProgress?: (seconds: number, paused: boolean) => void;
  onStarted?: () => void;
}

export function DesktopPlayer({
  src, title, subtitle, startPositionSeconds,
  audioTracks = [], subtitleTracks = [],
  currentAudio, currentSubtitle, currentQuality,
  onAudioChange, onSubtitleChange, onQualityChange,
  onProgress, onStarted,
}: DesktopPlayerProps) {
  const navigate = useNavigate();
  const { state, ready, error, play, togglePause, seek, seekRelative, setVolume, toggleMute, stop } = useDesktopPlayer();
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const hasStartedRef = useRef(false);

  // Load media when ready
  useEffect(() => {
    if (!ready || !src) return;
    const options: PlayOptions = {
      url: src,
      startPosition: startPositionSeconds,
      audioTrack: currentAudio > 0 ? currentAudio : undefined,
      subtitleTrack: currentSubtitle ?? 0,
    };
    play(options);
  }, [ready, src]);

  // Report progress to Jellyfin
  useEffect(() => {
    if (!state.playing && !hasStartedRef.current) return;
    if (state.playing && !hasStartedRef.current) {
      hasStartedRef.current = true;
      onStarted?.();
    }
    onProgress?.(state.position, state.paused);
  }, [state.position, state.paused, state.playing]);

  // Navigate back on EOF
  useEffect(() => {
    if (state.eof && hasStartedRef.current) {
      navigate(-1);
    }
  }, [state.eof, navigate]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { stop(); };
  }, [stop]);

  const scheduleHide = useCallback(() => {
    clearTimeout(hideTimer.current);
    setShowControls(true);
    hideTimer.current = setTimeout(() => {
      if (!state.paused) setShowControls(false);
    }, 3000);
  }, [state.paused]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") { e.preventDefault(); togglePause(); }
      if (e.code === "Escape") navigate(-1);
      if (e.code === "ArrowRight") seekRelative(10);
      if (e.code === "ArrowLeft") seekRelative(-10);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePause, navigate, seekRelative]);

  const fmt = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    return h > 0
      ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
      : `${m}:${String(sec).padStart(2, "0")}`;
  };

  const progress = state.duration > 0 ? state.position / state.duration : 0;
  const hasSettings = audioTracks.length > 0 || subtitleTracks.length > 0;

  if (error) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-black">
        <p className="text-lg text-red-400">Erreur mpv : {error}</p>
        <button onClick={() => navigate(-1)}
          className="rounded-lg bg-tentacle-accent px-6 py-2 text-white hover:bg-tentacle-accent/80">
          Retour
        </button>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-black">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-tentacle-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div onMouseMove={scheduleHide}
      className="relative flex h-screen w-screen items-center justify-center bg-black">
      {/* mpv renders in its own window — this is the overlay */}
      <div className="absolute inset-0 bg-black/20" onClick={() => { togglePause(); setShowSettings(false); }} />

      {/* Controls overlay */}
      <div className={`absolute inset-0 z-10 flex flex-col justify-between transition-opacity duration-300 ${showControls ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={(e) => e.stopPropagation()}>
        {/* Top bar */}
        <div className="bg-gradient-to-b from-black/70 to-transparent px-6 pb-10 pt-5">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="rounded-full p-2 hover:bg-white/10">
              <BackIcon />
            </button>
            <div>
              <h2 className="text-lg font-semibold text-white">{title}</h2>
              {subtitle && <p className="text-sm text-white/50">{subtitle}</p>}
            </div>
            <div className="ml-auto flex items-center gap-2 rounded-full bg-purple-600/30 px-3 py-1">
              <span className="h-2 w-2 rounded-full bg-purple-400" />
              <span className="text-xs text-purple-200">mpv</span>
            </div>
          </div>
        </div>

        {/* Bottom controls */}
        <div className="relative bg-gradient-to-t from-black/70 to-transparent px-6 pb-5 pt-10">
          <AnimatePresence>
            {showSettings && hasSettings && (
              <TrackSelector
                audioTracks={audioTracks} subtitleTracks={subtitleTracks}
                currentAudio={currentAudio} currentSubtitle={currentSubtitle}
                currentQuality={currentQuality}
                onAudioChange={onAudioChange} onSubtitleChange={onSubtitleChange}
                onQualityChange={onQualityChange}
                onClose={() => setShowSettings(false)}
              />
            )}
          </AnimatePresence>

          {/* Progress bar */}
          <div className="group/bar mb-3 flex h-1.5 cursor-pointer items-center rounded-full bg-white/20 transition-all hover:h-2.5"
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              const pct = (e.clientX - r.left) / r.width;
              seek(pct * state.duration);
            }}>
            <div className="relative h-full rounded-full bg-tentacle-accent" style={{ width: `${progress * 100}%` }}>
              <div className="absolute -right-1.5 -top-0.5 h-3.5 w-3.5 rounded-full bg-white opacity-0 shadow transition-opacity group-hover/bar:opacity-100" />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => togglePause()} className="rounded-full p-2 hover:bg-white/10">
                {state.paused ? <PlayIcon /> : <PauseIcon />}
              </button>
              <div className="group/vol flex items-center gap-2">
                <button onClick={() => toggleMute()} className="rounded-full p-2 hover:bg-white/10">
                  {state.muted || state.volume === 0 ? <MuteIcon /> : <VolumeIcon />}
                </button>
                <input type="range" min={0} max={100} step={1} value={state.volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  className="hidden w-20 accent-tentacle-accent group-hover/vol:block" />
              </div>
              <span className="text-sm text-white/60">
                {fmt(state.position)} / {fmt(state.duration)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {hasSettings && (
                <button onClick={() => setShowSettings((p) => !p)} className="rounded-full p-2 hover:bg-white/10">
                  <GearIcon />
                </button>
              )}
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
