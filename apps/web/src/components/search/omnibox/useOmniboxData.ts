/**
 * Ce que l'omnibox affiche : la réponse du moteur à la frappe (anti-rebond
 * court — le serveur répond en quelques millisecondes, c'est le réseau qu'on
 * ménage), les épisodes arrivés à part, et, barre vide, les recherches
 * récentes, les reprises et les genres à parcourir.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  useResumeItems, useSearchDiscover, useSearchEpisodes, useTentacleSearch,
} from "@tentacle-tv/api-client";
import { parseSearchQuery, withoutLibraryTwins } from "@tentacle-tv/shared";
import { clearRecentSearches, readRecentSearches, removeRecentSearch } from "../recentSearches";
import { resultOptions, zeroOptions } from "../omniboxModel";
import { useExternalSearch } from "../external/useExternalSearch";

/** Le temps de laisser finir un mot tapé d'un trait. */
const DEBOUNCE_MS = 90;
const RESUME_SHOWN = 4;
const GENRES_SHOWN = 12;
const EXTERNAL_SHOWN = 4;

function useDebounced(value: string, ms: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    // Vider la barre est immédiat : le zéro-état n'a rien à attendre.
    if (value === "") {
      setDebounced("");
      return;
    }
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

export function useOmniboxData(query: string) {
  const trimmed = query.trim();
  const debounced = useDebounced(trimmed, DEBOUNCE_MS);
  const search = useTentacleSearch(debounced, { limit: 5 });
  const episodes = useSearchEpisodes(debounced, { limit: 4 });
  // Hors bibliothèque : les plugins qui savent chercher, rangés après la bibliothèque.
  const external = useExternalSearch(debounced, { limit: EXTERNAL_SHOWN });
  const resume = useResumeItems();
  const discover = useSearchDiscover(trimmed === "");
  const [recents, setRecents] = useState(readRecentSearches);

  const response = debounced === "" ? undefined : search.data;
  const episodeList = debounced === "" ? undefined : episodes.data?.episodes;
  const beyond = useMemo(() => {
    const owned = [
      ...(response?.top?.kind === "item" ? [response.top.hit] : []),
      ...(response?.movies ?? []),
      ...(response?.series ?? []),
    ].map((hit) => ({ name: hit.item.Name, year: hit.item.ProductionYear ?? null }));
    return external.results
      .map((result) => ({ ...result, items: withoutLibraryTwins(result.items, owned) }))
      .filter((result) => result.items.length > 0);
  }, [external.results, response]);
  const options = useMemo(() => {
    if (debounced === "") {
      return zeroOptions(recents, (resume.data ?? []).slice(0, RESUME_SHOWN), (discover.data?.genres ?? []).slice(0, GENRES_SHOWN));
    }
    return resultOptions(response, episodeList ?? [], debounced, beyond);
  }, [debounced, response, episodeList, beyond, recents, resume.data, discover.data]);

  // Les termes à faire ressortir : ceux de la correction quand le moteur a
  // cherché autre chose que ce qui a été tapé.
  const terms = useMemo(() => parseSearchQuery(response?.correction ?? debounced).terms, [response?.correction, debounced]);

  const removeRecent = useCallback((value: string) => setRecents(removeRecentSearch(value)), []);
  const clearRecents = useCallback(() => setRecents(clearRecentSearches()), []);

  return {
    debounced,
    response,
    options,
    terms,
    recents,
    removeRecent,
    clearRecents,
    /** Une requête part ou revient : la ligne de progression. */
    fetching: debounced !== "" && (search.isFetching || debounced !== trimmed),
    /** La réponse affichée est celle de ce qui est tapé, ni plus ni moins. */
    current: response !== undefined && response.query.trim() === trimmed,
    /** Rien encore pour cette saisie : le squelette plutôt qu'un vide. */
    pending: debounced !== "" && response === undefined,
    /** Un plugin cherche encore hors bibliothèque : « aucun résultat » serait prématuré. */
    externalPending: debounced !== "" && external.pending,
  };
}
