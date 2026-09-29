import { useMemo } from "react";
import { languageValues, useLibraryLanguages } from "@tentacle-tv/api-client";
import type { LibraryFilterState } from "./useLibraryFilters";

/**
 * Les langues filtrables d'une bibliothèque, et ce que le catalogue envoie à
 * Jellyfin pour la langue choisie (tous ses codes : « fre » ET « fra »).
 * Rien ne part tant que le serveur n'a pas dit qu'il sait filtrer : un
 * Jellyfin ancien ignorerait le paramètre et rendrait tout.
 */
export function useLibraryLanguageFilter(libraryId: string | undefined, filters: LibraryFilterState) {
  const { data: languages } = useLibraryLanguages(libraryId);
  const catalog = useMemo(() => ({
    audioLanguages: languageValues(languages?.audio, filters.audioLang),
    subtitleLanguages: languageValues(languages?.subtitle, filters.subtitleLang),
  }), [languages, filters.audioLang, filters.subtitleLang]);
  return { languages: languages ?? null, catalog };
}
