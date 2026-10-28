/**
 * Octave — les résultats d'une recherche validée. Le crochet vit dans api-client (`useOctaveSearch`, lu aussi par
 * le mobile) ; ici, l'extension de ce serveur et les mots de l'interface.
 */

import { useTranslation } from "react-i18next";
import { useOctaveSearch as useSharedOctaveSearch } from "@tentacle-tv/api-client";
import { useOctaveProvider } from "../mode/useOctaveProvider";

export function useOctaveSearch(query: string) {
  const { t, i18n } = useTranslation("music");
  return useSharedOctaveSearch(useOctaveProvider(), query, { language: i18n.language, externalDefault: t("search.externalDefault") });
}
