import type { MediaItem } from "@tentacle-tv/shared";

/** Le strict nécessaire du client Jellyfin : ce module reste pur (testé sans
 *  React Native). */
interface ImageClient {
  getImageUrl: (itemId: string, type: "Primary" | "Backdrop", opts?: { width?: number; quality?: number }) => string;
}

/* ── Source d'image (backdrop plein cadre + miniature du halo) ──────────── */

export function heroImageUrl(
  client: ImageClient,
  it: MediaItem,
  width = 1280,
  quality = 85,
): string | null {
  const isEp = it.Type === "Episode";
  const hasParentBackdrop = (it.ParentBackdropImageTags?.length ?? 0) > 0;
  const hasOwnBackdrop = (it.BackdropImageTags?.length ?? 0) > 0;
  if (!hasParentBackdrop && !hasOwnBackdrop && !it.ImageTags?.Primary) return null;
  const backdropId = isEp
    ? (hasParentBackdrop ? (it.ParentBackdropItemId ?? it.SeriesId ?? it.Id) : it.Id)
    : it.Id;
  return (hasParentBackdrop || hasOwnBackdrop)
    ? client.getImageUrl(backdropId, "Backdrop", { width, quality })
    : client.getImageUrl(it.Id, "Primary", { width, quality });
}

/**
 * L'affiche (2/3) du titre, pour la carte portrait du téléphone. Un épisode
 * prend celle de SA SÉRIE : son image `Primary` à lui est une vignette 16/9.
 */
export function heroPosterUrl(
  client: ImageClient,
  it: MediaItem,
  width = 1080,
  quality = 85,
): string | null {
  if (it.Type === "Episode") {
    return it.SeriesId && it.SeriesPrimaryImageTag
      ? client.getImageUrl(it.SeriesId, "Primary", { width, quality })
      : null;
  }
  return it.ImageTags?.Primary ? client.getImageUrl(it.Id, "Primary", { width, quality }) : null;
}
