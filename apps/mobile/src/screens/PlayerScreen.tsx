import { useState, useRef, useCallback, useEffect } from "react";
import { View } from "react-native";
import { PLAYER } from "@/theme";
import { useMediaItem, useUserId } from "@tentacle-tv/api-client";
import { usePlayerPlayback, startTicksOf } from "../hooks/usePlayerPlayback";
import { usePlayerStartFetch } from "../hooks/usePlayerStartFetch";
import { WtPlayerFrame, useMobileGroupPlayback, useMobileGroupStart } from "../watchTogether/player";
import { usePlayerHandlers } from "../hooks/usePlayerHandlers";
import { usePlaybackOverlayMobile } from "../hooks/usePlaybackOverlayMobile";
import { usePlayerBackground } from "../hooks/usePlayerBackground";
import { usePlayerPreferences } from "../hooks/usePlayerPreferences";
import { usePlayerAirPlay } from "../hooks/usePlayerAirPlay";
import { usePlaybackStarted } from "../hooks/usePlaybackStarted";
import { usePlayerLoadingWatchdog } from "../hooks/usePlayerLoadingWatchdog";
import { usePlayerTracks } from "../hooks/usePlayerTracks";
import { usePlayerRemote } from "../session/usePlayerRemote";
import { useMobileStillWatching } from "../player/stillWatching/useMobileStillWatching";
import { useEngineSettings } from "../player/engine/engineSettings";
import { usePlayerEngine } from "../player/engine/usePlayerEngine";
import { usePlayerScreenDevHook } from "../player/engine/usePlayerScreenDevHook";
import type { PlayerEngineHandle } from "../player/engine/types";
import { MobilePlayerOverlay } from "../components/MobilePlayerOverlay";
import { useMobileQualityDrop } from "../components/player/PlayerQualityNotice";
import { PlayerNotices } from "../components/player/PlayerNotices";
import { usePlayerSeekGate } from "../hooks/usePlayerSeekGate";
import { PlayerLoadingScreen } from "../components/player/loading/PlayerLoadingScreen";
import { PlayerVideoSurface } from "../components/player/PlayerVideoSurface";
import { PlaybackProblemView } from "../components/problems/PlaybackProblemView";
import type { PlaybackFailureReport } from "../player/problems/playbackFailure";
import { usePlayerProblem } from "../player/problems/usePlayerProblem";
import { PlayerStatusBar, useChromeVisibility } from "../player/chrome/PlayerStatusBar";
import { PlayerTopActions } from "../components/player/PlayerTopActions";
import { CastControlView } from "../components/player/CastControlView";
import { usePlayerModes } from "../player/usePlayerModes";

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

  // Orientation : `app/_layout.tsx` ("all"). La barre d'état suit les commandes (`PlayerStatusBar`).
  const chrome = useChromeVisibility(overlayVisible);

  // La première négociation du flux — à la position du groupe en séance Watch Together.
  const groupStart = useMobileGroupStart(itemId, pb);
  usePlayerStartFetch({ itemId, pb, groupStart, resumeApplied, retryCount, setIsBuffering, setPaused, setBufferedTime });

  // Nouveau flux (ou même URL relancée) : gardes réarmées, sinon spinner sans fin.
  useEffect(() => {
    setVideoReady(false);
    retryingRef.current = false;
  }, [pb.streamUrl, pb.fetchNonce]);

  // La relance transcodée vise le lecteur système (un HLS h264/aac se lit partout).
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

  // Une lecture directe a échoué : l'autre moteur, s'il est plausible, sans transcodage.
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
    started, videoReady, paused, buffering: isBuffering, mpv: pb.engine === "mpv", restart: pb.restart, retryTranscoded, leavePlayer,
    resetGuards: () => { retryCount.current = 0; retryingRef.current = false; },
  });
  reportRef.current = failure.report;
  // Le saut pendant un transcodage : appuis regroupés en un seul redémarrage, attente dite.
  const seek = usePlayerSeekGate({ transcoding: !pb.isDirectPlay, duration: pb.jellyfinDuration || 0, positionRef: pb.positionRef,
    currentTime, buffering: isBuffering, seek: handleSeek, report: failure.report });
  const qualityDrop = useMobileQualityDrop(pb);
  // Watch Together : le port lecteur, les gestes du groupe, l'habillage (transparent hors séance).
  const group = useMobileGroupPlayback({ itemId, start: groupStart, pb, paused, setPaused, buffering: isBuffering, videoReady,
    seek, handleNextEpisode, handlePrevEpisode, failed: failure.problem !== null });
  // L'image ailleurs : sur une TV (Google Cast, Android), ou en image dans l'image (sans habillage).
  const { cast, pip } = usePlayerModes({ itemId, item: pb.item, pb, engineRef, paused, setPaused: group.setPaused, seekBy: group.seekBy, started, ended,
    failed: failure.problem !== null, airPlaying: isAirPlaying, leave: leavePlayer, hideOverlay: () => { setOverlayVisible(false); group.chrome.close(); } });

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
    onSeek: group.seekTo,
    onNextEpisode: group.handleNextEpisode,
    onEndOfPlayback: leavePlayer,
    group: group.overlay,
  });

  // Android : libère l'encodage après un arrière-plan prolongé, et relance le
  // flux au retour. iOS ne bouge pas — la lecture en fond y est voulue.
  usePlayerBackground(pb, () => pip.active || cast.active);

  // La télécommande de Jellyfin — tableau de bord Tentacle ou Jellyfin (en séance, par le groupe).
  usePlayerRemote({
    stop: leavePlayer, next: group.handleNextEpisode, previous: group.handlePrevEpisode,
    pause: () => group.setPaused(true), play: () => group.setPaused(false), isPaused: () => paused,
    seekTo: group.seekTo, positionSeconds: () => pb.positionRef.current,
    audio: handleSelectAudio, subtitle: (index) => handleSelectSubtitle(index ?? -1),
  });

  // Développement : le lecteur pilotable depuis l'inspecteur (voir le crochet).
  usePlayerScreenDevHook({ pb, engineRef, changeAudio: handleSelectAudio, changeSubtitle: handleSelectSubtitle,
    seek: handleSeek, setPaused, simulateAirPlay: onAirPlayRoute, leave: leavePlayer });

  const toggleOverlay = useCallback(() => setOverlayVisible((v) => !v), []);
  // « Vous regardez encore ? » — tout toucher est une présence ; muet pendant une séance Watch Together.
  const stillWatching = useMobileStillWatching({ paused, buffering: isBuffering, started, setPaused, enabled: !group.active });

  const statusBar = <PlayerStatusBar controlsVisible={(chrome.shown || cast.active) && started} pipActive={pip.active} />;
  // Le message — quoi, pourquoi, quoi faire —, une fois l'échec diagnostiqué.
  if (failure.problem) {
    return (
      <>{statusBar}<PlaybackProblemView model={failure.problem} item={pb.item ?? routedItem} onAction={failure.onAction} onBack={leavePlayer} /></>
    );
  }

  // Pas encore de flux, ou un échec en cours de diagnostic : l'écran de chargement, Retour compris.
  if (!pb.streamUrl || failure.diagnosing) {
    return (
      <View style={{ flex: 1, backgroundColor: PLAYER.bg }}>
        {statusBar}
        <PlayerLoadingScreen item={pb.item ?? routedItem} onCancel={leavePlayer} />
      </View>
    );
  }

  return (
    <WtPlayerFrame chrome={group.chrome}>
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
      paused={paused} rate={group.rate}
      videoReady={videoReady}
      currentTime={currentTime}
      subtitleVttUrl={pb.subtitleVttUrl}
      isAirPlaying={isAirPlaying}
      showLoading={false}
      overlayVisible={overlayVisible}
      reloadToken={String(pb.retryNonce)}
      subtitleScale={engineSettings.subtitleScale}
      subtitlePosition={engineSettings.subtitlePosition}
      onLoad={handleLoad} onProgress={group.wrapProgress(handleProgress)}
      onEnd={handleEnd} onError={handleError}
      onBuffering={setIsBuffering}
      onExternalPlaybackChange={onExternalPlaybackChange}
      onPausedChange={stillWatching.onPausedChange}
      onAirPlayRoute={onAirPlayRoute}
      onPipChange={pip.onEngineChange}
      onSeek={group.seekTo} onSkip={group.seekBy} onSeekComplete={group.onSeekComplete}
      onToggleOverlay={toggleOverlay} onActivity={stillWatching.reportActivity}
      onSwipeDown={leavePlayer}
    >
      {statusBar}
      {cast.active && <CastControlView cast={cast} item={pb.item} mediaSourceId={pb.mediaSourceId} onBack={leavePlayer} />}
      {!pip.active && !cast.active && <>
      <MobilePlayerOverlay
        title={pb.item?.Name ?? ""}
        currentTime={seek.target ?? currentTime}
        duration={pb.jellyfinDuration || 0}
        bufferedTime={bufferedTime}
        paused={paused}
        audioTracks={audioTracks}
        subtitleTracks={subtitleTracks}
        selectedAudio={pb.audioIndex}
        selectedSubtitle={pb.subtitleIndex}
        qualityKey={pb.qualityKey}
        qualityPresets={pb.qualityPresets}
        autoQualityActive={pb.autoModeArmed} qualityDrop={qualityDrop}
        playback={playback} stillWatching={stillWatching}
        nextEpisode={pb.episodeNav.nextEpisode} previousEpisode={pb.episodeNav.previousEpisode}
        item={pb.item}
        mediaSourceId={pb.mediaSourceId}
        onPlayPause={group.onPlayPause} groupButton={group.chrome.button}
        onSeek={group.seekTo} onSkip={group.seekBy}
        onBack={leavePlayer}
        onSelectAudio={handleSelectAudio} onSelectSubtitle={handleSelectSubtitle}
        onSelectQuality={pb.changeQuality}
        onNextEpisode={group.handleNextEpisode}
        onPreviousEpisode={group.handlePrevEpisode}
        onScrubStateChange={setScrubbing}
        visible={overlayVisible}
        onToggle={toggleOverlay}
        onFadeStart={chrome.onFadeStart}
        topActions={<PlayerTopActions pip={pip} cast={cast} />}
      />

      <PlayerNotices itemId={itemId} qualityDrop={qualityDrop} started={started} paused={paused} buffering={isBuffering} transcoding={!pb.isDirectPlay}
        seekPhase={seek.phase} canLowerQuality={failure.canLowerQuality} onLowerQuality={pb.lowerQuality} onRetryOutage={failure.reopen} />

      {/* Jusqu'à ce que la lecture AVANCE : l'écran de chargement, au-dessus
          des contrôles, puis un fondu. */}
      {!started && <PlayerLoadingScreen item={pb.item ?? routedItem} onCancel={leavePlayer} />}
      {group.chrome.layers}
      </>}
    </PlayerVideoSurface>
    </WtPlayerFrame>
  );
}
