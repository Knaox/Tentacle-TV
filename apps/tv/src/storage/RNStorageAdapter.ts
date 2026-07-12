import { Platform, Settings } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { StorageAdapter, UuidGenerator } from "@tentacle-tv/api-client";

/**
 * `true` sur le fork react-native-tvos ciblant l'Apple TV — l'app tv ne build
 * `ios` que pour tvOS. Sert à choisir le backend de persistance.
 */
export const IS_TVOS = Platform.OS === "ios";

/**
 * Stockage TV — lectures synchrones après `hydrate()`, backend par plateforme :
 *
 * - **tvOS** : `Settings` (NSUserDefaults) — persistant, synchrone, sans module
 *   natif supplémentaire, store local sanctionné par Apple sur tvOS (largement
 *   suffisant pour token/prefs/cache home). `hydrate()` est un no-op.
 * - **Android TV** : `Settings` N'EXISTE PAS (no-op + warning « Settings is not
 *   yet supported on this platform » → aucune persistance : jumelage et session
 *   perdus à chaque relance). On s'adosse à AsyncStorage derrière un cache
 *   mémoire : `hydrate()` précharge toutes les clés (appelé au boot dans
 *   `App.tsx` avant le premier render), les écritures sont write-through.
 */
export class RNStorageAdapter implements StorageAdapter {
  private cache = new Map<string, string>();

  async hydrate(): Promise<void> {
    if (IS_TVOS) return; // Settings est synchrone + persistant
    const keys = await AsyncStorage.getAllKeys();
    if (keys.length === 0) return;
    for (const [key, value] of await AsyncStorage.multiGet(keys)) {
      if (value != null) this.cache.set(key, value);
    }
  }

  getItem(key: string): string | null {
    if (IS_TVOS) {
      const v = Settings.get(key);
      return typeof v === "string" ? v : null;
    }
    return this.cache.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (IS_TVOS) {
      Settings.set({ [key]: value });
      return;
    }
    this.cache.set(key, value);
    AsyncStorage.setItem(key, value).catch(console.error);
  }

  removeItem(key: string): void {
    if (IS_TVOS) {
      // NSUserDefaults : pas d'API delete via RN Settings → null, lu comme absent.
      Settings.set({ [key]: null });
      return;
    }
    this.cache.delete(key);
    AsyncStorage.removeItem(key).catch(console.error);
  }

  /** Écriture critique (token, user, credentials) — ne résout qu'une fois la
   *  persistance réellement effectuée (tvOS : Settings est synchrone). */
  async setItemAsync(key: string, value: string): Promise<void> {
    if (IS_TVOS) {
      Settings.set({ [key]: value });
      return;
    }
    this.cache.set(key, value);
    await AsyncStorage.setItem(key, value);
  }

  async removeItemAsync(key: string): Promise<void> {
    if (IS_TVOS) {
      Settings.set({ [key]: null });
      return;
    }
    this.cache.delete(key);
    await AsyncStorage.removeItem(key);
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
