import type { RecoReason, RecoRowItem } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";

/**
 * Une recommandation EN BIBLIOTHÈQUE, vue comme un titre Jellyfin.
 *
 * Le téléviseur ne montre que ce qui est sur le serveur : un titre « à la
 * demande » n'y mène nulle part — pas de catalogue d'extension à trois mètres,
 * et une carte qu'on ne peut pas ouvrir est une impasse. Ce qui reste est un
 * titre de la bibliothèque, et il a droit aux cartes de toutes les autres
 * rangées (`RowTv`) : même affiche, même focus, même fiche au bout de l'appui.
 *
 * L'affiche se résout par l'identifiant seul (`ImageTags` absent : la carte
 * demande l'image sans prétendre qu'il n'y en a pas). La note est celle que le
 * moteur a servie, TMDB : c'est celle que la carte du web affiche aussi.
 */
export function recoItemToMediaItem(item: RecoRowItem): MediaItem | null {
  if (!item.jellyfinItemId) return null;
  return {
    Id: item.jellyfinItemId,
    Name: item.title,
    Type: item.mediaType === "tv" ? "Series" : "Movie",
    ...(item.year != null ? { ProductionYear: item.year } : {}),
    ...(item.voteAverage != null ? { CommunityRating: Math.round(item.voteAverage * 10) / 10 } : {}),
  } as MediaItem;
}

/** Les titres de la bibliothèque d'une rangée, dans l'ordre du moteur. */
export function recoLibraryItems(items: readonly RecoRowItem[]): MediaItem[] {
  const mapped: MediaItem[] = [];
  for (const item of items) {
    const media = recoItemToMediaItem(item);
    if (media) mapped.push(media);
  }
  return mapped;
}

/** La première raison qui fait une phrase — sinon aucune. */
export function firstReasonText(
  reasons: readonly RecoReason[],
  toText: (reason: RecoReason) => string | null,
): string | null {
  for (const reason of reasons) {
    const text = toText(reason);
    if (text) return text;
  }
  return null;
}
