import { useSyncExternalStore } from "react";
import { createBooleanStore } from "@tentacle-tv/shared";
import { tvStorage } from "../storage/RNStorageAdapter";

/**
 * « Son au démarrage » : le ta-dum de l'ouverture (Apple TV, Android TV). Un réglage
 * d'APPAREIL — le salon, pas le compte —, allumé par défaut.
 * Clé traversée par une chaîne — ne jamais la renommer (cf. CLAUDE.md).
 */
export const BOOT_SOUND_KEY = "tentacle_tv_boot_sound";

export const bootSoundStore = createBooleanStore(tvStorage, BOOT_SOUND_KEY, true);

export function useBootSoundEnabled(): boolean {
  return useSyncExternalStore(bootSoundStore.subscribe, bootSoundStore.readSnapshot, bootSoundStore.readSnapshot);
}
