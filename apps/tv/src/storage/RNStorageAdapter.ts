import AsyncStorage from "@react-native-async-storage/async-storage";
import type { StorageAdapter, UuidGenerator } from "@tentacle/api-client";

const STORAGE_KEYS = ["tentacle_device_id", "tentacle_token", "tentacle_user", "tentacle_server_url"];

/**
 * Synchronous storage adapter backed by AsyncStorage.
 * Must call hydrate() before first use to preload values into memory.
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
