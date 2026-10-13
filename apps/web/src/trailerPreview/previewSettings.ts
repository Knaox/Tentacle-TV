import { createDeviceFlag, useDeviceFlag } from "./deviceFlag";

/**
 * Les deux réglages d'appareil de l'aperçu de bande-annonce au survol.
 *
 * ⚠️ Les clés traversent le stockage de l'appareil : elles ne se renomment
 * jamais (un renommage rallumerait l'aperçu, ou le son, chez qui les a coupés).
 */

/** « Aperçus de bande-annonce au survol » — activé par défaut. */
export const TRAILER_PREVIEWS_STORAGE_KEY = "tentacle_trailer_previews";
/** Le son des aperçus, coupé d'un geste dans la mini-carte — retenu pour les suivants. */
export const TRAILER_PREVIEW_MUTED_STORAGE_KEY = "tentacle_trailer_preview_muted";

export const trailerPreviewsFlag = createDeviceFlag(TRAILER_PREVIEWS_STORAGE_KEY, true);
export const trailerPreviewMutedFlag = createDeviceFlag(TRAILER_PREVIEW_MUTED_STORAGE_KEY, false);

/** Le réglage « Aperçus de bande-annonce au survol », pour la ligne des Réglages. */
export function useTrailerPreviewsSetting(): [boolean, (next: boolean) => void] {
  return useDeviceFlag(trailerPreviewsFlag);
}

/** Le son coupé des aperçus, retenu sur l'appareil. */
export function useTrailerPreviewMuted(): [boolean, (next: boolean) => void] {
  return useDeviceFlag(trailerPreviewMutedFlag);
}
