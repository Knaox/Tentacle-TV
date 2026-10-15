import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import { StyleSheet } from "react-native";
import Video, { type OnLoadData, type OnProgressData } from "react-native-video";
import { PREVIEW_VIDEO_SURFACE } from "../../platform/tvos/player/previewVideoSurface";

/**
 * La vidéo de l'aperçu (Apple TV : AVPlayer ; Android TV : ExoPlayer) — le
 * flux relayé par le serveur Tentacle, chargé CACHÉ et en pause jusqu'à ce que
 * la grande carte se montre, puis joué. Elle ne décide de rien : elle dit sa
 * première image (`onReady`), sa fin, son échec, et où elle en est.
 *
 * - La première image : `onReadyForDisplay` (AVPlayer la sert même en pause,
 *   ExoPlayer rend la première image d'un flux préparé). Faute de cet avis
 *   `READY_FALLBACK_MS` après le chargement, le chargement vaut prêt : la
 *   grande carte montre alors l'image du titre jusqu'à la première image —
 *   jamais un cadre noir (la couche vidéo est transparente avant).
 * - La surface (et son « jamais focalisable ») vient de l'adaptateur de la
 *   plateforme (`previewVideoSurface`) ; pas de volet noir avant l'image.
 */

/** Chargée sans avis de première image au-delà : elle est tenue pour prête. */
const READY_FALLBACK_MS = 1_500;
/** Le pas des positions relevées (la reprise au retour sur la carte). */
const PROGRESS_INTERVAL_MS = 1_000;

export interface PreviewVideoProps {
  uri: string;
  hls: boolean;
  /** Où commencer (s). */
  startAt: number;
  /** Joue (montrée, ou dans son repli) ; sinon en pause sur sa première image. */
  playing: boolean;
  muted: boolean;
  volume: number;
  onReady: () => void;
  onError: () => void;
  onEnded: () => void;
  /** Où en est la vidéo (s), et sa durée : pour la reprendre plus tard. */
  onPosition: (position: number, duration: number) => void;
}

export const PreviewVideo = memo(function PreviewVideo({ uri, hls, startAt, playing, muted, volume, onReady, onError, onEnded, onPosition }: PreviewVideoProps) {
  const ready = useRef(false);
  const fallback = useRef<ReturnType<typeof setTimeout> | null>(null);
  const duration = useRef(0);
  const markReady = useCallback(() => {
    if (fallback.current) clearTimeout(fallback.current);
    fallback.current = null;
    if (ready.current) return;
    ready.current = true;
    onReady();
  }, [onReady]);
  useEffect(() => () => {
    if (fallback.current) clearTimeout(fallback.current);
  }, []);

  const onLoad = useCallback((data: OnLoadData) => {
    if (data.duration > 0) duration.current = data.duration;
    if (ready.current || fallback.current) return;
    fallback.current = setTimeout(markReady, READY_FALLBACK_MS);
  }, [markReady]);
  const onProgress = useCallback((data: OnProgressData) => {
    if (data.seekableDuration > 0) duration.current = data.seekableDuration;
    onPosition(data.currentTime, duration.current);
  }, [onPosition]);

  // Mémorisée : un objet neuf à chaque rendu rechargerait la source native.
  const source = useMemo(
    () => ({ uri, type: hls ? "m3u8" : undefined, startPosition: Math.round(startAt * 1000) }),
    [uri, hls, startAt],
  );

  return (
    <Video
      {...PREVIEW_VIDEO_SURFACE}
      source={source}
      style={StyleSheet.absoluteFill}
      paused={!playing}
      muted={muted}
      volume={volume}
      controls={false}
      resizeMode="cover"
      preventsDisplaySleepDuringVideoPlayback={false}
      hideShutterView
      shutterColor="transparent"
      progressUpdateInterval={PROGRESS_INTERVAL_MS}
      onReadyForDisplay={markReady}
      onLoad={onLoad}
      onProgress={onProgress}
      onError={onError}
      onEnd={onEnded}
    />
  );
});
