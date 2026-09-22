import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { BURN_IN_SUBTITLE_CODECS } from "@tentacle-tv/shared";
import { useNavigate } from "react-router-dom";
import { SkipBadge } from "./SkipBadge";
import { PlaybackBadge } from "./PlaybackBadge";
import { nativeHlsSupportsQualitySwitch } from "../hooks/useNativeHlsPreference";
import { usePlaybackFlash } from "../hooks/usePlaybackFlash";
import { markPlayerExit } from "./detail/detailTransition";
import { useSmartSeek } from "../hooks/useSmartSeek";
import { useVideoSource } from "../hooks/useVideoSource";
import { isMseSource } from "../hooks/videoSourceHelpers";
import { useVideoStallWatch } from "../hooks/useVideoStallWatch";
import { useVideoEvents } from "../hooks/useVideoEvents";
import { useWebSegmentsOverlay } from "../hooks/useWebSegmentsOverlay";
import { useNativeMediaTracks } from "../hooks/useNativeMediaTracks";
import { usePlayerHotkeys } from "../hooks/usePlayerHotkeys";
import { useWebTransport } from "../hooks/useWebTransport";
import { VideoPlayerOverlays } from "./player/VideoPlayerOverlays";
import { VideoPlayerControlsLayer } from "./player/VideoPlayerControlsLayer";
import { useControlsAutoHide } from "../hooks/useControlsAutoHide";
import { useVideoClock } from "../hooks/useVideoClock";
import { useVideoCommands } from "../hooks/useVideoCommands";
import { useGatedPlay } from "../hooks/useGatedPlay";
import { usePlayerSwipe } from "../hooks/usePlayerSwipe";
import { usePlayerVolume } from "../hooks/usePlayerVolume";
import { PgsSubtitleOverlay } from "./player/PgsSubtitleOverlay";
import { useSanitizedSubtitles } from "../hooks/useSanitizedSubtitles";
import type { VideoPlayerProps } from "./player/videoPlayer.types";

export type { AudioTrack, SubtitleTrack } from "./player/videoPlayer.types";

export function VideoPlayer({
  src, itemId, item, mediaSourceId, title, subtitle, startPositionSeconds, jellyfinDuration,
  subtitleTracks = [], audioTracks = [],
  currentAudio, currentSubtitle, currentQuality, sourceQuality, qualityPresets, autoQualityActive,
  isDirectPlay = true, streamOffset = 0, useNativeHls,
  onAudioChange, onSubtitleChange, onQualityChange,
  onProgress, onStarted, onSeekRequest, onSeekComplete, onDirectPlayNonFiable, onTrackNotFound,
  pgsSubtitleUrl, onPgsFailure,
  hasNextEpisode, hasPreviousEpisode, nextEpisodeTitle,
  nextEpisodeImageUrl, nextEpisodeDescription,
  nextSeriesBackdropUrl, nextEpisodeThumbUrl,
  onNextEpisode, onPreviousEpisode,
  segments = [], runtimeMs = 0, libraryId = null, posterUrl,
  transportRef, onPlayStateChange, onBufferingChange, onFatalError, onAutoNextDismiss, onRequestPlay,
  inGroupSession, onControlsVisibilityChange, applyToSeries,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  // Une balise `<video>` par SORTE de source : passer d'une lecture directe à
  // une session MSE sur le même élément fige le décodeur (cf. `isMseSource`).
  const mediaKind = isMseSource(src, useNativeHls) ? "mse" : "native";

  const [playing, setPlaying] = useState(false);
  // L'horloge à 1 Hz et les décalages de PTS du conteneur — voir `useVideoClock`.
  const {
    rawTimeRef, displayTime, lastKnownPositionRef,
    effectiveOffsetRef, containerPtsOffsetRef, offsetDetectedRef, hlsRunStartRef, hlsLandingRef, containerBaseRef,
  } = useVideoClock();

  const [videoDuration, setVideoDuration] = useState(0);
  const { showControls, scheduleHide, scrubbing } = useControlsAutoHide(playing);
  // Overlays externes (avatars Watch Together…) alignés sur l'overlay lecteur.
  useEffect(() => { onControlsVisibilityChange?.(showControls); }, [showControls, onControlsVisibilityChange]);
  const [fullscreen, setFullscreen] = useState(false);
  const [buffered, setBuffered] = useState(0);
  // Fin réelle du média (onEnded) — l'arbitre en fait l'écran de fin, ou la
  // sortie quand aucune suite n'est possible.
  const [ended, setEnded] = useState(false);
  const hasStartedRef = useRef(false);
  // Le pendant RÉACTIF de `hasStartedRef` : l'écran de chargement se décide au
  // rendu, et une ref mutée ne re-rend rien. Sans lui, le lecteur restait noir
  // entre son montage et la première image (cf. VideoPlayerOverlays).
  const [hasStarted, setHasStarted] = useState(false);
  const sourceChangingRef = useRef(false);
  const currentTimeRef = useRef(0);
  const userInteractedRef = useRef(false);
  const waitingTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const seekTargetRef = useRef<number | null>(null);
  const seekStallTimer = useRef<ReturnType<typeof setInterval>>(undefined);

  const { loading, setLoading, showPlayButton, setShowPlayButton } = useVideoSource({
    videoRef, src, isDirectPlay, streamOffset, useNativeHls, startPositionSeconds,
    effectiveOffsetRef, containerPtsOffsetRef, offsetDetectedRef,
    seekTargetRef, seekStallTimer, sourceChangingRef, hasStartedRef,
    lastKnownPositionRef, currentTimeRef, onSeekRequest, onSeekComplete, hlsRunStartRef, hlsLandingRef, containerBaseRef,
    onDirectPlayNonFiable,
  });

  const { volume, handleVolumeChange, handleToggleMute } = usePlayerVolume({ videoRef, elementKey: mediaKind });
  // Filet : un décodeur qui s'arrête sans rien dire se relance d'une recherche.
  useVideoStallWatch(videoRef);
  // Le lecteur web ne met pas en pause pour chercher un passage (sa barre appelle
  // `onSeek` sans toucher à la lecture), il n'a donc rien à faire taire.
  const { flash: playbackFlash } = usePlaybackFlash(!playing, volume === 0);

  const currentTime = effectiveOffsetRef.current + displayTime;
  const duration = jellyfinDuration && jellyfinDuration > 0 ? jellyfinDuration : videoDuration;

  // Lecture/pause et vitesse — les deux ordres donnés à l'élément lui-même ;
  // en séance, la lecture passe d'abord par le moteur (reprise commune).
  const { togglePlay: rawTogglePlay, applyRate } = useVideoCommands(videoRef);
  const { toggle: togglePlay } = useGatedPlay({
    rawToggle: rawTogglePlay, rawPlay: rawTogglePlay,
    isPaused: () => videoRef.current?.paused ?? true, onRequestPlay,
  });

  const { handleSeek, skipBy, skipFlash } = useSmartSeek({
    videoRef, containerPtsOffsetRef, seekTargetRef, seekStallTimer, currentTimeRef, hlsRunStartRef,
    src, isDirectPlay, streamOffset, onSeekRequest, onSeekComplete,
    reportLoading: setLoading,
    // Sauter à la fin VAUT la fin : même canal que l'événement `ended` — la
    // pause coupe un flux HLS qui chercherait encore son dernier fragment.
    onSeekToEnd: () => { videoRef.current?.pause(); setEnded(true); },
  });

  const [controlPanelOpen, setControlPanelOpen] = useState(false); // panneau ouvert → pilules effacées
  // L'arbitre partagé (boutons de saut, carte, affiche de fin), Watch Together
  // compris — câblé dans le hook, comme sur le bureau.
  const playback = useWebSegmentsOverlay({
    itemId, isEpisode: item?.Type === "Episode" && !!item.SeriesId, hasNextEpisode,
    positionSeconds: currentTime, durationSeconds: duration, hasStarted, playbackEnded: ended,
    segments, runtimeMs, libraryId,
    // En déplacement, l'habillage reste allumé (le téléviseur y loge sa
    // surcouche de scrub) mais il ne doit pas pour autant rendre un passage
    // mis en sourdine : on cherche une position, pas un bouton.
    controlsVisible: showControls && !scrubbing,
    scrubbing,
    onSeekSeconds: handleSeek, onNextEpisode,
    // Fin de lecture sans suite (film, dernier épisode) : retour à la fiche.
    onEndOfPlayback: () => { markPlayerExit(); navigate(`/media/${itemId}`, { replace: true }); },
    onAutoNextDismiss, inGroupSession,
  });

  // La sortie de fin (film, dernier épisode, affiche refusée ou éteinte) est
  // décidée par la coquille (`useEndOfPlaybackExit`) : elle appelle
  // `onEndOfPlayback` ci-dessus — plus aucune garde locale à tenir ici.
  useEffect(() => { setEnded(false); }, [src, itemId]);

  // Watch Together : surface de commande impérative pour le moteur de sync.
  // `wt:cancelAutoNext` = refus de carte distant, même sémantique que la croix.
  useWebTransport({
    transportRef, videoRef, lastKnownPositionRef, effectiveOffsetRef, sourceChangingRef,
    handleSeek, cancelAutoNextLocal: playback.signalRemoteNextDismiss,
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

  const swipe = usePlayerSwipe(skipBy, userInteractedRef);

  // Seules les pistes TEXTE deviennent des <track> : un sous-titre image n'a
  // pas de VTT à charger, et la correspondance index → textTracks doit rester
  // exacte des deux côtés (cf. useNativeMediaTracks).
  const textTracks = useMemo(
    () => subtitleTracks.filter((t) => !BURN_IN_SUBTITLE_CODECS.test(t.codec ?? "")),
    [subtitleTracks],
  );
  useNativeMediaTracks({ videoRef, src, subtitleTracks: textTracks, currentSubtitle, audioTracks, currentAudio, isDirectPlay, onTrackNotFound });
  // VTT de la piste active, débarrassé du balisage ASS que Jellyfin laisse
  // fuiter dans le texte des cues (« {\an8} » affiché tel quel).
  const sanitizedSubtitleUrl = useSanitizedSubtitles({ tracks: textTracks, selection: currentSubtitle, src });

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

  usePlayerHotkeys({
    videoRef, volume, subtitleTracks, currentSubtitle, hasNextEpisode, hasPreviousEpisode,
    navigate, togglePlay, toggleFullscreen, handleSeek, skipBy, handleVolumeChange,
    handleToggleMute, onSubtitleChange, onNextEpisode, onPreviousEpisode,
  });

  const videoEvents = useVideoEvents({
    videoRef, rawTimeRef, lastKnownPositionRef, effectiveOffsetRef, containerPtsOffsetRef,
    offsetDetectedRef, containerBaseRef, sourceChangingRef, hasStartedRef, waitingTimer,
    src, itemId, isDirectPlay, startPositionSeconds, jellyfinDuration,
    setPlaying, setHasStarted, setLoading, setShowPlayButton, setBuffered, setVideoDuration,
    onPlaybackEnded: () => setEnded(true),
    onProgress, onStarted, onPlayStateChange, onBufferingChange, onFatalError,
  });

  return (
    <div ref={containerRef} onMouseMove={scheduleHide}
      onClick={() => {
        userInteractedRef.current = true;
        togglePlay();
      }}
      onDoubleClick={toggleFullscreen}
      {...swipe}
      // Toile du lecteur (letterboxing derrière la vidéo) → bg-black
      // volontairement en dur dans les deux thèmes clair/sombre.
      className={`relative flex h-screen w-screen items-center justify-center bg-black ${showControls ? "" : "cursor-none"}`}>
      {/* Pas de `crossOrigin` : l'attribut ferait exiger le CORS sur l'URL de
          lecture directe, servie par le serveur Jellyfin — donc hors origine et
          sans en-tête. Rien n'en a besoin ici : les pistes VTT et le `.sup` PGS
          passent par le proxy, même origine, et personne ne dessine la vidéo
          dans un canvas. */}
      <video key={mediaKind} ref={videoRef} className="h-full w-full" playsInline preload="auto"
        {...videoEvents}
      >
        {/* Tous les <track> restent montés, sélectionnés ou non : la
            correspondance index → textTracks de useNativeMediaTracks se fait
            par POSITION, en omettre un décalerait toutes les suivantes.
            Seule la piste active porte une `src` — le navigateur ne charge de
            toute façon que celle dont le `mode` n'est pas `disabled`, et
            l'attendre évite d'afficher une seconde le fichier brut. */}
        {textTracks.map((t) => (
          <track key={`${src}-${t.index}`} kind="subtitles" label={t.label}
            src={t.index === currentSubtitle ? (sanitizedSubtitleUrl ?? undefined) : undefined} />
        ))}
      </video>

      {/* Sous-titres image décodés ici plutôt qu'incrustés par le serveur —
          monté uniquement quand une piste PGS est active (règle GPU). */}
      {pgsSubtitleUrl && onPgsFailure && (
        <PgsSubtitleOverlay
          videoRef={videoRef} supUrl={pgsSubtitleUrl}
          timeOffsetRef={effectiveOffsetRef} onFailure={onPgsFailure}
        />
      )}

      <VideoPlayerOverlays
        loading={loading} hasStarted={hasStarted}
        showPlayButton={showPlayButton}
        posterUrl={posterUrl}
        overlay={playback.overlay} countdownTotals={playback.countdownTotals}
        onSkip={playback.skipNow} onDismissOverlay={playback.dismissOverlay}
        onPlayNow={playback.playNow} controlsVisible={showControls} panelOpen={controlPanelOpen}
        nextEpisodeTitle={nextEpisodeTitle} nextEpisodeDescription={nextEpisodeDescription}
        nextEpisodeImageUrl={nextEpisodeImageUrl} nextSeriesBackdropUrl={nextSeriesBackdropUrl}
        nextEpisodeThumbUrl={nextEpisodeThumbUrl}
        item={item} onRatingEngage={playback.cancelNextCountdown}
        videoRef={videoRef} userInteractedRef={userInteractedRef}
        setShowPlayButton={setShowPlayButton}
      />

      <SkipBadge flash={skipFlash} />

      {/* Bascule lecture/pause, d'où qu'elle vienne — barre d'espace, clic,
          tap sur mobile. */}
      <PlaybackBadge flash={playbackFlash} />

      <VideoPlayerControlsLayer
        hasStarted={hasStarted}
        visible={showControls}
        controls={{
          playing, currentTime, duration, buffered, volume, fullscreen,
          item, itemId, mediaSourceId, title, subtitle,
          audioTracks, subtitleTracks, qualityPresets,
          currentAudio, currentSubtitle, currentQuality, sourceQuality, autoQualityActive,
          hasNextEpisode, hasPreviousEpisode,
          onTogglePlay: togglePlay, onSeek: handleSeek, onSkip: skipBy,
          onVolumeChange: handleVolumeChange, onToggleMute: handleToggleMute,
          onToggleFullscreen: toggleFullscreen,
          onBack: () => { markPlayerExit(); navigate(-1); },
          onAudioChange, onSubtitleChange,
          onQualityChange: useNativeHls && !nativeHlsSupportsQualitySwitch() ? undefined : onQualityChange,
          onNextEpisode, onPreviousEpisode,
          applyToSeries, onPlaybackRateChange: applyRate, onPanelsOpenChange: setControlPanelOpen,
        }}
      />
    </div>
  );
}
