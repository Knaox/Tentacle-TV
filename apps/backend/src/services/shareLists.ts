import { getPrisma } from "./db";
import { getJellyfinApiKey, getJellyfinUrl } from "./configStore";
import { getCachedMeta } from "./tmdb/metaCache";

/**
 * La liste « titres likés » partageable : les FAVORIS Jellyfin (IsFavorite)
 * du propriétaire, plus ses likes HORS bibliothèque (table user_likes,
 * habillés par le cache de métadonnées TMDB — jamais d'appel réseau ici).
 * Même doctrine Live que la watchlist partagée : rien n'est copié, la liste
 * est relue à chaque ouverture avec la clé admin.
 */

export interface SharedListEntry {
  /** Id Jellyfin — vide pour un titre hors bibliothèque. */
  Id: string;
  Name: string;
  Type: string;
  ProductionYear?: number;
  ImageTags?: Record<string, string>;
  /** Affiche TMDB absolue (titres hors bibliothèque uniquement). */
  PosterUrl?: string;
  InLibrary: boolean;
}

interface JellyfinItemsPage {
  Items?: Array<{
    Id: string;
    Name: string;
    Type: string;
    ProductionYear?: number;
    ImageTags?: Record<string, string>;
  }>;
}

const TMDB_IMG = "https://image.tmdb.org/t/p/w342";

export async function getLikedListItems(ownerUserId: string): Promise<SharedListEntry[]> {
  const url = getJellyfinUrl();
  const apiKey = getJellyfinApiKey();
  const out: SharedListEntry[] = [];

  if (url && apiKey) {
    const res = await fetch(
      `${url}/Users/${ownerUserId}/Items?Filters=IsFavorite&Recursive=true` +
        `&IncludeItemTypes=Movie,Series&SortBy=SortName&SortOrder=Ascending` +
        `&Fields=PrimaryImageAspectRatio&EnableImageTypes=Primary`,
      { headers: { "X-Emby-Token": apiKey } }
    );
    if (res.ok) {
      const data = (await res.json()) as JellyfinItemsPage;
      for (const i of data.Items ?? []) {
        out.push({
          Id: i.Id,
          Name: i.Name,
          Type: i.Type,
          ProductionYear: i.ProductionYear,
          ImageTags: i.ImageTags,
          InLibrary: true,
        });
      }
    }
  }

  const prisma = getPrisma();
  const likes = await prisma.userLike.findMany({
    where: { jellyfinUserId: ownerUserId },
    orderBy: { createdAt: "desc" },
  });
  for (const like of likes) {
    const mediaType = like.mediaType === "movie" ? "movie" : "tv";
    const meta = await getCachedMeta(mediaType, like.tmdbId);
    // Sans métadonnées cachées, la carte serait muette (ni titre ni affiche) :
    // on la saute — le titre reviendra quand le cache l'aura vue passer.
    if (!meta?.title) continue;
    out.push({
      Id: "",
      Name: meta.title,
      Type: mediaType === "movie" ? "Movie" : "Series",
      ProductionYear: meta.year ?? undefined,
      PosterUrl: meta.posterPath ? `${TMDB_IMG}${meta.posterPath}` : undefined,
      InLibrary: false,
    });
  }

  return out;
}
