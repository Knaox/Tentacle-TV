import { useRef, useState, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import { TrackSelector } from "./TrackSelector";
import {
  BackIcon, PlayIcon, PauseIcon, VolumeIcon, MuteIcon,
  GearIcon, FsIcon, ExitFsIcon, PrevEpIcon, NextEpIcon,
} from "./PlayerIcons";

export interface PlayerControlsProps {
  playing: boolean;
  currentTime: number;
  duration: number;
  buffered: number;
  volume: number;
  fullscreen: boolean;
  title: string;
  subtitle?: string;
  audioTracks: { index: number; label: string }[];
  subtitleTracks: { index: number; label: string }[];
  currentAudio: number;
  currentSubtitle: number | null;
  currentQuality: number | null;
  hasNextEpisode?: boolean;
  hasPreviousEpisode?: boolean;
  onTogglePlay: () => void;
  onSeek: (seconds: number) => void;
  onVolumeChange: (val: number) => void;
  onToggleMute: () => void;
  onToggleFullscreen: () => void;
  onBack: () => void;
  onAudioChange: (index: number) => void;
  onSubtitleChange: (index: number | null) => void;
  onQualityChange: (bitrate: number | null) => void;
  onNextEpisode?: () => void;
  onPreviousEpisode?: () => void;
}

export function PlayerControls({
  playing, currentTime, duration, buffered, volume, fullscreen,
  title, subtitle, audioTracks, subtitleTracks,
  currentAudio, currentSubtitle, currentQuality,
  hasNextEpisode, hasPreviousEpisode,
  onTogglePlay, onSeek, onVolumeChange, onToggleMute, onToggleFullscreen, onBack,
  onAudioChange, onSubtitleChange, onQualityChange,
  onNextEpisode, onPreviousEpisode,
}: PlayerControlsProps) {
  const [showSettings, setShowSettings] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState(0);

  const progress = duration > 0 ? currentTime / duration : 0;
  const hasSettings = audioTracks.length > 0 || subtitleTracks.length > 0;

  const handleBarClick = useCallback((e: React.MouseEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    onSeek(pct * duration);
  }, [duration, onSeek]);

  const handleBarHover = useCallback((e: React.MouseEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    setHoverTime(pct * duration);
    setHoverX(e.clientX - r.left);
  }, [duration]);

  return (
    <div className="absolute inset-0 flex flex-col">
      {/* Top bar — stops propagation so clicks don't toggle play */}
      <div className="bg-gradient-to-b from-black/70 to-transparent px-6 pb-10 pt-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="rounded-full p-2 hover:bg-white/10"><BackIcon /></button>
          <div>
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            {subtitle && <p className="text-sm text-white/50">{subtitle}</p>}
          </div>
        </div>
      </div>

      {/* Middle spacer — clicks pass through to parent (toggle play) */}
      <div className="flex-1" />

      {/* Bottom bar — stops propagation */}
      <div className="relative bg-gradient-to-t from-black/70 to-transparent px-6 pb-5 pt-10" onClick={(e) => e.stopPropagation()}>
        <AnimatePresence>
          {showSettings && hasSettings && (
            <TrackSelector
              audioTracks={audioTracks} subtitleTracks={subtitleTracks}
              currentAudio={currentAudio} currentSubtitle={currentSubtitle} currentQuality={currentQuality}
              onAudioChange={onAudioChange} onSubtitleChange={onSubtitleChange} onQualityChange={onQualityChange}
              onClose={() => setShowSettings(false)}
            />
          )}
        </AnimatePresence>

        {/* Progress bar */}
        <div ref={barRef}
          className="group/bar relative mb-3 h-1.5 cursor-pointer rounded-full bg-white/20 transition-all hover:h-2.5"
          onClick={handleBarClick} onMouseMove={handleBarHover} onMouseLeave={() => setHoverTime(null)}>
          <div className="absolute inset-y-0 left-0 rounded-full bg-white/30" style={{ width: `${buffered * 100}%` }} />
          <div className="relative h-full rounded-full bg-tentacle-accent" style={{ width: `${progress * 100}%` }}>
            <div className="absolute -right-1.5 -top-0.5 h-3.5 w-3.5 rounded-full bg-white opacity-0 shadow transition-opacity group-hover/bar:opacity-100" />
          </div>
          {hoverTime !== null && (
            <div className="absolute -top-8 -translate-x-1/2 rounded bg-black/80 px-2 py-0.5 text-xs text-white" style={{ left: hoverX }}>
              {fmt(hoverTime)}
            </div>
          )}
        </div>

        {/* Button row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {hasPreviousEpisode && (
              <button onClick={onPreviousEpisode} className="rounded-full p-2 hover:bg-white/10" title="Épisode précédent (P)"><PrevEpIcon /></button>
            )}
            <button onClick={() => onSeek(Math.max(0, currentTime - 10))} className="rounded-full p-1.5 hover:bg-white/10" title="-10s">
              <span className="text-xs font-bold text-white/70">-10</span>
            </button>
            <button onClick={onTogglePlay} className="rounded-full p-2 hover:bg-white/10">{playing ? <PauseIcon /> : <PlayIcon />}</button>
            <button onClick={() => onSeek(Math.min(duration, currentTime + 30))} className="rounded-full p-1.5 hover:bg-white/10" title="+30s">
              <span className="text-xs font-bold text-white/70">+30</span>
            </button>
            {hasNextEpisode && (
              <button onClick={onNextEpisode} className="rounded-full p-2 hover:bg-white/10" title="Épisode suivant (N)"><NextEpIcon /></button>
            )}
            <div className="group/vol flex items-center gap-2">
              <button onClick={onToggleMute} className="rounded-full p-2 hover:bg-white/10">
                {volume === 0 ? <MuteIcon /> : <VolumeIcon />}
              </button>
              <input type="range" min={0} max={1} step={0.05} value={volume}
                onChange={(e) => onVolumeChange(Number(e.target.value))}
                className="hidden w-20 accent-tentacle-accent group-hover/vol:block" />
            </div>
            <span className="text-sm text-white/60">{fmt(currentTime)} / {fmt(duration)}</span>
          </div>
          <div className="flex items-center gap-2">
            {hasSettings && (
              <button onClick={() => setShowSettings((p) => !p)} className="rounded-full p-2 hover:bg-white/10"><GearIcon /></button>
            )}
            <button onClick={onToggleFullscreen} className="rounded-full p-2 hover:bg-white/10">
              {fullscreen ? <ExitFsIcon /> : <FsIcon />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function fmt(s: number) {
  if (!isFinite(s) || s < 0) s = 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${m}:${String(sec).padStart(2, "0")}`;
}
