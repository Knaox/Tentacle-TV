import { Settings } from "react-native";
import type { StorageAdapter, UuidGenerator } from "@tentacle-tv/api-client";

/**
 * Stockage adossé à `Settings` (NSUserDefaults) — fourni par le cœur de
 * react-native, **persistant sur tvOS** et **synchrone**, sans dépendance ni
 * module natif, et SANS le warning « Persistent storage is not supported on
 * tvOS » d'AsyncStorage. NSUserDefaults est le store local sanctionné par Apple
 * sur tvOS (largement suffisant pour token/prefs/cache home).
 *
 * Synchrone → `hydrate()` est un no-op (plus de course au démarrage : le token
 * est dispo dès le 1er render, fiabilise aussi l'auth WebSocket).
 */
export class RNStorageAdapter implements StorageAdapter {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async hydrate(): Promise<void> { /* no-op : Settings est synchrone + persistant */ }

  getItem(key: string): string | null {
    const v = Settings.get(key);
    return typeof v === "string" ? v : null;
  }

  setItem(key: string, value: string): void {
    Settings.set({ [key]: value });
  }

  removeItem(key: string): void {
    // NSUserDefaults : pas d'API delete via RN Settings → null, lu comme absent.
    Settings.set({ [key]: null });
  }

  /** Écriture critique (token, user, credentials) — Settings persiste de façon
   *  synchrone, on écrit puis on résout immédiatement. */
  async setItemAsync(key: string, value: string): Promise<void> {
    Settings.set({ [key]: value });
  }

  async removeItemAsync(key: string): Promise<void> {
    Settings.set({ [key]: null });
  }
}

/**
 * UUID generator for React Native (Hermes has no crypto.randomUUID).
 */
export class RNUuidGenerator implements UuidGenerator {
  randomUUID(): string {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}
