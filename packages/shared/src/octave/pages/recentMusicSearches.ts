/**
 * Octave — les recherches musique RÉCENTES, gardées sur l'appareil : la
 * première suggestion d'une barre vide, et celles qui commencent comme la
 * frappe. À part de l'historique des films et séries (`tentacle_recent_searches`) :
 * on ne cherche pas « dune » dans la musique.
 */

import { readJson, writeJson, type OctaveDeviceStore } from "./deviceStore";

/** Clé de stockage : ne jamais la renommer (l'historique de l'utilisateur y vit). */
export const RECENT_MUSIC_SEARCHES_KEY = "tentacle_octave_recent_searches";
const MAX = 8;
const MIN_LENGTH = 2;

export function readRecentMusicSearchesFrom(store: OctaveDeviceStore | null): string[] {
  const parsed = readJson(store, RECENT_MUSIC_SEARCHES_KEY);
  return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string").slice(0, MAX) : [];
}

const write = (store: OctaveDeviceStore | null, list: string[]): string[] => {
  writeJson(store, RECENT_MUSIC_SEARCHES_KEY, list);
  return list;
};

/** La requête validée passe en tête (casse et espaces comparés, la forme tapée gardée). */
export function pushRecentMusicSearchTo(store: OctaveDeviceStore | null, query: string): string[] {
  const value = query.trim().replace(/\s+/g, " ");
  if (value.length < MIN_LENGTH) return readRecentMusicSearchesFrom(store);
  const key = value.toLocaleLowerCase();
  return write(store, [value, ...readRecentMusicSearchesFrom(store).filter((v) => v.toLocaleLowerCase() !== key)].slice(0, MAX));
}

export function removeRecentMusicSearchFrom(store: OctaveDeviceStore | null, query: string): string[] {
  const key = query.trim().toLocaleLowerCase();
  return write(store, readRecentMusicSearchesFrom(store).filter((v) => v.toLocaleLowerCase() !== key));
}
