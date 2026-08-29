import { useEffect, useRef, useState, useMemo } from "react";
import { SkipBadge } from "./SkipBadge";
import { PlaybackBadge } from "./PlaybackBadge";
import { useMpvPrebuffer } from "../hooks/useMpvPrebuffer";
import { usePlaybackFlash } from "../hooks/usePlaybackFlash";
import { useDesktopPlayerShortcuts } from "../hooks/useDesktopPlayerShortcuts";
import { useDesktopPlayer } from "../hooks/useDesktopPlayer";
import { useLocalMediaProbe } from "../hooks/useLocalMediaProbe";
import { useDesktopMediaControls } from "../hooks/useDesktopMediaControls";
import { useMpvTrackSync } from "../hooks/useMpvTrackSync";
import { useLocalPlaybackTracks } from "../hooks/useLocalPlaybackTracks";
import { useMpvSource } from "../hooks/useMpvSource";
import { useDesktopPlayerExit } from "../hooks/useDesktopPlayerExit";
import { useDesktopSegmentsOverlay } from "../hooks/useDesktopSegmentsOverlay";
import { useWaylandFullscreenNotice } from "../hooks/useWaylandFullscreenNotice";
import { useDesktopTransport } from "../hooks/useDesktopTransport";
import { useDesktopSeekbar } from "../hooks/useDesktopSeekbar";
import { DesktopPlayerControls } from "./player/DesktopPlayerControls";
import { DesktopPlayerOverlays } from "./player/DesktopPlayerOverlays";
import { DesktopPlayerError, DesktopPlayerLoading } from "./player/DesktopPlayerFallback";
import { useControlsAutoHide } from "../hooks/useControlsAutoHide";
import { EMPTY_SUBTITLE_FILES, type DesktopPlayerProps } from "./player/desktopPlayer.types";

export function DesktopPlayer({
  src, title, subtitle, startPositionSeconds, jellyfinDuration,
  audioTracks = [], subtitleTracks = [],
  currentAudio, currentSubtitle, currentQuality, sourceQuality, qualityPresets,
  onAudioChange, onSubtitleChange, onQualityChange,
  isLocalPlayback = false, offline = false, localLibraryId = null,
  localSubtitleFiles = EMPTY_SUBTITLE_FILES,
  onProgress, onStarted,
  isDirectPlay = true, streamOffset = 0, posterUrl,
  segments = [], runtimeMs = 0, libraryId = null,
  hasNextEpisode, hasPreviousEpisode, nextEpisodeTitle,
  nextEpisodeImageUrl, nextEpisodeDescription,
  nextSeriesBackdropUrl, nextEpisodeThumbUrl,
  serverAutoplayEnabled = true,
  itemId, item, mediaSourceId,
  onNextEpisode, onPreviousEpisode, onFallbackToWeb, onMediaMissing,
  transportRef, onPlayStateChange, onBufferingChange, onSeekComplete, onAutoNextDismiss,
  onControlsVisibilityChange, applyToSeries,
}: DesktopPlayerProps) {
  // Sonde d'existence du fichier local — le discriminant média/lecteur d'un
  // échec de chargement (voir playbackFailure.ts). Absente hors lecture locale.
  const probeLocalMedia = useLocalMediaProbe({ isLocalPlayback, itemId });
  const { state, ready, fileLoaded, mediaReady, failure, play, togglePause, setPause, seek, seekRelative,
    setAudioTrack, setSubtitleTrack, addSubtitle, setVolume, setSpeed, toggleMute, toggleFullscreen } = useDesktopPlayer({ probeLocalMedia });
  const { showControls, scheduleHide } = useControlsAutoHide(!state.paused);
  // Overlays externes (avatars Watch Together…) alignés sur l'overlay lecteur.
  useEffect(() => { onControlsVisibilityChange?.(showControls); }, [showControls, onControlsVisibilityChange]);
  const [showSettings, setShowSettings] = useState(false);
  const [showEpisodes, setShowEpisodes] = useState(false);
  const isEpisode = item?.Type === "Episode" && !!item.SeriesId;
  const hasStartedRef = useRef(false);
  // `hasStartedRef` est écrit par useMpvSource (contrat existant) ; ce MIROIR
  // réactif garantit que l'arbitre et l'écran de chargement voient le
  // démarrage à l'instant même — une ref seule dépendait d'un re-rendu
  // fortuit (bug latent, corrigé en parité avec `hasStarted` de VideoPlayer).
  const [hasStarted, setHasStarted] = useState(false);
  const prevSrcRef = useRef("");
  // Pistes externes déjà sub-add sur la source courante : jfIndex → sid mpv.
  const loadedExternalSubs = useRef<Map<number, number>>(new Map());
  // Absolute position ref — survives across direct play ↔ transcode transitions
  const lastAbsolutePosRef = useRef(0);
  // PTS detection: mpv may report absolute PTS (offset baked into HLS) or relative PTS.
  // effectiveMpvOffset is 0 when absolute (no correction needed), or streamOffset when relative.
  const effectiveMpvOffset = useRef(0);
  const offsetDetectedForSrc = useRef("");
  const fullscreenRef = useRef(state.fullscreen);
  fullscreenRef.current = state.fullscreen;

  // MPV tracks split by type
  const mpvAudio = useMemo(() => state.tracks.filter((t) => t.type === "audio"), [state.tracks]);
  const mpvSubs = useMemo(() => state.tracks.filter((t) => t.type === "sub"), [state.tracks]);

  // ── Pistes affichées : DTO Jellyfin (labels riches) en ligne, ou track-list
  // mpv du fichier local hors ligne (le DTO n'existe alors pas). Les
  // préférences de langue hors ligne sont remontées via onAudioChange/
  // onSubtitleChange — même pipeline d'application que le online. ──
  const { displayAudio, displaySubs } = useLocalPlaybackTracks({
    isLocalPlayback, fileLoaded, ready,
    audioTracks, subtitleTracks, mpvAudio, mpvSubs, localSubtitleFiles,
    localLibraryId, itemId: item?.Id, onAudioChange, onSubtitleChange, sourceKey: src,
  });

  // Handlers + application des préférences de pistes audio/sous-titres.
  // useMpvTrackSync reçoit les pistes AFFICHÉES (DTO ou fallback mpv) pour que
  // clics manuels et application de préférence partagent la même source.
  const { handleAudioChange, handleSubtitleChange } = useMpvTrackSync({
    state, ready, fileLoaded, isDirectPlay,
    audioTracks: displayAudio, subtitleTracks: displaySubs, mpvAudio, mpvSubs,
    currentAudio, currentSubtitle,
    setAudioTrack, setSubtitleTrack, addSubtitle,
    onAudioChange, onSubtitleChange, loadedExternalSubs,
  });

  // Fond de page transparent PENDANT LA LECTURE — et seulement une fois la
  // surface native prête (`ready` est posé au retour de mpv_init, qui vient
  // justement de rendre la webview transparente).
  //
  // L'ordre compte désormais : hors lecture, la webview macOS est OPAQUE
  // (cf. macos/window_opacity.rs — une fenêtre transparente coûtait une
  // recomposition alpha permanente). Rendre la page transparente avant la
  // bascule native laisserait voir, le temps d'une image ou deux, le fond de
  // base blanc de WebKit. À la sortie c'est l'inverse : le nettoyage React
  // rend la page opaque de façon synchrone, la webview repasse en opaque
  // juste après (mpv_destroy) — jamais de fenêtre de temps où les deux sont
  // transparents.
  useEffect(() => {
    if (!ready) return;
    const prev = document.body.style.background;
    document.body.style.background = "transparent";
    document.documentElement.style.background = "transparent";
    return () => { document.body.style.background = prev; document.documentElement.style.background = ""; };
  }, [ready]);

  // Pédagogie du plein écran Wayland (une fois, et seulement où il est imposé).
  useWaylandFullscreenNotice(ready);

  // Chargement de la source + détection PTS + report de progression
  const { sourceChanging } = useMpvSource({
    state, ready, fileLoaded, src, startPositionSeconds, isDirectPlay, streamOffset,
    play, onStarted, onProgress, onSeekComplete,
    lastAbsolutePosRef, effectiveMpvOffset, offsetDetectedForSrc, prevSrcRef,
    hasStartedRef, loadedExternalSubs,
    // Pour poser les pistes AVANT l'ouverture du fichier (cf. useMpvSource) —
    // jamais en lecture locale, où les pistes réelles ne sont connues qu'après.
    audioTracks, subtitleTracks, currentAudio, currentSubtitle, isLocalPlayback,
  });

  // Le miroir réactif du démarrage — armé dès que useMpvSource a posé la ref,
  // au premier battement de position ; réarmé à chaque nouvelle source.
  useEffect(() => { setHasStarted(false); }, [src]);
  useEffect(() => {
    if (!hasStarted && hasStartedRef.current) setHasStarted(true);
  }, [hasStarted, state.position, state.playing]);

  // Badge central, déclaré APRÈS `useMpvSource` : un rechargement de source fait
  // repasser mpv par la pause, et `inerte` empêche d'en faire un badge.
  const { flash: playbackFlash, ignoreNextToggle } = usePlaybackFlash(
    state.paused,
    state.muted || state.volume === 0,
    sourceChanging,
  );

  // Sorties du lecteur (retour, fiche, fermeture de session plein écran) —
  // le moteur d'enchaînement, lui, vit dans l'arbitre partagé (plus bas).
  const { goBack, goToDetail } = useDesktopPlayerExit({
    state, fileLoaded, itemId, hasNextEpisode, serverAutoplayEnabled, hasStartedRef,
  });

  // Touches média du système, incrustation de volume, Stream Deck (SMTC).
  useDesktopMediaControls({
    title, subtitle, posterUrl, paused: state.paused,
    togglePause, setPause, goBack,
    onNext: onNextEpisode, onPrevious: onPreviousEpisode,
    hasNext: hasNextEpisode, hasPrevious: hasPreviousEpisode,
  });

  // Raccourcis clavier + badge « +30s / −10s » (extrait — cf. hook dédié).
  const { skipFlash, skipBy } = useDesktopPlayerShortcuts({
    seekRelative, togglePause, goBack, toggleFullscreen, fullscreenRef,
    hasNextEpisode, hasPreviousEpisode, onNextEpisode, onPreviousEpisode,
  });

  const dur = jellyfinDuration && jellyfinDuration > 0 ? jellyfinDuration : state.duration;

  // Scrub + hover + trickplay de la seekbar (local d'abord en lecture locale)
  const seekbar = useDesktopSeekbar({
    dur, paused: state.paused, isDirectPlay, item, mediaSourceId,
    localItemId: isLocalPlayback ? itemId : undefined,
    effectiveMpvOffset, seek, setPause,
    // La pause du glissement n'est pas celle de l'utilisateur : aucun badge.
    ignoreNextToggle,
  });

  const actualPos = state.position + effectiveMpvOffset.current;
  const displayProgress = seekbar.dragProgress ?? (dur > 0 ? actualPos / dur : 0);
  const bufProg = dur > 0 ? Math.min((actualPos + state.buffered) / dur, 1) : 0;
  const hasSettings = displayAudio.length > 0 || displaySubs.length > 0 || !!onQualityChange;

  // ── L'arbitre partagé : boutons de saut, carte, affiche de fin — toutes les
  // décisions (fenêtres, priorités, décomptes, réglages) viennent de la
  // coquille commune aux six surfaces (Watch Together câblé dans le hook). ──
  const playback = useDesktopSegmentsOverlay({
    itemId, isEpisode, hasNextEpisode,
    positionSeconds: actualPos, durationSeconds: dur,
    hasStarted: hasStarted, playbackEnded: fileLoaded && state.eof && hasStarted,
    segments, runtimeMs, libraryId, serverAutoplayEnabled,
    scrubbing: seekbar.dragProgress != null,
    controlsVisible: showControls,
    isDirectPlay, effectiveMpvOffset, seek,
    onNextEpisode, onEndOfPlayback: () => { void goToDetail(); },
    onAutoNextDismiss,
  });

  // Watch Together : transport impératif + signaux prêt/buffering/pause.
  // `wt:cancelAutoNext` = un membre a refusé l'enchaînement — même sémantique
  // que la croix locale, sans ré-annonce au groupe.
  useDesktopTransport({
    transportRef, state, mediaReady, isDirectPlay,
    lastAbsolutePosRef, effectiveMpvOffset,
    setPause, seek, setSpeed,
    cancelAutoPlay: playback.signalRemoteNextDismiss,
    onPlayStateChange, onBufferingChange,
  });

  // Show loading overlay: initial load OR source change (quality/audio switch).
  // Sécurité anti-spinner-éternel : mpv qui lit sans le dire (event "playing"
  // perdu — configs Windows + EAC3 5.1). Le signe, c'est une position qui
  // AVANCE : `position > 0` ne le prouve pas, time-pos valant déjà la position
  // de départ dès l'ouverture du fichier sur une REPRISE.
  const startPosRef = useRef<number | null>(null);
  if (startPosRef.current === null && state.position > 0) startPosRef.current = state.position;
  const playbackStarted = startPosRef.current !== null && state.position > startPosRef.current + 0.25;
  // Réserve constituée avant de lancer l'image, l'écran de chargement couvrant
  // l'attente : un seul chargement, et il ne recommence pas derrière.
  const prebuffering = useMpvPrebuffer({ mediaReady, buffered: state.buffered, eof: state.eof, setPause });
  const showLoadingOverlay = prebuffering || (playbackStarted
    ? false
    : sourceChanging || (!state.playing && !hasStarted));

  // La bascule de secours est un setState du PARENT : elle part d'un effet,
  // jamais du rendu — React tolérait l'appel en place mais l'interdit en mode
  // strict (« setState during render »). L'erreur de MÉDIA prend sa propre
  // porte : écran dédié chez le parent, mpv épargné.
  useEffect(() => {
    if (!failure) return;
    if (failure.kind === "media" && onMediaMissing) { onMediaMissing(); return; }
    if (onFallbackToWeb) onFallbackToWeb();
  }, [failure, onFallbackToWeb, onMediaMissing]);

  // Pas encore d'image : le repli occupe seul l'écran (cf. DesktopPlayerFallback).
  if (failure && (failure.kind === "media" ? onMediaMissing : onFallbackToWeb)) return null;
  if (failure) return <DesktopPlayerError failure={failure} onBack={goBack} />;
  if (!ready) return <DesktopPlayerLoading posterUrl={posterUrl} />;

  return (
    // cursor-none : souris immobile → l'OSD se cache ET le curseur disparaît (revient au moindre mouvement).
    <div onMouseMove={scheduleHide} className={`relative flex h-screen w-screen items-center justify-center ${showControls ? "" : "cursor-none"}`} style={{ background: "transparent" }}>
      {/* Click catcher — toggle pause / fullscreen on video area */}
      <div className="absolute inset-0" onClick={() => { togglePause(); setShowSettings(false); setShowEpisodes(false); }} onDoubleClick={() => toggleFullscreen()} />

      <DesktopPlayerOverlays
        showLoadingOverlay={showLoadingOverlay} buffering={state.buffering}
        buffered={state.buffered} posterUrl={posterUrl}
        overlay={playback.overlay} countdownTotals={playback.countdownTotals}
        onSkip={playback.skipNow} onDismissOverlay={playback.dismissOverlay}
        onPlayNow={playback.playNow} controlsVisible={showControls}
        nextEpisodeTitle={nextEpisodeTitle} nextEpisodeDescription={nextEpisodeDescription}
        nextEpisodeImageUrl={nextEpisodeImageUrl} nextSeriesBackdropUrl={nextSeriesBackdropUrl}
        nextEpisodeThumbUrl={nextEpisodeThumbUrl}
      />

      {/* Badge « +30s / −10s » après un saut */}
      <SkipBadge flash={skipFlash} />

      {/* Et son pendant à chaque bascule lecture/pause, d'où qu'elle vienne —
          barre d'espace, bouton, télécommande média. */}
      <PlaybackBadge flash={playbackFlash} />

      <DesktopPlayerControls
        visible={showControls} state={state} title={title} subtitle={subtitle}
        isDirectPlay={isDirectPlay} isEpisode={isEpisode} item={item} itemId={itemId}
        useLocalEpisodes={offline}
        displayAudio={displayAudio} displaySubs={displaySubs}
        // L'état REACT fait foi pour la surbrillance du sélecteur, pas celui de
        // mpv : ses mises à jour passent par l'IPC, donc elles arrivent après —
        // le menu montrait brièvement la piste précédente.
        curAudio={currentAudio} curSub={currentSubtitle}
        currentQuality={currentQuality} sourceQuality={sourceQuality} qualityPresets={qualityPresets}
        hasSettings={hasSettings} hasNextEpisode={hasNextEpisode} hasPreviousEpisode={hasPreviousEpisode}
        dur={dur} actualPos={actualPos} displayProgress={displayProgress} bufProg={bufProg}
        seekbar={seekbar}
        showSettings={showSettings} showEpisodes={showEpisodes}
        setShowSettings={setShowSettings} setShowEpisodes={setShowEpisodes}
        closePanels={{ settings: () => setShowSettings(false), episodes: () => setShowEpisodes(false) }}
        goBack={goBack} togglePause={togglePause} skipBy={skipBy}
        toggleMute={toggleMute} setVolume={setVolume} setSpeed={setSpeed} toggleFullscreen={toggleFullscreen}
        handleAudioChange={handleAudioChange} handleSubtitleChange={handleSubtitleChange}
        onQualityChange={onQualityChange} applyToSeries={applyToSeries}
        onNextEpisode={onNextEpisode} onPreviousEpisode={onPreviousEpisode}
      />
    </div>
  );
}
