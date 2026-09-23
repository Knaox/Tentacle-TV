/**
 * Les résultats HORS bibliothèque d'une recherche — une requête par plugin qui
 * sait chercher (`pluginSearch.ts`), lancée à côté de celle de la bibliothèque
 * et jamais devant : la bibliothèque s'affiche dès qu'elle répond, les
 * plugins viennent se ranger dessous.
 *
 * Un plugin peut répondre VITE avec ce qu'il a sous la main et le dire
 * (`complete: false`) : on repasse alors quelques fois, à courts intervalles,
 * jusqu'à la réponse complète — la liste s'étoffe sans que rien ne clignote.
 */

import { useCallback, useMemo } from "react";
import { keepPreviousData, useQueries, type UseQueryResult } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useActivePluginsMeta } from "@tentacle-tv/plugins-api";
import { tentacleApiFetch } from "@tentacle-tv/api-client";
import {
  providerAccepts, providerUrl, readExternalResponse, searchProviders,
  type ExternalKind, type ExternalSearchResult,
} from "./pluginSearch";

/* Deux lettres : en dessous, une recherche hors bibliothèque n'a pas de sens. */
const MIN_QUERY = 2;
/* Réponse incomplète : on repasse vite, mais pas indéfiniment. */
const REFETCH_MS = 450;
const MAX_REFETCHES = 6;

export interface ExternalSearchOptions {
  limit?: number;
  /** Depuis une bibliothèque : seulement ce type de titre. */
  kind?: ExternalKind | null;
  enabled?: boolean;
}

export interface ExternalSearchState {
  /** Les sections à afficher — seulement celles qui ont quelque chose à dire. */
  results: ExternalSearchResult[];
  /** Au moins un plugin cherche encore (première réponse pas arrivée). */
  pending: boolean;
  /** Il existe au moins un plugin capable de chercher : sinon, rien à afficher du tout. */
  available: boolean;
}

/** Les réponses des plugins, réduites à ce qui s'affiche — partagé par la recherche et les filmographies. */
export function combineExternal(
  all: ReadonlyArray<UseQueryResult<ExternalSearchResult | null>>,
  enabled: boolean,
  providerCount: number,
): ExternalSearchState {
  const results: ExternalSearchResult[] = [];
  let pending = false;
  for (const result of all) {
    if (result.isPending && enabled) pending = true;
    const data = result.data;
    // Une réponse d'avant (frappe plus rapide que le réseau) reste affichée,
    // mais une section vide ne s'affiche jamais.
    if (enabled && data && data.items.length > 0) results.push(data);
  }
  return { results, pending, available: providerCount > 0 };
}

export function useExternalSearch(query: string, options: ExternalSearchOptions = {}): ExternalSearchState {
  const { t, i18n } = useTranslation("search");
  const plugins = useActivePluginsMeta();
  const lang = (i18n.language || "fr").slice(0, 2);
  const kind = options.kind ?? null;
  const limit = options.limit ?? 8;
  const q = query.trim();
  const enabled = (options.enabled ?? true) && q.length >= MIN_QUERY;

  const providers = useMemo(
    () => searchProviders(plugins, lang, t("externalFallback")).filter((p) => providerAccepts(p, kind)),
    [plugins, lang, t, kind],
  );

  // `combine` : le résultat ne change que si une réponse change — pas à chaque rendu.
  const combine = useCallback(
    (all: Array<UseQueryResult<ExternalSearchResult | null>>) => combineExternal(all, enabled, providers.length),
    [enabled, providers.length],
  );

  return useQueries({
    queries: providers.map((provider) => ({
      queryKey: ["search", "external", provider.pluginId, provider.path, q, kind ?? "all", limit, lang],
      queryFn: async ({ signal }: { signal: AbortSignal }) =>
        readExternalResponse(await tentacleApiFetch<unknown>(providerUrl(provider, q, { lang, limit, kind }), { signal }), provider),
      enabled,
      staleTime: 60_000,
      retry: false,
      placeholderData: keepPreviousData,
      refetchInterval: (query: { state: { data: ExternalSearchResult | null | undefined; dataUpdateCount: number } }) =>
        query.state.data?.complete === false && query.state.dataUpdateCount < MAX_REFETCHES ? REFETCH_MS : false,
    })),
    combine,
  });
}
