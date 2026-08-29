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

import { useCallback, useEffect, useSyncExternalStore } from "react";
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

/**
 * L'OVERRIDE de séance : les réglages de l'hôte d'un groupe Watch Together.
 *
 * Une séance commune ne peut pas avoir deux comportements — si l'hôte passe
 * les génériques tout seul et qu'un membre les garde, l'un des deux subit la
 * position de l'autre sans comprendre d'où elle vient. Le serveur envoie donc
 * les réglages de l'hôte dans l'état du groupe, et ils passent DEVANT le
 * magasin local, sans jamais l'écrire : les réglages du membre reviennent
 * intacts à la sortie.
 *
 * Un canal de module plutôt qu'une prop : les six surfaces lisent déjà
 * `usePlaybackSettings()`, elles suivent toutes sans être touchées. Même motif
 * que le bus de refus de saut, pour la même raison.
 */
let groupOverride: PlaybackSettings | null = null;
const overrideListeners = new Set<() => void>();

/** Posé par le fournisseur Watch Together ; `null` hors groupe ou si l'on EST
 *  l'hôte (ses propres réglages font déjà foi). */
export function setGroupPlaybackSettings(settings: PlaybackSettings | null): void {
  if (settings === groupOverride) return;
  groupOverride = settings;
  overrideListeners.forEach((listener) => listener());
}

export function groupPlaybackSettings(): PlaybackSettings | null {
  return groupOverride;
}

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

/**
 * Les réglages EFFECTIFS, réactifs — et resynchronisés (bornés) au montage.
 *
 * L'override de groupe passe devant le magasin : dans une séance Watch
 * Together, c'est l'hôte qui décide pour tout le monde. Hors groupe, il est
 * nul et rien ne change.
 */
export function usePlaybackSettings(): PlaybackSettings {
  const store = usePlaybackSettingsStore();

  useEffect(() => {
    const now = Date.now();
    if (now - lastResync < RESYNC_MIN_INTERVAL_MS) return;
    lastResync = now;
    void store.resync();
  }, [store]);

  const subscribe = useCallback(
    (callback: () => void) => {
      const stop = store.subscribe(callback);
      overrideListeners.add(callback);
      return () => {
        stop();
        overrideListeners.delete(callback);
      };
    },
    [store],
  );
  const read = useCallback(() => groupOverride ?? store.readSnapshot(), [store]);

  return useSyncExternalStore(subscribe, read, read);
}

/**
 * Les réglages PROPRES du compte, override ignoré — c'est ce que l'écran de
 * réglages doit montrer et modifier. Sans quoi un membre de groupe verrait les
 * choix de son hôte dans SES préférences, et les écraserait en y touchant.
 */
export function useOwnPlaybackSettings(): PlaybackSettings {
  const store = usePlaybackSettingsStore();
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
