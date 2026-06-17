import AsyncStorage from "@react-native-async-storage/async-storage";
import type { StorageAdapter, UuidGenerator } from "@tentacle-tv/api-client";

const STORAGE_KEYS = ["tentacle_device_id", "tentacle_token", "tentacle_user", "tentacle_server_url", "tentacle_language", "tentacle_jellyfin_url", "tentacle_jellyfin_token"];

/**
 * Synchronous storage adapter backed by AsyncStorage.
 * Must call hydrate() before first use to preload values into memory.
 *
 * NOTE persistance tvOS : AsyncStorage ne garantit pas la persistance sur tvOS
 * (warning natif « Persistent storage is not supported on tvOS »). Une migration
 * vers un stockage persistant tvOS (MMKV) a été tentée mais ne se lie pas
 * nativement sur react-native-tvos (0 symbole dans le binaire malgré
 * pod/autolink OK) → à reprendre avec un setup natif dédié.
 */
export class RNStorageAdapter implements StorageAdapter {
  private cache = new Map<string, string>();

  async hydrate(): Promise<void> {
    const pairs = await AsyncStorage.multiGet(STORAGE_KEYS);
    for (const [key, value] of pairs) {
      if (value != null) this.cache.set(key, value);
    }
  }

  getItem(key: string): string | null {
    return this.cache.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.cache.set(key, value);
    AsyncStorage.setItem(key, value).catch(console.error);
  }

  removeItem(key: string): void {
    this.cache.delete(key);
    AsyncStorage.removeItem(key).catch(console.error);
  }

  async setItemAsync(key: string, value: string): Promise<void> {
    this.cache.set(key, value);
    await AsyncStorage.setItem(key, value);
  }

  async removeItemAsync(key: string): Promise<void> {
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
