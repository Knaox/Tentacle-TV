import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { View, StatusBar } from "react-native";
import { PLAYER } from "@/theme";
import { TICKS_PER_SECOND } from "@tentacle-tv/shared";
import { useTranslation } from "react-i18next";
import { useMediaItem } from "@tentacle-tv/api-client";
import { usePlayerPlayback, startTicksOf } from "../hooks/usePlayerPlayback";
import { usePlayerHandlers } from "../hooks/usePlayerHandlers";
import { usePlaybackOverlayMobile } from "../hooks/usePlaybackOverlayMobile";
import { usePlayerBackground } from "../hooks/usePlayerBackground";
import { usePlayerPreferences } from "../hooks/usePlayerPreferences";
import { usePlayerAirPlay } from "../hooks/usePlayerAirPlay";
import { usePlayerTracks } from "../hooks/usePlayerTracks";
import { useEngineSettings } from "../player/engine/engineSettings";
import { usePlayerEngine } from "../player/engine/usePlayerEngine";
import { usePlayerDevHook } from "../player/engine/usePlayerDevHook";
import type { PlayerEngineHandle } from "../player/engine/types";
import { MobilePlayerOverlay } from "../components/MobilePlayerOverlay";
import { AutoCapBadge } from "../components/player/AutoCapBadge";
import { PlayerLoadingView } from "../components/player/PlayerLoadingView";
import { PlayerVideoSurface } from "../components/player/PlayerVideoSurface";
import { PlayerErrorView } from "../components/player/PlayerErrorView";

interface Props { itemId: string }

export function PlayerScreen({ itemId }: Props) {
  const { t } = useTranslation("player");
  const engineRef = useRef<PlayerEngineHandle>(null);

  // Le moteur se décide sur les flux de l'élément, AVANT PlaybackInfo : le
  // profil envoyé à Jellyfin est celui du moteur qui lira.
  const { data: routedItem } = useMediaItem(itemId);
  const eng = usePlayerEngine(routedItem);
  const engineSettings = useEngineSettings();
  const pb = usePlayerPlayback(itemId, eng.engine);
  const [paused, setPaused] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [bufferedTime, setBufferedTime] = useState(0);
  const [isBuffering, setIsBuffering] = useState(true);
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [videoReady, setVideoReady] = useState(false);
  const resumeApplied = useRef(false);
  const retryCount = useRef(0);
  const retryingRef = useRef(false);
  const hasEverPlayed = useRef(false);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [playerDetail, setPlayerDetail] = useState<string | null>(null);
  /** Le flux est allé au bout — donné à l'arbitre, qui en tire l'écran de fin. */
  const [ended, setEnded] = useState(false);
  /** Un scrub est en cours — l'arbitre suspend décomptes et surcouches. */
  const [scrubbing, setScrubbing] = useState(false);

  // Orientation: handled declaratively at the Stack.Screen level in
  // `app/_layout.tsx` (`watch/[itemId]` has `orientation: "all"` while the
  // app default is `portrait_up`). React-native-screens applies the mask at
  // the UIViewController level, which is more reliable than imperative
  // `ScreenOrientation.lockAsync` for per-route rotation control.

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

  // Reset videoReady when stream URL changes (avoids selectedTextTrack crash)
  // Also clear retryingRef + playerError so the new stream can report errors.
  // `fetchNonce` : une relance peut rendre une URL IDENTIQUE — sans lui, les
  // gardes restaient armées et le lecteur tournait en spinner pour toujours.
  useEffect(() => {
    setVideoReady(false);
    retryingRef.current = false;
    setPlayerError(null);
  }, [pb.streamUrl, pb.fetchNonce]);

  // La relance transcodée vise le lecteur système : un flux HLS h264/aac se
  // lit partout, et c'est souvent le lecteur avancé qui vient d'échouer
  // (bibliothèque absente, codec). La façade est prévenue, pour que les
  // négociations suivantes (piste, palier) restent sur ce moteur.
  const retryTranscoded = useCallback(() => {
    if (eng.engine === "mpv") eng.forceEngine("native", "fallback");
    pb.retry({ engine: "native" });
  }, [eng, pb.retry]); // eslint-disable-line react-hooks/exhaustive-deps

  // Android loading timeout — if onLoad hasn't fired after 20s, show error
  useEffect(() => {
    if (!pb.streamUrl || videoReady) return;
    const timer = setTimeout(() => {
      if (!videoReady && !playerError && !retryingRef.current) {
        console.log("[Tentacle:Player] loading timeout (20s) — URL:", pb.streamUrl?.slice(0, 200));
        if (retryCount.current < 1) {
          retryCount.current++;
          retryingRef.current = true;
          retryTranscoded();
        } else {
          setPlayerError(t("playbackError"));
        }
      }
    }, 20_000);
    return () => clearTimeout(timer);
  }, [pb.streamUrl, videoReady]); // eslint-disable-line react-hooks/exhaustive-deps

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
    setCurrentTime, setBufferedTime, setIsBuffering, setVideoReady, setPlayerError, setPlayerDetail,
    onDirectPlayFailed,
    onEnded: () => { setEnded(true); },
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

  // Error screen — from playback hook (HTTP error) or player (codec/stream error)
  if ((pb.error || playerError) && !pb.isLoading) {
    return (
      <PlayerErrorView
        message={playerError ?? t("playbackError")}
        details={[`${pb.engine} · ${eng.reason}`, pb.error, playerDetail].filter(Boolean).join("\n")}
        onRetry={() => {
          setPlayerError(null);
          setPlayerDetail(null);
          retryCount.current = 0;
          retryingRef.current = false;
          retryTranscoded();
        }}
        onBack={leavePlayer}
      />
    );
  }

  // Loading: no stream URL yet
  if (!pb.streamUrl) {
    return (
      <View style={{ flex: 1, backgroundColor: PLAYER.bg }}>
        <PlayerLoadingView onCancel={leavePlayer} />
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
      showLoading={isBuffering && !hasEverPlayed.current}
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
    </PlayerVideoSurface>
  );
}
