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
  /** L'embed est chargé (Android) ; la première image est à l'écran (tvOS). Masque le spinner. */
  onLoadEnd: () => void;
  /** Échec — résolution, flux refusé, lecture qui ne démarre ou n'avance pas (tvOS) → « indisponible ». */
  onError: () => void;
  /** Fin de lecture (tvOS) → l'écran ferme la bande-annonce. */
  onEnded?: () => void;
  /** La lecture lancée attend le réseau, ou repart (tvOS) → l'écran le montre. */
  onWaitingChange?: (waiting: boolean) => void;
}
