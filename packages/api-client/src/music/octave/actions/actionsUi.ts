/**
 * Octave — ce que les GESTES sur un titre demandent à l'interface de leur
 * application : les mots (`t`, espace `music`), un avis (le toast du web, celui
 * du mobile), le stockage de l'appareil (dernière playlist). Les gestes
 * eux-mêmes (cœur, playlists, droits d'ajout) sont les mêmes partout.
 */

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
}
