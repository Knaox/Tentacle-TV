import { useMemo } from "react";
import { Platform, View } from "react-native";
import type { ReactNode, RefObject } from "react";
import Video, { type OnLoadData, type OnProgressData, type VideoRef, SelectedTrackType } from "react-native-video";
import { PLAYER } from "@/theme";
import type { TextTrackEntry } from "@/hooks/usePlaybackInfoFetch";
import { AirPlayIndicator } from "./AirPlayIndicator";
import { PlayerGestures } from "./PlayerGestures";
import { PlayerLoadingView } from "./PlayerLoadingView";
import { SubtitleOverlay } from "./SubtitleOverlay";

export interface PlayerVideoSurfaceProps {
  videoRef: RefObject<VideoRef | null>;
  /** URL du flux serveur, ou URI `file://` d'un fichier local. */
  streamUrl: string;
  headers: Record<string, string>;
  startPositionMs: number;
  isDirectPlay: boolean;
  textTracks: TextTrackEntry[];
  title: string;
  artist: string;
  paused: boolean;
  /** Index NATIF de la piste audio (-1 = laisser le lecteur choisir). */
  audioTrackSelectedIndex: number;
  videoReady: boolean;
  currentTime: number;
  subtitleVttUrl: string | null;
  isAirPlaying: boolean;
  /** Le spinner de premier chargement. */
  showLoading: boolean;
  overlayVisible: boolean;
  onLoad: (data: OnLoadData) => void;
  onProgress: (data: OnProgressData) => void;
  onEnd: () => void;
  onError: (error: unknown) => void;
  onBuffering: (buffering: boolean) => void;
  onExternalPlaybackChange: (active: boolean) => void;
  onSeek: (seconds: number) => void;
  onToggleOverlay: () => void;
  onSwipeDown: () => void;
  /** L'habillage (contrôles, cartes de fin) et les badges, par-dessus. */
  children?: ReactNode;
}

/**
 * La surface vidéo du lecteur mobile — `<Video>`, sous-titres dessinés,
 * indicateur AirPlay, spinner, gestes — commune au flux serveur et au fichier
 * local. Extraction mécanique de `PlayerScreen` : rien n'y change pour le
 * streaming.
 */
export function PlayerVideoSurface({
  videoRef, streamUrl, headers, startPositionMs, isDirectPlay, textTracks, title, artist,
  paused, audioTrackSelectedIndex, videoReady, currentTime, subtitleVttUrl, isAirPlaying, showLoading,
  overlayVisible, onLoad, onProgress, onEnd, onError, onBuffering, onExternalPlaybackChange,
  onSeek, onToggleOverlay, onSwipeDown, children,
}: PlayerVideoSurfaceProps) {
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
        onLoad={onLoad}
        onProgress={onProgress}
        onEnd={onEnd}
        onError={onError}
        onBuffer={({ isBuffering }) => onBuffering(isBuffering)}
        onReadyForDisplay={() => onBuffering(false)}
        progressUpdateInterval={250}
        preventsDisplaySleepDuringVideoPlayback
        showNotificationControls={Platform.OS === "ios"}
        allowsExternalPlayback={Platform.OS === "ios"}
        onExternalPlaybackChange={({ isExternalPlaybackActive }) => {
          onExternalPlaybackChange(isExternalPlaybackActive);
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
