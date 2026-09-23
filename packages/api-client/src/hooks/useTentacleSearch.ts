/**
 * Le moteur de recherche du SERVEUR Tentacle (`/api/search`) — ce que la barre
 * de recherche du web et du bureau interroge à chaque frappe.
 *
 * Les requêtes gardent la réponse précédente affichée pendant la suivante :
 * une liste qui clignote vers un rond de chargement à chaque lettre se lit
 * comme une recherche lente, même en deux millisecondes. Double compatibilité
 * TanStack v4/v5, comme `useLibraryCatalog` : l'api-client est typé v5 mais la
 * TV résout la v4.
 *
 * Clés sous le préfixe `search` : les invalidations de listes après un « vu »
 * ou un favori (`cacheUtils.ts`) les rafraîchissent aussi.
 */

import { useQuery } from "@tanstack/react-query";
import type {
  SearchBrowseResponse, SearchDiscoverResponse, SearchEpisodesResponse, SearchResponse,
} from "@tentacle-tv/shared";
import { tentacleApiFetch } from "./usePreferences";

const KEEP_PREVIOUS = { keepPreviousData: true, placeholderData: (prev: unknown) => prev } as object;

export interface TentacleSearchOptions {
  /** Résultats par groupe (films, séries…) ; le serveur plafonne à 60. */
  limit?: number;
  enabled?: boolean;
}

/** Titres, personnes, genres et studios — en mémoire côté serveur, rapide à chaque frappe. */
export function useTentacleSearch(query: string, options: TentacleSearchOptions = {}) {
  const q = query.trim();
  const limit = options.limit ?? 6;
  return useQuery({
    queryKey: ["search", "tentacle", q, limit],
    queryFn: ({ signal }) =>
      tentacleApiFetch<SearchResponse>(`/api/search?q=${encodeURIComponent(q)}&limit=${limit}`, { signal }),
    enabled: (options.enabled ?? true) && q.length > 0,
    staleTime: 60_000,
    ...KEEP_PREVIOUS,
  });
}

/** Les épisodes — demandés à part, à Jellyfin : ils ne retardent jamais le reste. */
export function useSearchEpisodes(query: string, options: TentacleSearchOptions = {}) {
  const q = query.trim();
  const limit = options.limit ?? 6;
  return useQuery({
    queryKey: ["search", "episodes", q, limit],
    queryFn: ({ signal }) =>
      tentacleApiFetch<SearchEpisodesResponse>(`/api/search/episodes?q=${encodeURIComponent(q)}&limit=${limit}`, { signal }),
    enabled: (options.enabled ?? true) && q.length >= 3,
    staleTime: 60_000,
    ...KEEP_PREVIOUS,
  });
}

export type SearchBrowseTarget =
  | { kind: "person"; id: string }
  | { kind: "genre"; name: string }
  | { kind: "studio"; name: string };

function browsePath(target: SearchBrowseTarget, limit: number): string {
  if (target.kind === "person") return `/api/search/person/${encodeURIComponent(target.id)}?limit=${limit}`;
  return `/api/search/${target.kind}?name=${encodeURIComponent(target.name)}&limit=${limit}`;
}

/** Une filmographie, un genre ou un studio, parcouru dans la bibliothèque. */
export function useSearchBrowse(target: SearchBrowseTarget | null, limit = 120) {
  return useQuery({
    queryKey: ["search", "browse", target?.kind ?? "none", target === null ? "" : target.kind === "person" ? target.id : target.name, limit],
    queryFn: ({ signal }) => tentacleApiFetch<SearchBrowseResponse>(browsePath(target as SearchBrowseTarget, limit), { signal }),
    enabled: target !== null,
    staleTime: 5 * 60_000,
  });
}

/** Les genres à proposer quand la barre est vide. */
export function useSearchDiscover(enabled = true) {
  return useQuery({
    queryKey: ["search", "discover"],
    queryFn: ({ signal }) => tentacleApiFetch<SearchDiscoverResponse>("/api/search/discover", { signal }),
    enabled,
    staleTime: 10 * 60_000,
  });
}
