import type { JellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";

/** Largeur du backdrop de bannière — une seule définition pour toute l'app. */
export const HERO_BACKDROP_WIDTH = 1920;

/**
 * Identifiant à interroger pour obtenir un backdrop pleine largeur, ou `null`
 * si l'item n'en possède aucun (le repli est alors un aplat de page, jamais un
 * poster 2:3 étiré).
 *
 * Un épisode n'a presque jamais de backdrop propre : on remonte à celui de sa
 * série, qui est l'image large de référence.
 */
export function resolveBackdropId(item: MediaItem): string | null {
  const hasParent = (item.ParentBackdropImageTags?.length ?? 0) > 0;
  const hasOwn = (item.BackdropImageTags?.length ?? 0) > 0;
  if (!hasParent && !hasOwn) return null;

  if (item.Type === "Episode" && hasParent) {
    return item.ParentBackdropItemId ?? item.SeriesId ?? item.Id;
  }
  return item.Id;
}

/**
 * URL du backdrop de bannière, ou `null`.
 *
 * Une seule définition, partagée par le calque qui l'affiche (`HeroBackdrop`),
 * le halo qui en tire ses couleurs (`HeroAmbilight`) et la transition
 * d'ouverture de fiche (`HeroActions`). L'URL doit être RIGOUREUSEMENT la même
 * pour ces trois usages : c'est ce qui garantit que la transition reprend un
 * pixel déjà décodé, sans un octet de plus ni un clignotement.
 */
export function heroBackdropUrl(client: JellyfinClient, item: MediaItem | undefined): string | null {
  if (!item) return null;
  const id = resolveBackdropId(item);
  return id ? client.getImageUrl(id, "Backdrop", { width: HERO_BACKDROP_WIDTH, quality: 85 }) : null;
}

/** Premier item de la liste qui possède un backdrop exploitable. */
export function firstBackdropItem(items: MediaItem[] | undefined): MediaItem | null {
  return items?.find((item) => resolveBackdropId(item) !== null) ?? null;
}
