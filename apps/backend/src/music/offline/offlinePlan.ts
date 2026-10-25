/**
 * Octave — le PLAN de la musique gardée hors ligne (capacité `offline.music`) :
 * pour des titres de la bibliothèque, d'où le bureau les tire et sous quelle
 * forme. Règle PURE : les droits et l'index lus par la route
 * (`musicOfflineRoutes.ts`) entrent ici, la décision en sort.
 *
 * L'administration décide, comme pour les films : sans `EnableContentDownloading`,
 * rien ; avec son mode Allégé (et la conversion du son), l'Allégé AUDIO pour une
 * source qui y gagne (`audioLight.ts`) ; sinon l'original, tiré tel quel avec sa
 * taille exacte (contrôle d'intégrité du moteur). Le plafond de débit de
 * l'administration s'applique aux deux routes.
 */

import type { MusicOfflineTrackPlan } from "../contract/musicCoreApi";
import type { IndexRow } from "../index/indexTypes";
import {
  AUDIO_PRESETS,
  audioLightEstimate,
  DEFAULT_AUDIO_PRESET,
  lightPaysOff,
} from "../../services/offlinePrepare/audioLight";

/** Un titre planifié — la forme du contrat (`musicCoreApi.ts`). */
export type OfflineTrackPlan = MusicOfflineTrackPlan;

export interface OfflinePlanRights {
  /** Allégé audio permis par l'administration (`audioLightAllowed`). */
  light: boolean;
}

/** Une extension de fichier sûre, tirée du conteneur Jellyfin (`flac`, `mp3`, `m4a`, `ogg`…). */
function containerExt(row: IndexRow): string {
  const raw = (row.format?.container ?? row.format?.codec ?? "").split(",")[0]?.trim().toLowerCase() ?? "";
  return /^[a-z0-9]{1,5}$/.test(raw) ? raw : "audio";
}

export function planTrack(row: IndexRow, rights: OfflinePlanRights): OfflineTrackPlan {
  const format = row.format;
  const light = rights.light && format !== null && lightPaysOff({ lossless: format.lossless, bitrate: format.bitrate });
  if (light) {
    const preset = AUDIO_PRESETS[DEFAULT_AUDIO_PRESET];
    return {
      id: row.id,
      variant: "light",
      preset: DEFAULT_AUDIO_PRESET,
      path: `/api/downloads/light/${row.id}?mediaSourceId=${row.id}&preset=${DEFAULT_AUDIO_PRESET}`,
      container: "m4a",
      expectedSize: null,
      estimatedSize: preset ? audioLightEstimate(row.durationMs, preset) : null,
    };
  }
  return {
    id: row.id,
    variant: "original",
    preset: null,
    path: `/api/downloads/original/${row.id}?mediaSourceId=${row.id}`,
    container: containerExt(row),
    expectedSize: row.sizeBytes,
    estimatedSize: row.sizeBytes,
  };
}
