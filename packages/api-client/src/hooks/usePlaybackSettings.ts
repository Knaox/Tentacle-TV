/**
 * L'accès React au magasin des réglages de lecture (partagé entre les
 * appareils d'un compte, cache local pour le hors ligne — voir
 * `createPlaybackSettingsStore` dans @tentacle-tv/shared).
 *
 * Le magasin est un singleton de module, créé au premier usage avec le
 * `StorageAdapter` de la plateforme (localStorage sur web/desktop/webOS,
 * cache AsyncStorage sur mobile et TV). `initPlaybackSettingsStore` permet de
 * le créer HORS React — l'App TV réhydrate ses magasins après l'hydrate()
 * asynchrone d'Android, avant tout rendu.
 */

import { useEffect, useSyncExternalStore } from "react";
import {
  createPlaybackSettingsStore,
  type PlaybackSettings,
  type PlaybackSettingsPatch,
  type PlaybackSettingsStore,
} from "@tentacle-tv/shared";
import { useTentacleConfig } from "../context";
import type { StorageAdapter } from "../storage";
import { tentacleApiFetch } from "./usePreferences";

let settingsStore: PlaybackSettingsStore | null = null;
let lastResync = 0;

/** Une resynchronisation par demi-minute suffit — chaque montage n'en refait pas une. */
const RESYNC_MIN_INTERVAL_MS = 30_000;

export function initPlaybackSettingsStore(storage: StorageAdapter): PlaybackSettingsStore {
  if (!settingsStore) {
    settingsStore = createPlaybackSettingsStore({
      storage,
      readRemote: () => tentacleApiFetch<unknown>("/api/preferences/playback"),
      writeRemote: async (settings) => {
        await tentacleApiFetch("/api/preferences/playback", {
          method: "PUT",
          body: JSON.stringify(settings),
        });
      },
    });
  }
  return settingsStore;
}

export function usePlaybackSettingsStore(): PlaybackSettingsStore {
  const { storage } = useTentacleConfig();
  return initPlaybackSettingsStore(storage);
}

/** Les réglages, réactifs — et resynchronisés (bornés) au montage. */
export function usePlaybackSettings(): PlaybackSettings {
  const store = usePlaybackSettingsStore();

  useEffect(() => {
    const now = Date.now();
    if (now - lastResync < RESYNC_MIN_INTERVAL_MS) return;
    lastResync = now;
    void store.resync();
  }, [store]);

  return useSyncExternalStore(store.subscribe, store.readSnapshot, store.readSnapshot);
}

/** Écrit un correctif partiel (fusion profonde, optimiste, poussé au serveur). */
export function setPlaybackSettings(patch: PlaybackSettingsPatch): void {
  settingsStore?.set(patch);
}

/** Android TV : à appeler après l'hydrate() du stockage natif. */
export function rehydratePlaybackSettings(): void {
  settingsStore?.rehydrate();
}
