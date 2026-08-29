/**
 * Le magasin des réglages de lecture — cache local D'ABORD, serveur ensuite.
 *
 * L'ordre de vérité : l'instantané répond en synchrone depuis le cache de
 * l'appareil (le lecteur doit savoir quoi faire HORS LIGNE, au moment précis
 * où il décide) ; `resynchroniser()` aligne ensuite sur le serveur. Une
 * écriture est optimiste : posée localement tout de suite, poussée en PUT —
 * et si le PUT échoue, la valeur locale reste et sera re-poussée à la
 * prochaine resynchronisation (jamais écrasée par une lecture tant qu'une
 * écriture est en attente).
 *
 * Le SEMIS : à la première resynchronisation d'un compte que le serveur ne
 * connaît pas (`stored: false`), les trois anciennes clés d'appareil sont
 * lues UNE fois. Si elles portent un refus, il est converti et poussé ; si
 * elles sont vierges, rien n'est poussé — un autre appareil, peut-être mieux
 * réglé, garde ainsi le droit de semer.
 *
 * La MISE EN SOURDINE : une écriture en attente était re-poussée à CHAQUE
 * resynchronisation. Sur un serveur qui répond 500 — table absente, migration
 * oubliée — cela produisait une rafale sans fin, une requête par bascule et
 * par montage, jusqu'à noyer la console (constaté le 29.08 sur
 * `/api/preferences/playback`). Un 5xx est une RÉPONSE : le serveur a compris
 * et refuse, le marteler n'y changera rien. On se tait donc aussitôt, pour un
 * temps borné. Une coupure réseau, elle, se répare toute seule : on ne se tait
 * qu'après plusieurs échecs. Dans les deux cas la valeur locale reste la
 * vérité de l'appareil, et une nouvelle action de l'utilisateur relance
 * immédiatement la poussée.
 */

import { DEVICE_SETTING_KEYS } from "../player/deviceSettings";
import type { DeviceStorage } from "../player/deviceSettings";
import {
  DEFAULT_PLAYBACK_SETTINGS,
  normalizePlaybackSettings,
  type NextEpisodeSettings,
  type PlaybackSettings,
  type SegmentSettings,
} from "./playbackSettings";

export const SETTINGS_CACHE_KEY = "tentacle_playback_settings";

/** Un correctif partiel, par famille — ce que produit une bascule de réglage. */
export interface PlaybackSettingsPatch {
  intro?: Partial<SegmentSettings>;
  outro?: Partial<SegmentSettings>;
  recap?: Partial<SegmentSettings>;
  preview?: Partial<SegmentSettings>;
  next?: Partial<NextEpisodeSettings>;
}

export interface PlaybackSettingsStore {
  subscribe(callback: () => void): () => void;
  readSnapshot(): PlaybackSettings;
  set(patch: PlaybackSettingsPatch): void;
  resync(): Promise<void>;
  /** Android TV : le cache est rempli par un hydrate() asynchrone au démarrage. */
  rehydrate(): void;
}

export interface SettingsStoreDeps {
  storage: DeviceStorage;
  /** GET /api/preferences/playback — rend `{ stored, settings }`. */
  readRemote: () => Promise<unknown>;
  /** PUT /api/preferences/playback. */
  writeRemote: (settings: PlaybackSettings) => Promise<void>;
}

/** Les anciennes clés, converties une seule fois par le semis. */
export function seedFromLegacyDeviceKeys(
  read: (key: string) => string | null,
): PlaybackSettings {
  const seed = normalizePlaybackSettings(DEFAULT_PLAYBACK_SETTINGS);
  const isOff = (key: string): boolean => {
    try {
      return read(key) === "false";
    } catch {
      return false;
    }
  };
  if (isOff(DEVICE_SETTING_KEYS.autoSkipIntro)) seed.intro.action = "button";
  if (isOff(DEVICE_SETTING_KEYS.upNextCard)) seed.next.nextCard = false;
  if (isOff(DEVICE_SETTING_KEYS.upNextCountdown)) {
    // L'ancienne clé gouvernait le minuteur ET l'acte : on ne fait pas
    // apparaître un enchaînement chez quelqu'un qui l'avait éteint.
    seed.next.nextCountdown = false;
    seed.next.nextAutoPlay = false;
  }
  return seed;
}

/** Le temps qu'on se tait avant de retenter — le serveur a pu être réparé. */
export const PUSH_MUTE_MS = 5 * 60_000;

/** Échecs SANS réponse (réseau) tolérés avant de se taire aussi. */
export const PUSH_MAX_FAILURES = 3;

/**
 * Le serveur a-t-il RÉPONDU un refus définitif ? Duck typing volontaire :
 * `shared` ne dépend de rien, et l'erreur vient d'`api-client`
 * (`TentacleApiError`) comme elle pourrait venir d'un autre transport.
 */
function isServerRefusal(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" && status >= 500 && status < 600;
}

const areIdentical = (a: PlaybackSettings, b: PlaybackSettings): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

export function createPlaybackSettingsStore(deps: SettingsStoreDeps): PlaybackSettingsStore {
  const listeners = new Set<() => void>();
  let pendingWrite = false;
  let failedPushes = 0;
  let mutedUntilMs = 0;

  const readCache = (): PlaybackSettings => {
    try {
      const raw = deps.storage.getItem(SETTINGS_CACHE_KEY);
      return normalizePlaybackSettings(raw === null ? undefined : JSON.parse(raw));
    } catch {
      return normalizePlaybackSettings(undefined);
    }
  };

  let snapshot = readCache();

  const apply = (settings: PlaybackSettings): void => {
    if (areIdentical(settings, snapshot)) return;
    snapshot = settings;
    try {
      deps.storage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(settings));
    } catch {
      // Stockage indisponible : le réglage vaut pour cette session.
    }
    listeners.forEach((listener) => listener());
  };

  const push = async (settings: PlaybackSettings): Promise<void> => {
    try {
      await deps.writeRemote(settings);
      pendingWrite = false;
      failedPushes = 0;
      mutedUntilMs = 0;
    } catch (error) {
      pendingWrite = true;
      failedPushes += 1;
      if (isServerRefusal(error) || failedPushes >= PUSH_MAX_FAILURES) {
        mutedUntilMs = Date.now() + PUSH_MUTE_MS;
      }
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
      const merged = normalizePlaybackSettings({
        intro: { ...snapshot.intro, ...patch.intro },
        outro: { ...snapshot.outro, ...patch.outro },
        recap: { ...snapshot.recap, ...patch.recap },
        preview: { ...snapshot.preview, ...patch.preview },
        next: { ...snapshot.next, ...patch.next },
      });
      apply(merged);
      pendingWrite = true;
      // L'utilisateur vient d'agir : il a droit à une tentative, sourdine ou pas.
      mutedUntilMs = 0;
      failedPushes = 0;
      void push(merged);
    },

    async resync() {
      // Une écriture attend encore : on re-pousse au lieu de se faire écraser
      // — sauf en sourdine, où la valeur locale reste seule la vérité (relire
      // le serveur écraserait le réglage que l'utilisateur vient de poser).
      if (pendingWrite) {
        if (Date.now() < mutedUntilMs) return;
        await push(snapshot);
        return;
      }

      let raw: unknown;
      try {
        raw = await deps.readRemote();
      } catch {
        return; // Hors ligne : le cache local reste la vérité du moment.
      }

      const response = (typeof raw === "object" && raw !== null ? raw : null) as {
        stored?: unknown;
        settings?: unknown;
      } | null;

      if (response?.stored === true) {
        apply(normalizePlaybackSettings(response.settings));
        return;
      }
      if (response?.stored === false) {
        const seed = seedFromLegacyDeviceKeys((key) => deps.storage.getItem(key));
        apply(seed);
        if (!areIdentical(seed, DEFAULT_PLAYBACK_SETTINGS)) {
          await push(seed);
        }
        return;
      }
      // Réponse méconnaissable (proxy, vieille version) : ne rien toucher.
    },

    rehydrate() {
      apply(readCache());
    },
  };
}
