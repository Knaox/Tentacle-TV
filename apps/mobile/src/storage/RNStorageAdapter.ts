import AsyncStorage from "@react-native-async-storage/async-storage";
import type { StorageAdapter, UuidGenerator } from "@tentacle-tv/api-client";

/**
 * ⚠️ Liste FERMÉE, et c'est le piège du fichier : `hydrate()` ne précharge que
 * ces clés. Une clé absente s'écrit très bien, mais n'est jamais relue au
 * démarrage — le réglage a l'air de tenir, et repart à son défaut au prochain
 * lancement. Toute nouvelle clé persistée doit donc atterrir ici.
 */
const STORAGE_KEYS = [
  "tentacle_device_id", "tentacle_token", "tentacle_user", "tentacle_server_url",
  // L'identité d'appareil ADOPTÉE du token Jellyfin (adoptJellyfinDeviceId) :
  // sans elle ici, l'adoption s'écrivait mais n'était jamais relue au
  // démarrage — l'appareil changeait d'identité à chaque lancement.
  "tentacle_device_id_jf",
  "tentacle_language", "tentacle_credentials", "tentacle_theme_mode", "tentacle_liquid_glass",
  // Réglages de lecture : le cache local du magasin de compte, qui répond
  // AVANT le serveur (et à sa place, hors ligne).
  "tentacle_playback_settings",
  // Les trois clés d'appareil héritées : elles ne sont plus écrites, mais le
  // magasin les lit UNE fois pour semer les réglages d'un compte qui n'en a
  // pas encore. Sans elles au préchargement, le semis ne verrait rien.
  "tentacle_auto_skip_intro", "tentacle_up_next_card", "tentacle_up_next_countdown",
];

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
  private hydrated = false;
  /** Écritures reçues AVANT l'hydratation (valeur null = suppression). Elles
   *  ne touchent pas le disque : le client Jellyfin est construit pendant le
   *  premier rendu, sur un cache encore vide — il « ne trouve pas » la graine
   *  d'appareil et en régénère une. L'écrire immédiatement RASAIT la graine
   *  persistée (course avec le multiGet d'hydrate) : l'appareil changeait
   *  d'identité à chaque lancement. Ici, le disque GAGNE toujours à
   *  l'hydratation ; seul un provisoire sans valeur disque est conservé. */
  private pendingWrites = new Map<string, string | null>();

  async hydrate(): Promise<void> {
    // Ce que le DISQUE contient réellement — collecté avant toute réconciliation.
    const diskValues = new Map<string, string>();

    // Regular keys from AsyncStorage
    const regularKeys = STORAGE_KEYS.filter((k) => !SECURE_KEYS.has(k) || !SecureStore);
    const pairs = await AsyncStorage.multiGet(regularKeys);
    for (const [key, value] of pairs) {
      if (value != null) diskValues.set(key, value);
    }

    // Secure keys from SecureStore (if available)
    if (SecureStore) {
      for (const key of SECURE_KEYS) {
        try {
          const value = await SecureStore.getItemAsync(key);
          if (value != null) {
            diskValues.set(key, value);
            // Clean up legacy AsyncStorage entry
            AsyncStorage.removeItem(key).catch(() => {});
          } else {
            // Migration: move token from AsyncStorage to SecureStore
            const legacy = await AsyncStorage.getItem(key);
            if (legacy) {
              diskValues.set(key, legacy);
              SecureStore.setItemAsync(key, legacy).catch(console.error);
              AsyncStorage.removeItem(key).catch(() => {});
            }
          }
        } catch {
          const fallback = await AsyncStorage.getItem(key);
          if (fallback) diskValues.set(key, fallback);
        }
      }
    }

    // Réconciliation : le disque écrase tout provisoire du même nom…
    for (const [key, value] of diskValues) this.cache.set(key, value);
    this.hydrated = true;
    // …et seuls les provisoires SANS valeur disque sont enfin persistés.
    for (const [key, value] of this.pendingWrites) {
      if (diskValues.has(key) || value === null) continue;
      this.persist(key, value);
    }
    this.pendingWrites.clear();
  }

  getItem(key: string): string | null {
    return this.cache.get(key) ?? null;
  }

  private persist(key: string, value: string): void {
    if (SecureStore && SECURE_KEYS.has(key)) {
      SecureStore.setItemAsync(key, value).catch(console.error);
    } else {
      AsyncStorage.setItem(key, value).catch(console.error);
    }
  }

  setItem(key: string, value: string): void {
    this.cache.set(key, value);
    if (!this.hydrated) {
      this.pendingWrites.set(key, value);
      return;
    }
    this.persist(key, value);
  }

  removeItem(key: string): void {
    this.cache.delete(key);
    if (!this.hydrated) {
      this.pendingWrites.set(key, null);
      return;
    }
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
