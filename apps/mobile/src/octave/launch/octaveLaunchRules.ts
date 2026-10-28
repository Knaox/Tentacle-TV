/**
 * Octave (mobile) — ce que le LANCEMENT décide avant la première image, module
 * PUR (ni React Native ni Expo, testé sous vitest) : s'ouvre-t-on dans Octave,
 * et sur quelle page. Les règles sont celles du bureau
 * (`@tentacle-tv/shared/octave/mode`) : « Au démarrage, ouvrir » appliqué au
 * dernier mode, le miroir de la disponibilité par identité, la page gardée.
 */

import {
  OCTAVE_BASE_PATH, OCTAVE_LAUNCH_MIRROR_KEY, OCTAVE_MODE_KEY, OCTAVE_PAGE_KEY, OCTAVE_STARTUP_KEY,
  launchesInOctave, parseOctaveLaunchMirror, parseOctaveStartup, parseSavedOctavePage, resumePath, startupWantsOctave,
  type OctaveLaunchMirror, type SavedOctavePage,
} from "@tentacle-tv/shared/octave/mode";

export const SERVER_URL_KEY = "tentacle_server_url";
export const STORED_USER_KEY = "tentacle_user";

/** Les clés lues au démarrage, directement sur le disque (avant l'hydratation du stockage). */
export const OCTAVE_LAUNCH_READ_KEYS = [OCTAVE_MODE_KEY, OCTAVE_STARTUP_KEY, OCTAVE_LAUNCH_MIRROR_KEY, OCTAVE_PAGE_KEY, SERVER_URL_KEY, STORED_USER_KEY] as const;

export interface MobileOctaveLaunch {
  /** Le mode voulu par « Au démarrage, ouvrir ». */
  wantsOctave: boolean;
  /** Le lancement se fait DANS Octave : pas d'animation d'ouverture, la page gardée d'emblée. */
  inOctave: boolean;
  /** `<serveur>|<compte>` de la session gardée, ou null. */
  owner: string | null;
  /** Où arriver (null hors d'Octave). */
  path: string | null;
  mirror: OctaveLaunchMirror | null;
  savedPage: SavedOctavePage | null;
}

export const NOT_IN_OCTAVE: MobileOctaveLaunch = { wantsOctave: false, inOctave: false, owner: null, path: null, mirror: null, savedPage: null };

/** L'identité de la session gardée (profil de la Famille compris), lue dans `tentacle_user`. */
export function octaveOwnerOf(serverUrl: string | null | undefined, userRaw: string | null | undefined): string | null {
  if (!serverUrl || !userRaw) return null;
  try {
    const id = (JSON.parse(userRaw) as { Id?: unknown } | null)?.Id;
    return typeof id === "string" && id ? `${serverUrl}|${id}` : null;
  } catch {
    return null;
  }
}

export function decideMobileOctaveLaunch(values: Readonly<Record<string, string | null | undefined>>, now: number): MobileOctaveLaunch {
  const owner = octaveOwnerOf(values[SERVER_URL_KEY], values[STORED_USER_KEY]);
  const wantsOctave = startupWantsOctave(parseOctaveStartup(values[OCTAVE_STARTUP_KEY]), values[OCTAVE_MODE_KEY] === "1");
  const mirror = parseOctaveLaunchMirror(values[OCTAVE_LAUNCH_MIRROR_KEY]);
  const savedPage = parseSavedOctavePage(values[OCTAVE_PAGE_KEY]);
  const inOctave = launchesInOctave(wantsOctave, owner, mirror);
  const path = inOctave ? resumePath(savedPage, owner, now, OCTAVE_BASE_PATH) : null;
  return { wantsOctave, inOctave, owner, path, mirror, savedPage };
}

/** Le miroir dit-il Octave disponible pour CETTE identité ? */
export function mirrorSaysAvailable(mirror: OctaveLaunchMirror | null, owner: string | null): boolean {
  return owner !== null && mirror?.owner === owner && mirror.available;
}
