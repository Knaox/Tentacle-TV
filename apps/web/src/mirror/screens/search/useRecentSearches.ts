import { useCallback, useState } from "react";
import {
  clearRecentSearches,
  pushRecentSearch,
  readRecentSearches,
  removeRecentSearch,
} from "../../../components/search/recentSearches";

/**
 * `useRecentSearches` de l'app, sur l'historique local du web
 * (`recentSearches.ts`) — même clé `tentacle_recent_searches`, mêmes règles
 * (6 au plus, 2 lettres au moins, casse ignorée à la comparaison) : l'omnibox
 * du bureau et la recherche du miroir partagent la même liste.
 */
export function useRecentSearches() {
  const [recent, setRecent] = useState<string[]>(readRecentSearches);
  const push = useCallback((query: string) => setRecent(pushRecentSearch(query)), []);
  const remove = useCallback((query: string) => setRecent(removeRecentSearch(query)), []);
  const clear = useCallback(() => setRecent(clearRecentSearches()), []);
  return { recent, push, remove, clear };
}
