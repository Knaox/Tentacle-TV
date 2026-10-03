import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { View, StatusBar } from "react-native";
import { PLAYER } from "@/theme";
import { TICKS_PER_SECOND } from "@tentacle-tv/shared";
import { useMediaItem, useUserId } from "@tentacle-tv/api-client";
import { usePlayerPlayback, startTicksOf } from "../hooks/usePlayerPlayback";
import { usePlayerHandlers } from "../hooks/usePlayerHandlers";
import { usePlaybackOverlayMobile } from "../hooks/usePlaybackOverlayMobile";
import { usePlayerBackground } from "../hooks/usePlayerBackground";
import { usePlayerPreferences } from "../hooks/usePlayerPreferences";
import { usePlayerAirPlay } from "../hooks/usePlayerAirPlay";
import { usePlaybackStarted } from "../hooks/usePlaybackStarted";
import { usePlayerLoadingWatchdog } from "../hooks/usePlayerLoadingWatchdog";
import { usePlayerTracks } from "../hooks/usePlayerTracks";
import { usePlayerRemote } from "../session/usePlayerRemote";
import { useEngineSettings } from "../player/engine/engineSettings";
import { usePlayerEngine } from "../player/engine/usePlayerEngine";
import { usePlayerDevHook } from "../player/engine/usePlayerDevHook";
import type { PlayerEngineHandle } from "../player/engine/types";
import { MobilePlayerOverlay } from "../components/MobilePlayerOverlay";
import { AutoCapBadge } from "../components/player/AutoCapBadge";
import { PlayerStallNotice } from "../components/player/PlayerStallNotice";
import { PlayerLoadingScreen } from "../components/player/loading/PlayerLoadingScreen";
import { PlayerVideoSurface } from "../components/player/PlayerVideoSurface";
import { PlaybackProblemView } from "../components/problems/PlaybackProblemView";
import type { PlaybackFailureReport } from "../player/problems/playbackFailure";
import { usePlayerProblem } from "../player/problems/usePlayerProblem";

interface Props { itemId: string; version?: string }

export function PlayerScreen({ itemId, version }: Props) {
  const engineRef = useRef<PlayerEngineHandle>(null);
  const userId = useUserId();

  // Le moteur se décide sur les flux de l'élément, AVANT PlaybackInfo : le
  // profil envoyé à Jellyfin est celui du moteur qui lira.
  const { data: routedItem, error: itemError } = useMediaItem(itemId);
  const eng = usePlayerEngine(routedItem, version);
  const engineSettings = useEngineSettings();
  const pb = usePlayerPlayback(itemId, eng.engine, version);
  const [paused, setPaused] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [bufferedTime, setBufferedTime] = useState(0);
  // Le tampon : une lecture qui cale le dit (`PlayerStallNotice`).
  const [isBuffering, setIsBuffering] = useState(true);
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [videoReady, setVideoReady] = useState(false);
  const started = usePlaybackStarted(videoReady, currentTime);
  const resumeApplied = useRef(false);
  const retryCount = useRef(0);
  const retryingRef = useRef(false);
  const hasEverPlayed = useRef(false);
  // Le signalement d'un échec, posé une fois le diagnostic monté (plus bas).
  const reportRef = useRef<(report: PlaybackFailureReport) => void>(() => undefined);
  /** Le flux est allé au bout — donné à l'arbitre, qui en tire l'écran de fin. */
  const [ended, setEnded] = useState(false);
  /** Un scrub est en cours — l'arbitre suspend décomptes et surcouches. */
  const [scrubbing, setScrubbing] = useState(false);

  // Orientation : déclarée au niveau du Stack.Screen (`app/_layout.tsx`, `watch/[itemId]`
  // en "all") — react-native-screens l'applique au UIViewController, plus sûr qu'un lockAsync.

  // StatusBar: hide/show
  useEffect(() => {
    StatusBar.setHidden(true);
    return () => { StatusBar.setHidden(false); };
  }, []);

  // Fetch PlaybackInfo once the item metadata is ready
  useEffect(() => {
    if (!pb.item) return;
    resumeApplied.current = false;
    retryCount.current = 0;
    setIsBuffering(true);
    setPaused(false);
    setBufferedTime(0);

    const resumeTicks = pb.item.UserData?.PlaybackPositionTicks;
    const resumeSeconds = resumeTicks && resumeTicks > 0 ? resumeTicks / TICKS_PER_SECOND : 0;
    // Store resume position so changeAudio/changeSubtitle preserves it
    pb.positionRef.current = resumeSeconds;
    // Don't set currentTime here — let handleProgress determine the real position

    pb.fetchPlaybackInfo({
      startTimeTicks: resumeTicks && resumeTicks > 0 ? resumeTicks : undefined,
    });
  }, [itemId, pb.item?.Id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Nouveau flux (ou même URL relancée, `fetchNonce`) : gardes réarmées, sinon le
  // lecteur tournait en spinner pour toujours (et selectedTextTrack plantait).
  useEffect(() => {
    setVideoReady(false);
    retryingRef.current = false;
  }, [pb.streamUrl, pb.fetchNonce]);

  // La relance transcodée vise le lecteur système (un HLS h264/aac se lit partout ; c'est
  // souvent le lecteur avancé qui vient d'échouer) — la façade le retient pour la suite.
  const retryTranscoded = useCallback(() => {
    if (eng.engine === "mpv") eng.forceEngine("native", "fallback");
    pb.retry({ engine: "native" });
  }, [eng, pb.retry]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-apply language preferences
  usePlayerPreferences({
    item: pb.item,
    ancestors: pb.ancestors,
    streams: pb.streams,
    onAudioResolved: (idx) => pb.changeAudio(idx),
    onSubtitleResolved: (idx) => pb.changeSubtitle(idx),
  });

  // Les choix EXPLICITES de piste, mémorisés pour ce contenu ; la résolution
  // automatique ci-dessus ne compte pas comme un choix.
  const { handleSelectAudio, handleSelectSubtitle, audioTracks, subtitleTracks } = usePlayerTracks(itemId, pb);

  // Une lecture directe a échoué : l'autre moteur, s'il est plausible, avec le
  // profil de CE moteur et la position courante — sans transcodage.
  const onDirectPlayFailed = useCallback((): boolean => {
    const next = eng.fallbackEngine();
    if (next === null) return false;
    eng.forceEngine(next, "fallback");
    pb.fetchPlaybackInfo({ engine: next, startTimeTicks: startTicksOf(pb.positionRef.current) });
    return true;
  }, [eng, pb.fetchPlaybackInfo, pb.positionRef]); // eslint-disable-line react-hooks/exhaustive-deps

  // AirPlay, dans les deux sens (voir le crochet).
  const { isAirPlaying, onAirPlayRoute, onExternalPlaybackChange } = usePlayerAirPlay({
    eng, pb, engineRef, videoReady, retryCount,
  });

  // Image dans l'image : l'habillage n'a rien à faire dans la petite fenêtre.
  const onPipChange = useCallback((active: boolean) => {
    if (active) setOverlayVisible(false);
  }, []);

  const {
    handleLoad, handleProgress, handleEnd, handleError, handleSeek,
    leavePlayer, handleNextEpisode, handlePrevEpisode,
  } = usePlayerHandlers({
    itemId, pb: { ...pb, retry: retryTranscoded }, engineRef, paused,
    resumeApplied, retryCount, retryingRef, hasEverPlayed,
    setCurrentTime, setBufferedTime, setIsBuffering, setVideoReady,
    onFailure: (error) => reportRef.current({ from: "engine", engine: pb.engine, error }),
    onDirectPlayFailed,
    onEnded: () => { setEnded(true); },
  });

  // Chaque échec — négociation, fiche, moteur, attente sans fin — devient UN
  // message du modèle commun, diagnostiqué (serveurs, flux), et ses gestes.
  const failure = usePlayerProblem({
    itemId, item: pb.item ?? routedItem, itemError, missingUser: !userId,
    streamUrl: pb.streamUrl, headers: pb.headers, isLoading: pb.isLoading, negotiationError: pb.error,
    isDirectPlay: pb.isDirectPlay, burnInSubIndex: pb.burnInSubIndex, subtitleIndex: pb.subtitleIndex,
    mediaSourceId: pb.mediaSourceId, qualityKey: pb.qualityKey, qualityPresets: pb.qualityPresets,
    started, videoReady, paused, restart: pb.restart, retryTranscoded, leavePlayer,
    resetGuards: () => { retryCount.current = 0; retryingRef.current = false; },
  });
  reportRef.current = failure.report;

  // Rien de chargé en 20 s : relance transcodée, puis le message.
  usePlayerLoadingWatchdog({
    streamUrl: pb.streamUrl, videoReady, suspended: failure.problem !== null || failure.diagnosing,
    retryCount, retryingRef, retryTranscoded,
    fail: () => failure.report({ from: "marker", marker: "startTimeout" }),
  });

  // L'arbitre partagé — mêmes règles que le web, le bureau et le téléviseur.
  useEffect(() => { setEnded(false); }, [itemId, pb.streamUrl, pb.fetchNonce]);
  const playback = usePlaybackOverlayMobile({
    itemId, pb, currentTime, ended, hasStarted: videoReady,
    controlsVisible: overlayVisible,
    scrubbing,
    onSeek: handleSeek,
    onNextEpisode: handleNextEpisode,
    onEndOfPlayback: leavePlayer,
  });

  // Android : libère l'encodage après un arrière-plan prolongé, et relance le
  // flux au retour. iOS ne bouge pas — la lecture en fond y est voulue.
  usePlayerBackground(pb);

  // La télécommande de Jellyfin — tableau de bord Tentacle ou Jellyfin.
  usePlayerRemote({
    stop: leavePlayer, next: handleNextEpisode, previous: handlePrevEpisode,
    pause: () => setPaused(true), play: () => setPaused(false), isPaused: () => paused,
    seekTo: handleSeek, positionSeconds: () => pb.positionRef.current,
    audio: handleSelectAudio, subtitle: (index) => handleSelectSubtitle(index ?? -1),
  });

  // Développement : le lecteur pilotable depuis l'inspecteur (voir le crochet).
  usePlayerDevHook(useMemo(() => ({
    engine: pb.engine, audioIndex: pb.audioIndex, subtitleIndex: pb.subtitleIndex, isDirectPlay: pb.isDirectPlay,
    changeAudio: handleSelectAudio, changeSubtitle: handleSelectSubtitle, seek: handleSeek, setPaused,
    simulateAirPlay: onAirPlayRoute,
    changeQuality: (key) => pb.changeQuality(key as Parameters<typeof pb.changeQuality>[0]),
    technicalInfo: () => engineRef.current?.getTechnicalInfo?.() ?? Promise.resolve({}),
    leave: leavePlayer,
  }), [pb.engine, pb.audioIndex, pb.subtitleIndex, pb.isDirectPlay, pb.changeQuality, handleSelectAudio, handleSelectSubtitle, handleSeek, onAirPlayRoute, leavePlayer]));

  const toggleOverlay = useCallback(() => setOverlayVisible((v) => !v), []);

  // Le message — quoi, pourquoi, quoi faire —, une fois l'échec diagnostiqué.
  if (failure.problem) {
    return (
      <PlaybackProblemView model={failure.problem} item={pb.item ?? routedItem} onAction={failure.onAction} onBack={leavePlayer} />
    );
  }

  // Pas encore de flux, ou un échec en cours de diagnostic : l'écran de chargement, Retour compris.
  if (!pb.streamUrl || failure.diagnosing) {
    return (
      <View style={{ flex: 1, backgroundColor: PLAYER.bg }}>
        <PlayerLoadingScreen item={pb.item ?? routedItem} onCancel={leavePlayer} />
      </View>
    );
  }

  return (
    <PlayerVideoSurface
      engine={pb.engine}
      engineRef={engineRef}
      streamUrl={pb.streamUrl}
      headers={pb.headers}
      startPositionMs={pb.startPositionMs}
      isDirectPlay={pb.isDirectPlay}
      streams={pb.streams}
      selectedAudioIndex={pb.audioIndex}
      selectedSubtitleIndex={pb.subtitleIndex}
      externalSubtitles={pb.externalSubtitles}
      textTracks={pb.textTracks}
      audioTrackSelectedIndex={pb.audioTrackSelectedIndex}
      title={pb.item?.Name ?? ""}
      artist={pb.item?.SeriesName ?? ""}
      paused={paused}
      videoReady={videoReady}
      currentTime={currentTime}
      subtitleVttUrl={pb.subtitleVttUrl}
      isAirPlaying={isAirPlaying}
      showLoading={false}
      overlayVisible={overlayVisible}
      reloadToken={String(pb.retryNonce)}
      subtitleScale={engineSettings.subtitleScale}
      subtitlePosition={engineSettings.subtitlePosition}
      onLoad={handleLoad}
      onProgress={handleProgress}
      onEnd={handleEnd}
      onError={handleError}
      onBuffering={setIsBuffering}
      onExternalPlaybackChange={onExternalPlaybackChange}
      onPausedChange={setPaused}
      onAirPlayRoute={onAirPlayRoute}
      onPipChange={onPipChange}
      onSeek={handleSeek}
      onToggleOverlay={toggleOverlay}
      onSwipeDown={leavePlayer}
    >
      <MobilePlayerOverlay
        title={pb.item?.Name ?? ""}
        currentTime={currentTime}
        duration={pb.jellyfinDuration || 0}
        bufferedTime={bufferedTime}
        paused={paused}
        audioTracks={audioTracks}
        subtitleTracks={subtitleTracks}
        selectedAudio={pb.audioIndex}
        selectedSubtitle={pb.subtitleIndex}
        qualityKey={pb.qualityKey}
        qualityPresets={pb.qualityPresets}
        autoQualityActive={pb.autoModeArmed}
        playback={playback}
        nextEpisode={pb.episodeNav.nextEpisode}
        previousEpisode={pb.episodeNav.previousEpisode}
        item={pb.item}
        mediaSourceId={pb.mediaSourceId}
        onPlayPause={() => setPaused((p) => !p)}
        onSeek={handleSeek}
        onBack={leavePlayer}
        onSelectAudio={handleSelectAudio}
        onSelectSubtitle={handleSelectSubtitle}
        onSelectQuality={pb.changeQuality}
        onNextEpisode={handleNextEpisode}
        onPreviousEpisode={handlePrevEpisode}
        onScrubStateChange={setScrubbing}
        visible={overlayVisible}
        onToggle={toggleOverlay}
      />

      {/* Badge éphémère « Qualité réduite » — le message temporaire du cap. */}
      <AutoCapBadge active={pb.autoCapActive} />
      <PlayerStallNotice buffering={isBuffering} started={started} paused={paused} transcoding={!pb.isDirectPlay}
        canLowerQuality={failure.canLowerQuality} onLowerQuality={pb.lowerQuality} />

      {/* Jusqu'à ce que la lecture AVANCE : l'écran de chargement, au-dessus
          des contrôles, puis un fondu. */}
      {!started && <PlayerLoadingScreen item={pb.item ?? routedItem} onCancel={leavePlayer} />}
    </PlayerVideoSurface>
  );
}
