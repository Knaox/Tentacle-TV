/**
 * La filmographie HORS bibliothèque d'une personne : une requête par plugin
 * qui en sert une (champ `search.person` de son manifeste, cf.
 * `pluginSearch.ts`). Tentacle donne le nom et, quand Jellyfin le connaît,
 * l'identifiant TMDB ; le plugin rend ce que la personne a fait et que la
 * bibliothèque n'a pas.
 *
 * Aucun plugin actif et configuré qui sache le faire : aucune requête, aucune
 * section — la filmographie reste celle de la bibliothèque.
 *
 * Commun au web et au mobile, comme `useExternalSearch` : chacun passe SA
 * liste de plugins actifs, sa langue et le nom de repli de la section.
 */

import { useCallback, useMemo } from "react";
import { useQueries, type UseQueryResult } from "@tanstack/react-query";
import {
  personProviderUrl, readExternalResponse, searchProviders,
  type ExternalSearchResult, type SearchablePlugin, type SearchProvider,
} from "@tentacle-tv/shared";
import { combineExternal, type ExternalSearchState } from "./useExternalSearch";
import { tentacleApiFetch } from "./usePreferences";

export interface FilmographyPerson {
  name: string;
  /** L'identifiant TMDB de la personne, tel que Jellyfin le connaît — sinon le plugin cherche par nom. */
  tmdbId: string | null;
}

export interface ExternalFilmographyOptions {
  /** Langue de l'interface (deux lettres) : les plugins répondent dans celle-ci. */
  lang: string;
  /** Le nom de la section quand le manifeste n'en donne pas. */
  fallbackLabel: string;
  limit?: number;
}

export function useExternalFilmography(
  person: FilmographyPerson | null,
  plugins: readonly SearchablePlugin[],
  { lang, fallbackLabel, limit = 20 }: ExternalFilmographyOptions,
): ExternalSearchState {
  const name = person?.name.trim() ?? "";
  const tmdbId = person?.tmdbId ?? null;
  const enabled = name !== "";

  const providers = useMemo(
    () => searchProviders(plugins, lang, fallbackLabel)
      .filter((p): p is SearchProvider & { personPath: string } => p.personPath !== null),
    [plugins, lang, fallbackLabel],
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
