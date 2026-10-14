import { resolveLogoImage, type MediaItem } from "@tentacle-tv/shared";

/**
 * L'IMAGE d'un titre que la mini-carte montre le temps de son agrandissement :
 * le fond 16:9 du titre (celui de la série pour un épisode), annoncé par la
 * donnée — jamais demandé à l'aveugle.
 *
 * Pourquoi une image et pas la première image de la vidéo : une bande-annonce
 * s'ouvre presque toujours sur du noir ou un logo de distributeur. Grandir sur
 * une boîte noire, c'est exactement le « flash noir » à éviter. Netflix fait de
 * même : l'image du titre d'abord, la vidéo la rejoint en fondu quand elle part.
 */
export interface PreviewImageRef {
  id: string;
  tag: string;
}

export function previewBackdropOf(item: MediaItem): PreviewImageRef | null {
  const own = item.BackdropImageTags?.[0];
  if (item.Type !== "Episode" && item.Type !== "Season" && own) return { id: item.Id, tag: own };
  const parent = item.ParentBackdropImageTags?.[0];
  const parentId = item.ParentBackdropItemId ?? item.SeriesId;
  if (parent && parentId) return { id: parentId, tag: parent };
  return own ? { id: item.Id, tag: own } : null;
}

export function previewLogoOf(item: MediaItem): PreviewImageRef | null {
  return resolveLogoImage(item);
}

/**
 * Faut-il lire la FICHE du titre (`["item", id]`) ? Les rangées et les grilles
 * ne demandent pas l'image Logo (`EnableImageTypes=Primary,Backdrop,Thumb`) :
 * leur item ne l'annonce jamais, et son absence n'y prouve rien. La fiche,
 * elle, annonce tout — le logo du titre, celui de la série pour un épisode.
 * Sans item de carte (une recommandation), on ne sait rien : la fiche aussi.
 */
export function previewNeedsDetail(card: MediaItem | null, needBackdrop: boolean): boolean {
  if (!card) return true;
  return previewLogoOf(card) === null || (needBackdrop && previewBackdropOf(card) === null);
}

/** La largeur demandée pour l'image du titre : la mini-carte la plus large (560 px) à DPR 1,4. */
export const PREVIEW_STILL_WIDTH = 780;

/**
 * L'URL EXACTE de l'image que la mini-carte montre pendant son agrandissement,
 * sans lire la fiche : l'image que la carte donne, sinon le fond qu'elle
 * annonce ; `null` si elle n'annonce rien (la fiche le dira peut-être). Pure :
 * un préchargement peut la demander avant que la mini-carte n'existe.
 */
export function previewStillUrlOf(
  getImageUrl: (id: string, type: "Backdrop", options: { width: number; quality: number; tag: string }) => string,
  card: MediaItem | null,
  backdropOverride: string | null,
  detail: MediaItem | null = null,
): string | null {
  if (backdropOverride) return backdropOverride;
  const backdrop = (card && previewBackdropOf(card)) ?? (detail && previewBackdropOf(detail)) ?? null;
  return backdrop ? getImageUrl(backdrop.id, "Backdrop", { width: PREVIEW_STILL_WIDTH, quality: 80, tag: backdrop.tag }) : null;
}

/** Logo et fond : ceux que la carte annonce d'abord, sinon ceux de sa fiche. */
export function previewArtOf(
  card: MediaItem | null,
  detail: MediaItem | null,
): { logo: PreviewImageRef | null; backdrop: PreviewImageRef | null } {
  return {
    logo: (card && previewLogoOf(card)) ?? (detail && previewLogoOf(detail)) ?? null,
    backdrop: (card && previewBackdropOf(card)) ?? (detail && previewBackdropOf(detail)) ?? null,
  };
}
