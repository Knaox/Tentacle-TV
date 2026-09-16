import type { MutableRefObject } from "react";

/**
 * Watch Together — surface de commande commune aux deux players (web HTML5 et
 * desktop MPV). Chaque player remplit une ref `PlayerTransport` (prop
 * `transportRef`) ; le moteur de sync (useGroupSyncEngine) ne parle qu'à cette
 * interface. Toutes les positions sont en secondes « position film »
 * (0 → durée), jamais en PTS.
 */
export interface PlayerTransport {
  /** Précision de `getPositionSeconds` : `coarse` = position extrapolée depuis
   *  une valeur étranglée (mpv) — la boucle de dérive élargit sa zone morte. */
  precision?: "fine" | "coarse";
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
  /** Posé sur `targetSeconds` (position film) : plus de seek en vol, données
   *  décodables à cet endroit, position à moins de 150 ms de la cible. Lu par
   *  la barrière de synchronisation avant de confirmer « prêt ». */
  isSettledAt?(targetSeconds: number): boolean;
  /** Appelé DANS le geste de l'utilisateur quand la lecture est demandée au
   *  serveur au lieu d'être lancée : un lecteur qui n'a jamais joué s'en sert
   *  pour lever ses restrictions de lecture automatique (WebKit) — sans rien
   *  laisser voir. Inutile côté mpv. */
  primeGesture?(): void;
}

export type PlayerTransportRef = MutableRefObject<PlayerTransport | null>;
