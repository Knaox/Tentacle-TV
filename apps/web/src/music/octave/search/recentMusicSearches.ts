/**
 * Octave — les recherches musique récentes de CET appareil (`localStorage`). La règle et la clé vivent dans le
 * partagé (`@tentacle-tv/shared/octave` › pages/recentMusicSearches), lues aussi par le mobile.
 */

import { pushRecentMusicSearchTo, readRecentMusicSearchesFrom, removeRecentMusicSearchFrom, type OctaveDeviceStore } from "@tentacle-tv/shared/octave";

const store = (): OctaveDeviceStore | null => (typeof localStorage === "undefined" ? null : localStorage);

export const readRecentMusicSearches = (): string[] => readRecentMusicSearchesFrom(store());
export const pushRecentMusicSearch = (query: string): string[] => pushRecentMusicSearchTo(store(), query);
export const removeRecentMusicSearch = (query: string): string[] => removeRecentMusicSearchFrom(store(), query);
