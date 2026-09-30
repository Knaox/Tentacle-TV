import type { useJellyfinClient } from "@tentacle-tv/api-client";
import { resolveBannerImage, resolvePosterImage, type MediaItem } from "@tentacle-tv/shared";
import { NEUTRAL_PALETTE, paletteFromBlurHash, type ArtworkPalette } from "../../redesign/color/artworkPalette";

/**
 * Les images et la lumière d'une œuvre, telles que les vues de la refonte les
 * attendent : des adresses prêtes (`CardModel`, `HeroModel`) et une palette
 * tirée du BlurHash que Jellyfin joint à chaque image.
 */

type ImageClient = ReturnType<typeof useJellyfinClient>;
type BlurHashes = Partial<Record<"Primary" | "Backdrop" | "Thumb" | "Logo", Record<string, string>>>;

/** Les tailles demandées au serveur : de quoi rester net sur une Apple TV 4K
 *  (échelle 2) sans charger l'original. */
const LANDSCAPE_WIDTH = 640;
const POSTER_HEIGHT = 480;
const LOGO_WIDTH = 400;
const BACKDROP_WIDTH = 1280;

/** L'empreinte floue d'une image de l'item — `ImageBlurHashes` n'est pas dans
 *  le type partagé, mais Jellyfin la joint à toute réponse qui porte des images. */
export function blurHashOf(item: MediaItem | null | undefined, type: keyof BlurHashes): string | undefined {
  const hashes = (item as { ImageBlurHashes?: BlurHashes } | null | undefined)?.ImageBlurHashes?.[type];
  return hashes ? Object.values(hashes)[0] : undefined;
}

// Une palette par empreinte, calculée une fois : la même œuvre rend le même
// objet d'un rendu à l'autre, et les cartes mémoïsées ne bougent pas.
const palettes = new Map<string, ArtworkPalette>();
const PALETTE_CACHE_MAX = 600;

function paletteOfHash(hash: string): ArtworkPalette {
  let palette = palettes.get(hash);
  if (!palette) {
    palette = paletteFromBlurHash(hash) ?? NEUTRAL_PALETTE;
    if (palettes.size >= PALETTE_CACHE_MAX) palettes.delete(palettes.keys().next().value as string);
    palettes.set(hash, palette);
  }
  return palette;
}

/** La lumière d'une œuvre : son fond, sinon son affiche, sinon sa vignette —
 *  sinon celles de sa série ; une lumière neutre à défaut. */
export function paletteOfItem(item: MediaItem | null | undefined, series?: MediaItem | null): ArtworkPalette {
  for (const source of [item, series]) {
    const hash = blurHashOf(source, "Backdrop") ?? blurHashOf(source, "Primary") ?? blurHashOf(source, "Thumb");
    if (hash) return paletteOfHash(hash);
  }
  return NEUTRAL_PALETTE;
}

/** L'affiche 2:3 — pour un épisode, celle de sa série (`resolvePosterImage`). */
export function posterUriOf(client: ImageClient, item: MediaItem): string | undefined {
  const image = resolvePosterImage(item, "series");
  if (!image) return undefined;
  return client.getImageUrl(image.id, image.type, { height: POSTER_HEIGHT, quality: 85, ...(image.tag ? { tag: image.tag } : {}) });
}

/**
 * L'image 16:9 d'une carte, et le logo à poser dessus quand elle n'en porte
 * pas déjà un. Épisode : son image réelle (`resolveBannerImage`). Film ou
 * série : la vignette (Thumb, qui porte déjà le titre), sinon le fond — et
 * alors le logo, s'il est connu (une réponse qui n'a pas demandé les logos
 * ne l'annonce pas : on n'en demande pas un à l'aveugle).
 */
export function landscapeOf(client: ImageClient, item: MediaItem): { uri?: string; logoUri?: string } {
  const at = (id: string, type: "Primary" | "Backdrop" | "Thumb", tag?: string) =>
    client.getImageUrl(id, type, { width: LANDSCAPE_WIDTH, quality: 80, ...(tag ? { tag } : {}) });
  if (item.Type === "Episode") {
    const banner = resolveBannerImage(item);
    return { uri: banner ? at(banner.id, banner.type, banner.tag) : undefined };
  }
  const thumb = item.ImageTags?.Thumb;
  if (thumb) return { uri: at(item.Id, "Thumb", thumb) };
  const backdrop = item.BackdropImageTags?.[0];
  if (!backdrop) {
    const primary = resolvePosterImage(item, "series");
    return { uri: primary ? at(primary.id, primary.type, primary.tag) : undefined };
  }
  return { uri: at(item.Id, "Backdrop", backdrop), logoUri: logoUriOf(client, item) };
}

/** Le logo d'une œuvre (celui de la série pour un épisode), s'il est connu. */
export function logoUriOf(client: ImageClient, item: MediaItem): string | undefined {
  const own = item.ImageTags?.Logo;
  if (own) return client.getImageUrl(item.Id, "Logo", { width: LOGO_WIDTH, tag: own });
  const parent = (item as { ParentLogoItemId?: string; ParentLogoImageTag?: string });
  if (parent.ParentLogoItemId && parent.ParentLogoImageTag) {
    return client.getImageUrl(parent.ParentLogoItemId, "Logo", { width: LOGO_WIDTH, tag: parent.ParentLogoImageTag });
  }
  return undefined;
}

/** Le grand fond d'une œuvre (héros), le sien sinon celui de sa série. */
export function backdropUriOf(client: ImageClient, item: MediaItem): string | undefined {
  const own = item.BackdropImageTags?.[0];
  if (own) return client.getImageUrl(item.Id, "Backdrop", { width: BACKDROP_WIDTH, quality: 85, tag: own });
  const parentTag = item.ParentBackdropImageTags?.[0];
  const parentId = item.ParentBackdropItemId ?? item.SeriesId;
  if (parentTag && parentId) return client.getImageUrl(parentId, "Backdrop", { width: BACKDROP_WIDTH, quality: 85, tag: parentTag });
  return undefined;
}

/** 0 à 1, ou undefined quand il n'y a rien à reprendre (ou que le titre est vu). */
export function progressOf(item: MediaItem): number | undefined {
  const pct = item.UserData?.PlayedPercentage ?? 0;
  return item.UserData?.Played || pct <= 0 ? undefined : Math.min(1, pct / 100);
}
