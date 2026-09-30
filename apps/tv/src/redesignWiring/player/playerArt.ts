import type { MediaItem } from "@tentacle-tv/shared";
import {
  isLogoLegibleOnDark,
  NEUTRAL_PALETTE,
  paletteFromBlurHash,
  type ArtworkPalette,
} from "../../redesign/color/artworkPalette";

/**
 * Les images et les textes d'une œuvre, tels que l'habillage du lecteur les
 * montre — sans rien charger : l'URL vient du client Jellyfin (`ImageUrl`),
 * la présence d'une image de son étiquette (`ImageTags`), sa lumière de son
 * BlurHash.
 */

export type ImageKind = "Primary" | "Backdrop" | "Logo" | "Thumb";
/** L'URL d'une image : le client Jellyfin dans l'app, l'instantané au banc (qui peut ne pas l'avoir). */
export type ImageUrl = (itemId: string, type: ImageKind, options?: { width?: number; quality?: number }) => string | undefined;

type WithHashes = { ImageBlurHashes?: Partial<Record<string, Record<string, string>>> };

function blurHashOf(item: MediaItem | undefined, type: ImageKind): string | undefined {
  const hashes = (item as (MediaItem & WithHashes) | undefined)?.ImageBlurHashes?.[type];
  return hashes ? Object.values(hashes)[0] : undefined;
}

/**
 * Le logo de l'œuvre, s'il existe ET se lit sur la scène sombre : un logo noir
 * de part en part cède au titre écrit (`isLogoLegibleOnDark`). `TitleArt` n'a
 * pas de repli sur erreur — on ne lui passe donc qu'un logo qu'on sait là.
 */
export function logoUriOf(image: ImageUrl, art: MediaItem | undefined, width = 800): string | undefined {
  if (!art?.ImageTags?.Logo) return undefined;
  if (!isLogoLegibleOnDark(blurHashOf(art, "Logo"))) return undefined;
  return image(art.Id, "Logo", { width, quality: 90 });
}

/**
 * Le fond d'une œuvre : celui du film, celui de la série pour un épisode (le
 * fond propre d'un épisode est rare) — même repli que l'écran de chargement
 * actuel.
 */
export function backdropUriOf(image: ImageUrl, item: MediaItem | undefined, width = 1920): string | undefined {
  if (!item) return undefined;
  if (item.Type !== "Episode") return item.BackdropImageTags?.length ? image(item.Id, "Backdrop", { width, quality: 80 }) : undefined;
  const parent = item.ParentBackdropImageTags?.length ? (item.ParentBackdropItemId ?? item.SeriesId) : item.SeriesId;
  return parent ? image(parent, "Backdrop", { width, quality: 80 }) : undefined;
}

/** La lumière d'une œuvre : son fond, sinon son affiche, sinon sa vignette. */
export function paletteOf(...items: Array<MediaItem | undefined>): ArtworkPalette {
  for (const item of items) {
    const hash = blurHashOf(item, "Backdrop") ?? blurHashOf(item, "Primary") ?? blurHashOf(item, "Thumb");
    const palette = paletteFromBlurHash(hash);
    if (palette) return palette;
  }
  return NEUTRAL_PALETTE;
}

/**
 * Un résumé Jellyfin en texte : certains portent du HTML (« <br>Source:
 * crunchyroll »), que l'app affichait brut.
 */
export function plainText(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const text = value.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  return text || undefined;
}
