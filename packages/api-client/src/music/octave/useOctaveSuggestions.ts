/**
 * Octave — les suggestions de la barre pendant la frappe : la bibliothèque
 * (index local du serveur, quelques titres, artistes et albums), l'extension
 * (`music.suggest` : ses index, jamais le réseau), et les recherches récentes
 * de l'appareil (stockage passé par l'application). Aucune recherche complète
 * ne part d'ici. Web, bureau et mobile : le MÊME crochet.
 */

import { useCallback, useMemo, useState } from "react";
import {
  buildSuggestions, forgetSearchListensIn, pushRecentMusicSearchTo, readRecentMusicSearchesFrom, removeRecentMusicSearchFrom,
  type OctaveDeviceStore, type OctaveSuggestion, type SuggestionInput,
} from "@tentacle-tv/shared/octave";
import type { MusicSuggestion } from "@tentacle-tv/shared/music";
import type { MusicProvider } from "../../pluginMusic/musicProvider";
import { useMusicSuggest } from "../../pluginMusic/useMusicSuggest";
import { useMusicSearch } from "../useMusicSearch";

/** Le temps de laisser finir une lettre tapée d'un trait (celui de la barre de Tentacle). */
export const SUGGEST_DEBOUNCE_MS = 90;
const LIBRARY_LIMIT = 6;

function fromExtension(list: readonly MusicSuggestion[]): SuggestionInput[] {
  return list.map((s) => ({ kind: s.kind, title: s.title, subtitle: s.subtitle, text: s.text }));
}

export function useOctaveSuggestions(provider: MusicProvider | null, draft: string, store: OctaveDeviceStore | null) {
  const library = useMusicSearch(draft, { limit: LIBRARY_LIMIT, debounceMs: SUGGEST_DEBOUNCE_MS, enabled: draft.trim().length > 0 });
  const extension = useMusicSuggest(provider, draft, { debounceMs: SUGGEST_DEBOUNCE_MS });
  const [recents, setRecents] = useState(() => readRecentMusicSearchesFrom(store));

  const fromLibrary = useMemo<SuggestionInput[]>(() => {
    const data = library.data;
    if (!data) return [];
    return [
      ...data.artists.map((a) => ({ kind: "artist" as const, title: a.name, subtitle: null })),
      ...data.tracks.map((t) => ({ kind: "track" as const, title: t.title, subtitle: t.artists[0]?.name ?? null })),
      ...data.albums.map((a) => ({ kind: "album" as const, title: a.title, subtitle: a.artists[0]?.name ?? null })),
    ];
  }, [library.data]);
  const fromExt = useMemo(() => fromExtension(extension), [extension]);

  const suggestions = useMemo<OctaveSuggestion[]>(
    () => buildSuggestions({ draft, recents, library: fromLibrary, extension: fromExt }),
    [draft, recents, fromLibrary, fromExt],
  );

  const remember = useCallback((query: string) => setRecents(pushRecentMusicSearchTo(store, query)), [store]);
  // Oublier une recherche, c'est aussi oublier ce qu'elle a fait écouter (le « déjà écouté »).
  const forget = useCallback(
    (query: string) => {
      forgetSearchListensIn(store, query);
      setRecents(removeRecentMusicSearchFrom(store, query));
    },
    [store],
  );
  return { suggestions, recents, remember, forget };
}
