import { useRef, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { PlayerControls } from "./PlayerControls";
import { SkipBadge } from "./SkipBadge";
import { PlaybackBadge } from "./PlaybackBadge";
import { usePlaybackFlash } from "../hooks/usePlaybackFlash";
import { markPlayerExit } from "./detail/detailTransition";
import { useSmartSeek } from "../hooks/useSmartSeek";
import { useVideoSource } from "../hooks/useVideoSource";
import { useVideoEvents } from "../hooks/useVideoEvents";
import { useAutoNextCountdown } from "../hooks/useAutoNextCountdown";
import { useNativeMediaTracks } from "../hooks/useNativeMediaTracks";
import { usePlayerHotkeys } from "../hooks/usePlayerHotkeys";
import { useWebTransport } from "../hooks/useWebTransport";
import { AutoPlayOverlay } from "./AutoPlayOverlay";
import { useUpNextCard } from "./player/useUpNextCard";
import { VideoPlayerOverlays } from "./player/VideoPlayerOverlays";
import { useControlsAutoHide } from "../hooks/useControlsAutoHide";
import type { VideoPlayerProps } from "./player/videoPlayer.types";

export type { AudioTrack, SubtitleTrack } from "./player/videoPlayer.types";

export function VideoPlayer({
  src, itemId, item, mediaSourceId, title, subtitle, startPositionSeconds, jellyfinDuration,
  subtitleTracks = [], audioTracks = [],
  currentAudio, currentSubtitle, currentQuality, sourceQuality,
  isDirectPlay = true, streamOffset = 0, useNativeHls,
  onAudioChange, onSubtitleChange, onQualityChange,
  onProgress, onStarted, onSeekRequest, onSeekComplete, onDirectPlayNonFiable,
  hasNextEpisode, hasPreviousEpisode, nextEpisodeTitle,
  nextEpisodeImageUrl, nextEpisodeDescription,
  autoplayNextEnabled = true, maxResumePct = 90,
  onNextEpisode, onPreviousEpisode,
  introSegment, creditsSegment, posterUrl,
  transportRef, onPlayStateChange, onBufferingChange, onFatalError, onAutoNextDismiss,
  onControlsVisibilityChange, applyToSeries,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

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

  const [videoDuration, setVideoDuration] = useState(0);
  const { showControls, scheduleHide } = useControlsAutoHide(playing);
  // Overlays externes (avatars Watch Together…) alignés sur l'overlay lecteur.
  useEffect(() => { onControlsVisibilityChange?.(showControls); }, [showControls, onControlsVisibilityChange]);
  const [volume, setVolume] = useState(() => {
    const s = localStorage.getItem("tentacle_player_volume");
    if (s != null) { const v = Number(s); if (!Number.isNaN(v)) return Math.min(1, Math.max(0, v / 100)); }
    return 1;
  });
  // `volume` vaut 0 dès que le son est coupé — `handleToggleMute` le pose
  // lui-même, il n'y a donc pas d'état muet séparé à tenir.
  // Le lecteur web ne met pas en pause pour chercher un passage (sa barre appelle
  // `onSeek` sans toucher à la lecture), il n'a donc rien à faire taire.
  const { flash: playbackFlash } = usePlaybackFlash(!playing, volume === 0);
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = volume;
    // Mute persisté : survit aux changements d'épisode/média (remount).
    if (localStorage.getItem("tentacle_player_muted") === "1") v.muted = true;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // 1Hz display timer — reduces re-renders from ~4Hz (onTimeUpdate) to 1Hz.
  // rawTimeRef is updated every onTimeUpdate; displayTime only triggers renders at 1Hz.
  useEffect(() => {
    const id = setInterval(() => setDisplayTime(rawTimeRef.current), 1000);
    return () => clearInterval(id);
  }, []);
  const [fullscreen, setFullscreen] = useState(false);
  const [buffered, setBuffered] = useState(0);
  const autoPlayTimerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const creditsAutoPlayTriggered = useRef(false);
  const hasStartedRef = useRef(false);
  const sourceChangingRef = useRef(false);
  const currentTimeRef = useRef(0);
  const userInteractedRef = useRef(false);
  const waitingTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const seekTargetRef = useRef<number | null>(null);
  const seekStallTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Touch gestures : swipe horizontal pour seek (-10s / +30s), tap simple pour play/pause.
  // Le scrubber a son propre `onTouchStart` qui stopPropagation, donc pas de collision.
  const touchStartRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const SWIPE_THRESHOLD_PX = 50;
  const SWIPE_MAX_DURATION_MS = 600;

  const { loading, setLoading, showPlayButton, setShowPlayButton, policyMuted, setPolicyMuted } = useVideoSource({
    videoRef, src, isDirectPlay, streamOffset, useNativeHls, startPositionSeconds,
    effectiveOffsetRef, containerPtsOffsetRef, offsetDetectedRef,
    seekTargetRef, seekStallTimer, sourceChangingRef, hasStartedRef,
    lastKnownPositionRef, currentTimeRef, onSeekRequest, onDirectPlayNonFiable,
  });

  const currentTime = effectiveOffsetRef.current + displayTime;
  const duration = jellyfinDuration && jellyfinDuration > 0 ? jellyfinDuration : videoDuration;

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {}); else v.pause();
  }, []);

  const { handleSeek, skipBy, skipFlash } = useSmartSeek({
    videoRef, containerPtsOffsetRef, seekTargetRef, seekStallTimer, currentTimeRef,
    src, isDirectPlay, streamOffset, onSeekRequest, onSeekComplete,
  });

  const { autoPlayCountdown, startAutoPlay, cancelAutoNextLocal } = useAutoNextCountdown({
    hasNextEpisode, onNextEpisode, autoplayNextEnabled, maxResumePct,
    duration, currentTime, hasStartedRef, autoPlayTimerRef, creditsAutoPlayTriggered,
  });

  // Watch Together : surface de commande impérative pour le moteur de sync.
  useWebTransport({
    transportRef, videoRef, lastKnownPositionRef, sourceChangingRef,
    handleSeek, cancelAutoNextLocal,
  });

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

  useNativeMediaTracks({ videoRef, src, subtitleTracks, currentSubtitle, audioTracks, currentAudio, isDirectPlay });

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
    const v = videoRef.current;
    if (v) {
      v.volume = val;
      // Monter le volume démute (et efface le mute persisté).
      if (val > 0 && v.muted) {
        v.muted = false;
        try { localStorage.setItem("tentacle_player_muted", "0"); } catch {}
      }
    }
    try { localStorage.setItem("tentacle_player_volume", String(Math.round(val * 100))); } catch {}
  }, []);

  const handleToggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    if (!v.muted) setPolicyMuted(false);
    try { localStorage.setItem("tentacle_player_muted", v.muted ? "1" : "0"); } catch {}
    setVolume(v.muted ? 0 : 1);
  }, []);

  usePlayerHotkeys({
    videoRef, volume, subtitleTracks, currentSubtitle, hasNextEpisode, hasPreviousEpisode,
    navigate, togglePlay, toggleFullscreen, handleSeek, skipBy, handleVolumeChange,
    handleToggleMute, onSubtitleChange, onNextEpisode, onPreviousEpisode,
  });

  const videoEvents = useVideoEvents({
    videoRef, rawTimeRef, lastKnownPositionRef, effectiveOffsetRef, containerPtsOffsetRef,
    offsetDetectedRef, sourceChangingRef, hasStartedRef, waitingTimer, seekStallTimer,
    src, itemId, startPositionSeconds, jellyfinDuration, autoplayNextEnabled,
    hasNextEpisode, autoPlayCountdown,
    setPlaying, setLoading, setShowPlayButton, setBuffered, setVideoDuration,
    startAutoPlay, onProgress, onStarted, onPlayStateChange, onBufferingChange, onFatalError,
  });

  const showSkipIntro = introSegment && currentTime >= introSegment.start && currentTime < introSegment.end - 1;
  const showSkipCredits = creditsSegment && currentTime >= creditsSegment.start && currentTime < creditsSegment.end - 1;
  // Carte « à suivre » : proposée dès le générique quand un épisode suivant
  // existe (elle remplace alors le bouton texte), puis dotée d'un décompte si
  // l'enchaînement automatique démarre.
  const upNext = useUpNextCard({ itemId, hasNextEpisode, duringCredits: showSkipCredits, autoPlayCountdown });

  return (
    <div ref={containerRef} onMouseMove={scheduleHide}
      onClick={() => {
        userInteractedRef.current = true;
        const v = videoRef.current;
        if (policyMuted && v && !v.paused) { v.muted = false; setPolicyMuted(false); return; }
        togglePlay();
      }}
      onDoubleClick={toggleFullscreen}
      onTouchStart={(e) => {
        userInteractedRef.current = true;
        const t = e.touches[0];
        if (t) touchStartRef.current = { x: t.clientX, y: t.clientY, t: Date.now() };
      }}
      onTouchEnd={(e) => {
        const start = touchStartRef.current;
        touchStartRef.current = null;
        if (!start) return;
        const t = e.changedTouches[0];
        if (!t) return;
        const dx = t.clientX - start.x;
        const dy = t.clientY - start.y;
        const dt = Date.now() - start.t;
        // Reconnaît un swipe horizontal franc — pas un drag lent ni un tap.
        if (dt > SWIPE_MAX_DURATION_MS) return;
        if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return;
        if (Math.abs(dx) <= Math.abs(dy)) return; // composante verticale dominante = scroll
        e.preventDefault();
        e.stopPropagation();
        if (dx > 0) skipBy(30);
        else skipBy(-10);
      }}
      // Toile du lecteur (letterboxing derrière la vidéo) → bg-black
      // volontairement en dur dans les deux thèmes clair/sombre.
      className={`relative flex h-screen w-screen items-center justify-center bg-black ${showControls ? "" : "cursor-none"}`}>
      <video ref={videoRef} className="h-full w-full" playsInline preload="auto"
        {...videoEvents}
        crossOrigin={useNativeHls ? undefined : "anonymous"}
      >
        {subtitleTracks.map((t) => (
          <track key={`${src}-${t.index}`} kind="subtitles" src={t.url} label={t.label} />
        ))}
      </video>

      <VideoPlayerOverlays
        loading={loading} playing={playing} showPlayButton={showPlayButton} policyMuted={policyMuted}
        posterUrl={posterUrl} showSkipIntro={showSkipIntro} showSkipCredits={showSkipCredits}
        introSegment={introSegment} creditsSegment={creditsSegment}
        autoPlayCountdown={autoPlayCountdown} hasNextEpisode={hasNextEpisode}
        videoRef={videoRef} sourceChangingRef={sourceChangingRef} hasStartedRef={hasStartedRef}
        userInteractedRef={userInteractedRef}
        setShowPlayButton={setShowPlayButton} setPolicyMuted={setPolicyMuted}
        handleSeek={handleSeek}
      />

      <SkipBadge flash={skipFlash} />

      {/* Bascule lecture/pause, d'où qu'elle vienne — barre d'espace, clic,
          tap sur mobile. */}
      <PlaybackBadge flash={playbackFlash} />

      <div className={`absolute inset-0 transition-opacity duration-300 ${showControls ? "opacity-100" : "pointer-events-none opacity-0"}`}>
        <PlayerControls
          playing={playing} currentTime={currentTime} duration={duration}
          buffered={buffered} volume={volume} fullscreen={fullscreen}
          item={item} itemId={itemId} mediaSourceId={mediaSourceId}
          title={title} subtitle={subtitle}
          audioTracks={audioTracks} subtitleTracks={subtitleTracks}
          currentAudio={currentAudio} currentSubtitle={currentSubtitle} currentQuality={currentQuality} sourceQuality={sourceQuality}
          hasNextEpisode={hasNextEpisode} hasPreviousEpisode={hasPreviousEpisode}
          onTogglePlay={togglePlay} onSeek={handleSeek} onSkip={skipBy}
          onVolumeChange={handleVolumeChange} onToggleMute={handleToggleMute}
          onToggleFullscreen={toggleFullscreen} onBack={() => { markPlayerExit(); navigate(-1); }}
          onAudioChange={onAudioChange} onSubtitleChange={onSubtitleChange} onQualityChange={useNativeHls ? undefined : onQualityChange}
          onNextEpisode={onNextEpisode} onPreviousEpisode={onPreviousEpisode}
          applyToSeries={applyToSeries}
        />
      </div>

      <AnimatePresence>
        {upNext.visible && (
          <AutoPlayOverlay
            countdown={upNext.countdown} episodeTitle={nextEpisodeTitle}
            episodeDescription={nextEpisodeDescription} episodeImageUrl={nextEpisodeImageUrl}
            onPlay={() => onNextEpisode?.()}
            onCancel={() => {
              // Fermer la carte vaut aussi annulation quand un enchaînement
              // court : c'est le seul moyen offert de l'interrompre.
              if (upNext.countdown !== null) { cancelAutoNextLocal(); onAutoNextDismiss?.(); }
              upNext.dismiss();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
