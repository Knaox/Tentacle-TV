import type { MutableRefObject } from "react";

/**
 * Watch Together — surface de commande commune aux deux players (web HTML5 et
 * desktop MPV). Chaque player remplit une ref `PlayerTransport` (prop
 * `transportRef`) ; le moteur de sync (useGroupSyncEngine) ne parle qu'à cette
 * interface. Toutes les positions sont en secondes « position film »
 * (0 → durée), jamais en PTS.
 */
export interface PlayerTransport {
  play(): void;
  pause(): void;
  seekTo(seconds: number): void;
  getPositionSeconds(): number;
  isPaused(): boolean;
  /** Rattrapage doux (0.95 / 1.0 / 1.05) — web: playbackRate, MPV: speed. */
  setRate(rate: number): void;
  /** Masque la bannière/écran « épisode suivant » (dismiss venu d'un autre membre). */
  cancelAutoNext?(): void;
  /** Média courant réellement prêt (première frame décodée / readyState ≥ 3).
   *  Lu par la déclaration du moteur : rejoindre un groupe avec un player DÉJÀ
   *  chargé ne doit pas déclarer un buffering que rien ne résoudra jamais. */
  isMediaReady?(): boolean;
  /** Seek en cours dans le player (mpv `seeking` / video.seeking). La boucle
   *  de drift NE corrige PAS pendant un seek en vol : un far-seek HLS prend
   *  plusieurs secondes et chaque re-seek relancerait ffmpeg (spirale). */
  isSeeking?(): boolean;
}

export type PlayerTransportRef = MutableRefObject<PlayerTransport | null>;
