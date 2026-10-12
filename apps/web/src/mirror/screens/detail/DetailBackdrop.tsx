import { memo, type CSSProperties } from "react";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { useBrokenImage } from "../../../hooks/useBrokenImage";
import { DetailStageFallback } from "../../../components/detail/DetailArtworkFallback";

/**
 * L'identifiant du décor de la fiche du miroir : le sien, sinon celui de sa
 * série (saison, épisode), sinon AUCUN — un titre sans images ne demande plus
 * une adresse vouée au 404 (« Backdrop?maxWidth=1200 » en rouge dans la
 * console d'un Jellyfin qui n'a rien trouvé).
 */
export function mirrorBackdropId(item: Pick<MediaItem, "Id" | "BackdropImageTags" | "ParentBackdropImageTags" | "ParentBackdropItemId" | "SeriesId">): string | null {
  if ((item.BackdropImageTags?.length ?? 0) > 0) return item.Id;
  if ((item.ParentBackdropImageTags?.length ?? 0) > 0) return item.ParentBackdropItemId ?? item.SeriesId ?? null;
  return null;
}

/**
 * Le décor de la scène du miroir, ou son repli de marque (le même que le
 * bureau) quand il n'y en a pas ou qu'il ne se charge pas.
 */
export const DetailBackdrop = memo(function DetailBackdrop({ item, className, style }: {
  item: MediaItem;
  className: string;
  style?: CSSProperties;
}) {
  const client = useJellyfinClient();
  const id = mirrorBackdropId(item);
  const url = id ? client.getImageUrl(id, "Backdrop", { width: 1200, quality: 85 }) : null;
  const { broken, reportFailure } = useBrokenImage(url);
  if (!url || broken) return <DetailStageFallback />;
  return <img src={url} alt="" decoding="async" draggable={false} onError={reportFailure} className={className} style={style} />;
});
