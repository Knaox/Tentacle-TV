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
  /** Parité de signature tvOS (gate remux par conteneur) ; ignoré côté Android. */
  container?: string;
  streams: JfStream[];
  audioIndex: number;
  /** Piste sous-titres à INCRUSTER en transcode (PGS/burn-in). -1 = aucune. */
  subtitleIndex?: number;
  startTicks: number;
  /** Position de DÉMARRAGE de la lecture (reprise / reload de piste), en
   *  secondes — transmise au natif via un fragment `#tnt-start=` : le player
   *  démarre directement à cette position (zéro frame à 0:00, et le seek
   *  post-chargement sur un HLS en transcodage n'est plus nécessaire). */
  startSeconds?: number;
  forceTranscode: boolean;
  isTranscodingQuality: boolean;
  maxBitrate?: number;
  maxHeight?: number;
  isDirectPlay: boolean;
  /** Parité de signature tvOS (reload transcode explicite) ; ignoré côté Android
   *  (le changement de piste audio est natif, pas de refetch d'URL). */
  reloadNonce?: number;
}) {
  const {
    itemId, mediaSourceId, streams, audioIndex, subtitleIndex, startTicks,
    startSeconds, forceTranscode, isTranscodingQuality, maxBitrate, maxHeight, isDirectPlay,
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
    // Fragment de position de départ — jamais envoyé en HTTP, lu par le natif
    const startFragment = startSeconds && startSeconds > 1 ? `#tnt-start=${Math.floor(startSeconds)}` : "";
    if (isTranscodingQuality) {
      return client.getStreamUrl(itemId, {
        mediaSourceId, audioIndex, subtitleStreamIndex: burnInIndex, directPlay: false,
        maxBitrate, maxHeight,
        startTimeTicks: startTicks > 0 ? startTicks : undefined, playSessionId,
      }) + startFragment;
    }
    if (forceTranscode) {
      return client.getStreamUrl(itemId, {
        mediaSourceId, audioIndex, subtitleStreamIndex: burnInIndex, directPlay: false, maxBitrate: 8_000_000,
        startTimeTicks: startTicks > 0 ? startTicks : undefined, playSessionId,
      }) + startFragment;
    }
    return client.getStreamUrl(itemId, {
      mediaSourceId, directPlay: true, playSessionId, sourceVideoCodec,
    }) + startFragment;
  }, [client, itemId, mediaSourceId, audioIndex, burnInIndex, startTicks, startSeconds, playSessionId, sourceVideoCodec, forceTranscode, isTranscodingQuality, maxBitrate, maxHeight]);

  // `isDirectPlay` est renvoyé tel quel (décidé côté client sur Android) pour
  // aligner le contrat sur la variante tvOS (où c'est le serveur qui décide).
  return { streamUrl, playSessionId, isDirectPlay };
}
