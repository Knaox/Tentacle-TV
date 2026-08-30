/**
 * Les props du lecteur de bureau — extraites sur le motif de
 * `videoPlayer.types.ts` : le composant garde le budget de lignes pour sa
 * logique, le contrat vit ici.
 */

import type { MediaItem, ResolvedSegment, QualityKey, QualityPreset, SourceQuality } from "@tentacle-tv/shared";
import type { AudioTrack, SubtitleTrack } from "../VideoPlayer";
import type { LocalSubtitleFile } from "../../downloads/playbackApi";
import type { PlayerTransportRef } from "../../watchTogether/playerTransport";
import type { ApplyToSeriesControl } from "../../hooks/useApplyToSeries";

/** Référence stable : une valeur par défaut inline relancerait les mémos. */
export const EMPTY_SUBTITLE_FILES: LocalSubtitleFile[] = [];

export interface DesktopPlayerProps {
  src: string; title: string; subtitle?: string;
  startPositionSeconds?: number; jellyfinDuration?: number;
  audioTracks?: AudioTrack[]; subtitleTracks?: SubtitleTrack[];
  currentAudio: number; currentSubtitle: number | null; currentQuality: QualityKey;
  sourceQuality?: SourceQuality;
  qualityPresets?: readonly QualityPreset[];
  onAudioChange: (index: number) => void; onSubtitleChange: (index: number | null) => void;
  /** Absent en lecture locale : le sélecteur de qualité est alors masqué. */
  onQualityChange?: (key: QualityKey) => void;
  /** Lecture depuis un fichier local (masque la qualité, pistes via mpv). */
  isLocalPlayback?: boolean;
  /** Mode hors ligne (préférences de pistes résolues localement). */
  offline?: boolean;
  /** Bibliothèque de l'item local (préférences de pistes hors ligne). */
  localLibraryId?: string | null;
  /** Side-cars de sous-titres téléchargés (menus en lecture locale). */
  localSubtitleFiles?: LocalSubtitleFile[];
  onProgress?: (seconds: number, paused: boolean) => void; onStarted?: () => void;
  isDirectPlay?: boolean; streamOffset?: number; posterUrl?: string;
  /** Les segments RÉSOLUS du média (contrat v1, ms) — l'arbitre décide de tout. */
  segments?: readonly ResolvedSegment[];
  /** Durée du contrat, en ms — 0 = inconnue (la durée mpv fait alors foi). */
  runtimeMs?: number;
  /** Bibliothèque du média (contrat de segments) — règles « avant la fin ». */
  libraryId?: string | null;
  hasNextEpisode?: boolean; hasPreviousEpisode?: boolean; nextEpisodeTitle?: string;
  nextEpisodeImageUrl?: string; nextEpisodeDescription?: string;
  nextSeriesBackdropUrl?: string; nextEpisodeThumbUrl?: string;
  /** Garde serveur admin « Déclenchement auto-play » (carte + écran de fin). */
  serverAutoplayEnabled?: boolean;
  itemId?: string;
  item?: MediaItem;
  mediaSourceId?: string;
  onNextEpisode?: () => void; onPreviousEpisode?: () => void; onFallbackToWeb?: () => void;
  /**
   * Erreur de MÉDIA (fichier local disparu, prouvé par la sonde) : le parent
   * démonte le lecteur et affiche l'écran dédié — la bascule de secours n'est
   * PAS mémorisée, mpv reste le lecteur des médias suivants.
   */
  onMediaMissing?: () => void;
  /** Watch Together — surface de commande impérative (play/pause/seek/speed). */
  transportRef?: PlayerTransportRef;
  /** Watch Together — transition lecture/pause observée (état mpv). */
  onPlayStateChange?: (paused: boolean) => void;
  /** Watch Together — buffering mpv (paused-for-cache) + premier « prêt ». */
  onBufferingChange?: (buffering: boolean) => void;
  /** Watch Together — seek local détecté (saut de position discontinu). */
  onSeekComplete?: (seconds: number, paused: boolean) => void;
  /** Watch Together — l'utilisateur a masqué la bannière auto-next (à propager). */
  onAutoNextDismiss?: () => void;
  /** Watch Together — une séance est active sur ce média (refus ⇒ décompte annulé). */
  inGroupSession?: boolean;
  /** Visibilité de l'overlay lecteur (contrôles) — synchronise les overlays externes. */
  onControlsVisibilityChange?: (visible: boolean) => void;
  /** Épisode : case « Appliquer à cette série » (préférence de langues). */
  applyToSeries?: ApplyToSeriesControl;
}
