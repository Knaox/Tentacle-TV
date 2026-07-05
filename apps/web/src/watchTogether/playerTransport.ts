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
}

export type PlayerTransportRef = MutableRefObject<PlayerTransport | null>;
