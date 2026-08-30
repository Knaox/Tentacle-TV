import { useMemo } from "react";
import { buildTrickplayTileUrl, isDataSaverActive, useJellyfinClient } from "@tentacle-tv/api-client";
import {
  TICKS_PER_MS,
  getTrickplayTile,
  pickBestTrickplayWidth,
  type MediaItem,
  type TrickplayInfo,
} from "@tentacle-tv/shared";

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
    if (saver || positionTicks <= 0 || !manifest) return null;
    const selection = pickBestTrickplayWidth(manifest, defaultSourceId);
    if (!selection) return null;
    const { info } = selection;
    if (info.Interval <= 0 || info.Width <= 0 || info.Height <= 0) return null;
    // La position peut dépasser la dernière vignette (fin de fichier, durée
    // arrondie) : bornée, sinon l'index viserait une planche qui n'existe pas.
    const positionMs = Math.min(
      positionTicks / TICKS_PER_MS,
      Math.max(0, (info.ThumbnailCount - 1) * info.Interval),
    );
    const coords = getTrickplayTile(positionMs, info);
    return {
      url: buildTrickplayTileUrl(
        client.getBaseUrl(),
        client.getAccessToken(),
        item.Id,
        selection.mediaSourceId,
        selection.width,
        coords.tileIndex,
      ),
      info,
      col: coords.xInTile / info.Width,
      row: coords.yInTile / info.Height,
    };
  }, [saver, positionTicks, manifest, defaultSourceId, client, item.Id]);
}
