import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { BURN_IN_SUBTITLE_CODECS } from "@tentacle-tv/shared";
import { useNavigate } from "react-router-dom";
import { PlayerControls } from "./PlayerControls";
import { SkipBadge } from "./SkipBadge";
import { PlaybackBadge } from "./PlaybackBadge";
import { nativeHlsSupportsQualitySwitch } from "../hooks/useNativeHlsPreference";
import { usePlaybackFlash } from "../hooks/usePlaybackFlash";
import { markPlayerExit } from "./detail/detailTransition";
import { useSmartSeek } from "../hooks/useSmartSeek";
import { useVideoSource } from "../hooks/useVideoSource";
import { useVideoEvents } from "../hooks/useVideoEvents";
import { usePlaybackOverlay } from "@tentacle-tv/api-client";
import { annoncerRefusLocal, useRefusSautIntro } from "../watchTogether/refusSautIntro";
import { useNativeMediaTracks } from "../hooks/useNativeMediaTracks";
import { usePlayerHotkeys } from "../hooks/usePlayerHotkeys";
import { useWebTransport } from "../hooks/useWebTransport";
import { VideoPlayerOverlays } from "./player/VideoPlayerOverlays";
import { useControlsAutoHide } from "../hooks/useControlsAutoHide";
import { usePlayerSwipe } from "../hooks/usePlayerSwipe";
import { usePlayerVolume } from "../hooks/usePlayerVolume";
import { PgsSubtitleOverlay } from "./player/PgsSubtitleOverlay";
import { useSanitizedSubtitles } from "../hooks/useSanitizedSubtitles";
import type { VideoPlayerProps } from "./player/videoPlayer.types";

export type { AudioTrack, SubtitleTrack } from "./player/videoPlayer.types";

export function VideoPlayer({
  src, itemId, item, mediaSourceId, title, subtitle, startPositionSeconds, jellyfinDuration,
  subtitleTracks = [], audioTracks = [],
  currentAudio, currentSubtitle, currentQuality, sourceQuality, qualityPresets,
  isDirectPlay = true, streamOffset = 0, useNativeHls,
  onAudioChange, onSubtitleChange, onQualityChange,
  onProgress, onStarted, onSeekRequest, onSeekComplete, onDirectPlayNonFiable, surPisteIntrouvable,
  pgsSubtitleUrl, onPgsEchec,
  hasNextEpisode, hasPreviousEpisode, nextEpisodeTitle,
  nextEpisodeImageUrl, nextEpisodeDescription,
  nextSeriesBackdropUrl, nextEpisodeThumbUrl,
  serverAutoplayEnabled = true,
  onNextEpisode, onPreviousEpisode,
  segments = [], runtimeMs = 0, posterUrl,
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
  // 1Hz display timer — reduces re-renders from ~4Hz (onTimeUpdate) to 1Hz.
  // rawTimeRef is updated every onTimeUpdate; displayTime only triggers renders at 1Hz.
  useEffect(() => {
    const id = setInterval(() => setDisplayTime(rawTimeRef.current), 1000);
    return () => clearInterval(id);
  }, []);
  const [fullscreen, setFullscreen] = useState(false);
  const [buffered, setBuffered] = useState(0);
  // Fin réelle du média (onEnded) — l'arbitre en fait l'écran de fin, ou la
  // sortie quand aucune suite n'est possible.
  const [ended, setEnded] = useState(false);
  const hasStartedRef = useRef(false);
  // Le pendant RÉACTIF de `hasStartedRef` : l'écran de chargement se décide au
  // rendu, et une ref mutée ne re-rend rien. Sans lui, le lecteur restait noir
  // entre son montage et la première image (cf. VideoPlayerOverlays).
  const [aDemarre, setADemarre] = useState(false);
  const sourceChangingRef = useRef(false);
  const currentTimeRef = useRef(0);
  const userInteractedRef = useRef(false);
  const waitingTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const seekTargetRef = useRef<number | null>(null);
  const seekStallTimer = useRef<ReturnType<typeof setInterval>>(undefined);

  const { loading, setLoading, showPlayButton, setShowPlayButton, policyMuted, setPolicyMuted } = useVideoSource({
    videoRef, src, isDirectPlay, streamOffset, useNativeHls, startPositionSeconds,
    effectiveOffsetRef, containerPtsOffsetRef, offsetDetectedRef,
    seekTargetRef, seekStallTimer, sourceChangingRef, hasStartedRef,
    lastKnownPositionRef, currentTimeRef, onSeekRequest, onDirectPlayNonFiable,
  });

  const { volume, handleVolumeChange, handleToggleMute } = usePlayerVolume({
    videoRef, onSonRetabli: () => setPolicyMuted(false),
  });
  // Le lecteur web ne met pas en pause pour chercher un passage (sa barre appelle
  // `onSeek` sans toucher à la lecture), il n'a donc rien à faire taire.
  const { flash: playbackFlash } = usePlaybackFlash(!playing, volume === 0);

  const currentTime = effectiveOffsetRef.current + displayTime;
  const duration = jellyfinDuration && jellyfinDuration > 0 ? jellyfinDuration : videoDuration;

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {}); else v.pause();
  }, []);

  // Vitesse de lecture. `defaultPlaybackRate` est posé EN PLUS de
  // `playbackRate` : la spec remet playbackRate à defaultPlaybackRate au
  // chargement de chaque nouvelle ressource, donc sans lui le taux choisi
  // serait perdu à la moindre reconstruction de source (changement de qualité,
  // repli CORS, seek qui relance le transcodage).
  const appliquerVitesse = useCallback((taux: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = taux;
    v.defaultPlaybackRate = taux;
  }, []);

  const { handleSeek, skipBy, skipFlash } = useSmartSeek({
    videoRef, containerPtsOffsetRef, seekTargetRef, seekStallTimer, currentTimeRef,
    src, isDirectPlay, streamOffset, onSeekRequest, onSeekComplete,
    signalerChargement: setLoading,
  });

  // ── L'arbitre partagé : boutons de saut, carte, affiche de fin — toutes les
  // décisions (fenêtres, priorités, décomptes, réglages) viennent de la
  // coquille commune aux six surfaces. ──
  const playback = usePlaybackOverlay({
    itemId,
    isEpisode: item?.Type === "Episode" && !!item.SeriesId,
    hasNextEpisode: !!hasNextEpisode,
    positionSeconds: currentTime,
    durationSeconds: duration,
    hasStarted: aDemarre,
    playbackEnded: ended,
    segments,
    runtimeMs,
    serverAutoplayEnabled,
    onSeekSeconds: handleSeek,
    onNextEpisode: () => onNextEpisode?.(),
    // Fin de lecture sans suite (film, dernier épisode) : retour à la fiche.
    onEndOfPlayback: () => { markPlayerExit(); navigate(`/media/${itemId}`, { replace: true }); },
    // Watch Together : le refus local part au groupe par le bus existant.
    onSegmentDismissNotify: () => annoncerRefusLocal(),
    onNextDismissNotify: onAutoNextDismiss,
  });

  // Watch Together entrant : un membre a refusé le saut d'intro — on s'aligne.
  const refusDistants = useRefusSautIntro();
  const refusVusRef = useRef(refusDistants);
  const { signalRemoteSegmentDismiss } = playback;
  useEffect(() => {
    if (refusDistants === refusVusRef.current) return;
    refusVusRef.current = refusDistants;
    signalRemoteSegmentDismiss("Intro");
  }, [refusDistants, signalRemoteSegmentDismiss]);

  // Fin de média sans écran de fin possible : retour fiche — l'équivalent de
  // l'ancienne navigation d'onEnded, décidée ici et plus dans les événements.
  useEffect(() => {
    if (!ended) return;
    if (hasNextEpisode && serverAutoplayEnabled) return;
    markPlayerExit();
    navigate(`/media/${itemId}`, { replace: true });
  }, [ended, hasNextEpisode, serverAutoplayEnabled, itemId, navigate]);
  useEffect(() => { setEnded(false); }, [src, itemId]);

  // Watch Together : surface de commande impérative pour le moteur de sync.
  // `wt:cancelAutoNext` = refus de carte distant, même sémantique que la croix.
  useWebTransport({
    transportRef, videoRef, lastKnownPositionRef, sourceChangingRef,
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
  const pistesTexte = useMemo(
    () => subtitleTracks.filter((t) => !BURN_IN_SUBTITLE_CODECS.test(t.codec ?? "")),
    [subtitleTracks],
  );
  useNativeMediaTracks({ videoRef, src, subtitleTracks: pistesTexte, currentSubtitle, audioTracks, currentAudio, isDirectPlay, surPisteIntrouvable });
  // VTT de la piste active, débarrassé du balisage ASS que Jellyfin laisse
  // fuiter dans le texte des cues (« {\an8} » affiché tel quel).
  const urlSousTitreAssaini = useSanitizedSubtitles({ pistes: pistesTexte, selection: currentSubtitle, src });

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
    offsetDetectedRef, sourceChangingRef, hasStartedRef, waitingTimer,
    src, itemId, startPositionSeconds, jellyfinDuration,
    setPlaying, setADemarre, setLoading, setShowPlayButton, setBuffered, setVideoDuration,
    onPlaybackEnded: () => setEnded(true),
    onProgress, onStarted, onPlayStateChange, onBufferingChange, onFatalError,
  });

  return (
    <div ref={containerRef} onMouseMove={scheduleHide}
      onClick={() => {
        userInteractedRef.current = true;
        const v = videoRef.current;
        if (policyMuted && v && !v.paused) { v.muted = false; setPolicyMuted(false); return; }
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
      <video ref={videoRef} className="h-full w-full" playsInline preload="auto"
        {...videoEvents}
      >
        {/* Tous les <track> restent montés, sélectionnés ou non : la
            correspondance index → textTracks de useNativeMediaTracks se fait
            par POSITION, en omettre un décalerait toutes les suivantes.
            Seule la piste active porte une `src` — le navigateur ne charge de
            toute façon que celle dont le `mode` n'est pas `disabled`, et
            l'attendre évite d'afficher une seconde le fichier brut. */}
        {pistesTexte.map((t) => (
          <track key={`${src}-${t.index}`} kind="subtitles" label={t.label}
            src={t.index === currentSubtitle ? (urlSousTitreAssaini ?? undefined) : undefined} />
        ))}
      </video>

      {/* Sous-titres image décodés ici plutôt qu'incrustés par le serveur —
          monté uniquement quand une piste PGS est active (règle GPU). */}
      {pgsSubtitleUrl && onPgsEchec && (
        <PgsSubtitleOverlay
          videoRef={videoRef} supUrl={pgsSubtitleUrl}
          timeOffsetRef={effectiveOffsetRef} onEchec={onPgsEchec}
        />
      )}

      <VideoPlayerOverlays
        loading={loading} playing={playing} aDemarre={aDemarre}
        showPlayButton={showPlayButton} policyMuted={policyMuted}
        posterUrl={posterUrl}
        overlay={playback.overlay} countdownTotals={playback.countdownTotals}
        onSkip={playback.skipNow} onDismissOverlay={playback.dismissOverlay}
        onPlayNow={playback.playNow}
        nextEpisodeTitle={nextEpisodeTitle} nextEpisodeDescription={nextEpisodeDescription}
        nextEpisodeImageUrl={nextEpisodeImageUrl} nextSeriesBackdropUrl={nextSeriesBackdropUrl}
        nextEpisodeThumbUrl={nextEpisodeThumbUrl}
        videoRef={videoRef} userInteractedRef={userInteractedRef}
        setShowPlayButton={setShowPlayButton} setPolicyMuted={setPolicyMuted}
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
          qualityPresets={qualityPresets}
          hasNextEpisode={hasNextEpisode} hasPreviousEpisode={hasPreviousEpisode}
          onTogglePlay={togglePlay} onSeek={handleSeek} onSkip={skipBy}
          onVolumeChange={handleVolumeChange} onToggleMute={handleToggleMute}
          onToggleFullscreen={toggleFullscreen} onBack={() => { markPlayerExit(); navigate(-1); }}
          onAudioChange={onAudioChange} onSubtitleChange={onSubtitleChange} onQualityChange={useNativeHls && !nativeHlsSupportsQualitySwitch() ? undefined : onQualityChange}
          onNextEpisode={onNextEpisode} onPreviousEpisode={onPreviousEpisode}
          applyToSeries={applyToSeries} onPlaybackRateChange={appliquerVitesse}
        />
      </div>

    </div>
  );
}
