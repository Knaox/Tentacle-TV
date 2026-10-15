import { useSyncExternalStore } from "react";
import { createBooleanStore } from "@tentacle-tv/shared";
import { tvStorage } from "../storage/RNStorageAdapter";

/**
 * Les réglages de l'aperçu des bandes-annonces au focus d'une carte (Apple TV,
 * Android TV) — réglages d'APPAREIL, comme sur le bureau : le salon où l'on
 * regarde, pas le compte. Allumés par défaut, avec le son, comme Netflix.
 * Clés traversées par une chaîne — ne jamais renommer (cf. CLAUDE.md).
 */
export const TRAILER_PREVIEWS_KEY = "tentacle_tv_trailer_previews";
export const TRAILER_PREVIEW_SOUND_KEY = "tentacle_tv_trailer_preview_sound";

/** Coupé : aucune carte ne grandit, rien n'est demandé au serveur. */
export const trailerPreviewsStore = createBooleanStore(tvStorage, TRAILER_PREVIEWS_KEY, true);
/** Coupé : l'aperçu se joue sans le son. */
export const trailerPreviewSoundStore = createBooleanStore(tvStorage, TRAILER_PREVIEW_SOUND_KEY, true);

export function useTrailerPreviewsEnabled(): boolean {
  return useSyncExternalStore(trailerPreviewsStore.subscribe, trailerPreviewsStore.readSnapshot, trailerPreviewsStore.readSnapshot);
}

export function useTrailerPreviewSound(): boolean {
  return useSyncExternalStore(trailerPreviewSoundStore.subscribe, trailerPreviewSoundStore.readSnapshot, trailerPreviewSoundStore.readSnapshot);
}
