import { memo, useCallback, useEffect, useRef } from "react";
import { PreviewVideoElement } from "../../platform/tvos/player/previewVideoElement";

/**
 * La vidéo de l'aperçu (Apple TV : AVPlayer ; Android TV : ExoPlayer) — le
 * flux relayé par le serveur Tentacle, chargé CACHÉ et en pause jusqu'à ce que
 * la grande carte se montre, puis joué. Elle ne décide de rien : elle dit sa
 * première image (`onReady`), sa fin, son échec, et où elle en est.
 *
 * - La première image : AVPlayer la sert même en pause, ExoPlayer rend la
 *   première image d'un flux préparé. Faute de cet avis `READY_FALLBACK_MS`
 *   après le chargement, le chargement vaut prêt : la grande carte montre
 *   alors l'image du titre jusqu'à la première image — jamais un cadre noir
 *   (la couche vidéo est transparente avant).
 * - Le lecteur vient de l'adaptateur de la plateforme (`previewVideoElement`) :
 *   react-native-video sur Apple TV ; sur Android TV, un lecteur d'aperçu natif
 *   sans contrôleur ni focus (celui de react-native-video bloquait le fil UI à
 *   chaque aperçu et volait le focus de la carte).
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

  const onLoad = useCallback((loaded: number) => {
    if (loaded > 0) duration.current = loaded;
    if (ready.current || fallback.current) return;
    fallback.current = setTimeout(markReady, READY_FALLBACK_MS);
  }, [markReady]);
  const onProgress = useCallback((position: number, known: number) => {
    if (known > 0) duration.current = known;
    onPosition(position, duration.current);
  }, [onPosition]);

  return (
    <PreviewVideoElement
      uri={uri}
      hls={hls}
      startAt={startAt}
      playing={playing}
      muted={muted}
      volume={volume}
      progressIntervalMs={PROGRESS_INTERVAL_MS}
      onFirstFrame={markReady}
      onLoad={onLoad}
      onProgress={onProgress}
      onError={onError}
      onEnd={onEnded}
    />
  );
});
