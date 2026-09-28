/**
 * Les volets d'une SAGA que la bibliothèque n'a pas : une requête par plugin
 * qui en sert (champ `search.collection` de son manifeste, cf.
 * `pluginSearch.ts`). Tentacle donne l'identifiant TMDB de la saga ; le
 * plugin rend les films qui manquent, chacun avec son `tmdbId` pour prendre
 * son rang dans la rangée de la fiche.
 *
 * Aucun plugin actif et configuré qui sache le faire : aucune requête — la
 * rangée ne montre que la bibliothèque. Web et mobile seulement (`combine`
 * est de react-query v5) ; les téléviseurs n'ont pas de plugins.
 */

import { useCallback, useMemo } from "react";
import { useQueries, type UseQueryResult } from "@tanstack/react-query";
import {
  collectionProviderUrl, readExternalResponse, searchProviders,
  type ExternalSearchResult, type SearchablePlugin, type SearchProvider,
} from "@tentacle-tv/shared";
import { combineExternal, type ExternalSearchState } from "./useExternalSearch";
import { tentacleApiFetch } from "./usePreferences";

export interface ExternalCollectionOptions {
  /** Langue de l'interface (deux lettres) : les plugins répondent dans celle-ci. */
  lang: string;
  /** Le nom d'une section quand le manifeste n'en donne pas. */
  fallbackLabel: string;
  limit?: number;
}

export function useExternalCollection(
  collectionId: number | null,
  plugins: readonly SearchablePlugin[],
  { lang, fallbackLabel, limit = 20 }: ExternalCollectionOptions,
): ExternalSearchState {
  const enabled = collectionId !== null;
  const providers = useMemo(
    () => searchProviders(plugins, lang, fallbackLabel)
      .filter((p): p is SearchProvider & { collectionPath: string } => typeof p.collectionPath === "string"),
    [plugins, lang, fallbackLabel],
  );

  const combine = useCallback(
    (all: Array<UseQueryResult<ExternalSearchResult | null>>) => combineExternal(all, enabled, providers.length),
    [enabled, providers.length],
  );

  return useQueries({
    queries: providers.map((provider) => ({
      queryKey: ["search", "external-collection", provider.pluginId, provider.collectionPath, collectionId ?? 0, limit, lang],
      queryFn: async ({ signal }: { signal: AbortSignal }) => readExternalResponse(
        await tentacleApiFetch<unknown>(collectionProviderUrl(provider, collectionId ?? 0, { lang, limit }), { signal }),
        provider,
      ),
      enabled,
      // Une saga ne bouge pas d'une minute à l'autre ; un volet demandé
      // entre-temps garde sa pastille jusqu'au prochain passage.
      staleTime: 5 * 60_000,
      retry: false,
    })),
    combine,
  });
}
