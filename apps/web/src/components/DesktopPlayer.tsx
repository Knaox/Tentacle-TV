import { useEffect, useCallback, useRef, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { SkipBadge, type SkipFlash } from "./SkipBadge";
import type { AudioTrack, SubtitleTrack } from "./VideoPlayer";
import { useDesktopPlayer } from "../hooks/useDesktopPlayer";
import { useSmtc } from "../hooks/useSmtc";
import { useMpvTrackSync } from "../hooks/useMpvTrackSync";
import { useMpvSource } from "../hooks/useMpvSource";
import { useDesktopAutoNext } from "../hooks/useDesktopAutoNext";
import { useDesktopTransport } from "../hooks/useDesktopTransport";
import { useDesktopSeekbar } from "../hooks/useDesktopSeekbar";
import { DesktopPlayerControls } from "./player/DesktopPlayerControls";
import { DesktopPlayerOverlays } from "./player/DesktopPlayerOverlays";
import { isChatActive } from "../watchTogether/chat/chatUiStore";
import type { MediaItem, SegmentTimestamps, QualityKey, SourceQuality } from "@tentacle-tv/shared";
import type { PlayerTransportRef } from "../watchTogether/playerTransport";
import type { ApplyToSeriesControl } from "../hooks/useApplyToSeries";

interface DesktopPlayerProps {
  src: string; title: string; subtitle?: string;
  startPositionSeconds?: number; jellyfinDuration?: number;
  audioTracks?: AudioTrack[]; subtitleTracks?: SubtitleTrack[];
  currentAudio: number; currentSubtitle: number | null; currentQuality: QualityKey;
  sourceQuality?: SourceQuality;
  onAudioChange: (index: number) => void; onSubtitleChange: (index: number | null) => void;
  onQualityChange: (key: QualityKey) => void;
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
  const { t } = useTranslation("player");
  const { state, ready, fileLoaded, mediaReady, error, play, togglePause, setPause, seek, seekRelative,
    setAudioTrack, setSubtitleTrack, addSubtitle, setVolume, setSpeed, toggleMute, toggleFullscreen } = useDesktopPlayer();
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [showControls, setShowControls] = useState(true);
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

  // ── Always show Jellyfin tracks in selector (better labels, consistent) ──
  const displayAudio = audioTracks;
  const displaySubs = subtitleTracks;

  // Handlers + application des préférences de pistes audio/sous-titres
  const { handleAudioChange, handleSubtitleChange } = useMpvTrackSync({
    state, ready, fileLoaded, isDirectPlay,
    audioTracks, subtitleTracks, mpvAudio, mpvSubs,
    currentAudio, currentSubtitle,
    setAudioTrack, setSubtitleTrack, addSubtitle,
    onAudioChange, onSubtitleChange, loadedExternalSubs,
  });

  useEffect(() => {
    const prev = document.body.style.background;
    document.body.style.background = "transparent";
    document.documentElement.style.background = "transparent";
    return () => { document.body.style.background = prev; document.documentElement.style.background = ""; };
  }, []);

  // Chargement de la source + détection PTS + report de progression
  const { sourceChanging } = useMpvSource({
    state, ready, fileLoaded, src, startPositionSeconds, isDirectPlay, streamOffset,
    play, onStarted, onProgress, onSeekComplete,
    lastAbsolutePosRef, effectiveMpvOffset, offsetDetectedForSrc, prevSrcRef,
    hasStartedRef, loadedExternalSubs,
  });

  // Auto-next (bannière crédits / affiche EOF) + navigations de sortie
  const { autoPlayCountdown, autoPlaySource, cancelAutoPlay, goBack } = useDesktopAutoNext({
    state, fileLoaded, itemId, jellyfinDuration, autoplayNextEnabled, maxResumePct,
    hasNextEpisode, onNextEpisode, hasStartedRef, effectiveMpvOffset, fullscreenRef,
  });

  // Watch Together : transport impératif + signaux prêt/buffering/pause
  useDesktopTransport({
    transportRef, state, mediaReady, isDirectPlay,
    lastAbsolutePosRef, effectiveMpvOffset,
    setPause, seek, setSpeed, cancelAutoPlay,
    onPlayStateChange, onBufferingChange,
  });

  const scheduleHide = useCallback(() => {
    clearTimeout(hideTimer.current);
    setShowControls(true);
    // Watch Together : jamais de masquage pendant une interaction avec le chat
    // (portail hors conteneur — ses événements n'atteignent pas ce onMouseMove).
    // Re-vérifie chaque seconde ; à la fin de l'interaction, contrôles ET chat
    // s'estompent ensemble.
    const attemptHide = () => {
      if (isChatActive()) { hideTimer.current = setTimeout(attemptHide, 1000); return; }
      if (!state.paused) setShowControls(false);
    };
    hideTimer.current = setTimeout(attemptHide, 3000);
  }, [state.paused]);

  // Contrôles média système Windows (SMTC) : touches média + overlay + Stream Deck.
  useSmtc({
    title,
    artist: subtitle,
    cover: posterUrl,
    paused: state.paused,
    onToggle: togglePause,
    onPlay: () => setPause(false),
    onPause: () => setPause(true),
    onStop: goBack,
    onNext: hasNextEpisode ? onNextEpisode : undefined,
    onPrevious: hasPreviousEpisode ? onPreviousEpisode : undefined,
  });

  // Badge « +30s / −10s » à chaque saut (boutons, flèches clavier)
  const [skipFlash, setSkipFlash] = useState<SkipFlash | null>(null);
  const skipFlashTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(skipFlashTimer.current), []);
  const skipAccumRef = useRef(0);
  const skipBy = useCallback((delta: number) => {
    seekRelative(delta);
    // Appuis rapides dans le MÊME sens → cumul de l'affichage (+30 → +60 → +90),
    // façon TV/Netflix. mpv coalesce déjà les seeks relatifs, on ne cumule donc
    // que le badge. Reset au changement de sens ou après 1,5 s d'inactivité.
    const sameDir = skipAccumRef.current !== 0 && Math.sign(delta) === Math.sign(skipAccumRef.current);
    skipAccumRef.current = sameDir ? skipAccumRef.current + delta : delta;
    setSkipFlash({ delta: skipAccumRef.current, id: Date.now() });
    clearTimeout(skipFlashTimer.current);
    skipFlashTimer.current = setTimeout(() => { skipAccumRef.current = 0; setSkipFlash(null); }, 1500);
  }, [seekRelative]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") { e.preventDefault(); togglePause(); }
      if (e.code === "Escape") {
        if (fullscreenRef.current) toggleFullscreen();
        else goBack();
      }
      if (e.code === "ArrowRight") skipBy(30);
      if (e.code === "ArrowLeft") skipBy(-10);
      if (e.code === "KeyF") toggleFullscreen();
      if (e.code === "KeyN" && hasNextEpisode) onNextEpisode?.();
      if (e.code === "KeyP" && hasPreviousEpisode) onPreviousEpisode?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePause, goBack, skipBy, toggleFullscreen, hasNextEpisode, hasPreviousEpisode, onNextEpisode, onPreviousEpisode]);

  const dur = jellyfinDuration && jellyfinDuration > 0 ? jellyfinDuration : state.duration;

  // Scrub + hover + trickplay de la seekbar
  const seekbar = useDesktopSeekbar({
    dur, paused: state.paused, isDirectPlay, item, mediaSourceId, effectiveMpvOffset, seek, setPause,
  });

  const actualPos = state.position + effectiveMpvOffset.current;
  const displayProgress = seekbar.dragProgress ?? (dur > 0 ? actualPos / dur : 0);
  const bufProg = dur > 0 ? Math.min((actualPos + state.buffered) / dur, 1) : 0;
  const hasSettings = displayAudio.length > 0 || displaySubs.length > 0 || !!onQualityChange;

  // Map MPV state back to Jellyfin indices for the selector highlight.
  // Use React state (currentAudio/currentSubtitle) as source of truth — mpv state
  // updates are async (Tauri IPC delay) and would show stale values briefly.
  const curAudio = currentAudio;
  const curSub = currentSubtitle;

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

  if (error && onFallbackToWeb) { onFallbackToWeb(); return null; }
  if (error) return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-black">
      <p className="text-lg text-red-400">{t("player:mpvError", { error })}</p>
      <button onClick={() => goBack()} className="rounded-lg h-11 px-5 bg-white text-black font-bold hover:bg-white/90" style={{ boxShadow: "0 8px 22px rgba(var(--brand-rgb), 0.45)" }}>{t("common:back")}</button>
    </div>
  );
  if (!ready) return (
    <div className="relative flex h-screen w-screen items-center justify-center bg-black">
      {posterUrl && <img src={posterUrl} className="absolute inset-0 h-full w-full object-cover" alt="" />}
      <div className="absolute inset-0 flex items-center justify-center bg-black/60">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-tentacle-accent border-t-transparent" />
      </div>
    </div>
  );

  return (
    // cursor-none : souris immobile → l'OSD se cache ET le curseur disparaît (revient au moindre mouvement).
    <div onMouseMove={scheduleHide} className={`relative flex h-screen w-screen items-center justify-center ${showControls ? "" : "cursor-none"}`} style={{ background: "transparent" }}>
      {/* Click catcher — toggle pause / fullscreen on video area */}
      <div className="absolute inset-0" onClick={() => { togglePause(); setShowSettings(false); setShowEpisodes(false); }} onDoubleClick={() => toggleFullscreen()} />

      <DesktopPlayerOverlays
        showLoadingOverlay={showLoadingOverlay} buffering={state.buffering} posterUrl={posterUrl}
        showSkipIntro={showSkipIntro} showSkipCredits={showSkipCredits}
        introSegment={introSegment} creditsSegment={creditsSegment}
        isDirectPlay={isDirectPlay} effectiveMpvOffset={effectiveMpvOffset}
        hasNextEpisode={hasNextEpisode}
        autoPlayCountdown={autoPlayCountdown} autoPlaySource={autoPlaySource}
        nextEpisodeTitle={nextEpisodeTitle} nextEpisodeDescription={nextEpisodeDescription}
        nextEpisodeImageUrl={nextEpisodeImageUrl} nextSeriesBackdropUrl={nextSeriesBackdropUrl}
        nextEpisodeThumbUrl={nextEpisodeThumbUrl}
        seek={seek} onNextEpisode={onNextEpisode}
        cancelAutoPlay={cancelAutoPlay} onAutoNextDismiss={onAutoNextDismiss}
      />

      {/* Badge « +30s / −10s » après un saut */}
      <SkipBadge flash={skipFlash} />

      <DesktopPlayerControls
        visible={showControls} state={state} title={title} subtitle={subtitle}
        isDirectPlay={isDirectPlay} isEpisode={isEpisode} item={item}
        displayAudio={displayAudio} displaySubs={displaySubs}
        curAudio={curAudio} curSub={curSub}
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
