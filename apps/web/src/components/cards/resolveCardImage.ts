import type { MediaItem } from "@tentacle-tv/shared";

/** Image résolue : identifiant Jellyfin + type d'image à demander. */
export interface ResolvedCardImage {
  id: string;
  type: "Primary" | "Backdrop";
}

/**
 * Image 16:9 « bannière » pour les cartes EpisodeCard.
 *
 * Pour un épisode, on privilégie la VRAIE image de l'épisode (sa Primary, qui
 * est le still 16:9 réel) avant de retomber sur le backdrop de la série — c'est
 * l'inverse de l'ancien comportement, qui montrait toujours le backdrop série.
 * Priorité : Primary épisode → Backdrop épisode → Backdrop série → Primary série.
 * Pour un film : Backdrop propre → Primary.
 */
export function resolveBannerImage(item: MediaItem): ResolvedCardImage {
  const isEpisode = item.Type === "Episode";
  const hasOwnPrimary = !!item.ImageTags?.Primary;
  const hasOwnBackdrop = (item.BackdropImageTags?.length ?? 0) > 0;
  const hasParentBackdrop = (item.ParentBackdropImageTags?.length ?? 0) > 0;

  if (isEpisode) {
    if (hasOwnPrimary) return { id: item.Id, type: "Primary" };
    if (hasOwnBackdrop) return { id: item.Id, type: "Backdrop" };
    if (hasParentBackdrop) {
      return { id: item.ParentBackdropItemId ?? item.SeriesId ?? item.Id, type: "Backdrop" };
    }
    return { id: item.SeriesId ?? item.Id, type: "Primary" };
  }

  return { id: item.Id, type: hasOwnBackdrop ? "Backdrop" : "Primary" };
}

/** Mode d'affiche pour un épisode dans une carte 2:3. */
export type PosterImageMode = "auto" | "series";

/**
 * Image 2:3 « affiche » pour les cartes PosterCard.
 *
 * - `auto` (défaut) : pour un épisode, affiche réelle de l'épisode (sa Primary),
 *   repli sur le poster de la série.
 * - `series` : pour un épisode, on force le poster de la SÉRIE (plus propre dans
 *   « Derniers ajouts » où un still 16:9 rogné en 2:3 rend mal).
 */
export function resolvePosterImage(item: MediaItem, mode: PosterImageMode = "auto"): ResolvedCardImage {
  if (item.Type === "Episode") {
    if (mode === "series" && item.SeriesId) return { id: item.SeriesId, type: "Primary" };
    if (item.ImageTags?.Primary) return { id: item.Id, type: "Primary" };
    if (item.SeriesId) return { id: item.SeriesId, type: "Primary" };
  }
  return { id: item.Id, type: "Primary" };
}
