/**
 * Ce que la vidéo d'aperçu reçoit et dit, quelle que soit la plateforme
 * (`previewVideoElement` : react-native-video sur Apple TV, le lecteur
 * d'aperçu natif sur Android TV). Les secondes partout.
 */
export interface PreviewVideoElementProps {
  uri: string;
  hls: boolean;
  /** Où commencer (s). */
  startAt: number;
  playing: boolean;
  muted: boolean;
  volume: number;
  /** Le pas des positions relevées (ms). */
  progressIntervalMs: number;
  /** La première image est posée. */
  onFirstFrame: () => void;
  /** Le flux est chargé ; sa durée (s), 0 si inconnue. */
  onLoad: (duration: number) => void;
  /** Où en est la vidéo, et sa durée (s, 0 si inconnue). */
  onProgress: (position: number, duration: number) => void;
  onError: () => void;
  onEnd: () => void;
}
