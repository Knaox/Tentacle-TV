import { useMemo } from "react";
import { buildTrickplayTileUrl, isDataSaverActive, useJellyfinClient } from "@tentacle-tv/api-client";
import { resolveResumeSprite, type MediaItem, type TrickplayInfo } from "@tentacle-tv/shared";

export interface ResumeFrame {
  /** L'URL de la planche trickplay qui contient la vignette. */
  url: string;
  info: TrickplayInfo;
  /** Colonne et rangée de la vignette dans la planche (indices entiers). */
  col: number;
  row: number;
}

/**
 * La vignette trickplay EXACTE de la position de reprise d'un média.
 *
 * `null` dès qu'un maillon manque — pas de position, pas de manifeste, mode
 * économie (une planche pèse dix fois la bannière) — et la carte retombe sur
 * sa bannière habituelle.
 *
 * La position vient de `UserData.PlaybackPositionTicks`, que Jellyfin
 * synchronise entre appareils : tous calculent le même index de tuile, donc
 * montrent la MÊME image, jusqu'à ce que l'un d'eux avance la lecture — la
 * requête Resume se rafraîchit déjà à l'arrêt d'une lecture et sur le
 * websocket d'accueil.
 */
export function useResumeFrame(item: MediaItem): ResumeFrame | null {
  const client = useJellyfinClient();
  const positionTicks = item.UserData?.PlaybackPositionTicks ?? 0;
  const manifest = item.Trickplay;
  // La source PAR DÉFAUT : celle que la lecture ouvrira, et celle dont les
  // temps correspondent à la position (média multi-versions).
  const defaultSourceId = item.MediaSources?.[0]?.Id;
  const saver = isDataSaverActive();

  return useMemo(() => {
    if (saver) return null;
    const sprite = resolveResumeSprite(manifest, positionTicks, defaultSourceId);
    if (!sprite) return null;
    return {
      url: buildTrickplayTileUrl(
        client.getBaseUrl(),
        client.getAccessToken(),
        item.Id,
        sprite.selection.mediaSourceId,
        sprite.selection.width,
        sprite.tileIndex,
      ),
      info: sprite.selection.info,
      col: sprite.col,
      row: sprite.row,
    };
  }, [saver, positionTicks, manifest, defaultSourceId, client, item.Id]);
}
