import { useQuery } from "@tanstack/react-query";
import type { MediaItem } from "@tentacle-tv/shared";
import { useJellyfinClient } from "./useJellyfinClient";
import { useUserId } from "./useUserId";

/**
 * Bandes-annonces LOCALES d'un item (fichiers vidéo sur le serveur).
 *
 * `GET /Users/{userId}/Items/{itemId}/LocalTrailers` renvoie un tableau de
 * `BaseItemDto` (items vidéo réels avec leur propre `Id`) → jouables directement
 * dans le player via `/watch/{id}`. La détection se fait sur le tableau non vide
 * (plus fiable que `LocalTrailerCount`, absent selon la version/Fields).
 */
export function useLocalTrailers(itemId: string | undefined) {
  const client = useJellyfinClient();
  const userId = useUserId();

  return useQuery({
    queryKey: ["local-trailers", itemId],
    queryFn: () =>
      client.fetch<MediaItem[]>(`/Users/${userId}/Items/${itemId}/LocalTrailers`),
    enabled: !!userId && !!itemId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Extras / special features d'un item (Trailer, BehindTheScenes, DeletedScene,
 * Clip, Interview, Featurette…).
 *
 * `GET /Users/{userId}/Items/{itemId}/SpecialFeatures` renvoie un `BaseItemDto[]`.
 * Piège (cf. Swiftfin) : sur une SÉRIE, l'appel au niveau seriesId renvoie VIDE —
 * les extras sont attachés au niveau SAISON. Appeler ce hook par `seasonId`.
 */
export function useSpecialFeatures(itemId: string | undefined) {
  const client = useJellyfinClient();
  const userId = useUserId();

  return useQuery({
    queryKey: ["special-features", itemId],
    queryFn: () =>
      client.fetch<MediaItem[]>(`/Users/${userId}/Items/${itemId}/SpecialFeatures`),
    enabled: !!userId && !!itemId,
    staleTime: 5 * 60 * 1000,
  });
}
