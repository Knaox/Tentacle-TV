import { useImperativeHandle, useMemo, useRef } from "react";
import { Platform, View } from "react-native";
import Video, { type OnLoadData, type OnProgressData, type VideoRef, SelectedTrackType } from "react-native-video";
import { PLAYER } from "@/theme";
import { AirPlayIndicator } from "@/components/player/AirPlayIndicator";
import { PlayerGestures } from "@/components/player/PlayerGestures";
import { PlayerLoadingView } from "@/components/player/PlayerLoadingView";
import { SubtitleOverlay } from "@/components/player/SubtitleOverlay";
import type { EngineSurfaceProps } from "./types";

/**
 * La surface du lecteur SYSTÈME (AVPlayer sur iOS, ExoPlayer sur Android, par
 * react-native-video) — `<Video>`, sous-titres dessinés par l'overlay,
 * indicateur AirPlay, spinner, gestes. C'est l'ancienne `PlayerVideoSurface`,
 * derrière le contrat commun des deux moteurs : rien n'y change pour le
 * streaming, la poignée `engineRef` remplace la ref vidéo des gestionnaires.
 */
export function NativeVideoSurface({
  engineRef, streamUrl, headers, startPositionMs, isDirectPlay, textTracks, title, artist,
  paused, audioTrackSelectedIndex, videoReady, currentTime, subtitleVttUrl, isAirPlaying, showLoading,
  overlayVisible, onLoad, onProgress, onEnd, onError, onBuffering, onExternalPlaybackChange,
  onSeek, onToggleOverlay, onSwipeDown, children,
}: EngineSurfaceProps) {
  const videoRef = useRef<VideoRef>(null);
  useImperativeHandle(engineRef, () => ({
    seek: (seconds: number) => videoRef.current?.seek(seconds),
    // react-native-video s'éteint seul au démontage ; d'ici là, plus un son —
    // et plus d'image dans l'image automatique pendant la fermeture.
    release: () => videoRef.current?.pause(),
  }), []);

  // La source est MÉMOÏSÉE sur ses valeurs : react-native-video (Android,
  // `Source.equals`) recrée le lecteur dès que l'objet reçu diffère — avec un
  // littéral reconstruit à chaque rendu, chaque `setState` du lecteur
  // rechargeait le média (progression figée, sous-titres jamais affichés,
  // erreurs de lecture en boucle).
  const headersKey = JSON.stringify(headers);
  const textTracksKey = JSON.stringify(textTracks);
  const source = useMemo(() => ({
    uri: streamUrl,
    // Auth headers — Android only (iOS uses cookies / query string token)
    ...(Platform.OS === "android" && Object.keys(headers).length > 0 ? { headers } : {}),
    startPosition: startPositionMs > 0 ? startPositionMs : undefined,
    // Sideloaded VTT tracks — Android only. iOS uses SubtitleOverlay to keep AirPlay working
    // (sidecar textTracks create AVMutableComposition which force-disables external playback)
    textTracks: isDirectPlay && textTracks.length > 0 && Platform.OS === "android"
      ? textTracks as any // eslint-disable-line @typescript-eslint/no-explicit-any
      : undefined,
    // Help ExoPlayer identify HLS streams (Jellyfin URLs may lack .m3u8 extension)
    ...(Platform.OS === "android" && !isDirectPlay ? { type: "m3u8" } : {}),
    // Now Playing metadata for lock screen / AirPlay / Control Center
    metadata: { title, artist },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [streamUrl, headersKey, startPositionMs, isDirectPlay, textTracksKey, title, artist]);

  return (
    <View style={{ flex: 1, backgroundColor: PLAYER.bg }}>
      <Video
        ref={videoRef}
        source={source}
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
          isDirectPlay && audioTrackSelectedIndex >= 0
            ? { type: SelectedTrackType.INDEX, value: audioTrackSelectedIndex }
            : undefined
        }
        selectedTextTrack={
          // All subtitles handled by custom SubtitleOverlay — disable native tracks
          videoReady ? { type: SelectedTrackType.DISABLED } : undefined
        }
        onLoad={(data: OnLoadData) => onLoad({
          duration: data.duration,
          audioTracks: data.audioTracks ?? [],
          naturalWidth: data.naturalSize?.width,
          naturalHeight: data.naturalSize?.height,
        })}
        onProgress={(data: OnProgressData) => onProgress({
          currentTime: data.currentTime,
          playableDuration: data.playableDuration,
        })}
        onEnd={onEnd}
        onError={onError}
        onBuffer={({ isBuffering }) => onBuffering(isBuffering)}
        onReadyForDisplay={() => onBuffering(false)}
        progressUpdateInterval={250}
        preventsDisplaySleepDuringVideoPlayback
        showNotificationControls={Platform.OS === "ios"}
        allowsExternalPlayback={Platform.OS === "ios"}
        // La position à rétablir quand AirPlay s'allume est l'affaire de
        // l'écran : lui seul connaît le décalage du flux (transcodage).
        onExternalPlaybackChange={({ isExternalPlaybackActive }) => onExternalPlaybackChange(isExternalPlaybackActive)}
        // iOS: background playback + PiP for AirPlay continuity
        {...(Platform.OS === "ios" ? {
          playInBackground: true,
          playWhenInactive: true,
          enterPictureInPictureOnLeave: true,
        } : {})}
      />

      <SubtitleOverlay vttUrl={subtitleVttUrl} currentTime={currentTime} headers={headers} />

      {/* AirPlay active indicator */}
      {isAirPlaying && <AirPlayIndicator />}

      {showLoading && <PlayerLoadingView />}

      <PlayerGestures
        currentTime={currentTime}
        overlayVisible={overlayVisible}
        onSeek={onSeek}
        onToggleOverlay={onToggleOverlay}
        onSwipeDown={onSwipeDown}
      />

      {children}
    </View>
  );
}
