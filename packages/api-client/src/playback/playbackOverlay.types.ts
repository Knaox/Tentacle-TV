/**
 * Le contrat de la coquille de lecture — ce qu'un lecteur lui donne, ce
 * qu'elle lui rend. Isolé de `usePlaybackOverlay.ts` pour la seule raison qui
 * vaille ici : le fichier passait les 300 lignes. Même motif que
 * `desktopPlayer.types.ts` et `videoPlayer.types.ts` côté web.
 */

import type {
  PlayerOverlay,
  ResolvedSegment,
  SegmentType,
} from "@tentacle-tv/shared";

export interface PlaybackOverlayInput {
  itemId: string | undefined;
  isEpisode: boolean;
  hasNextEpisode: boolean;
  /** Position AFFICHÉE par le lecteur, offsets de flux déjà appliqués. */
  positionSeconds: number;
  durationSeconds: number;
  hasStarted: boolean;
  playbackEnded: boolean;
  segments: readonly ResolvedSegment[];
  /** Durée du contrat (ms) ; à défaut, `durationSeconds` fait foi. */
  runtimeMs?: number;
  /**
   * Bibliothèque du média, telle que le contrat la porte. Elle ne sert qu'aux
   * règles « avant la fin » ciblées ; absente, le seuil global s'applique.
   */
  libraryId?: string | null;
  serverAutoplayEnabled: boolean;
  /** TV : le décompte se suspend et rien ne s'affiche pendant le scrub. */
  scrubbing?: boolean;
  /**
   * Les contrôles du lecteur sont-ils à l'écran ? Seule chose qui rende encore
   * un passage MIS EN SOURDINE. Absent = pas d'OSD connu : la sourdine masque
   * alors complètement.
   */
  controlsVisible?: boolean;
  onSeekSeconds: (seconds: number) => void;
  onNextEpisode: () => void;
  onEndOfPlayback: () => void;
  /** Watch Together : annoncer un refus local au groupe. */
  onSegmentDismissNotify?: (type: SegmentType) => void;
  onNextDismissNotify?: () => void;
}

export interface PlaybackOverlayResult {
  overlay: PlayerOverlay;
  /** Miroir synchrone — pour le bouton Retour TV. */
  overlayRef: { readonly current: PlayerOverlay };
  /** Durées totales des glissières de décompte. */
  countdownTotals: { skipMs: number; nextMs: number };
  /** La croix de l'overlay courant : met le passage en sourdine, prévient le groupe. */
  dismissOverlay: () => void;
  /** Les types mis en sourdine pour cette lecture. */
  mutedSegments: ReadonlySet<SegmentType>;
  /** Saut manuel du bouton courant ; « lire maintenant » de la carte. */
  skipNow: () => void;
  playNow: () => void;
  /** Watch Together entrant : un membre a refusé. */
  signalRemoteSegmentDismiss: (type: SegmentType) => void;
  signalRemoteNextDismiss: () => void;
}
