import type { SubtitleCue } from "@tentacle-tv/shared";
import type { TrailerTracks } from "@tentacle-tv/tv-core";

export type { TrailerTracks } from "@tentacle-tv/tv-core";

/**
 * Props du lecteur de bande-annonce (`TrailerWebView.tsx`, le flux relayé par
 * le serveur, sur Apple TV comme sur Android TV).
 *
 * Les commandes du lecteur simplifié (qualité, sous-titres, pause, position)
 * sont toutes FACULTATIVES : sans elles, le lecteur d'avant — la bande-annonce
 * en Auto, sans sous-titres, jusqu'au bout.
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
  /**
   * Hauteur choisie (une de `onTracks` › `qualities`) ; `null` ou absent :
   * Auto. La changer recharge le flux À LA MÊME POSITION, sans chargement.
   */
  quality?: number | null;
  /** `lang` de la piste choisie (une de `onTracks` › `subtitles`) ; `null` ou absent : aucune. */
  subtitle?: string | null;
  paused?: boolean;
  /** Les qualités et les pistes du flux, dès sa résolution ; vides face à un serveur sans `trailers.player`. */
  onTracks?: (tracks: TrailerTracks) => void;
  /** Au tic du lecteur (~250 ms), en secondes. */
  onProgress?: (progress: TrailerProgress) => void;
  /** La réplique à l'écran (à rendre par `SubtitleLayer`), à chaque CHANGEMENT seulement ; `null` : rien. */
  onCue?: (cue: SubtitleCue | null) => void;
}

export interface TrailerProgress {
  position: number;
  /** 0 tant que le flux ne l'a pas dite. */
  duration: number;
  /** Jusqu'où le lecteur a déjà de quoi lire. */
  buffered: number;
}

/** La commande impérative du lecteur (ref de `TrailerWebView`). */
export interface TrailerPlayerHandle {
  /** Va à `seconds` (borné à la durée connue) ; le chien de garde est prévenu. */
  seekTo: (seconds: number) => void;
}
