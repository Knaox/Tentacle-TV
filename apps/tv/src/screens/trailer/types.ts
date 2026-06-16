/**
 * Props communes aux deux variants de lecteur de bande-annonce, résolus par
 * plateforme : `TrailerWebView.tsx` (Android, Webui YouTube) et
 * `TrailerWebView.ios.tsx` (Apple TV, flux MP4 via react-native-video).
 * Chaque variant n'utilise que les champs qui le concernent.
 */
export interface TrailerPlayerProps {
  /** ID YouTube (11 chars) — utilisé par le variant tvOS pour résoudre le flux. */
  ytId: string;
  /** URL de la page relais d'embed YouTube — utilisée par le variant Android. */
  embedUri: string;
  /** Le flux/embed est chargé (masque le spinner). */
  onLoadEnd: () => void;
  /** Échec de chargement → l'écran affiche le fallback « indisponible ». */
  onError: () => void;
  /** Fin de lecture (tvOS) → l'écran ferme la bande-annonce. */
  onEnded?: () => void;
}
