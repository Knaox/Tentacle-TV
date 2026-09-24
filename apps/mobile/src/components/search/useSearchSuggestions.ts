import { useMemo } from "react";
import { useTentacleSearch } from "@tentacle-tv/api-client";
import type { ExternalKind, ExternalSearchResult } from "@tentacle-tv/shared";
import { suggestionsFrom, type SuggestionModel } from "./searchSuggestionModel";
import { useMobileExternalSearch } from "./useMobileExternalSearch";

/** Ce que la barre propose pendant la frappe. */
export interface SearchSuggestions extends SuggestionModel {
  /** Ce que les extensions trouvent hors de la bibliothèque (Vigie…), si un plugin sait chercher. */
  external: ExternalSearchResult[];
  /** Le moteur n'a pas encore répondu à cette requête. */
  pending: boolean;
}

/**
 * Les suggestions d'une barre de recherche locale (bibliothèque, liste),
 * calculées sur le moteur du serveur, plus le hors bibliothèque. À partir de
 * deux lettres ; le cache du moteur sert la recherche complète ensuite.
 */
export function useSearchSuggestions(
  query: string,
  { kind = null, enabled = true, people = true }: { kind?: ExternalKind | null; enabled?: boolean; people?: boolean } = {},
): SearchSuggestions {
  const q = query.trim();
  const on = enabled && q.length >= 2;
  const search = useTentacleSearch(q, { limit: 6, enabled: on });
  const outside = useMobileExternalSearch(q, { limit: 4, kind, enabled: on });
  const data = on ? search.data : undefined;
  return useMemo(() => ({
    ...suggestionsFrom(query, data, { kind, people }),
    external: on ? outside.results : [],
    pending: on && search.isPending,
  }), [query, data, kind, people, on, outside.results, search.isPending]);
}
