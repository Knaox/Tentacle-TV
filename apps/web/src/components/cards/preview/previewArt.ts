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
