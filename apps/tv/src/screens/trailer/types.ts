/**
 * Props du lecteur de bande-annonce (`TrailerWebView.tsx`, le flux relayé par
 * le serveur, sur Apple TV comme sur Android TV).
 */
export interface TrailerPlayerProps {
  /** ID YouTube (11 chars) — le serveur en résout le flux. */
  ytId: string;
  /** URL de la page relais d'embed YouTube — plus lue (l'ancienne WebView Android). */
  embedUri: string;
  /** La première image est à l'écran : masque le chargement. */
  onLoadEnd: () => void;
  /** Échec — résolution, flux refusé, lecture qui ne démarre ou n'avance pas → « indisponible ». */
  onError: () => void;
  /** Fin de lecture → l'écran ferme la bande-annonce. */
  onEnded?: () => void;
  /** La lecture lancée attend le réseau, ou repart → l'écran le montre. */
  onWaitingChange?: (waiting: boolean) => void;
}
