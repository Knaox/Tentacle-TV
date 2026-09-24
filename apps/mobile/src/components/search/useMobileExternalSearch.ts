import { useTranslation } from "react-i18next";
import { useExternalSearch, type ExternalSearchState } from "@tentacle-tv/api-client";
import type { ExternalKind } from "@tentacle-tv/shared";
import { useActivePlugins } from "@/hooks/useActivePlugins";

const NONE: never[] = [];

/**
 * Ce que les extensions trouvent HORS de la bibliothèque (« Pas encore sur le
 * serveur · via Vigie ») — le crochet commun au web, branché sur les plugins
 * actifs du mobile. Aucun plugin qui sache chercher : aucune requête, aucune
 * section.
 */
export function useMobileExternalSearch(
  query: string,
  options: { limit?: number; kind?: ExternalKind | null; enabled?: boolean } = {},
): ExternalSearchState {
  const { t, i18n } = useTranslation("search");
  const { data: plugins } = useActivePlugins();
  return useExternalSearch(query, plugins ?? NONE, {
    ...options,
    lang: (i18n.language || "fr").slice(0, 2),
    fallbackLabel: t("externalFallback"),
  });
}
