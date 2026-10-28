/**
 * Octave — ce que les GESTES sur un titre demandent à l'interface de leur
 * application : les mots (`t`, espace `music`), un avis (le toast du web, celui
 * du mobile), le stockage de l'appareil (dernière playlist). Les gestes
 * eux-mêmes (cœur, playlists, droits d'ajout) sont les mêmes partout.
 */

import type { MusicTrack } from "@tentacle-tv/shared/music";
import type { OctaveDeviceStore } from "@tentacle-tv/shared/octave";

/** La traduction de l'espace `music` : celle de react-i18next convient. */
export type MusicTranslate = (key: string, options?: Record<string, unknown>) => string;

export type ActionNoticeKind = "success" | "error" | "info";

export interface ActionNoticeOptions {
  title?: string;
  action?: { label: string; onPress: () => void };
}

export interface OctaveActionsUi {
  t: MusicTranslate;
  notify: (kind: ActionNoticeKind, message: string, options?: ActionNoticeOptions) => void;
  store: OctaveDeviceStore | null;
  /**
   * Des titres viennent de QUITTER une playlist (`stillListed` : ceux qui y restent, un doublon par exemple) :
   * la plateforme qui garde de la musique applique la règle du hors ligne (`planPlaylistRemoval`). Absent : rien.
   */
  onRemovedFromPlaylist?: (playlistId: string, removed: readonly MusicTrack[], stillListed: ReadonlySet<string>) => void;
  /** « Annuler » les a remis à leur place : un retrait pas encore appliqué ne l'est jamais. */
  onRestoredToPlaylist?: (playlistId: string, restored: readonly MusicTrack[]) => void;
}
