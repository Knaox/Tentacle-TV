/**
 * Les résultats HORS bibliothèque d'une recherche, côté web : le crochet
 * commun (`useExternalSearch`, api-client — partagé avec le mobile), branché
 * sur la liste des plugins actifs du web et sur la langue de l'interface.
 */

import { useTranslation } from "react-i18next";
import { useActivePluginsMeta } from "@tentacle-tv/plugins-api";
import { useExternalSearch as useSharedExternalSearch, type ExternalSearchState } from "@tentacle-tv/api-client";
import type { ExternalKind } from "@tentacle-tv/shared";

export { combineExternal, type ExternalSearchState } from "@tentacle-tv/api-client";

export interface ExternalSearchOptions {
  limit?: number;
  /** Depuis une bibliothèque : seulement ce type de titre. */
  kind?: ExternalKind | null;
  enabled?: boolean;
}

export function useExternalSearch(query: string, options: ExternalSearchOptions = {}): ExternalSearchState {
  const { t, i18n } = useTranslation("search");
  const plugins = useActivePluginsMeta();
  return useSharedExternalSearch(query, plugins, {
    ...options,
    lang: (i18n.language || "fr").slice(0, 2),
    fallbackLabel: t("externalFallback"),
  });
}
