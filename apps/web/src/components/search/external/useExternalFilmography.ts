/**
 * La filmographie HORS bibliothèque d'une personne : une requête par plugin
 * qui en sert une (champ `search.person` de son manifeste, cf.
 * `pluginSearch.ts`). Tentacle donne le nom et, quand Jellyfin le connaît,
 * l'identifiant TMDB ; le plugin rend ce que la personne a fait et que la
 * bibliothèque n'a pas.
 *
 * Aucun plugin actif et configuré qui sache le faire : aucune requête, aucune
 * section — la filmographie reste celle de la bibliothèque.
 */

import { useCallback, useMemo } from "react";
import { useQueries, type UseQueryResult } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useActivePluginsMeta } from "@tentacle-tv/plugins-api";
import { tentacleApiFetch } from "@tentacle-tv/api-client";
import {
  personProviderUrl, readExternalResponse, searchProviders,
  type ExternalSearchResult, type SearchProvider,
} from "./pluginSearch";
import { combineExternal, type ExternalSearchState } from "./useExternalSearch";

export interface FilmographyPerson {
  name: string;
  /** L'identifiant TMDB de la personne, tel que Jellyfin le connaît — sinon le plugin cherche par nom. */
  tmdbId: string | null;
}

export function useExternalFilmography(person: FilmographyPerson | null, limit = 20): ExternalSearchState {
  const { t, i18n } = useTranslation("search");
  const plugins = useActivePluginsMeta();
  const lang = (i18n.language || "fr").slice(0, 2);
  const name = person?.name.trim() ?? "";
  const tmdbId = person?.tmdbId ?? null;
  const enabled = name !== "";

  const providers = useMemo(
    () => searchProviders(plugins, lang, t("externalFallback"))
      .filter((p): p is SearchProvider & { personPath: string } => p.personPath !== null),
    [plugins, lang, t],
  );

  const combine = useCallback(
    (all: Array<UseQueryResult<ExternalSearchResult | null>>) => combineExternal(all, enabled, providers.length),
    [enabled, providers.length],
  );

  return useQueries({
    queries: providers.map((provider) => ({
      queryKey: ["search", "external-person", provider.pluginId, provider.personPath, name, tmdbId ?? "", limit, lang],
      queryFn: async ({ signal }: { signal: AbortSignal }) => readExternalResponse(
        await tentacleApiFetch<unknown>(personProviderUrl(provider, { name, tmdbId }, { lang, limit }), { signal }),
        provider,
      ),
      enabled,
      // Une filmographie ne bouge pas d'une minute à l'autre ; un titre demandé
      // entre-temps garde sa pastille jusqu'au prochain passage.
      staleTime: 5 * 60_000,
      retry: false,
    })),
    combine,
  });
}
