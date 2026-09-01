import { getJellyfinApiKey, getJellyfinUrl } from "../../configStore";
import type { JellyfinFacetSource } from "../facets";

/** Un titre de bibliothèque, indexé par sa clé canonique "movie:603"/"tv:1399". */
export interface LibraryEntry extends JellyfinFacetSource {
  itemId: string;
  name: string;
  key: string;
  mediaType: "movie" | "tv";
  tmdbId: number;
  played: boolean;
  isFavorite: boolean;
  /** Série entamée (≥ un épisode vu, pas terminée) — jamais vrai pour un film. */
  inProgress: boolean;
  hasPrimaryImage: boolean;
  hasBackdrop: boolean;
  communityRating: number | null;
}

export interface LibraryIndex {
  byKey: Map<string, LibraryEntry>;
  entries: LibraryEntry[];
}

interface RawItem extends JellyfinFacetSource {
  Id: string;
  Name?: string;
  Type?: string;
  ProviderIds?: Record<string, string>;
  CommunityRating?: number;
  ImageTags?: Record<string, string>;
  BackdropImageTags?: string[];
  /** Nombre d'épisodes (séries) — sert à détecter une série entamée. */
  RecursiveItemCount?: number;
  UserData?: {
    Played?: boolean;
    IsFavorite?: boolean;
    PlayedPercentage?: number;
    UnplayedItemCount?: number;
  };
}

const PAGE = 1000;
const PAGES_MAX = 40;

/**
 * UN balayage de la bibliothèque (films + séries, clé admin, UserData du
 * compte) qui sert quatre usages : présence en bibliothèque (exclusion de la
 * rangée « À découvrir »), résolution clé canonique → jellyfinItemId (la
 * bifurcation de navigation), pool in-library (non vus), et signaux
 * played/favoris pour les exclusions. Les titres sans tmdbId sont ignorés :
 * sans identité TMDB, le moteur ne peut ni les scorer ni les dédupliquer.
 */
export async function buildLibraryIndex(userId: string): Promise<LibraryIndex> {
  const url = getJellyfinUrl();
  const apiKey = getJellyfinApiKey();
  const byKey = new Map<string, LibraryEntry>();
  if (!url || !apiKey) return { byKey, entries: [] };

  for (let page = 0; page < PAGES_MAX; page++) {
    const res = await fetch(
      // Images : seulement les TAGS (Primary/Backdrop), jamais les binaires —
      // ils disent « une affiche existe », matière du filtre de qualité.
      `${url}/Items?userId=${userId}&Recursive=true&IncludeItemTypes=Movie,Series` +
        `&ImageTypeLimit=1&EnableImageTypes=Primary,Backdrop&EnableUserData=true` +
        `&Fields=ProviderIds,Genres,Studios,ProductionYear,RunTimeTicks,CommunityRating,BackdropImageTags,RecursiveItemCount` +
        `&StartIndex=${page * PAGE}&Limit=${PAGE}`,
      { headers: { "X-Emby-Token": apiKey } }
    );
    if (!res.ok) break;
    const data = (await res.json()) as { Items?: RawItem[]; TotalRecordCount?: number };
    const batch = data.Items ?? [];
    for (const item of batch) {
      const tmdbId = Number(item.ProviderIds?.Tmdb);
      if (!Number.isFinite(tmdbId) || tmdbId <= 0) continue;
      const mediaType = item.Type === "Movie" ? "movie" : item.Type === "Series" ? "tv" : null;
      if (!mediaType) continue;
      const key = `${mediaType}:${tmdbId}`;
      const played = item.UserData?.Played === true;
      // Série entamée : pourcentage global > 0, ou des épisodes vus (le compte
      // des non-vus descend sous le total). Champs absents → false, sans casse.
      const unplayed = item.UserData?.UnplayedItemCount;
      const episodes = item.RecursiveItemCount;
      const inProgress =
        mediaType === "tv" &&
        !played &&
        ((item.UserData?.PlayedPercentage ?? 0) > 0 ||
          (unplayed != null && episodes != null && unplayed < episodes));
      const entry: LibraryEntry = {
        itemId: item.Id,
        name: item.Name ?? "",
        key,
        mediaType,
        tmdbId,
        played,
        isFavorite: item.UserData?.IsFavorite === true,
        inProgress,
        hasPrimaryImage: !!item.ImageTags?.Primary,
        hasBackdrop: (item.BackdropImageTags?.length ?? 0) > 0,
        communityRating: item.CommunityRating ?? null,
        Genres: item.Genres,
        Studios: item.Studios,
        ProductionYear: item.ProductionYear,
        RunTimeTicks: item.RunTimeTicks,
      };
      // Doublon (deux versions du même film) : la première ligne gagne.
      if (!byKey.has(key)) byKey.set(key, entry);
    }
    if (byKey.size >= (data.TotalRecordCount ?? 0) || batch.length < PAGE) break;
  }

  return { byKey, entries: [...byKey.values()] };
}
