import type { CSSProperties } from "react";
import type { TrailerPreviewMimeType, TrailerPreviewPhase } from "@tentacle-tv/shared";

/** Le flux d'un aperçu, prêt pour `<TrailerPreviewVideo>`. */
export interface TrailerPreviewStream {
  /** L'adresse ABSOLUE du flux relayé par le serveur Tentacle (maître HLS ou MP4), jeton compris. */
  src: string;
  mimeType: TrailerPreviewMimeType;
  kind: "hls" | "mp4";
  /** Les hauteurs H.264 du maître, de la plus haute à la plus basse ; vide pour un MP4. */
  heights: readonly number[];
}

/**
 * Ce que `<TrailerPreviewVideo>` reçoit. La mini-carte étale `handle.videoProps`
 * et n'y ajoute que sa mise en page (`className`, `style`) et `hold`.
 */
export interface TrailerPreviewVideoProps {
  stream: TrailerPreviewStream | null;
  /** Le son coupé (geste de l'utilisateur, ou lecture sonore refusée par le navigateur). */
  muted: boolean;
  /** L'aperçu joue (montré, ou dans son fondu de sortie). Faux : chargé et EN PAUSE sur sa première image. */
  playing: boolean;
  /** Le volume visé, de 0 à 1 : le son y glisse (fondu d'entrée à la révélation, de sortie au départ). */
  volume: number;
  /** Le cycle d'aperçu : un nouveau cycle recharge une vidéo neuve. */
  cycle: number;
  /** La première image est décodée (vidéo chargée, cachée, en pause). */
  onReady: () => void;
  /** Échec fatal (réseau, média, blocage) : l'aperçu n'est pas montré, ou s'efface. */
  onError: () => void;
  /** La bande-annonce est finie. */
  onEnded: () => void;
  /** Le navigateur a refusé la lecture SONORE : elle continue en muet, sans erreur. */
  onSoundBlocked: () => void;
  /**
   * Retient la lecture sur la première image, même quand `playing` est vrai —
   * le temps de l'agrandissement de la mini-carte. Le son fond à la reprise.
   */
  hold?: boolean;
  className?: string;
  style?: CSSProperties;
}

/** Ce que `useTrailerPreview` rend à une carte. */
export interface TrailerPreviewHandle {
  phase: TrailerPreviewPhase;
  /** La vidéo doit exister (chargée cachée, puis montrée, puis en fondu de sortie `TRAILER_PREVIEW_TIMING.exitMs`). */
  mount: boolean;
  /**
   * La mini-carte se montre : rendez-vous passé (800 ms), survol tenu, rien ne
   * bloque, et la vidéo prête — OU l'image du titre signalée (`reportStillReady`) :
   * la vidéo la rejoint alors à sa première image (`videoReady`).
   */
  visible: boolean;
  /** La première image de la vidéo est décodée : elle peut se montrer, en fondu sur l'image du titre. */
  videoReady: boolean;
  /**
   * La mini-carte a l'image du titre chargée ET décodée (jamais une image
   * cassée) : la révélation n'attend plus la vidéo. Stable, sans effet hors
   * d'un aperçu dont le serveur a vérifié la bande-annonce.
   */
  reportStillReady: () => void;
  /** La vidéo joue (montrée ou en fondu de sortie). */
  playing: boolean;
  stream: TrailerPreviewStream | null;
  muted: boolean;
  /** Coupe ou rend le son — retenu sur l'appareil pour les aperçus suivants. */
  toggleMute: () => void;
  onReady: () => void;
  onError: () => void;
  onEnded: () => void;
  /** Tout ce que `<TrailerPreviewVideo>` attend, à étaler tel quel (identité stable entre deux changements). */
  videoProps: Omit<TrailerPreviewVideoProps, "hold" | "className" | "style">;
}
