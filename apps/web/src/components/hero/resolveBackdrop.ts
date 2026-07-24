import type { MediaItem } from "@tentacle-tv/shared";

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

/** Premier item de la liste qui possède un backdrop exploitable. */
export function firstBackdropItem(items: MediaItem[] | undefined): MediaItem | null {
  return items?.find((item) => resolveBackdropId(item) !== null) ?? null;
}
