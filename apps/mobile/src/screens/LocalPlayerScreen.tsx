import { useState, useRef, useCallback, useEffect } from "react";
import { StatusBar } from "react-native";
import type { VideoRef } from "react-native-video";
import { useTranslation } from "react-i18next";
import { useLocalPlayerPlayback } from "../hooks/offline/useLocalPlayerPlayback";
import { usePlayerHandlers } from "../hooks/usePlayerHandlers";
import { usePlaybackOverlayMobile } from "../hooks/usePlaybackOverlayMobile";
import { MobilePlayerOverlay } from "../components/MobilePlayerOverlay";
import { LocalPlaybackBadge } from "../components/player/LocalPlaybackBadge";
import { PlayerErrorView } from "../components/player/PlayerErrorView";
import { PlayerVideoSurface } from "../components/player/PlayerVideoSurface";
import type { OfflineLocalSource } from "../offline/engineApi";

interface Props {
  itemId: string;
  localSource: OfflineLocalSource;
  /** Le fichier a disparu : la route re-résout la source (flux serveur s'il répond). */
  onMediaMissing: () => void;
}

/**
 * Le lecteur d'un titre PRÉSENT sur l'appareil — même en ligne, sans une
 * seule requête : le fichier `file://`, la reprise locale, la progression en
 * SQLite et un seul envoi à la sortie. Même squelette que `PlayerScreen`,
 * sans PlaybackInfo, préférences serveur, arrière-plan Android ni qualité.
 */
export function LocalPlayerScreen({ itemId, localSource, onMediaMissing }: Props) {
  const { t } = useTranslation("player");
  const { t: to } = useTranslation("offline");
  const videoRef = useRef<VideoRef>(null);

  const pb = useLocalPlayerPlayback(itemId, localSource);
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
  const [isAirPlaying, setIsAirPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);

  useEffect(() => {
    StatusBar.setHidden(true);
    return () => { StatusBar.setHidden(false); };
  }, []);

  // Nouveau titre : remise à zéro des gardes ; la position de départ vient de la source locale.
  useEffect(() => {
    resumeApplied.current = false;
    retryCount.current = 0;
    setIsBuffering(true);
    setPaused(false);
    setBufferedTime(0);
    setEnded(false);
  }, [itemId]);

  useEffect(() => {
    setVideoReady(false);
    retryingRef.current = false;
    setPlayerError(null);
  }, [pb.fetchNonce]);

  // Rien après 20 s : une relance (le fichier a-t-il disparu ?), puis l'erreur.
  useEffect(() => {
    if (videoReady) return;
    const timer = setTimeout(() => {
      if (!videoReady && !playerError && !retryingRef.current) {
        if (retryCount.current < 1) {
          retryCount.current++;
          retryingRef.current = true;
          pb.retry();
        } else {
          setPlayerError(t("playbackError"));
        }
      }
    }, 20_000);
    return () => clearTimeout(timer);
  }, [pb.fetchNonce, videoReady]); // eslint-disable-line react-hooks/exhaustive-deps

  const {
    handleLoad, handleProgress, handleEnd, handleError, handleSeek,
    leavePlayer, handleNextEpisode, handlePrevEpisode,
  } = usePlayerHandlers({
    itemId, pb, videoRef, paused,
    resumeApplied, retryCount, retryingRef, hasEverPlayed,
    setCurrentTime, setBufferedTime, setIsBuffering, setVideoReady, setPlayerError,
    onEnded: () => { setEnded(true); },
  });

  const playback = usePlaybackOverlayMobile({
    itemId, pb, currentTime, ended, hasStarted: videoReady,
    controlsVisible: overlayVisible,
    scrubbing,
    onSeek: handleSeek,
    onNextEpisode: handleNextEpisode,
    onEndOfPlayback: leavePlayer,
  });

  const toggleOverlay = useCallback(() => setOverlayVisible((v) => !v), []);

  if (pb.mediaMissing) {
    return <PlayerErrorView message={`${to("fileMissingTitle")} — ${to("fileMissingHint")}`} onRetry={onMediaMissing} onBack={leavePlayer} />;
  }
  if (playerError) {
    return (
      <PlayerErrorView
        message={playerError}
        onRetry={() => {
          setPlayerError(null);
          retryCount.current = 0;
          retryingRef.current = false;
          pb.retry();
        }}
        onBack={leavePlayer}
      />
    );
  }

  return (
    <PlayerVideoSurface
      videoRef={videoRef}
      streamUrl={pb.streamUrl as string}
      headers={pb.headers}
      startPositionMs={pb.startPositionMs}
      isDirectPlay
      textTracks={[]}
      title={pb.item?.Name ?? ""}
      artist={pb.item?.SeriesName ?? ""}
      paused={paused}
      audioTrackSelectedIndex={pb.audioTrackSelectedIndex}
      videoReady={videoReady}
      currentTime={currentTime}
      subtitleVttUrl={pb.subtitleVttUrl}
      isAirPlaying={isAirPlaying}
      showLoading={isBuffering && !hasEverPlayed.current}
      overlayVisible={overlayVisible}
      onLoad={handleLoad}
      onProgress={handleProgress}
      onEnd={handleEnd}
      onError={handleError}
      onBuffering={setIsBuffering}
      onExternalPlaybackChange={setIsAirPlaying}
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
        audioTracks={pb.audioTracks}
        subtitleTracks={pb.subtitleTracks}
        selectedAudio={pb.audioIndex}
        selectedSubtitle={pb.subtitleIndex}
        // Un fichier local n'a ni palier ni plafond : la section Qualité est absente.
        qualityKey="original"
        qualityPresets={[]}
        playback={playback}
        nextEpisode={pb.episodeNav.nextEpisode}
        previousEpisode={pb.episodeNav.previousEpisode}
        item={pb.item}
        mediaSourceId={pb.mediaSourceId}
        onPlayPause={() => setPaused((p) => !p)}
        onSeek={handleSeek}
        onBack={leavePlayer}
        onSelectAudio={pb.changeAudio}
        onSelectSubtitle={pb.changeSubtitle}
        onSelectQuality={() => undefined}
        onNextEpisode={handleNextEpisode}
        onPreviousEpisode={handlePrevEpisode}
        onScrubStateChange={setScrubbing}
        visible={overlayVisible}
        onToggle={toggleOverlay}
      />
      <LocalPlaybackBadge visible={overlayVisible} />
    </PlayerVideoSurface>
  );
}
