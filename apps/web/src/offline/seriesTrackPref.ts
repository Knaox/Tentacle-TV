/**
 * La préférence de pistes d'une SÉRIE (« Appliquer à cette série »), vue de
 * l'appareil : elle l'emporte sur le choix propre à chaque épisode et sur la
 * bibliothèque, en ligne comme en lecture locale.
 *
 * Le serveur la range avec les préférences de bibliothèque
 * (`libraryId` = identifiant de la série) ; l'appareil la lit dans le même
 * cache (`localTrackPrefs`), par correspondance EXACTE — jamais le repli
 * « unique préférence » de `prefForLibrary`, qui ferait d'une bibliothèque la
 * préférence d'une série.
 */

import { itemTracksFor } from "./localItemTracks";
import {
  cacheLibraryPrefs, prefForLibrary, readLibraryPrefs, type CachedLibraryPref, type SubtitleMode,
} from "./localTrackPrefs";

export interface LocalTrackPref {
  audioLang: string | null;
  subtitleLang: string | null;
  subtitleMode: SubtitleMode;
}

const normalized = (id: string): string => id.replace(/-/g, "").toLowerCase();

export function seriesPrefFor(userId: string, seriesId: string | null | undefined): CachedLibraryPref | null {
  if (!seriesId) return null;
  const wanted = normalized(seriesId);
  return readLibraryPrefs(userId).find((pref) => normalized(pref.libraryId) === wanted) ?? null;
}

/**
 * Reporte dans le cache de l'appareil la préférence de la série telle que le
 * serveur la connaît (`null` : retirée) — la lecture locale suivante
 * l'applique sans attendre la prochaine photographie des préférences.
 */
export function mirrorSeriesPref(userId: string, seriesId: string, pref: LocalTrackPref | null): void {
  const wanted = normalized(seriesId);
  const others = readLibraryPrefs(userId).filter((row) => normalized(row.libraryId) !== wanted);
  const rows = pref === null
    ? others
    : [...others, { libraryId: seriesId, audioLang: pref.audioLang, subtitleLang: pref.subtitleLang, subtitleMode: pref.subtitleMode }];
  cacheLibraryPrefs(userId, rows);
}

/**
 * La préférence qu'une lecture LOCALE applique : la série d'abord, puis le
 * choix propre au contenu, puis la bibliothèque.
 */
export function localTrackPrefFor({
  userId,
  seriesId,
  itemId,
  libraryId,
}: {
  userId: string;
  seriesId: string | null | undefined;
  itemId: string | null | undefined;
  libraryId: string | null;
}): LocalTrackPref | null {
  return seriesPrefFor(userId, seriesId) ?? itemTracksFor(itemId) ?? prefForLibrary(userId, libraryId);
}
