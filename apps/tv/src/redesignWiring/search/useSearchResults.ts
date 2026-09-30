import { useCallback, useMemo } from "react";
import { useSearchDiscover, useSearchEpisodes, useTentacleSearch } from "@tentacle-tv/api-client";
import { foldForSearch, type MediaItem, type SearchMediaItem, type SearchResponse } from "@tentacle-tv/shared";
import { searchSubmitAnswer, type SearchSubmitAnswer } from "@tentacle-tv/tv-core";
import { NEUTRAL_PALETTE, type ArtworkPalette } from "../../redesign/color/artworkPalette";
import type { SearchContentModel, SearchSectionModel, SearchSuggestionModel } from "../../redesign/screens/search/searchViewModel";
import { searchDiscover, searchNotice, searchPalette, searchSections, searchSuggestions, type SearchModelSources } from "./searchModels";
import type { SearchInput } from "./useSearchInput";

const RESULTS_LIMIT = 12;

export interface SearchResults {
  content: SearchContentModel;
  completion: string | null;
  suggestions: SearchSuggestionModel[];
  /** La lumière de la page : le meilleur résultat, sinon neutre. */
  palette: ArtworkPalette;
  /** « Rechercher » au clavier système : où mener le focus (`searchSubmitAnswer`). */
  submitAnswer: SearchSubmitAnswer;
  /** La clé du premier résultat (le meilleur), ou rien. */
  firstKey: string | null;
  /** Le titre derrière une carte ou le meilleur résultat : navigation, feuille d'actions. */
  itemOf: (id: string) => MediaItem | undefined;
}

function firstKeyOf(sections: SearchSectionModel[]): string | null {
  const first = sections[0];
  if (!first) return null;
  return first.key === "top" ? "top" : `${first.key}:0`;
}

/** Tous les titres d'une réponse, par identifiant : ce qu'une carte désigne. */
function titlesOf(data: SearchResponse | undefined, episodes: SearchMediaItem[]): Map<string, SearchMediaItem> {
  const titles = new Map<string, SearchMediaItem>();
  if (data?.top?.kind === "item") titles.set(data.top.hit.item.Id, data.top.hit.item);
  for (const hit of [...(data?.movies ?? []), ...(data?.series ?? []), ...(data?.collections ?? [])]) titles.set(hit.item.Id, hit.item);
  for (const episode of episodes) titles.set(episode.Id, episode);
  return titles;
}

/**
 * La colonne de droite de la recherche, tirée du moteur de Tentacle — la
 * bibliothèque seule, comme sur Android TV : rien de tapé → les recherches
 * récentes et les genres ; première réponse attendue → le chargement ;
 * réponse → les rangées (atténuées tant qu'elles répondent à une frappe
 * précédente) ; rien trouvé → la même page que le repos, qui le dit.
 */
export function useSearchResults(src: SearchModelSources, input: SearchInput): SearchResults {
  const { query, debounced, recents } = input;
  const search = useTentacleSearch(debounced, { limit: RESULTS_LIMIT });
  const episodes = useSearchEpisodes(debounced, { limit: RESULTS_LIMIT });
  const discover = useSearchDiscover(true);
  const data = search.data;
  const episodeItems = episodes.data?.episodes;
  const genres = discover.data?.genres;
  // La réponse montrée peut être celle d'une frappe précédente (gardée pendant
  // la requête suivante) : lisible, atténuée.
  const current = data !== undefined && foldForSearch(data.query) === foldForSearch(debounced);

  const sections = useMemo(() => searchSections(src, data, episodeItems ?? []), [src, data, episodeItems]);
  const { completion, suggestions } = useMemo(() => searchSuggestions(query, data), [query, data]);

  const idle = debounced.length === 0;
  const loading = !idle && data === undefined && search.isFetching;
  // Un moteur injoignable ne dit rien de plus qu'une recherche vaine : la page
  // de la recherche vaine, qui propose ses recherches récentes et ses genres.
  const empty = !idle && ((current && !search.isFetching && sections.length === 0) || (data === undefined && search.isError));
  const { t } = src;
  const content = useMemo<SearchContentModel>(() => {
    if (idle || empty) return { kind: idle ? "idle" : "empty", discover: searchDiscover(t, idle ? "idle" : "empty", debounced, recents, genres ?? []) };
    if (loading) return { kind: "loading", label: t("search:searching") };
    return { kind: "results", notice: searchNotice(t, data), stale: !current, sections };
  }, [idle, empty, loading, t, debounced, recents, genres, data, current, sections]);

  const palette = useMemo(() => (content.kind === "results" ? searchPalette(src, data) : NEUTRAL_PALETTE), [content.kind, src, data]);
  const titles = useMemo(() => titlesOf(data, episodeItems ?? []), [data, episodeItems]);
  const itemOf = useCallback((id: string) => {
    const title = titles.get(id);
    return title ? src.full(title) : undefined;
  }, [titles, src]);

  return {
    content,
    completion,
    suggestions,
    palette,
    submitAnswer: searchSubmitAnswer({
      typed: query, debounced, current, fetching: search.isFetching, failed: search.isError, sections: sections.length,
    }),
    firstKey: firstKeyOf(sections),
    itemOf,
  };
}
