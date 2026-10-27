/**
 * Octave — ce qu'on a écouté sur CET appareil (`localStorage`), pour le « déjà écouté » de la recherche. La règle
 * et la clé vivent dans le partagé (`@tentacle-tv/shared/octave` › pages/searchListens), lues aussi par le mobile.
 */

import {
  forgetSearchListensIn, readSearchListensFrom, writeSearchListensTo, type OctaveDeviceStore, type SearchListen,
} from "@tentacle-tv/shared/octave";

export { LISTENS_MAX, albumTargetOf, queryOfContext, withListen, type SearchListen } from "@tentacle-tv/shared/octave";

const store = (): OctaveDeviceStore | null => (typeof localStorage === "undefined" ? null : localStorage);

export const readSearchListens = (): SearchListen[] => readSearchListensFrom(store());
export const writeSearchListens = (list: readonly SearchListen[]): void => writeSearchListensTo(store(), list);
export const forgetSearchListens = (query: string): void => forgetSearchListensIn(store(), query);
