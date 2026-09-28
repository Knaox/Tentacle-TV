/**
 * La scène de la fiche média — ce que le web, le miroir et le mobile lisent de
 * la même façon, en pur :
 *
 *  • la GALERIE : les images qu'ouvre la vue « image plein écran » (décors,
 *    affiche, image d'un épisode), dans l'ordre où on les parcourt ;
 *  • la REPRISE : où en est la lecture, et combien il en reste.
 *
 * Aucune URL ici : chaque client la fabrique avec son `getImageUrl`, à la
 * taille qui convient à son écran.
 */

import type { MediaItem } from "../types/media";

const TICKS_PER_MINUTE = 60 * 10_000_000;
/** Au-delà, un visionneur devient une pellicule qu'on ne parcourt plus. */
export const DETAIL_GALLERY_MAX = 12;

export type DetailImageKind = "backdrop" | "poster" | "still";

export interface DetailImageRef {
  /** Clé stable pour React (type + item + index). */
  key: string;
  itemId: string;
  imageType: "Backdrop" | "Primary";
  /** Index du décor chez Jellyfin (0 pour une Primary). */
  index: number;
  kind: DetailImageKind;
  /** Tag Jellyfin : adresse l'image par contenu, donc cache sûr. */
  tag?: string;
  /** Largeur / hauteur attendue, pour réserver la place avant le décodage. */
  aspect: number;
}

type GalleryItem = Pick<
  MediaItem,
  "Id" | "Type" | "ImageTags" | "BackdropImageTags" | "ParentBackdropImageTags" | "ParentBackdropItemId" | "SeriesId"
>;

function backdrops(itemId: string, tags: readonly string[]): DetailImageRef[] {
  return tags.map((tag, index) => ({
    key: `Backdrop:${itemId}:${index}`,
    itemId,
    imageType: "Backdrop",
    index,
    kind: "backdrop",
    tag,
    aspect: 16 / 9,
  }));
}

/**
 * Les images de la fiche, dans l'ordre de parcours.
 *
 * Un épisode commence par SA propre image (la seule qui lui appartienne), puis
 * les décors de sa série. Film, série, saison, collection : les décors d'abord
 * — c'est ce que montre la bannière, donc là où la visionneuse s'ouvre — puis
 * l'affiche. Une saison ou un épisode sans décor propre emprunte ceux de la
 * série, comme la bannière.
 */
export function detailGallery(item: GalleryItem): DetailImageRef[] {
  const primaryTag = item.ImageTags?.Primary;
  const own = item.BackdropImageTags ?? [];
  const parent = item.ParentBackdropImageTags ?? [];
  const parentId = item.ParentBackdropItemId ?? item.SeriesId;
  const decor = own.length > 0
    ? backdrops(item.Id, own)
    : parentId && parent.length > 0 ? backdrops(parentId, parent) : [];

  const isEpisode = item.Type === "Episode";
  const primary: DetailImageRef[] = primaryTag
    ? [{
        key: `Primary:${item.Id}:0`,
        itemId: item.Id,
        imageType: "Primary",
        index: 0,
        kind: isEpisode ? "still" : "poster",
        tag: primaryTag,
        aspect: isEpisode ? 16 / 9 : 2 / 3,
      }]
    : [];

  const ordered = isEpisode ? [...primary, ...decor] : [...decor, ...primary];
  return ordered.slice(0, DETAIL_GALLERY_MAX);
}

/** Position dans la galerie de la première image d'un genre, 0 à défaut. */
export function galleryIndexOf(gallery: readonly DetailImageRef[], kind: DetailImageKind): number {
  const index = gallery.findIndex((image) => image.kind === kind);
  return index < 0 ? 0 : index;
}

export interface ResumeState {
  /** Avancement, de 0 à 1. */
  progress: number;
  /** Minutes restantes (arrondies au-dessus), `null` sans durée connue. */
  remainingMinutes: number | null;
}

/**
 * Ce qu'il reste d'une lecture entamée, ou `null` s'il n'y a rien à reprendre.
 *
 * Le seuil haut est à 99 % et non 100 : Jellyfin rend couramment 99,4 % sur un
 * titre vu jusqu'au générique, et la fiche affichait « Reprendre » à côté d'un
 * « vu ». Une série n'a pas de reprise propre : c'est son épisode qui en a une.
 */
export function resumeState(item: Pick<MediaItem, "Type" | "RunTimeTicks" | "UserData">): ResumeState | null {
  if (item.Type === "Series" || item.Type === "BoxSet" || item.Type === "Season") return null;
  const position = item.UserData?.PlaybackPositionTicks ?? 0;
  const runtime = item.RunTimeTicks ?? 0;
  const percent = runtime > 0 ? (position / runtime) * 100 : (item.UserData?.PlayedPercentage ?? 0);
  if (!(percent > 0 && percent < 99) || position <= 0) return null;
  const remaining = runtime > 0 ? Math.ceil((runtime - position) / TICKS_PER_MINUTE) : null;
  return { progress: percent / 100, remainingMinutes: remaining != null && remaining > 0 ? remaining : null };
}

/** « 1 h 42 » se dit en heures ET minutes ; sous l'heure, en minutes seules. */
export function splitMinutes(total: number): { hours: number; minutes: number } {
  return { hours: Math.floor(total / 60), minutes: total % 60 };
}
