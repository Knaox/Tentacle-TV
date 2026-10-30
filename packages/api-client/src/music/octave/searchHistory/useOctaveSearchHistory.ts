/**
 * Octave — l'historique de la recherche, côté crochets : les recherches récentes et les titres récemment
 * recherchés, ceux du COMPTE quand le serveur les garde (`music.searchHistory` : le bureau, le web et le mobile
 * voient les mêmes), sinon ceux de l'appareil, comme avant. Le miroir de l'appareil s'affiche le temps que le
 * serveur réponde (et hors ligne). À la première lecture du compte, l'historique de l'appareil lui est versé, une
 * seule fois (`SEARCH_HISTORY_SYNCED_KEY`).
 *
 * `useSearchPickRecorder` note, partout dans Octave, le titre LANCÉ depuis des résultats (`watchSearchPicks`).
 */

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { MusicSearchHistory } from "@tentacle-tv/shared/music";
import {
  deviceHistorySynced, markDeviceHistorySynced, readDeviceSearchHistory, watchSearchPicks, writeDeviceSearchHistory,
  type OctaveDeviceStore, type OctavePlayer,
} from "@tentacle-tv/shared/octave";
import { useServerCapability } from "../../../hooks/useServerCapabilities";
import { musicKeys } from "../../musicQueryKeys";
import { useMusicCapability } from "../../useMusicLibrary";
import { EMPTY_SEARCH_HISTORY, searchHistoryActions, searchHistoryApi, type SearchHistoryActions, type SearchHistoryScope } from "./searchHistoryActions";

/** Le compte garde-t-il l'historique ? Sans la capacité (ou sans la musique) : l'appareil seul. */
export function useSearchHistoryScope(): SearchHistoryScope {
  const music = useMusicCapability();
  const shared = useServerCapability("music.searchHistory");
  return music && shared ? "account" : "device";
}

/** Lit l'historique du compte ; la première fois sur cet appareil, y verse d'abord celui de l'appareil. */
export async function readAccountHistory(store: OctaveDeviceStore | null, signal?: AbortSignal, now: () => number = Date.now): Promise<MusicSearchHistory> {
  let history: MusicSearchHistory | null = null;
  if (!deviceHistorySynced(store)) {
    const device = readDeviceSearchHistory(store, now());
    if (device.queries.length > 0 || device.tracks.length > 0) history = await searchHistoryApi.add(device);
    markDeviceHistorySynced(store);
  }
  history ??= await searchHistoryApi.read(signal);
  writeDeviceSearchHistory(store, history);
  return history;
}

export interface OctaveSearchHistory extends SearchHistoryActions {
  scope: SearchHistoryScope;
  history: MusicSearchHistory;
}

export function useOctaveSearchHistory(store: OctaveDeviceStore | null): OctaveSearchHistory {
  const qc = useQueryClient();
  const scope = useSearchHistoryScope();
  // Le miroir de l'appareil, lu une fois : ce qui s'affiche avant la première réponse.
  const [mirror] = useState(() => readDeviceSearchHistory(store, Date.now()));
  const query = useQuery<MusicSearchHistory>({
    queryKey: musicKeys.searchHistory(scope),
    queryFn: ({ signal }) => (scope === "account" ? readAccountHistory(store, signal) : readDeviceSearchHistory(store, Date.now())),
    placeholderData: mirror,
    staleTime: scope === "account" ? 0 : Infinity,
  });
  const actions = useMemo(() => searchHistoryActions(qc, scope, store), [qc, scope, store]);
  return useMemo(() => ({ scope, history: query.data ?? EMPTY_SEARCH_HISTORY, ...actions }), [scope, query.data, actions]);
}

/** Note chaque titre lancé depuis des résultats de recherche. Monté une fois sous le lecteur. */
export function useSearchPickRecorder(player: OctavePlayer | null, store: OctaveDeviceStore | null): void {
  const qc = useQueryClient();
  const scope = useSearchHistoryScope();
  useEffect(() => {
    if (!player) return;
    const actions = searchHistoryActions(qc, scope, store);
    return watchSearchPicks(player, ({ track }) => actions.rememberTrack(track));
  }, [player, qc, scope, store]);
}
