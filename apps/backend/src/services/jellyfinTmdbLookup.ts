import { getJellyfinUrl, getJellyfinApiKey } from "./configStore";
import { getAdminUserId } from "./jellyfinLibrary";

// Retrouver dans Jellyfin le film ou la série qui porte un identifiant TMDB.
// Deux besoins, deux coûts :
//   • UN titre, tout de suite (garde des annonces Seer, « Ma liste » posée sur
//     un titre qui vient peut-être d'arriver) : `findLibraryItemByTmdb` ;
//   • BEAUCOUP de titres d'un coup (le balayage des « Ma liste à l'arrivée ») :
//     `libraryTmdbIndex`, une seule liste de la bibliothèque au lieu d'une
//     requête par titre.
// Toujours avec le userId admin : sans lui, /Items?Recursive=true masque une
// partie de la bibliothèque et produirait de faux « absent ».

export type TmdbMediaType = "movie" | "tv";

export type TmdbLookup = { kind: "found"; id: string } | { kind: "missing" } | { kind: "error" };

type Item = { Id?: string; Type?: string; ProviderIds?: Record<string, string | undefined> };

/** La clé TMDB d'un item, quelle que soit sa casse (« Tmdb », « tmdb »). */
function tmdbOf(ids: Item["ProviderIds"]): string | null {
  if (!ids) return null;
  for (const [key, value] of Object.entries(ids)) {
    if (key.toLowerCase() === "tmdb" && value) return value;
  }
  return null;
}

/**
 * Item Movie/Series par identifiant TMDB — stratégie éprouvée de routes/tmdb.ts
 * (AnyProviderIdEquals + filtre exact, puis scan complet en repli — nécessaire :
 * AnyProviderIdEquals ne filtre pas sur certaines versions Jellyfin).
 */
export async function findLibraryItemByTmdb(tmdbId: number, mediaType: TmdbMediaType): Promise<TmdbLookup> {
  const jellyfinUrl = getJellyfinUrl();
  const apiKey = getJellyfinApiKey();
  const userId = await getAdminUserId();
  if (!jellyfinUrl || !apiKey || !userId) return { kind: "error" };
  const itemTypes = mediaType === "movie" ? "Movie" : "Series";
  const headers = { "X-Emby-Token": apiKey };
  try {
    const res = await fetch(
      `${jellyfinUrl}/Items?userId=${userId}&AnyProviderIdEquals=tmdb.${tmdbId}` +
        `&IncludeItemTypes=${itemTypes}&Recursive=true&Limit=100&Fields=ProviderIds&EnableImages=false`,
      { headers, signal: AbortSignal.timeout(8_000) },
    );
    if (res.ok) {
      const data = (await res.json()) as { Items?: Item[] };
      const match = data.Items?.find((it) => tmdbOf(it.ProviderIds) === String(tmdbId));
      if (match?.Id) return { kind: "found", id: match.Id };
    }
    const allRes = await fetch(
      `${jellyfinUrl}/Items?userId=${userId}&IncludeItemTypes=${itemTypes}` +
        `&Recursive=true&Limit=10000&Fields=ProviderIds&EnableImages=false`,
      { headers, signal: AbortSignal.timeout(15_000) },
    );
    if (!allRes.ok) return { kind: "error" };
    const allData = (await allRes.json()) as { Items?: Item[] };
    const match = allData.Items?.find((it) => tmdbOf(it.ProviderIds) === String(tmdbId));
    return match?.Id ? { kind: "found", id: match.Id } : { kind: "missing" };
  } catch {
    return { kind: "error" };
  }
}

/**
 * Tous les films et séries de la bibliothèque, par clé « movie:603 » /
 * « tv:1399 » → ID Jellyfin. Champs minimaux : ni images ni données
 * utilisateur. `null` si Jellyfin est injoignable — l'appelant réessaiera.
 */
export async function libraryTmdbIndex(): Promise<Map<string, string> | null> {
  const jellyfinUrl = getJellyfinUrl();
  const apiKey = getJellyfinApiKey();
  const userId = await getAdminUserId();
  if (!jellyfinUrl || !apiKey || !userId) return null;
  try {
    const res = await fetch(
      `${jellyfinUrl}/Items?userId=${userId}&IncludeItemTypes=Movie,Series&Recursive=true` +
        `&HasTmdbId=true&Fields=ProviderIds&EnableImages=false&EnableUserData=false`,
      { headers: { "X-Emby-Token": apiKey }, signal: AbortSignal.timeout(20_000) },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { Items?: Item[] };
    const index = new Map<string, string>();
    for (const it of data.Items ?? []) {
      const tmdb = tmdbOf(it.ProviderIds);
      const type = it.Type === "Movie" ? "movie" : it.Type === "Series" ? "tv" : null;
      if (!it.Id || !tmdb || !type) continue;
      // Deux versions d'un même film : la première suffit, le like est le même geste.
      const key = `${type}:${tmdb}`;
      if (!index.has(key)) index.set(key, it.Id);
    }
    return index;
  } catch {
    return null;
  }
}
