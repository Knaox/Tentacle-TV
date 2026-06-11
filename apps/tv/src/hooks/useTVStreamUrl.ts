import { useMemo } from "react";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { BURN_IN_SUBTITLE_CODECS } from "@tentacle-tv/shared";
import type { MediaStream as JfStream } from "@tentacle-tv/shared";
import { randomSessionId } from "../utils/playerHelpers";

/**
 * Construit l'URL Jellyfin selon le mode de lecture :
 *  - Qualité user transcodée → maxBitrate + maxHeight/Width depuis le preset
 *  - forceTranscode codec → fallback 8 Mbps (compat MPV)
 *  - Direct play → URL Static avec sourceVideoCodec
 *
 * Génère un `playSessionId` stable tant qu'on reste en direct play (`undefined`)
 * et un UUID frais pour chaque session transcodée.
 */
export function useTVStreamUrl(args: {
  itemId: string;
  mediaSourceId?: string;
  streams: JfStream[];
  audioIndex: number;
  /** Piste sous-titres à INCRUSTER en transcode (PGS/burn-in). -1 = aucune. */
  subtitleIndex?: number;
  startTicks: number;
  forceTranscode: boolean;
  isTranscodingQuality: boolean;
  maxBitrate?: number;
  maxHeight?: number;
  isDirectPlay: boolean;
}) {
  const {
    itemId, mediaSourceId, streams, audioIndex, subtitleIndex, startTicks,
    forceTranscode, isTranscodingQuality, maxBitrate, maxHeight, isDirectPlay,
  } = args;
  const client = useJellyfinClient();

  const sourceVideoCodec = streams.find((s) => s.Type === "Video")?.Codec?.toLowerCase();
  // En transcode, seuls les sous-titres image (PGS…) passent par l'URL
  // (SubtitleMethod=Encode) ; les sous-titres texte restent en VTT externe.
  const burnInIndex = subtitleIndex != null && subtitleIndex >= 0
    && BURN_IN_SUBTITLE_CODECS.test(
      streams.find((s) => s.Type === "Subtitle" && s.Index === subtitleIndex)?.Codec ?? "",
    )
    ? subtitleIndex
    : undefined;

  const playSessionId = useMemo(() => {
    if (isDirectPlay) return undefined;
    return randomSessionId();
  }, [audioIndex, burnInIndex, startTicks, isDirectPlay, forceTranscode, isTranscodingQuality]); // eslint-disable-line react-hooks/exhaustive-deps

  const streamUrl = useMemo(() => {
    if (!itemId) return null;
    if (isTranscodingQuality) {
      return client.getStreamUrl(itemId, {
        mediaSourceId, audioIndex, subtitleStreamIndex: burnInIndex, directPlay: false,
        maxBitrate, maxHeight,
        startTimeTicks: startTicks > 0 ? startTicks : undefined, playSessionId,
      });
    }
    if (forceTranscode) {
      return client.getStreamUrl(itemId, {
        mediaSourceId, audioIndex, subtitleStreamIndex: burnInIndex, directPlay: false, maxBitrate: 8_000_000,
        startTimeTicks: startTicks > 0 ? startTicks : undefined, playSessionId,
      });
    }
    return client.getStreamUrl(itemId, {
      mediaSourceId, directPlay: true, playSessionId, sourceVideoCodec,
    });
  }, [client, itemId, mediaSourceId, audioIndex, burnInIndex, startTicks, playSessionId, sourceVideoCodec, forceTranscode, isTranscodingQuality, maxBitrate, maxHeight]);

  return { streamUrl, playSessionId };
}
