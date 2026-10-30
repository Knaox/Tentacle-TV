import AsyncStorage from "@react-native-async-storage/async-storage";
import type { StorageAdapter, UuidGenerator } from "@tentacle-tv/api-client";
import { INSTALL_MARKER_KEY, shouldPurgeSecureKeys } from "./freshInstall";

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
  // « Vous regardez encore ? » — la copie du réglage du COMPTE
  // (`STILL_WATCHING_CACHE_KEY`) : sans elle ici, le lecteur hors ligne
  // oublierait le choix (et que le serveur le connaît) à chaque lancement.
  "tentacle_still_watching",
  // Les trois clés d'appareil héritées : elles ne sont plus écrites, mais le
  // magasin les lit UNE fois pour semer les réglages d'un compte qui n'en a
  // pas encore. Sans elles au préchargement, le semis ne verrait rien.
  "tentacle_auto_skip_intro", "tentacle_up_next_card", "tentacle_up_next_countdown",
  // L'accusé du démarrage à froid des recommandations (par compte, sur cet
  // appareil) : lu au premier rendu de « Pour vous ».
  "tentacle_coldstart_ack",
  // Le hors ligne — réglages D'APPAREIL, comme le thème (mêmes clés que le
  // web) : mode hors ligne manuel, économie de données, notification « prêt »,
  // accusé « continuer en données mobiles ». Les caches de langues et
  // « Wi-Fi seulement » vivent, eux, dans la base locale du hors ligne.
  "tentacle_offline_manual", "tentacle_data_saver", "tentacle_offline_notify_ready", "tentacle_offline_live_activity",
  "tentacle_offline_cellular_ack",
  // Le dernier mot du serveur sur le droit `keepOffline` de chaque compte de
  // l'appareil (`OFFLINE_KEEP_RIGHT_KEY`, offline-core) : hors ligne, il fait foi.
  "tentacle_offline_keep_right",
  // Le lecteur — réglages D'APPAREIL (`player/engine/engineSettings.ts`) :
  // moteur vidéo, Atmos du système, sous-titres stylés, taille et position des
  // sous-titres, fréquence de l'écran calée sur le film. Un téléphone décode
  // ce que l'autre ne décode pas : pas de compte.
  "tentacle_video_engine", "tentacle_prefer_system_atmos", "tentacle_mpv_styled_subs",
  "tentacle_sub_scale", "tentacle_sub_pos", "tentacle_match_frame_rate",
  // Ma liste en grille ou en liste — préférence d'appareil, même clé que le web.
  "tentacle_watchlist_view",
  // Les comptes déjà invités à choisir un avatar sur cet appareil
  // (`AVATAR_INVITE_SEEN_KEY`, même clé que le web) : absente d'ici,
  // l'invitation unique reviendrait à chaque lancement.
  "tentacle_avatar_invite_seen",
  // Le tour de l'invitation (`AVATAR_INVITE_ROUND_KEY`) : absent d'ici, elle repasserait à chaque lancement.
  "tentacle_avatar_invite_round",
  // La session de PROFIL de la Famille (`@tentacle-tv/shared` › `profileSessionStore`) :
  // la marque du profil actif, la réserve de la session du compte (un SECRET :
  // trousseau), le dernier profil choisi (`MOBILE_PROFILE_STAY_KEY`), le choix
  // « Qui regarde ? » au démarrage (`MOBILE_PROFILE_LAUNCH_KEY`) et
  // le premier lancement déjà vu par profil (`FIRST_RUN_SEEN_KEY`). Absentes d'ici,
  // l'app rouvrirait au nom du profil sans pouvoir revenir au compte.
  "tentacle_profile_session", "tentacle_account_session", "tentacle_mobile_profile_stay",
  "tentacle_mobile_profile_launch",
  "tentacle_first_run_seen",
  // « Reproposer le code PIN et la photo » : la dernière demande du serveur honorée ici (`PROMPTS_RESET_SEEN_KEY`).
  "tentacle_prompts_reset_seen",
  // Les réglages d'appareil de l'ouverture du démarrage (src/bootIntro/bootIntroSettings.ts).
  "tentacle_boot_intro", "tentacle_boot_sound",
  // Les invitations de Watch Together que la boîte a déjà présentées d'elle-même
  // (`WT_INVITES_SHOWN_KEY`, shared, même clé que le web) : absente d'ici,
  // une invitation refermée sans réponse reviendrait à chaque lancement.
  "tentacle_wt_invites_shown",
  // Octave — réglages d'APPAREIL (`src/octave/settings/`, mêmes clés que le bureau) : transition douce, tenue à
  // jour des playlists gardées, « ne pas demander le code PIN au démarrage », « au démarrage, ouvrir »,
  // apparence et Liquid Glass d'Octave.
  "tentacle_octave_crossfade", "tentacle_octave_offline_autosync", "tentacle_octave_skip_launch_pin",
  "tentacle_octave_startup", "tentacle_octave_theme", "tentacle_octave_liquid_glass",
  // Octave — le mode musique (mêmes clés que le web et le bureau, `@tentacle-tv/shared/octave/mode`) :
  // le mode, « Au démarrage, ouvrir », le miroir de sa disponibilité, la page où l'on était.
  "tentacle_octave_mode", "tentacle_octave_launch", "tentacle_octave_page",
  // Octave (pages) : la mémoire de l'appareil — recherches récentes, « déjà écouté », albums et artistes
  // consultés, dernière playlist du « + », tri des albums (@tentacle-tv/shared/octave › pages, api-client).
  "tentacle_octave_recent_searches", "tentacle_octave_search_listens", "tentacle_octave_recent_visits",
  "tentacle_octave_last_playlist", "tentacle_octave_album_sort",
  // Octave : les titres récemment recherchés et le versement unique de l'historique au compte (`searchHistoryDevice`).
  "tentacle_octave_recent_search_tracks", "tentacle_octave_search_history_synced",
  // Octave : la session du lecteur reprise en pause au retour (`attachPlayerResume`, api-client).
  "tentacle_octave_player",
];

/** Délai avant le second essai de lecture du trousseau. */
const SECURE_RETRY_MS = 300;

/** Keys stored in Keychain via SecureStore instead of AsyncStorage. */
const SECURE_KEYS = new Set(["tentacle_token", "tentacle_credentials", "tentacle_account_session"]);

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
 * Une lecture du trousseau peut échouer de façon passagère (Keystore pas prêt
 * juste après le lancement) : un second essai avant de conclure, sinon la
 * session paraît perdue alors que le jeton est bien sur le disque.
 */
async function readSecure(store: NonNullable<typeof SecureStore>, key: string): Promise<string | null> {
  try {
    return await store.getItemAsync(key);
  } catch {
    await new Promise((resolve) => setTimeout(resolve, SECURE_RETRY_MS));
    return store.getItemAsync(key);
  }
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

    // Le trousseau survit à la désinstallation : sur une installation neuve,
    // ses clés sont celles de la précédente — purgées, jamais relues (cf.
    // freshInstall.ts). Attendu : une suppression encore en vol croiserait le
    // jeton qu'écrira la prochaine connexion.
    const marker = await AsyncStorage.getItem(INSTALL_MARKER_KEY);
    const purgeSecure = shouldPurgeSecureKeys({
      marker,
      serverUrl: diskValues.get("tentacle_server_url") ?? null,
      user: diskValues.get("tentacle_user") ?? null,
    });
    if (purgeSecure && SecureStore) await this.purgeSecureKeys(SecureStore);
    if (marker === null) AsyncStorage.setItem(INSTALL_MARKER_KEY, "1").catch(console.error);

    // Secure keys from SecureStore (if available)
    if (SecureStore && !purgeSecure) {
      for (const key of SECURE_KEYS) {
        try {
          const value = await readSecure(SecureStore, key);
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

  private async purgeSecureKeys(store: NonNullable<typeof SecureStore>): Promise<void> {
    for (const key of SECURE_KEYS) {
      await store.deleteItemAsync(key).catch(console.error);
    }
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
