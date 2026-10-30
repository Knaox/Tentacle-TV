/**
 * Octave — les GESTES de l'historique de la recherche, sans React : noter une recherche validée, un titre lancé
 * depuis les résultats, en retirer un, tout effacer. Chaque geste se voit tout de suite (cache de la requête,
 * miroir de l'appareil), puis part au compte quand le serveur le garde (`music.searchHistory`) ; sa réponse fait
 * foi, un refus est oublié (la prochaine lecture rétablit l'état du compte).
 */

import type { QueryClient } from "@tanstack/react-query";
import {
  EMPTY_SEARCH_HISTORY, MUSIC_SEARCH_HISTORY_ROUTES, forgetInSearchHistory, mergeSearchHistory, normalizeSearchQuery,
  type MusicSearchHistory, type MusicSearchHistoryAdd, type MusicSearchHistoryForget, type MusicTrack,
} from "@tentacle-tv/shared/music";
import { forgetSearchListensIn, readDeviceSearchHistory, writeDeviceSearchHistory, type OctaveDeviceStore } from "@tentacle-tv/shared/octave";
import { tentacleApiFetch } from "../../../hooks/usePreferences";
import { musicKeys } from "../../musicQueryKeys";

export const searchHistoryApi = {
  read: (signal?: AbortSignal) => tentacleApiFetch<MusicSearchHistory>(MUSIC_SEARCH_HISTORY_ROUTES.history, { signal }),
  add: (add: MusicSearchHistoryAdd) => tentacleApiFetch<MusicSearchHistory>(MUSIC_SEARCH_HISTORY_ROUTES.history, { method: "POST", body: JSON.stringify(add) }),
  forget: (forget: MusicSearchHistoryForget) =>
    tentacleApiFetch<MusicSearchHistory>(MUSIC_SEARCH_HISTORY_ROUTES.forget, { method: "POST", body: JSON.stringify(forget) }),
};

/** Où vit l'historique : le compte (serveur), ou l'appareil seul. */
export type SearchHistoryScope = "account" | "device";

export interface SearchHistoryActions {
  rememberQuery(text: string): void;
  forgetQuery(text: string): void;
  rememberTrack(track: MusicTrack): void;
  forgetTrack(key: string): void;
  clearAll(): void;
}

export function searchHistoryActions(qc: QueryClient, scope: SearchHistoryScope, store: OctaveDeviceStore | null, now: () => number = Date.now): SearchHistoryActions {
  const key = musicKeys.searchHistory(scope);
  const current = (): MusicSearchHistory => qc.getQueryData<MusicSearchHistory>(key) ?? readDeviceSearchHistory(store, now());
  const show = (next: MusicSearchHistory) => {
    qc.setQueryData(key, next);
    writeDeviceSearchHistory(store, next);
  };
  const send = (call: () => Promise<MusicSearchHistory>) => {
    if (scope !== "account") return;
    call()
      .then((saved) => show(saved))
      .catch(() => undefined);
  };
  const add = (entry: MusicSearchHistoryAdd) => {
    show(mergeSearchHistory(current(), entry));
    send(() => searchHistoryApi.add(entry));
  };
  const forget = (entry: MusicSearchHistoryForget) => {
    show(forgetInSearchHistory(current(), entry));
    send(() => searchHistoryApi.forget(entry));
  };
  return {
    rememberQuery: (text) => {
      const value = normalizeSearchQuery(text);
      if (value !== null) add({ queries: [{ text: value, at: now() }] });
    },
    // Oublier une recherche, c'est aussi oublier ce qu'elle a fait écouter (le « déjà écouté »).
    forgetQuery: (text) => {
      forgetSearchListensIn(store, text);
      forget({ kind: "query", text });
    },
    rememberTrack: (track) => add({ tracks: [{ track, at: now() }] }),
    forgetTrack: (trackKey) => forget({ kind: "track", key: trackKey }),
    clearAll: () => {
      for (const q of current().queries) forgetSearchListensIn(store, q.text);
      forget({ kind: "all" });
    },
  };
}

export { EMPTY_SEARCH_HISTORY };
