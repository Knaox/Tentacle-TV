/**
 * La page de résultats de la recherche (`/search`) — la version pleine page
 * de l'omnibox : une vraie saisie, des onglets par type, le meilleur résultat
 * en grand, et le parcours d'une personne, d'un genre ou d'un studio. Tout son
 * état vit dans l'adresse (`searchParams.ts`).
 */

import { useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSearchEpisodes, useTentacleSearch } from "@tentacle-tv/api-client";
import { parseSearchQuery, type SearchMediaItem, type SearchPersonHit } from "@tentacle-tv/shared";
import { PageTransition } from "../components/PageTransition";
import { pushRecentSearch } from "../components/search/recentSearches";
import { SearchBrowseView } from "../components/search/page/SearchBrowseView";
import { SearchPageEmpty } from "../components/search/page/SearchPageEmpty";
import { SearchPageHeader } from "../components/search/page/SearchPageHeader";
import { SearchResultsView } from "../components/search/page/SearchResultsView";
import { readSearchParams, searchHref, type SearchTab } from "../components/search/page/searchParams";
import { useExternalSearch } from "../components/search/external/useExternalSearch";

export function Search() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const state = readSearchParams(params);
  const searching = state.browse === null && state.query.trim() !== "";
  const search = useTentacleSearch(state.query, { limit: state.tab === "all" ? 12 : 60, enabled: searching });
  const withEpisodes = state.tab === "all" || state.tab === "episodes";
  const episodes = useSearchEpisodes(state.query, { limit: state.tab === "episodes" ? 40 : 8, enabled: searching && withEpisodes });
  // Hors bibliothèque : seulement là où l'on cherche des œuvres (tout, films, séries).
  const external = useExternalSearch(state.query, {
    limit: 18,
    enabled: searching && (state.tab === "all" || state.tab === "movies" || state.tab === "series"),
  });
  const terms = useMemo(
    () => parseSearchQuery(search.data?.correction ?? state.query).terms,
    [search.data?.correction, state.query],
  );

  const setQuery = useCallback((query: string) => {
    navigate(searchHref(query, state.tab), { replace: true });
  }, [navigate, state.tab]);
  const setTab = useCallback((tab: SearchTab) => {
    navigate(searchHref(state.query, tab), { replace: true });
  }, [navigate, state.query]);

  const openPath = useCallback((path: string) => {
    if (state.query.trim() !== "") pushRecentSearch(state.query);
    navigate(path);
  }, [navigate, state.query]);
  const openItem = useCallback((item: SearchMediaItem) => openPath(`/media/${item.Id}`), [openPath]);
  const openPerson = useCallback((person: SearchPersonHit) => {
    openPath(`/search?person=${encodeURIComponent(person.id)}&name=${encodeURIComponent(person.name)}`);
  }, [openPath]);
  const openFacet = useCallback((kind: "genre" | "studio", name: string) => {
    openPath(`/search?${kind}=${encodeURIComponent(name)}`);
  }, [openPath]);

  const totals = search.data?.totals;
  const counts: Partial<Record<SearchTab, number>> = totals
    ? { movies: totals.movies, series: totals.series, collections: totals.collections, people: totals.people, episodes: episodes.data?.episodes.length }
    : {};

  return (
    <PageTransition>
      <div className="min-h-screen pb-24">
        {state.browse !== null ? (
          <SearchBrowseView target={state.browse} personName={state.personName} onOpenItem={openItem} />
        ) : (
          <>
            <SearchPageHeader query={state.query} tab={state.tab} counts={counts} onQuery={setQuery} onTab={setTab} />
            {!searching && <SearchPageEmpty onQuery={setQuery} onGenre={(name) => openFacet("genre", name)} />}
            {searching && search.data && (
              <SearchResultsView
                response={search.data}
                episodes={episodes.data?.episodes ?? []}
                external={external}
                tab={state.tab}
                terms={terms}
                onTab={setTab}
                onOpenPath={openPath}
                onOpenItem={openItem}
                onOpenPerson={openPerson}
                onOpenFacet={openFacet}
                onRetry={setQuery}
              />
            )}
          </>
        )}
      </div>
    </PageTransition>
  );
}
