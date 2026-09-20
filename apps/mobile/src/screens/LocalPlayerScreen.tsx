import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { StatusBar } from "react-native";
import type { PlayerEngineHandle } from "../player/engine/types";
import { useTranslation } from "react-i18next";
import { useLocalPlayerPlayback } from "../hooks/offline/useLocalPlayerPlayback";
import { useLocalSnapshotItem, useLocalSnapshotJson } from "../hooks/offline/useLocalSnapshot";
import type { MediaItem } from "@tentacle-tv/shared";
import { localRouterItem } from "../hooks/offline/localRouterItem";
import { usePlayerEngine } from "../player/engine/usePlayerEngine";
import { useAirPlayRestoreSeek } from "../player/engine/useAirPlayRoute";
import { useEngineSettings } from "../player/engine/engineSettings";
import { usePlayerDevHook } from "../player/engine/usePlayerDevHook";
import { usePlayerHandlers } from "../hooks/usePlayerHandlers";
import { usePlaybackOverlayMobile } from "../hooks/usePlaybackOverlayMobile";
import { MobilePlayerOverlay } from "../components/MobilePlayerOverlay";
import { classifyLocalPlaybackFailure } from "@tentacle-tv/offline-core";
import { LocalPlaybackBadge } from "../components/player/LocalPlaybackBadge";
import { MediaMissingView } from "../components/player/MediaMissingView";
import { PlayerErrorView } from "../components/player/PlayerErrorView";
import { PlayerVideoSurface } from "../components/player/PlayerVideoSurface";
import { localExists, type OfflineLocalSource } from "../offline/engineApi";

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
 * Le moteur est décidé par la même façade, sur le snapshot du fichier : le
 * lecteur avancé lit le MKV et ses pistes tel quel, le lecteur système garde
 * ce qu'il lit le mieux.
 */
export function LocalPlayerScreen({ itemId, localSource, onMediaMissing }: Props) {
  const { t } = useTranslation("player");
  const engineRef = useRef<PlayerEngineHandle>(null);

  const snapshotItem = useLocalSnapshotItem(itemId, localSource);
  // Le moteur ne se décide qu'une fois item.json lu (même requête, même cache) :
  // décidé sur l'item minimal, le lecteur avancé démarrait puis cédait la place.
  const { isFetched: snapshotReady } = useLocalSnapshotJson<MediaItem>(itemId, "item.json");
  // Le routeur juge le FICHIER gardé : une variante recompressée est un MP4, pas la source.
  const routerItem = useMemo(() => localRouterItem(snapshotItem, localSource), [snapshotItem, localSource]);
  const eng = usePlayerEngine(routerItem);
  const engineSettings = useEngineSettings();
  const pb = useLocalPlayerPlayback(itemId, localSource, eng.engine);
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

  // Un moteur a calé sur le fichier : l'autre, s'il est plausible — même
  // fichier, même position ; personne ne transcode un titre déjà sur l'appareil.
  const onDirectPlayFailed = useCallback((): boolean => {
    const next = eng.fallbackEngine();
    if (next === null) return false;
    eng.forceEngine(next, "fallback");
    return true;
  }, [eng]);

  const {
    handleLoad, handleProgress, handleEnd, handleError, handleSeek,
    leavePlayer, handleNextEpisode, handlePrevEpisode,
  } = usePlayerHandlers({
    itemId, pb, engineRef, paused,
    resumeApplied, retryCount, retryingRef, hasEverPlayed,
    setCurrentTime, setBufferedTime, setIsBuffering, setVideoReady, setPlayerError, setPlayerDetail,
    onDirectPlayFailed,
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

  // AirPlay sur un fichier local lu par le lecteur système : pas de bascule de
  // moteur (le lecteur avancé ne diffuse pas, le système ne lit pas un MKV),
  // seulement la position rétablie quand l'AVPlayer recharge son flux.
  const restoreAfterAirPlay = useAirPlayRestoreSeek({ engineRef, positionRef: pb.positionRef, streamOffset: 0, videoReady });
  const onExternalPlaybackChange = useCallback((active: boolean) => {
    setIsAirPlaying(active);
    restoreAfterAirPlay(active);
  }, [restoreAfterAirPlay]);

  // Développement : le lecteur local pilotable depuis l'inspecteur (pas d'AirPlay à simuler ici).
  usePlayerDevHook(useMemo(() => ({
    engine: eng.engine, audioIndex: pb.audioIndex, subtitleIndex: pb.subtitleIndex, isDirectPlay: true,
    changeAudio: pb.changeAudio, changeSubtitle: pb.changeSubtitle, seek: handleSeek, setPaused,
    simulateAirPlay: () => undefined,
  }), [eng.engine, pb.audioIndex, pb.subtitleIndex, pb.changeAudio, pb.changeSubtitle, handleSeek]));

  const toggleOverlay = useCallback(() => setOverlayVisible((v) => !v), []);

  // Échec classé : le fichier a disparu (« Fichier introuvable », relance par la
  // route — flux serveur s'il répond) ou le lecteur a calé (relance locale).
  if (pb.mediaMissing || playerError) {
    const failure = classifyLocalPlaybackFailure({
      isLocalPlayback: true,
      localFilePresent: pb.mediaMissing ? false : localExists(localSource.fileUri),
    });
    if (failure.kind === "media") return <MediaMissingView onRetry={onMediaMissing} onBack={leavePlayer} />;
  }
  if (playerError) {
    return (
      <PlayerErrorView
        message={playerError}
        details={[`${eng.engine} · ${eng.reason}`, playerDetail].filter(Boolean).join("\n")}
        onRetry={() => {
          setPlayerError(null);
          setPlayerDetail(null);
          retryCount.current = 0;
          retryingRef.current = false;
          pb.retry();
        }}
        onBack={leavePlayer}
      />
    );
  }

  if (!snapshotReady) return null;

  return (
    <PlayerVideoSurface
      engine={eng.engine}
      engineRef={engineRef}
      streamUrl={pb.streamUrl as string}
      headers={pb.headers}
      startPositionMs={pb.startPositionMs}
      isDirectPlay
      streams={pb.streams}
      // Les index sont ceux du moteur qui lit : Jellyfin pour le lecteur
      // avancé, positions du fichier pour le lecteur système.
      selectedAudioIndex={eng.engine === "mpv" ? pb.audioIndex : -1}
      selectedSubtitleIndex={eng.engine === "mpv" ? pb.subtitleIndex : -1}
      externalSubtitles={pb.externalSubtitles}
      textTracks={[]}
      title={pb.item?.Name ?? ""}
      artist={pb.item?.SeriesName ?? ""}
      paused={paused}
      audioTrackSelectedIndex={eng.engine === "native" ? pb.audioIndex : -1}
      videoReady={videoReady}
      currentTime={currentTime}
      subtitleVttUrl={pb.subtitleVttUrl}
      subtitleScale={engineSettings.subtitleScale}
      subtitlePosition={engineSettings.subtitlePosition}
      isAirPlaying={isAirPlaying}
      showLoading={isBuffering && !hasEverPlayed.current}
      overlayVisible={overlayVisible}
      reloadToken={String(pb.fetchNonce)}
      onLoad={(data) => { pb.onLoad(data); handleLoad(data); }}
      onProgress={handleProgress}
      onEnd={handleEnd}
      onError={handleError}
      onBuffering={setIsBuffering}
      onExternalPlaybackChange={onExternalPlaybackChange}
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
        localTrickplay={pb.localTrickplay}
        nextArtwork={pb.nextArtwork}
        localSession
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
