import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import { PLAYER } from "@/theme";
import { AirPlayIndicator } from "@/components/player/AirPlayIndicator";
import { PlayerGestures } from "@/components/player/PlayerGestures";
import { PlayerLoadingView } from "@/components/player/PlayerLoadingView";
import {
  MpvPlayerView,
  type MpvLoadEvent,
  type MpvPlayerViewHandle,
  type MpvSource,
  type MpvTrack,
} from "../../../modules/mpv-player";
import { engineAudioTracks, mpvAudioId, mpvSubtitleId } from "./trackMapping";
import type { EngineSurfaceProps } from "./types";

/**
 * La surface du lecteur AVANCÉ (libmpv). mpv rend ses sous-titres lui-même :
 * pas d'overlay VTT ici. Les pistes voulues arrivent en index Jellyfin et se
 * traduisent en identifiants mpv par `ff-index` ; un sous-titre externe pas
 * encore connu de mpv est ajouté à la demande (`sub-add`), jamais tous d'un
 * coup — un fichier par piste choisie, pas dix au chargement.
 */
export function MpvVideoSurface({
  engineRef, streamUrl, headers, startPositionMs, selectedAudioIndex, selectedSubtitleIndex,
  externalSubtitles, title, artist, paused, currentTime, isAirPlaying, showLoading, overlayVisible,
  reloadToken, subtitleScale, subtitlePosition, subtitleDelay, audioDelay,
  onLoad, onProgress, onEnd, onError, onBuffering, onPausedChange, onAirPlayRoute, onPipChange,
  onSeek, onToggleOverlay, onSwipeDown, children,
}: EngineSurfaceProps) {
  const viewRef = useRef<MpvPlayerViewHandle>(null);
  const [tracks, setTracks] = useState<readonly MpvTrack[]>([]);
  const [loaded, setLoaded] = useState(false);
  /** Externes déjà demandés à mpv, pour ne pas les ajouter deux fois. */
  const requestedRef = useRef<Set<number>>(new Set());

  useImperativeHandle(engineRef, () => ({
    seek: (seconds: number) => { void viewRef.current?.seekTo(seconds); },
    getTechnicalInfo: async () => ({ ...(await viewRef.current?.getTechnicalInfo()) }),
    release: () => { void viewRef.current?.release(); },
  }), []);

  // La source, mémoïsée sur ses valeurs (une prop identique ne recharge rien).
  // La position de départ n'en fait PAS partie : elle ne compte qu'au chargement,
  // et une renégociation qui rend la même URL avec une position avancée
  // rechargerait le média pour rien.
  const startPositionRef = useRef(startPositionMs);
  startPositionRef.current = startPositionMs;
  const headersKey = JSON.stringify(headers);
  const initialExternal = externalSubtitles.find((s) => s.jellyfinIndex === selectedSubtitleIndex);
  const initialExternalUrl = initialExternal?.url;
  const source = useMemo<MpvSource>(() => ({
    url: streamUrl,
    headers: Object.keys(headers).length > 0 ? headers : undefined,
    startPosition: startPositionRef.current > 0 ? startPositionRef.current / 1000 : undefined,
    externalSubtitles: initialExternalUrl ? [{ url: initialExternalUrl, select: true }] : undefined,
    initialAudioFfIndex: selectedAudioIndex >= 0 ? selectedAudioIndex : undefined,
    initialSubtitleFfIndex: !initialExternalUrl && selectedSubtitleIndex >= 0 ? selectedSubtitleIndex : undefined,
    reloadToken,
    // Les pistes initiales ne comptent qu'au chargement : les changer ensuite
    // passe par les effets ci-dessous, pas par un rechargement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [streamUrl, headersKey, reloadToken]);

  // Nouvelle source : l'état des pistes repart de zéro.
  useEffect(() => {
    setLoaded(false);
    setTracks([]);
    requestedRef.current = new Set();
  }, [source]);

  // Sélection déclarative → commandes mpv, une fois le fichier chargé.
  useEffect(() => {
    if (!loaded) return;
    if (selectedAudioIndex < 0) return;
    const id = mpvAudioId(tracks, selectedAudioIndex);
    if (id !== null) void viewRef.current?.setAudioTrack(id);
  }, [loaded, tracks, selectedAudioIndex]);

  useEffect(() => {
    if (!loaded) return;
    if (selectedSubtitleIndex < 0) {
      void viewRef.current?.setSubtitleTrack(-1);
      return;
    }
    const id = mpvSubtitleId(tracks, selectedSubtitleIndex, externalSubtitles);
    if (id !== null) {
      void viewRef.current?.setSubtitleTrack(id);
      return;
    }
    const external = externalSubtitles.find((s) => s.jellyfinIndex === selectedSubtitleIndex);
    if (external && !requestedRef.current.has(external.jellyfinIndex)) {
      requestedRef.current.add(external.jellyfinIndex);
      void viewRef.current?.addSubtitle(external.url, true);
    }
  }, [loaded, tracks, selectedSubtitleIndex, externalSubtitles]);

  const handleLoad = useCallback((event: { nativeEvent: MpvLoadEvent }) => {
    const info = event.nativeEvent;
    setTracks(info.tracks);
    setLoaded(true);
    if (initialExternal) requestedRef.current.add(initialExternal.jellyfinIndex);
    onLoad({
      duration: info.duration,
      audioTracks: engineAudioTracks(info.tracks),
      naturalWidth: info.width,
      naturalHeight: info.height,
      hdr: info.hdr,
      hwdec: info.hwdec,
    });
  }, [onLoad, initialExternal]);

  return (
    <View style={{ flex: 1, backgroundColor: PLAYER.bg }}>
      <MpvPlayerView
        ref={viewRef}
        style={{ flex: 1 }}
        source={source}
        paused={paused}
        nowPlaying={{ title, artist }}
        subtitleScale={subtitleScale}
        subtitlePosition={subtitlePosition}
        subtitleDelay={subtitleDelay}
        audioDelay={audioDelay}
        onLoad={handleLoad}
        onTracksChanged={(event) => setTracks(event.nativeEvent.tracks)}
        onProgress={(event) => onProgress({
          currentTime: event.nativeEvent.position,
          playableDuration: event.nativeEvent.position + event.nativeEvent.cacheSeconds,
        })}
        onBuffering={(event) => onBuffering(event.nativeEvent.buffering)}
        onEnd={onEnd}
        onError={(event) => onError(event.nativeEvent)}
        onPlaybackStateChange={(event) => onPausedChange?.(event.nativeEvent.paused)}
        onAirPlayRoute={(event) => onAirPlayRoute?.(event.nativeEvent.active)}
        onPipChanged={(event) => onPipChange?.(event.nativeEvent.active)}
      />

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
