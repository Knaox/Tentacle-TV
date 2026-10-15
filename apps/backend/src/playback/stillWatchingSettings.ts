/**
 * « Vous regardez encore ? » — le réglage du COMPTE (serveur 1.29.0, capacité
 * `playback.stillWatching`) et son contrat `GET/PUT /api/preferences/still-watching`.
 *
 * Une préférence du compte, pas de l'appareil : réglée sur l'ordinateur, elle
 * vaut sur le téléphone et les téléviseurs. Chaque client en garde une COPIE
 * locale (`stillWatchingStore.ts`) : le lecteur hors ligne la connaît.
 *
 * Activée par défaut : après `afterMs` de lecture sans le moindre geste, un
 * encart demande « Vous regardez encore ? » et laisse `countdownMs` pour
 * répondre ; sans réponse, la lecture se met en PAUSE (jamais un arrêt : la
 * position reste, « Reprendre » repart d'où l'on était).
 *
 * MIROIR : ce fichier est reflété octet pour octet dans
 * `apps/backend/src/playback/` (`sharedMirror.test.ts`) — aucun import.
 */

export interface StillWatchingSettings {
  /** Demander « Vous regardez encore ? » après un long moment sans geste. */
  enabled: boolean;
  /** Le temps de LECTURE sans le moindre geste avant de demander, en ms. */
  afterMs: number;
  /** Le temps laissé pour répondre avant la pause, en ms. */
  countdownMs: number;
}

/** Les durées proposées avant la question — une liste, pas un curseur : on choisit une soirée, pas une minute. */
export const STILL_WATCHING_AFTER_CHOICES_MS = [3_600_000, 5_400_000, 7_200_000, 10_800_000] as const;
/** Les délais de réponse proposés. */
export const STILL_WATCHING_COUNTDOWN_CHOICES_MS = [10_000, 30_000, 60_000] as const;

/** Une heure et demie : deux épisodes d'une heure, ou un film, sans question. */
export const STILL_WATCHING_AFTER_DEFAULT_MS = 5_400_000;
/** Dix secondes pour répondre. */
export const STILL_WATCHING_COUNTDOWN_DEFAULT_MS = 10_000;

export const STILL_WATCHING_AFTER_MIN_MS = 15 * 60_000;
export const STILL_WATCHING_AFTER_MAX_MS = 6 * 3_600_000;
export const STILL_WATCHING_COUNTDOWN_MIN_MS = 5_000;
export const STILL_WATCHING_COUNTDOWN_MAX_MS = 120_000;

export const DEFAULT_STILL_WATCHING_SETTINGS: StillWatchingSettings = {
  enabled: true,
  afterMs: STILL_WATCHING_AFTER_DEFAULT_MS,
  countdownMs: STILL_WATCHING_COUNTDOWN_DEFAULT_MS,
};

/** `GET /api/preferences/still-watching`, et la réponse du `PUT`. */
export interface StillWatchingSettingsResponse {
  /** Le compte a déjà choisi (sinon : les défauts). */
  stored: boolean;
  settings: StillWatchingSettings;
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

/** Toujours un réglage complet et sain : un champ illisible retombe sur son défaut. */
export function normalizeStillWatchingSettings(raw: unknown): StillWatchingSettings {
  const o = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_STILL_WATCHING_SETTINGS;
  return {
    enabled: typeof o.enabled === "boolean" ? o.enabled : d.enabled,
    afterMs: clampInt(o.afterMs, STILL_WATCHING_AFTER_MIN_MS, STILL_WATCHING_AFTER_MAX_MS, d.afterMs),
    countdownMs: clampInt(o.countdownMs, STILL_WATCHING_COUNTDOWN_MIN_MS, STILL_WATCHING_COUNTDOWN_MAX_MS, d.countdownMs),
  };
}
