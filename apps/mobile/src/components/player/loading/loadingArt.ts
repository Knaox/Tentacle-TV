import type { JellyfinClient } from "@tentacle-tv/api-client";
import { formatEpisodeCode, type MediaItem } from "@tentacle-tv/shared";

/** Largeur demandée pour le fond : nette sur un iPad, sans tirer du 4K sur un téléphone. */
const BACKDROP_WIDTH = 1600;
const POSTER_HEIGHT = 1400;
const LOGO_WIDTH = 600;

/** Champs que Jellyfin renvoie pour un épisode, absents du type partagé. */
type EpisodeLogoFields = { ParentLogoItemId?: string; ParentLogoImageTag?: string };

export interface LoadingArt {
  /** Le fond paysage (écran large). */
  backdropUrl: string | null;
  /** L'affiche verticale (téléphone en portrait) : le fond paysage, recadré, n'en montrait qu'une tranche. */
  posterUrl: string | null;
  logoUrl: string | null;
  title: string;
  subtitle: string | null;
}

/**
 * Ce que l'écran de chargement montre d'un titre — la même chaîne de repli que
 * le web (`buildPosterUrl`) pour le fond : celui du titre (film), celui du
 * parent (épisode), sinon celui de la série. L'affiche et le logo ne sont
 * demandés que si la donnée dit qu'ils existent : aucune requête pour rien.
 */
export function loadingArt(client: JellyfinClient, item: MediaItem | null | undefined): LoadingArt {
  if (!item) return { backdropUrl: null, posterUrl: null, logoUrl: null, title: "", subtitle: null };
  const isEpisode = item.Type === "Episode";

  let backdropUrl: string | null = null;
  if ((item.BackdropImageTags?.length ?? 0) > 0) {
    backdropUrl = client.getImageUrl(item.Id, "Backdrop", { width: BACKDROP_WIDTH, quality: 80 });
  } else if ((item.ParentBackdropImageTags?.length ?? 0) > 0 && item.ParentBackdropItemId) {
    backdropUrl = client.getImageUrl(item.ParentBackdropItemId, "Backdrop", { width: BACKDROP_WIDTH, quality: 80 });
  } else if (item.SeriesId) {
    backdropUrl = client.getImageUrl(item.SeriesId, "Backdrop", { width: BACKDROP_WIDTH, quality: 80 });
  }

  // L'affiche d'un épisode est celle de sa série (sa propre image est une vignette paysage).
  let posterUrl: string | null = null;
  if (!isEpisode && item.ImageTags?.Primary) {
    posterUrl = client.getImageUrl(item.Id, "Primary", { height: POSTER_HEIGHT, quality: 85 });
  } else if (isEpisode && item.SeriesId && item.SeriesPrimaryImageTag) {
    posterUrl = client.getImageUrl(item.SeriesId, "Primary", { height: POSTER_HEIGHT, quality: 85 });
  }

  const episode = item as MediaItem & EpisodeLogoFields;
  let logoUrl: string | null = null;
  if (!isEpisode && item.ImageTags?.Logo) {
    logoUrl = client.getImageUrl(item.Id, "Logo", { width: LOGO_WIDTH, quality: 90 });
  } else if (isEpisode && episode.ParentLogoItemId && episode.ParentLogoImageTag) {
    logoUrl = client.getImageUrl(episode.ParentLogoItemId, "Logo", { width: LOGO_WIDTH, quality: 90 });
  }

  const title = isEpisode ? (item.SeriesName ?? item.Name) : item.Name;
  const subtitle = isEpisode
    ? `${formatEpisodeCode(item.ParentIndexNumber, item.IndexNumber, { style: "padded" })} — ${item.Name}`
    : (item.ProductionYear ? String(item.ProductionYear) : null);
  return { backdropUrl, posterUrl, logoUrl, title, subtitle };
}
