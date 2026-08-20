import { useQuery } from "@tanstack/react-query";
import type { MediaItem } from "@tentacle-tv/shared";
import { useJellyfinClient } from "./useJellyfinClient";
import { useUserId } from "./useUserId";

// Le fond de bannière d'une bibliothèque — extrait de useLibrary.ts (limite de
// 300 lignes) pour lui adjoindre son préchargement, sur le modèle de
// useLibraryCatalog : une clé et une requête PARTAGÉES entre le hook et le
// prefetch, sans quoi le préchargement vise une entrée de cache que le hook ne
// lira jamais.

/** Longtemps, mais pas éternellement. Le tirage est volontairement stable —
 *  changer de fond à chaque visite serait agité — seulement, `Infinity` des
 *  deux côtés gravait AUSSI les échecs : une bibliothèque interrogée pendant
 *  une coupure, ou dont le fond n'était pas encore récupéré, restait sans
 *  bannière pour toute la session, sans qu'aucune navigation n'y change quoi
 *  que ce soit. Une heure garde la stabilité et laisse une seconde chance. */
const BACKDROP_STALE_TIME = 60 * 60 * 1000;
const BACKDROP_GC_TIME = 2 * 60 * 60 * 1000;

/** Clé de cache du fond — partagée entre le hook et le prefetch (toute
 *  divergence = cache-miss silencieux). */
export function getLibraryBackdropKey(libraryId: string | undefined): unknown[] {
  return ["library", libraryId, "random-backdrop"];
}

interface BackdropFetchClient {
  fetch<T>(url: string): Promise<T>;
}

/** queryFn du tirage — partagée entre le hook et le prefetch. */
function buildBackdropFetcher(
  client: BackdropFetchClient,
  userId: string,
  libraryId: string,
) {
  return () =>
    client
      .fetch<{ Items: MediaItem[] }>(
        `/Users/${userId}/Items?ParentId=${libraryId}` +
          `&IncludeItemTypes=Movie,Series&Recursive=true&ExcludeLocationTypes=Virtual&IsMissing=false` +
          `&HasBackdrop=true&SortBy=Random&Limit=1` +
          `&Fields=Overview,PrimaryImageAspectRatio&EnableImageTypes=Primary,Backdrop&ImageTypeLimit=1`
      )
      .then((r) => r.Items[0]);
}

/**
 * Un item ALÉATOIRE de la bibliothèque possédant un backdrop — pour l'image de
 * la bannière de bibliothèque.
 *
 * `SortBy=Random` + `HasBackdrop=true` + `Limit=1` : le serveur tire l'item, on
 * n'a pas à filtrer côté client. Le tirage est gardé une heure : une seule
 * requête par bibliothèque, quels que soient les allers-venues, et l'image
 * (déjà en cache) ne se recharge pas. Renvoie `MediaItem | undefined`.
 */
export function useRandomLibraryBackdrop(libraryId: string | undefined) {
  const client = useJellyfinClient();
  const userId = useUserId();

  return useQuery({
    queryKey: getLibraryBackdropKey(libraryId),
    queryFn: buildBackdropFetcher(client, userId ?? "", libraryId ?? ""),
    enabled: !!userId && !!libraryId,
    staleTime: BACKDROP_STALE_TIME,
    gcTime: BACKDROP_GC_TIME,
  });
}

interface PrefetchClientLike {
  prefetchQuery(options: Record<string, unknown>): Promise<void>;
}

/** Précharge le fond de bannière (ex. au focus d'une bibliothèque dans le rail
 *  TV) — no-op réseau si le cache est encore frais. Duck-typé : accepte un
 *  QueryClient v4 (TV) comme v5 (web). */
export function prefetchLibraryBackdrop(
  qc: PrefetchClientLike,
  client: BackdropFetchClient,
  userId: string | null | undefined,
  libraryId: string,
): Promise<void> {
  if (!userId || !libraryId) return Promise.resolve();
  return qc.prefetchQuery({
    queryKey: getLibraryBackdropKey(libraryId),
    queryFn: buildBackdropFetcher(client, userId, libraryId),
    staleTime: BACKDROP_STALE_TIME,
  });
}
