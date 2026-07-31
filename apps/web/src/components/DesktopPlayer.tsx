import { useEffect, useRef, useState, useMemo } from "react";
import { SkipBadge } from "./SkipBadge";
import { PlaybackBadge } from "./PlaybackBadge";
import { usePlaybackFlash } from "../hooks/usePlaybackFlash";
import { useDesktopPlayerShortcuts } from "../hooks/useDesktopPlayerShortcuts";
import type { AudioTrack, SubtitleTrack } from "./VideoPlayer";
import { useDesktopPlayer } from "../hooks/useDesktopPlayer";
import { useDesktopMediaControls } from "../hooks/useDesktopMediaControls";
import { useMpvTrackSync } from "../hooks/useMpvTrackSync";
import { useLocalPlaybackTracks } from "../hooks/useLocalPlaybackTracks";
import { useMpvSource } from "../hooks/useMpvSource";
import { useDesktopAutoNext } from "../hooks/useDesktopAutoNext";
import { useDesktopTransport } from "../hooks/useDesktopTransport";
import { useDesktopSeekbar } from "../hooks/useDesktopSeekbar";
import { DesktopPlayerControls } from "./player/DesktopPlayerControls";
import { DesktopPlayerOverlays } from "./player/DesktopPlayerOverlays";
import { DesktopPlayerError, DesktopPlayerLoading } from "./player/DesktopPlayerFallback";
import { useControlsAutoHide } from "../hooks/useControlsAutoHide";
import { bordureVideo } from "../lib/ombreSurVideo";
import type { MediaItem, SegmentTimestamps, QualityKey, SourceQuality } from "@tentacle-tv/shared";
import type { LocalSubtitleFile } from "../downloads/playbackApi";
import type { PlayerTransportRef } from "../watchTogether/playerTransport";
import type { ApplyToSeriesControl } from "../hooks/useApplyToSeries";

/** Référence stable : une valeur par défaut inline relancerait les mémos. */
const EMPTY_SUBTITLE_FILES: LocalSubtitleFile[] = [];

interface DesktopPlayerProps {
  src: string; title: string; subtitle?: string;
  startPositionSeconds?: number; jellyfinDuration?: number;
  audioTracks?: AudioTrack[]; subtitleTracks?: SubtitleTrack[];
  currentAudio: number; currentSubtitle: number | null; currentQuality: QualityKey;
  sourceQuality?: SourceQuality;
  onAudioChange: (index: number) => void; onSubtitleChange: (index: number | null) => void;
  /** Absent en lecture locale : le sélecteur de qualité est alors masqué. */
  onQualityChange?: (key: QualityKey) => void;
  /** Lecture depuis un fichier local (masque la qualité, pistes via mpv). */
  isLocalPlayback?: boolean;
  /** Mode hors ligne (préférences de pistes résolues localement). */
  offline?: boolean;
  /** Bibliothèque de l'item local (préférences de pistes hors ligne). */
  localLibraryId?: string | null;
  /** Side-cars de sous-titres téléchargés (menus en lecture locale). */
  localSubtitleFiles?: LocalSubtitleFile[];
  onProgress?: (seconds: number, paused: boolean) => void; onStarted?: () => void;
  isDirectPlay?: boolean; streamOffset?: number; posterUrl?: string;
  introSegment?: SegmentTimestamps | null; creditsSegment?: SegmentTimestamps | null;
  hasNextEpisode?: boolean; hasPreviousEpisode?: boolean; nextEpisodeTitle?: string;
  nextEpisodeImageUrl?: string; nextEpisodeDescription?: string;
  nextSeriesBackdropUrl?: string; nextEpisodeThumbUrl?: string;
  /** Interrupteur admin « Déclenchement auto-play » (bannière + écran de fin). */
  autoplayNextEnabled?: boolean;
  /** Seuil (%) = MaxResumePct Jellyfin : la bannière apparaît à ce % de lecture. */
  maxResumePct?: number;
  itemId?: string;
  item?: MediaItem;
  mediaSourceId?: string;
  onNextEpisode?: () => void; onPreviousEpisode?: () => void; onFallbackToWeb?: () => void;
  /** Watch Together — surface de commande impérative (play/pause/seek/speed). */
  transportRef?: PlayerTransportRef;
  /** Watch Together — transition lecture/pause observée (état mpv). */
  onPlayStateChange?: (paused: boolean) => void;
  /** Watch Together — buffering mpv (paused-for-cache) + premier « prêt ». */
  onBufferingChange?: (buffering: boolean) => void;
  /** Watch Together — seek local détecté (saut de position discontinu). */
  onSeekComplete?: (seconds: number, paused: boolean) => void;
  /** Watch Together — l'utilisateur a masqué la bannière auto-next (à propager). */
  onAutoNextDismiss?: () => void;
  /** Visibilité de l'overlay lecteur (contrôles) — synchronise les overlays externes. */
  onControlsVisibilityChange?: (visible: boolean) => void;
  /** Épisode : case « Appliquer à cette série » (préférence de langues). */
  applyToSeries?: ApplyToSeriesControl;
}

export function DesktopPlayer({
  src, title, subtitle, startPositionSeconds, jellyfinDuration,
  audioTracks = [], subtitleTracks = [],
  currentAudio, currentSubtitle, currentQuality, sourceQuality,
  onAudioChange, onSubtitleChange, onQualityChange,
  isLocalPlayback = false, offline = false, localLibraryId = null,
  localSubtitleFiles = EMPTY_SUBTITLE_FILES,
  onProgress, onStarted,
  isDirectPlay = true, streamOffset = 0, posterUrl,
  introSegment, creditsSegment,
  hasNextEpisode, hasPreviousEpisode, nextEpisodeTitle,
  nextEpisodeImageUrl, nextEpisodeDescription,
  nextSeriesBackdropUrl, nextEpisodeThumbUrl,
  autoplayNextEnabled = true, maxResumePct = 90,
  itemId, item, mediaSourceId,
  onNextEpisode, onPreviousEpisode, onFallbackToWeb,
  transportRef, onPlayStateChange, onBufferingChange, onSeekComplete, onAutoNextDismiss,
  onControlsVisibilityChange, applyToSeries,
}: DesktopPlayerProps) {
  const { state, ready, fileLoaded, mediaReady, error, play, togglePause, setPause, seek, seekRelative,
    setAudioTrack, setSubtitleTrack, addSubtitle, setVolume, setSpeed, toggleMute, toggleFullscreen } = useDesktopPlayer();
  const { showControls, scheduleHide } = useControlsAutoHide(!state.paused);
  // Overlays externes (avatars Watch Together…) alignés sur l'overlay lecteur.
  useEffect(() => { onControlsVisibilityChange?.(showControls); }, [showControls, onControlsVisibilityChange]);
  const [showSettings, setShowSettings] = useState(false);
  const [showEpisodes, setShowEpisodes] = useState(false);
  const isEpisode = item?.Type === "Episode" && !!item.SeriesId;
  const hasStartedRef = useRef(false);
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

  // Chargement de la source + détection PTS + report de progression
  const { sourceChanging } = useMpvSource({
    state, ready, fileLoaded, src, startPositionSeconds, isDirectPlay, streamOffset,
    play, onStarted, onProgress, onSeekComplete,
    lastAbsolutePosRef, effectiveMpvOffset, offsetDetectedForSrc, prevSrcRef,
    hasStartedRef, loadedExternalSubs,
  });

  // Badge central, déclaré APRÈS `useMpvSource` : un rechargement de source fait
  // repasser mpv par la pause, et `inerte` empêche d'en faire un badge.
  const { flash: playbackFlash, ignorerProchaineBascule } = usePlaybackFlash(
    state.paused,
    state.muted || state.volume === 0,
    sourceChanging,
  );

  // Auto-next (bannière crédits / affiche EOF) + navigations de sortie
  const { autoPlayCountdown, autoPlaySource, cancelAutoPlay, goBack } = useDesktopAutoNext({
    state, fileLoaded, itemId, jellyfinDuration, autoplayNextEnabled, maxResumePct,
    hasNextEpisode, onNextEpisode, hasStartedRef, effectiveMpvOffset,
  });

  // Watch Together : transport impératif + signaux prêt/buffering/pause
  useDesktopTransport({
    transportRef, state, mediaReady, isDirectPlay,
    lastAbsolutePosRef, effectiveMpvOffset,
    setPause, seek, setSpeed, cancelAutoPlay,
    onPlayStateChange, onBufferingChange,
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
    ignorerProchaineBascule,
  });

  const actualPos = state.position + effectiveMpvOffset.current;
  const displayProgress = seekbar.dragProgress ?? (dur > 0 ? actualPos / dur : 0);
  const bufProg = dur > 0 ? Math.min((actualPos + state.buffered) / dur, 1) : 0;
  const hasSettings = displayAudio.length > 0 || displaySubs.length > 0 || !!onQualityChange;

  // Skip intro / credits segments
  const showSkipIntro = introSegment && actualPos >= introSegment.start && actualPos < introSegment.end - 1;
  const showSkipCredits = creditsSegment && actualPos >= creditsSegment.start && actualPos < creditsSegment.end - 1;

  // Show loading overlay: initial load OR source change (quality/audio switch).
  // Sécurité anti-spinner-éternel : dès que mpv a une position > 0 (donc lit
  // réellement quelque chose), on masque l'overlay même si l'event "playing"
  // a été perdu (cas observé sur certaines configs Windows + EAC3 5.1).
  const showLoadingOverlay = state.position > 0
    ? false
    : sourceChanging || (!state.playing && !hasStartedRef.current);

  // Pas encore d'image : le repli occupe seul l'écran (cf. DesktopPlayerFallback).
  if (error && onFallbackToWeb) { onFallbackToWeb(); return null; }
  if (error) return <DesktopPlayerError error={error} onBack={goBack} />;
  if (!ready) return <DesktopPlayerLoading posterUrl={posterUrl} />;

  return (
    // cursor-none : souris immobile → l'OSD se cache ET le curseur disparaît (revient au moindre mouvement).
    <div onMouseMove={scheduleHide} className={`relative flex h-screen w-screen items-center justify-center ${showControls ? "" : "cursor-none"}`} style={{ background: "transparent", boxShadow: bordureVideo(state.fullscreen) }}>
      {/* Click catcher — toggle pause / fullscreen on video area */}
      <div className="absolute inset-0" onClick={() => { togglePause(); setShowSettings(false); setShowEpisodes(false); }} onDoubleClick={() => toggleFullscreen()} />

      <DesktopPlayerOverlays
        showLoadingOverlay={showLoadingOverlay} buffering={state.buffering} posterUrl={posterUrl}
        showSkipIntro={showSkipIntro} showSkipCredits={showSkipCredits}
        introSegment={introSegment} creditsSegment={creditsSegment}
        isDirectPlay={isDirectPlay} effectiveMpvOffset={effectiveMpvOffset}
        hasNextEpisode={hasNextEpisode} itemId={itemId}
        autoPlayCountdown={autoPlayCountdown} autoPlaySource={autoPlaySource}
        nextEpisodeTitle={nextEpisodeTitle} nextEpisodeDescription={nextEpisodeDescription}
        nextEpisodeImageUrl={nextEpisodeImageUrl} nextSeriesBackdropUrl={nextSeriesBackdropUrl}
        nextEpisodeThumbUrl={nextEpisodeThumbUrl}
        seek={seek} onNextEpisode={onNextEpisode}
        cancelAutoPlay={cancelAutoPlay} onAutoNextDismiss={onAutoNextDismiss}
      />

      {/* Badge « +30s / −10s » après un saut */}
      <SkipBadge flash={skipFlash} />

      {/* Et son pendant à chaque bascule lecture/pause, d'où qu'elle vienne —
          barre d'espace, bouton, télécommande média. */}
      <PlaybackBadge flash={playbackFlash} />

      <DesktopPlayerControls
        visible={showControls} state={state} title={title} subtitle={subtitle}
        isDirectPlay={isDirectPlay} isEpisode={isEpisode} item={item}
        useLocalEpisodes={offline}
        displayAudio={displayAudio} displaySubs={displaySubs}
        // L'état REACT fait foi pour la surbrillance du sélecteur, pas celui de
        // mpv : ses mises à jour passent par l'IPC, donc elles arrivent après —
        // le menu montrait brièvement la piste précédente.
        curAudio={currentAudio} curSub={currentSubtitle}
        currentQuality={currentQuality} sourceQuality={sourceQuality}
        hasSettings={hasSettings} hasNextEpisode={hasNextEpisode} hasPreviousEpisode={hasPreviousEpisode}
        dur={dur} actualPos={actualPos} displayProgress={displayProgress} bufProg={bufProg}
        seekbar={seekbar}
        showSettings={showSettings} showEpisodes={showEpisodes}
        setShowSettings={setShowSettings} setShowEpisodes={setShowEpisodes}
        closePanels={{ settings: () => setShowSettings(false), episodes: () => setShowEpisodes(false) }}
        goBack={goBack} togglePause={togglePause} skipBy={skipBy}
        toggleMute={toggleMute} setVolume={setVolume} toggleFullscreen={toggleFullscreen}
        handleAudioChange={handleAudioChange} handleSubtitleChange={handleSubtitleChange}
        onQualityChange={onQualityChange} applyToSeries={applyToSeries}
        onNextEpisode={onNextEpisode} onPreviousEpisode={onPreviousEpisode}
      />
    </div>
  );
}
