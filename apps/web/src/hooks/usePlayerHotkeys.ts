import { useEffect, type MutableRefObject } from "react";
import type { NavigateFunction } from "react-router-dom";
import { markPlayerExit } from "../components/detail/detailTransition";
import type { SubtitleTrack } from "../components/player/videoPlayer.types";

interface UsePlayerHotkeysOptions {
  videoRef: MutableRefObject<HTMLVideoElement | null>;
  volume: number;
  subtitleTracks: SubtitleTrack[];
  currentSubtitle: number | null;
  hasNextEpisode?: boolean;
  hasPreviousEpisode?: boolean;
  navigate: NavigateFunction;
  togglePlay: () => void;
  toggleFullscreen: () => void;
  handleSeek: (targetSeconds: number) => void;
  skipBy: (delta: number) => void;
  handleVolumeChange: (val: number) => void;
  handleToggleMute: () => void;
  onSubtitleChange: (index: number | null) => void;
  onNextEpisode?: () => void;
  onPreviousEpisode?: () => void;
}

export function usePlayerHotkeys({
  videoRef, volume, subtitleTracks, currentSubtitle, hasNextEpisode, hasPreviousEpisode,
  navigate, togglePlay, toggleFullscreen, handleSeek, skipBy, handleVolumeChange,
  handleToggleMute, onSubtitleChange, onNextEpisode, onPreviousEpisode,
}: UsePlayerHotkeysOptions): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") { e.preventDefault(); togglePlay(); }
      if (e.code === "KeyF") toggleFullscreen();
      if (e.code === "Escape") { if (document.fullscreenElement) document.exitFullscreen(); else { markPlayerExit(); navigate(-1); } }
      if (e.code === "ArrowRight") skipBy(30);
      if (e.code === "ArrowLeft") skipBy(-10);
      if (e.code === "ArrowUp") { e.preventDefault(); handleVolumeChange(Math.min(1, volume + 0.1)); }
      if (e.code === "ArrowDown") { e.preventDefault(); handleVolumeChange(Math.max(0, volume - 0.1)); }
      if (e.code === "KeyM") handleToggleMute();
      if (e.code === "KeyN" && hasNextEpisode) onNextEpisode?.();
      if (e.code === "KeyP" && hasPreviousEpisode) onPreviousEpisode?.();
      if (e.code === "KeyS") {
        // Toggle subtitles
        const v = videoRef.current;
        if (v && v.textTracks.length > 0) {
          const active = Array.from(v.textTracks).findIndex((t) => t.mode === "showing");
          if (active >= 0) { onSubtitleChange(null); }
          else if (subtitleTracks.length > 0) { onSubtitleChange(subtitleTracks[0].index); }
        }
      }
      if (e.code === "KeyR") handleSeek(0);
      if (e.code === "KeyC") {
        // Cycle subtitle tracks
        if (subtitleTracks.length > 0) {
          const currentIdx = subtitleTracks.findIndex((t) => t.index === currentSubtitle);
          const nextIdx = (currentIdx + 1) % (subtitleTracks.length + 1);
          onSubtitleChange(nextIdx < subtitleTracks.length ? subtitleTracks[nextIdx].index : null);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, toggleFullscreen, navigate, handleSeek, skipBy, handleVolumeChange, handleToggleMute, volume, hasNextEpisode, hasPreviousEpisode, onNextEpisode, onPreviousEpisode]);
}
