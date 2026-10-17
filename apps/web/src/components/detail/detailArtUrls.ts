import type { JellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";

/**
 * Les adresses des images de la fiche, écrites à UN endroit : la fiche les
 * décode d'avance (`useDetailArrival`) et ses composants les affichent — la
 * moindre différence (taille, qualité, tag) ferait décoder une image que
 * personne ne montre, et surgir celle qu'on montre.
 */

/** L'affiche (2:3), ou la vignette 16:9 d'un épisode ; `null` sans image. */
export function detailPosterUrl(client: JellyfinClient, item: MediaItem): string | null {
  if (!item.ImageTags?.Primary) return null;
  const isEpisode = item.Type === "Episode";
  return client.getImageUrl(item.Id, "Primary", {
    ...(isEpisode ? { width: 832 } : { height: 600 }),
    quality: 90,
    // Adressée par son tag : une affiche arrivée après une analyse change
    // d'adresse, l'échec d'avant ne la masque pas (`useBrokenImage`).
    tag: item.ImageTags.Primary,
  });
}

/** Le logo du titre ; jamais pour un épisode (ce serait celui de la série). */
export function detailLogoUrl(client: JellyfinClient, item: MediaItem): string | null {
  if (item.Type === "Episode" || !item.ImageTags?.Logo) return null;
  return client.getImageUrl(item.Id, "Logo", { height: 320, quality: 90, tag: item.ImageTags.Logo });
}
