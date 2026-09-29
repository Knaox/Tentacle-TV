import { useQuery } from "@tanstack/react-query";
import { useJellyfinClient } from "./useJellyfinClient";
import { useUserId } from "./useUserId";
import { libraryLanguagesPath, parseLibraryLanguages, type LibraryLanguages } from "./libraryLanguages";

/**
 * Les langues filtrables d'une bibliothèque, ou `null` quand le serveur ne sait
 * pas filtrer par langue (avant Jellyfin 12) : le filtre ne s'affiche pas.
 */
export function useLibraryLanguages(libraryId: string | undefined) {
  const client = useJellyfinClient();
  const userId = useUserId();
  return useQuery<LibraryLanguages | null>({
    queryKey: ["library", "languages", libraryId],
    queryFn: async () => parseLibraryLanguages(await client.fetch<unknown>(libraryLanguagesPath(userId ?? "", libraryId ?? ""))),
    enabled: !!userId && !!libraryId,
    staleTime: 30 * 60_000,
  });
}
