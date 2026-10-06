import type { JellyfinClient } from "@tentacle-tv/api-client";
import type { HeroImageOption, MediaItem } from "@tentacle-tv/shared";

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

/**
 * L'adresse d'une image du plan de la bannière d'ACCUEIL (shared
 * `heroImagePlan`). Une image Jellyfin garde l'URL de `heroBackdropUrl` à
 * l'octet près pour un fond (même largeur, même qualité) : la fiche et la
 * transition d'ouverture reprennent la même image en cache. Une image TMDB
 * est servie telle quelle — en `w300` pour une source minuscule (le halo).
 */
export function heroOptionUrl(
  client: Pick<JellyfinClient, "getImageUrl">,
  option: HeroImageOption,
  width = HERO_BACKDROP_WIDTH,
  quality = 85
): string {
  if (option.url !== undefined) return width <= 300 ? option.url.replace("/w1280/", "/w300/") : option.url;
  const { id, type, index } = option.ref;
  return client.getImageUrl(id, type, { width, quality, ...(index ? { index } : {}) });
}
