/**
 * Octave — l'historique de la recherche gardé sur l'APPAREIL (contrat `music/musicSearchHistory.ts`) : les
 * recherches récentes (la clé d'avant, `recentMusicSearches.ts`, en texte seul : un ancien client la relit telle
 * quelle) et les titres récemment recherchés (instantanés). C'est tout l'historique face à un serveur sans
 * `music.searchHistory` ; avec elle, un MIROIR de celui du compte (ce qui s'affiche avant la réponse du serveur, et
 * hors ligne), et ce que l'appareil verse UNE fois au compte (`SEARCH_HISTORY_SYNCED_KEY`).
 */

import {
  EMPTY_SEARCH_HISTORY, isSearchTrackSnapshot, mergeSearchHistory, MUSIC_SEARCH_HISTORY_MAX,
  type MusicSearchHistory, type MusicSearchTrackEntry,
} from "../../music/musicSearchHistory";
import { readJson, writeJson, type OctaveDeviceStore } from "./deviceStore";
import { readRecentMusicSearchesFrom, RECENT_MUSIC_SEARCHES_KEY } from "./recentMusicSearches";

/** Clés de stockage : ne jamais les renommer (l'historique de l'appareil y vit). */
export const RECENT_SEARCH_TRACKS_KEY = "tentacle_octave_recent_search_tracks";
/** Posée quand l'historique de l'appareil a été versé au compte : il ne l'est qu'une fois. */
export const SEARCH_HISTORY_SYNCED_KEY = "tentacle_octave_search_history_synced";
/** Ce que la clé d'avant garde de recherches (`recentMusicSearches.ts`). */
const DEVICE_QUERIES_MAX = 8;

function isTrackEntry(value: unknown): value is MusicSearchTrackEntry {
  if (typeof value !== "object" || value === null) return false;
  const e = value as Partial<MusicSearchTrackEntry>;
  return typeof e.at === "number" && isSearchTrackSnapshot(e.track);
}

/**
 * L'historique de l'appareil. Les recherches d'avant n'ont pas de date : elles prennent celle de `now`, décroissante
 * dans leur ordre (la plus récente reste en tête quand elles rejoignent celles du compte).
 */
export function readDeviceSearchHistory(store: OctaveDeviceStore | null, now: number): MusicSearchHistory {
  const queries = readRecentMusicSearchesFrom(store).map((text, i) => ({ text, at: now - i }));
  const raw = readJson(store, RECENT_SEARCH_TRACKS_KEY);
  const tracks = Array.isArray(raw) ? raw.filter(isTrackEntry) : [];
  return mergeSearchHistory(EMPTY_SEARCH_HISTORY, { queries, tracks });
}

/** Écrit l'historique de l'appareil (huit recherches, la forme d'avant ; les titres avec leur date). */
export function writeDeviceSearchHistory(store: OctaveDeviceStore | null, history: MusicSearchHistory): void {
  writeJson(store, RECENT_MUSIC_SEARCHES_KEY, history.queries.slice(0, DEVICE_QUERIES_MAX).map((e) => e.text));
  writeJson(store, RECENT_SEARCH_TRACKS_KEY, history.tracks.slice(0, MUSIC_SEARCH_HISTORY_MAX));
}

export function deviceHistorySynced(store: OctaveDeviceStore | null): boolean {
  return readJson(store, SEARCH_HISTORY_SYNCED_KEY) === true;
}

export function markDeviceHistorySynced(store: OctaveDeviceStore | null): void {
  writeJson(store, SEARCH_HISTORY_SYNCED_KEY, true);
}

/** Ce que la recherche vide montre : huit recherches, six titres (le compte en garde plus). */
export const RECENT_QUERIES_SHOWN = 8;
export const RECENT_TRACKS_SHOWN = 6;

export function recentQueriesOf(history: MusicSearchHistory): string[] {
  return history.queries.slice(0, RECENT_QUERIES_SHOWN).map((e) => e.text);
}

export function recentTracksOf(history: MusicSearchHistory): MusicSearchTrackEntry[] {
  return history.tracks.slice(0, RECENT_TRACKS_SHOWN);
}
