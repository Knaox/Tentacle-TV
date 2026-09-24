/**
 * La filmographie hors bibliothèque d'une personne, côté web : le crochet
 * commun (`@tentacle-tv/api-client`), branché sur les plugins actifs du web.
 */

import { useTranslation } from "react-i18next";
import { useActivePluginsMeta } from "@tentacle-tv/plugins-api";
import {
  useExternalFilmography as useSharedExternalFilmography,
  type ExternalSearchState,
  type FilmographyPerson,
} from "@tentacle-tv/api-client";

export type { FilmographyPerson };

export function useExternalFilmography(person: FilmographyPerson | null, limit = 20): ExternalSearchState {
  const { t, i18n } = useTranslation("search");
  const plugins = useActivePluginsMeta();
  return useSharedExternalFilmography(person, plugins, {
    lang: (i18n.language || "fr").slice(0, 2),
    fallbackLabel: t("externalFallback"),
    limit,
  });
}
