import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { View, StatusBar, Platform } from "react-native";
import Video, { type VideoRef, SelectedTrackType } from "react-native-video";
import { PLAYER } from "@/theme";
import { TICKS_PER_SECOND } from "@tentacle-tv/shared";
import { useTranslation } from "react-i18next";
import { usePlayerPlayback } from "../hooks/usePlayerPlayback";
import { usePlayerHandlers } from "../hooks/usePlayerHandlers";
import { usePlaybackOverlayMobile } from "../hooks/usePlaybackOverlayMobile";
import { usePlayerBackground } from "../hooks/usePlayerBackground";
import { usePlayerPreferences } from "../hooks/usePlayerPreferences";
import { formatTrackLabel } from "../lib/playerUtils";
import { MobilePlayerOverlay } from "../components/MobilePlayerOverlay";
import { AirPlayIndicator } from "../components/player/AirPlayIndicator";
import { AutoCapBadge } from "../components/player/AutoCapBadge";
import { PlayerLoadingView } from "../components/player/PlayerLoadingView";
import { PlayerErrorView } from "../components/player/PlayerErrorView";
import { PlayerGestures } from "../components/player/PlayerGestures";
import { SubtitleOverlay } from "../components/player/SubtitleOverlay";

interface Props { itemId: string }

export function PlayerScreen({ itemId }: Props) {
  const { t } = useTranslation("player");
  const videoRef = useRef<VideoRef>(null);

  const pb = usePlayerPlayback(itemId);
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

  // Android loading timeout — if onLoad hasn't fired after 20s, show error
  useEffect(() => {
    if (!pb.streamUrl || videoReady) return;
    const timer = setTimeout(() => {
      if (!videoReady && !playerError && !retryingRef.current) {
        console.log("[Tentacle:Player] loading timeout (20s) — URL:", pb.streamUrl?.slice(0, 200));
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
  }, [pb.streamUrl, videoReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-apply language preferences
  usePlayerPreferences({
    item: pb.item,
    ancestors: pb.ancestors,
    streams: pb.streams,
    onAudioResolved: (idx) => pb.changeAudio(idx),
    onSubtitleResolved: (idx) => pb.changeSubtitle(idx),
  });

  // Audio/subtitle track lists for the modal
  const audioTracks = useMemo(() =>
    pb.streams.filter((s) => s.Type === "Audio").map((s) => ({ index: s.Index, label: formatTrackLabel(s) })),
    [pb.streams],
  );
  const subtitleTracks = useMemo(() =>
    pb.streams.filter((s) => s.Type === "Subtitle").map((s) => ({ index: s.Index, label: formatTrackLabel(s) })),
    [pb.streams],
  );

  const {
    handleLoad, handleProgress, handleEnd, handleError, handleSeek,
    leavePlayer, handleNextEpisode, handlePrevEpisode,
  } = usePlayerHandlers({
    itemId, pb, videoRef, paused,
    resumeApplied, retryCount, retryingRef, hasEverPlayed,
    setCurrentTime, setBufferedTime, setIsBuffering, setVideoReady, setPlayerError,
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

  const toggleOverlay = useCallback(() => setOverlayVisible((v) => !v), []);

  // Error screen — from playback hook (HTTP error) or player (codec/stream error)
  if ((pb.error || playerError) && !pb.isLoading) {
    return (
      <PlayerErrorView
        message={playerError ?? t("playbackError")}
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

  // Loading: no stream URL yet
  if (!pb.streamUrl) {
    return (
      <View style={{ flex: 1, backgroundColor: PLAYER.bg }}>
        <PlayerLoadingView />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: PLAYER.bg }}>
      <Video
        ref={videoRef}
        source={{
          uri: pb.streamUrl,
          // Auth headers — Android only (iOS uses cookies / query string token)
          ...(Platform.OS === "android" && Object.keys(pb.headers).length > 0 ? { headers: pb.headers } : {}),
          startPosition: pb.startPositionMs > 0 ? pb.startPositionMs : undefined,
          // Sideloaded VTT tracks — Android only. iOS uses SubtitleOverlay to keep AirPlay working
          // (sidecar textTracks create AVMutableComposition which force-disables external playback)
          textTracks: pb.isDirectPlay && pb.textTracks.length > 0 && Platform.OS === "android"
            ? pb.textTracks as any
            : undefined,
          // Help ExoPlayer identify HLS streams (Jellyfin URLs may lack .m3u8 extension)
          ...(Platform.OS === "android" && !pb.isDirectPlay ? { type: "m3u8" } : {}),
          // Now Playing metadata for lock screen / AirPlay / Control Center
          metadata: { title: pb.item?.Name ?? "", artist: pb.item?.SeriesName ?? "" },
        }}
        style={{ flex: 1 }}
        resizeMode="contain"
        paused={paused}
        // Android ExoPlayer buffer config — larger buffer for smoother playback
        {...(Platform.OS === "android" ? {
          bufferConfig: {
            minBufferMs: 15000,
            maxBufferMs: 50000,
            bufferForPlaybackMs: 2500,
            bufferForPlaybackAfterRebufferMs: 5000,
          },
        } : {})}
        selectedAudioTrack={
          pb.isDirectPlay && pb.audioTrackSelectedIndex >= 0
            ? { type: SelectedTrackType.INDEX, value: pb.audioTrackSelectedIndex }
            : undefined
        }
        selectedTextTrack={
          // All subtitles handled by custom SubtitleOverlay — disable native tracks
          videoReady ? { type: SelectedTrackType.DISABLED } : undefined
        }
        onLoad={handleLoad}
        onProgress={handleProgress}
        onEnd={handleEnd}
        onError={handleError}
        onBuffer={({ isBuffering: b }) => setIsBuffering(b)}
        onReadyForDisplay={() => setIsBuffering(false)}
        progressUpdateInterval={250}
        preventsDisplaySleepDuringVideoPlayback
        showNotificationControls={Platform.OS === "ios"}
        allowsExternalPlayback={Platform.OS === "ios"}
        onExternalPlaybackChange={({ isExternalPlaybackActive }) => {
          setIsAirPlaying(isExternalPlaybackActive);
          // Restore position when AirPlay activates (AVPlayer reloads the stream)
          if (isExternalPlaybackActive && currentTime > 1) {
            setTimeout(() => videoRef.current?.seek(currentTime), 500);
          }
        }}
        // iOS: background playback + PiP for AirPlay continuity
        {...(Platform.OS === "ios" ? {
          playInBackground: true,
          playWhenInactive: true,
          enterPictureInPictureOnLeave: true,
        } : {})}
      />

      <SubtitleOverlay vttUrl={pb.subtitleVttUrl} currentTime={currentTime} headers={pb.headers} />

      {/* AirPlay active indicator */}
      {isAirPlaying && <AirPlayIndicator />}

      {isBuffering && !hasEverPlayed.current && <PlayerLoadingView />}

      <PlayerGestures
        currentTime={currentTime}
        overlayVisible={overlayVisible}
        onSeek={handleSeek}
        onToggleOverlay={toggleOverlay}
        onSwipeDown={leavePlayer}
      />

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
        onSelectAudio={pb.changeAudio}
        onSelectSubtitle={pb.changeSubtitle}
        onSelectQuality={pb.changeQuality}
        onNextEpisode={handleNextEpisode}
        onPreviousEpisode={handlePrevEpisode}
        onScrubStateChange={setScrubbing}
        visible={overlayVisible}
        onToggle={toggleOverlay}
      />

      {/* Badge éphémère « Qualité réduite » — le message temporaire du cap. */}
      <AutoCapBadge active={pb.autoCapActive} />
    </View>
  );
}
