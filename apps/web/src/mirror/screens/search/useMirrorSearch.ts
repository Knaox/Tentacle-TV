import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchEpisodes, useTentacleSearch } from "@tentacle-tv/api-client";
import { completionFor, suggestionsFrom, type SearchPersonHit } from "@tentacle-tv/shared";
import { useExternalSearch } from "../../../components/search/external/useExternalSearch";
import { availableFilters, type SearchFilter } from "./SearchFilters";
import type { SearchActions } from "./SearchResults";
import { useRecentSearches } from "./useRecentSearches";
import { useSearchRoute } from "./useSearchRoute";

/** Le serveur répond en quelques millisecondes : on attend juste la fin d'une rafale de frappe. */
const DEBOUNCE_MS = 110;

/**
 * L'état de `SearchScreen` de l'app : la saisie et sa version stabilisée, le
 * filtre, les trois requêtes (moteur, épisodes, extensions), les suggestions
 * et la complétion fantôme, l'historique, et ce que fait chaque geste. La
 * requête stabilisée s'écrit dans l'adresse (`?q=`) : Retour et un
 * rechargement retrouvent la recherche.
 */
export function useMirrorSearch() {
  const nav = useSearchRoute();
  const { route, writeQuery, openBrowse, leaveTo, forgetOpenedOnBrowse } = nav;
  const browse = route.browse;
  const [query, setQuery] = useState(route.query);
  const [debounced, setDebounced] = useState(route.query.trim());
  const [filter, setFilter] = useState<SearchFilter>("all");
  const [focused, setFocused] = useState(false);
  const recents = useRecentSearches();

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);
  // L'adresse suit la requête stabilisée — jamais pendant un parcours, qui
  // porte sa propre adresse.
  useEffect(() => {
    if (browse === null && debounced !== route.query.trim()) writeQuery(debounced);
  }, [debounced, browse, route.query, writeQuery]);

  const searching = debounced.length > 0 && browse === null;
  const search = useTentacleSearch(debounced, { limit: filter === "all" ? 10 : 48, enabled: searching });
  const episodes = useSearchEpisodes(debounced, { limit: filter === "episodes" ? 30 : 8, enabled: searching });
  const external = useExternalSearch(debounced, { limit: 10, enabled: searching });
  const episodeList = useMemo(() => episodes.data?.episodes ?? [], [episodes.data]);
  const filters = useMemo(() => availableFilters(search.data, episodeList.length), [search.data, episodeList.length]);
  // Les requêtes complètes et la suite grise du meilleur titre — la
  // correction, elle, se dit déjà en tête des résultats.
  const suggestions = useMemo(
    () => suggestionsFrom(debounced, search.data, { correction: false }),
    [debounced, search.data],
  );
  const completion = searching && focused ? completionFor(query, suggestions) : null;

  // Un filtre qui n'a plus rien à montrer (nouvelle requête) retombe sur « Tout ».
  useEffect(() => {
    if (filter !== "all" && !filters.some((f) => f.key === filter)) setFilter("all");
  }, [filters, filter]);

  const change = useCallback((value: string) => {
    forgetOpenedOnBrowse();
    setQuery(value);
    if (browse === null) return;
    // Taper sort du parcours : l'adresse et la requête stabilisée ensemble,
    // sans quoi l'adresse repasserait un instant par l'ancienne requête.
    setDebounced(value.trim());
    writeQuery(value);
  }, [forgetOpenedOnBrowse, browse, writeQuery]);

  const pick = useCallback((value: string) => {
    setQuery(value);
    setDebounced(value.trim());
    setFilter("all");
    if (browse !== null) writeQuery(value);
  }, [browse, writeQuery]);

  // Ouvrir un résultat, c'est retenir la requête qui y a mené.
  const { push: pushRecent } = recents;
  const remember = useCallback(() => pushRecent(query), [pushRecent, query]);
  const actions = useMemo<SearchActions>(() => ({
    openItem: (id) => { remember(); leaveTo(`/media/${id}`); },
    playItem: (id) => { remember(); leaveTo(`/watch/${id}`); },
    openPerson: (person: SearchPersonHit) => { remember(); openBrowse(query, { kind: "person", id: person.id, person }); },
    openFacet: (kind, name) => { remember(); openBrowse(query, { kind, name }); },
    // Une route de Tentacle, déjà validée : la page du plugin qui montre ce titre.
    openExternalItem: (_provider, item) => { remember(); leaveTo(item.href); },
    openExternal: (_provider, href) => { remember(); leaveTo(href); },
  }), [remember, leaveTo, openBrowse, query]);

  const openGenre = useCallback((name: string) => openBrowse(query, { kind: "genre", name }), [openBrowse, query]);
  const openHomeItem = useCallback((id: string) => leaveTo(`/media/${id}`), [leaveTo]);
  const submit = useCallback(() => pushRecent(query), [pushRecent, query]);

  return {
    nav,
    browse,
    query,
    debounced,
    filter,
    setFilter,
    setFocused,
    searching,
    busy: search.isFetching && searching,
    response: search.data,
    episodes: episodeList,
    external,
    filters,
    suggestions: suggestions.queries,
    completion,
    recents,
    actions,
    change,
    pick,
    submit,
    openGenre,
    openHomeItem,
  };
}
