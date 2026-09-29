import { useMemo } from "react";
import { useLibraryLanguages, type LanguageOption } from "@tentacle-tv/api-client";
import type { LibraryFilterState } from "./useLibraryFilters";

const valuesOf = (options: LanguageOption[] | undefined, code: string | null): string[] | undefined =>
  code ? options?.find((o) => o.code === code)?.values : undefined;

/**
 * Les langues filtrables d'une bibliothèque, et ce que le catalogue envoie à
 * Jellyfin pour la langue choisie (tous ses codes : « fre » ET « fra »).
 * Rien ne part tant que le serveur n'a pas dit qu'il sait filtrer : un
 * Jellyfin ancien ignorerait le paramètre et rendrait tout.
 */
export function useLibraryLanguageFilter(libraryId: string | undefined, filters: LibraryFilterState) {
  const { data: languages } = useLibraryLanguages(libraryId);
  const catalog = useMemo(() => ({
    audioLanguages: valuesOf(languages?.audio, filters.audioLang),
    subtitleLanguages: valuesOf(languages?.subtitle, filters.subtitleLang),
  }), [languages, filters.audioLang, filters.subtitleLang]);
  return { languages: languages ?? null, catalog };
}
