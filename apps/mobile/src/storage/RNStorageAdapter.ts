import AsyncStorage from "@react-native-async-storage/async-storage";
import type { StorageAdapter, UuidGenerator } from "@tentacle-tv/api-client";

const STORAGE_KEYS = ["tentacle_device_id", "tentacle_token", "tentacle_user", "tentacle_server_url", "tentacle_language", "tentacle_credentials"];

/** Keys stored in Keychain via SecureStore instead of AsyncStorage. */
const SECURE_KEYS = new Set(["tentacle_token", "tentacle_credentials"]);

// Dynamic import: expo-secure-store requires native module, unavailable in Expo Go
let SecureStore: {
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
  deleteItemAsync: (key: string) => Promise<void>;
} | null = null;
try {
  SecureStore = require("expo-secure-store");
} catch {
  // Native module not available (Expo Go) — fallback to AsyncStorage
}

/**
 * Synchronous storage adapter backed by AsyncStorage + SecureStore.
 * Sensitive keys (tokens) are stored in iOS Keychain via expo-secure-store.
 * Falls back to AsyncStorage if SecureStore is unavailable.
 * Must call hydrate() before first use to preload values into memory.
 */
export class RNStorageAdapter implements StorageAdapter {
  private cache = new Map<string, string>();

  async hydrate(): Promise<void> {
    // Hydrate regular keys from AsyncStorage
    const regularKeys = STORAGE_KEYS.filter((k) => !SECURE_KEYS.has(k) || !SecureStore);
    const pairs = await AsyncStorage.multiGet(regularKeys);
    for (const [key, value] of pairs) {
      if (value != null) this.cache.set(key, value);
    }

    // Hydrate secure keys from SecureStore (if available)
    if (SecureStore) {
      for (const key of SECURE_KEYS) {
        try {
          const value = await SecureStore.getItemAsync(key);
          if (value != null) {
            this.cache.set(key, value);
            // Clean up legacy AsyncStorage entry
            AsyncStorage.removeItem(key).catch(() => {});
          } else {
            // Migration: move token from AsyncStorage to SecureStore
            const legacy = await AsyncStorage.getItem(key);
            if (legacy) {
              this.cache.set(key, legacy);
              SecureStore.setItemAsync(key, legacy).catch(console.error);
              AsyncStorage.removeItem(key).catch(() => {});
            }
          }
        } catch {
          const fallback = await AsyncStorage.getItem(key);
          if (fallback) this.cache.set(key, fallback);
        }
      }
    }
  }

  getItem(key: string): string | null {
    return this.cache.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.cache.set(key, value);
    if (SecureStore && SECURE_KEYS.has(key)) {
      SecureStore.setItemAsync(key, value).catch(console.error);
    } else {
      AsyncStorage.setItem(key, value).catch(console.error);
    }
  }

  removeItem(key: string): void {
    this.cache.delete(key);
    if (SecureStore && SECURE_KEYS.has(key)) {
      SecureStore.deleteItemAsync(key).catch(console.error);
    } else {
      AsyncStorage.removeItem(key).catch(console.error);
    }
  }

  clear(): void {
    this.cache.clear();
    AsyncStorage.clear().catch(console.error);
    if (SecureStore) {
      for (const key of SECURE_KEYS) {
        SecureStore.deleteItemAsync(key).catch(console.error);
      }
    }
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
