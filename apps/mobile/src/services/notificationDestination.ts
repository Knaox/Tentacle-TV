import type { LibraryTitleLookup } from "@tentacle-tv/api-client";

/**
 * Chercher un titre de la bibliothèque par son TMDB, depuis le mobile (URL et
 * jeton de l'app : la cloche partagée du web lit ceux du navigateur). Même
 * route que la fiche Vigie : `/api/tmdb/resolve`. Un échec rend null — la
 * notification retombe alors sur son repli.
 */
export function libraryTitleLookup(serverUrl: string, token: string): LibraryTitleLookup {
  return async (mediaType, tmdbId) => {
    if (!serverUrl || !token) return null;
    const res = await fetch(
      `${serverUrl.replace(/\/$/, "")}/api/tmdb/resolve?tmdbId=${encodeURIComponent(String(tmdbId))}&mediaType=${mediaType}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { jellyfinId?: string | null };
    return data.jellyfinId ?? null;
  };
}
