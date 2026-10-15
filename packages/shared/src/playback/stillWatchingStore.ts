/**
 * Le magasin du réglage « Vous regardez encore ? » — cache local D'ABORD,
 * serveur ensuite, comme les réglages de lecture (`playbackSettingsStore.ts`) :
 * le lecteur hors ligne lit la copie locale, `resync()` l'aligne sur le compte.
 *
 * La copie retient aussi si le SERVEUR connaît le réglage (`supported`) : la
 * fonction ne tourne que face à un serveur qui la déclare (capacité
 * `playback.stillWatching`) — un appareil à jour face à un serveur d'avant
 * n'en subit rien —, et hors ligne, la dernière réponse fait foi.
 */

import type { DeviceStorage } from "../player/deviceSettings";
import { DEFAULT_STILL_WATCHING_SETTINGS, normalizeStillWatchingSettings, type StillWatchingSettings } from "./stillWatchingSettings";

export const STILL_WATCHING_CACHE_KEY = "tentacle_still_watching";

export interface StillWatchingSnapshot {
  /** Le serveur du compte connaît le réglage : la fonction peut tourner. */
  supported: boolean;
  settings: StillWatchingSettings;
}

export interface StillWatchingStore {
  subscribe(callback: () => void): () => void;
  readSnapshot(): StillWatchingSnapshot;
  /** Écriture optimiste, poussée au serveur (re-poussée au prochain `resync` si elle échoue). */
  set(patch: Partial<StillWatchingSettings>): void;
  /** Relit le compte — à n'appeler que face à un serveur qui déclare la capacité. */
  resync(): Promise<void>;
  /** Le serveur ne déclare PAS la capacité : la fonction se tait. */
  markUnsupported(): void;
  rehydrate(): void;
}

export interface StillWatchingStoreDeps {
  storage: DeviceStorage;
  /** GET /api/preferences/still-watching — `{ stored, settings }`. */
  readRemote: () => Promise<unknown>;
  /** PUT /api/preferences/still-watching. */
  writeRemote: (settings: StillWatchingSettings) => Promise<void>;
}

function readCache(storage: DeviceStorage): StillWatchingSnapshot {
  try {
    const raw = storage.getItem(STILL_WATCHING_CACHE_KEY);
    const parsed = raw === null ? null : (JSON.parse(raw) as { supported?: unknown; settings?: unknown } | null);
    return { supported: parsed?.supported === true, settings: normalizeStillWatchingSettings(parsed?.settings) };
  } catch {
    return { supported: false, settings: { ...DEFAULT_STILL_WATCHING_SETTINGS } };
  }
}

const sameSnapshot = (a: StillWatchingSnapshot, b: StillWatchingSnapshot): boolean => JSON.stringify(a) === JSON.stringify(b);

export function createStillWatchingStore(deps: StillWatchingStoreDeps): StillWatchingStore {
  const listeners = new Set<() => void>();
  let snapshot = readCache(deps.storage);
  let pendingWrite = false;

  const apply = (next: StillWatchingSnapshot): void => {
    if (sameSnapshot(next, snapshot)) return;
    snapshot = next;
    try {
      deps.storage.setItem(STILL_WATCHING_CACHE_KEY, JSON.stringify(next));
    } catch {
      // Stockage indisponible : le réglage vaut pour cette session.
    }
    listeners.forEach((listener) => listener());
  };

  const push = async (settings: StillWatchingSettings): Promise<void> => {
    try {
      await deps.writeRemote(settings);
      pendingWrite = false;
    } catch {
      pendingWrite = true;
    }
  };

  return {
    subscribe(callback) {
      listeners.add(callback);
      return () => {
        listeners.delete(callback);
      };
    },
    readSnapshot: () => snapshot,
    set(patch) {
      const settings = normalizeStillWatchingSettings({ ...snapshot.settings, ...patch });
      apply({ supported: snapshot.supported, settings });
      pendingWrite = true;
      void push(settings);
    },
    async resync() {
      if (pendingWrite) {
        await push(snapshot.settings);
        if (!snapshot.supported && !pendingWrite) apply({ ...snapshot, supported: true });
        return;
      }
      let raw: unknown;
      try {
        raw = await deps.readRemote();
      } catch {
        return; // Hors ligne : la copie locale reste la vérité du moment.
      }
      const response = (typeof raw === "object" && raw !== null ? raw : null) as { settings?: unknown } | null;
      if (!response || typeof response.settings !== "object") return; // Réponse méconnaissable : ne rien toucher.
      apply({ supported: true, settings: normalizeStillWatchingSettings(response.settings) });
    },
    markUnsupported() {
      if (snapshot.supported) apply({ ...snapshot, supported: false });
    },
    rehydrate() {
      apply(readCache(deps.storage));
    },
  };
}
