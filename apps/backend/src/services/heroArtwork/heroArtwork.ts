import { jellyfinAdminFetch } from "../jellyfinAdminFetch";
import { getTitleMeta } from "../tmdb/metaCache";
import { tmdbConfigured } from "../tmdb/client";
import { heroArtworkList, orderJellyfinImages, type HeroArtwork, type JellyfinImageInfo } from "./heroArtworkOrder";

interface ItemFacts {
  Id: string;
  Type?: string;
  SeriesId?: string;
  ParentBackdropItemId?: string;
  ProviderIds?: Record<string, string | undefined>;
}

const normalizeId = (id: string) => id.replace(/-/g, "").toLowerCase();

/**
 * Un titre, tel que CE compte le voit (`userId` : un titre caché par ses
 * droits n'existe pas pour lui). Par `/Items?Ids=` et en comparant l'id :
 * un `Ids` illisible est ignoré par Jellyfin, qui rend alors d'autres titres.
 */
async function itemFor(userId: string, itemId: string): Promise<ItemFacts | null> {
  const query = new URLSearchParams({ userId, Ids: itemId, Recursive: "true", Fields: "ProviderIds", EnableImages: "false" });
  const result = await jellyfinAdminFetch<{ Items?: ItemFacts[] }>(`/Items?${query}`, { timeoutMs: 4000 });
  if (!result.ok) return null;
  return (result.data.Items ?? []).find((item) => normalizeId(item.Id) === normalizeId(itemId)) ?? null;
}

async function imagesOf(itemId: string): Promise<JellyfinImageInfo[]> {
  const result = await jellyfinAdminFetch<JellyfinImageInfo[]>(`/Items/${encodeURIComponent(itemId)}/Images`, { timeoutMs: 4000 });
  return result.ok && Array.isArray(result.data) ? result.data : [];
}

/** Le fond TMDB du film ou de la série — par le cache des métadonnées (30 jours). */
async function tmdbBackdrop(title: ItemFacts): Promise<string | null> {
  if (!tmdbConfigured()) return null;
  const tmdbId = Number(title.ProviderIds?.Tmdb ?? title.ProviderIds?.tmdb);
  if (!Number.isInteger(tmdbId) || tmdbId <= 0) return null;
  const mediaType = title.Type === "Series" ? "tv" : title.Type === "Movie" ? "movie" : null;
  if (!mediaType) return null;
  const meta = await getTitleMeta(mediaType, tmdbId, { priority: "interactive" });
  return meta?.backdropPath ?? null;
}

/**
 * Les images de REPLI de la bannière d'accueil pour un titre, quand celles
 * que la donnée annonce manquent ou échouent : le fond TMDB d'abord (clé TMDB
 * configurée et titre identifié), puis TOUTES les images que Jellyfin a du
 * titre et de sa série — un autre fond, une vignette, l'affiche…
 *
 * `null` : le titre n'existe pas pour ce compte. Jellyfin muet : une liste
 * vide, jamais une erreur — la bannière garde alors son fond de marque.
 */
export async function heroArtworkFor(userId: string, itemId: string): Promise<HeroArtwork[] | null> {
  const item = await itemFor(userId, itemId);
  if (!item) return null;
  // Un épisode ou une saison : le titre de référence est la série.
  const parentId = item.Type === "Episode" || item.Type === "Season" ? (item.SeriesId ?? item.ParentBackdropItemId) : undefined;
  const parent = parentId ? await itemFor(userId, parentId) : null;
  const title = parent ?? item;

  const [backdropPath, ownImages, parentImages] = await Promise.all([
    tmdbBackdrop(title),
    imagesOf(item.Id),
    parent ? imagesOf(parent.Id) : Promise.resolve([]),
  ]);
  const sources = [{ itemId: item.Id, images: ownImages }];
  if (parent) sources.push({ itemId: parent.Id, images: parentImages });
  return heroArtworkList(backdropPath, orderJellyfinImages(sources));
}
