import { useMemo } from "react";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { BURN_IN_SUBTITLE_CODECS } from "@tentacle-tv/shared";
import type { MediaStream as JfStream } from "@tentacle-tv/shared";
import type { ExoTextTrack } from "../components/player/ExoPlayer";

/**
 * Construit la liste des pistes de sous-titres TEXTE (non-burn-in) à charger
 * nativement dans le MediaItem ExoPlayer (rendu par le subtitleView natif,
 * cf. plan sous-titres). Même logique d'URL que useTVSubtitles : URL Jellyfin
 * directe si le direct streaming est actif (le proxy strippe api_key), sinon
 * proxy. Mémoïsé sur `streams` → stable pour une source donnée (pas de
 * re-prepare). `enabled` = ExoPlayer (direct play) ; en MPV/transcode, on
 * conserve l'overlay JS (useTVSubtitles).
 */
export function useTVTextTracks(args: {
  itemId?: string;
  mediaSourceId?: string;
  streams: JfStream[];
  enabled: boolean;
}): ExoTextTrack[] {
  const { itemId, mediaSourceId, streams, enabled } = args;
  const client = useJellyfinClient();

  return useMemo(() => {
    if (!enabled || !itemId || !mediaSourceId) return [];
    const ds = client.getDirectStreaming?.();
    return streams
      .filter((s) => s.Type === "Subtitle" && !BURN_IN_SUBTITLE_CODECS.test(s.Codec ?? ""))
      .map((s) => ({
        jellyfinIndex: s.Index,
        language: (s.Language ?? "").toLowerCase(),
        label: s.DisplayTitle || s.Title || s.Language || `Sub ${s.Index}`,
        uri: ds?.enabled && ds.mediaBaseUrl && ds.jellyfinToken
          ? `${ds.mediaBaseUrl}/Videos/${itemId}/${mediaSourceId}/Subtitles/${s.Index}/Stream.vtt?api_key=${encodeURIComponent(ds.jellyfinToken)}`
          : client.getSubtitleUrl(itemId, mediaSourceId, s.Index),
      }));
  }, [enabled, itemId, mediaSourceId, streams, client]);
}
