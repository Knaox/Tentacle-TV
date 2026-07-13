import { useMemo } from "react";
import { Platform } from "react-native";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaStream as JfStream } from "@tentacle-tv/shared";
import { isBurnInSubtitleCodec } from "../utils/subtitleBurnIn";
import type { ExoTextTrack } from "../components/player/ExoPlayer";

/**
 * Format de livraison natif selon le codec (parité DesktopPlayer) : les pistes
 * ASS/SSA sont servies en `.ass` pour être rendues nativement par ExoPlayer
 * (legacy SsaParser, MimeType text/x-ssa côté natif) avec leur stylage ;
 * sinon `.vtt` (texte simple, validé). Jellyfin convertit ASS→VTT sinon, ce qui
 * casse le rendu (ExoPlayer parse alors de l'ASS comme du VTT).
 */
function nativeSubFormat(codec?: string): string {
  const c = codec?.toLowerCase();
  return c === "ass" || c === "ssa" ? "ass" : "vtt";
}

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
      // Pistes IMAGE (PGS/VOBSUB/DVB) exclues : incrustées par le serveur.
      .filter((s) => s.Type === "Subtitle" && !isBurnInSubtitleCodec(s.Codec))
      .map((s) => {
        // tvOS/AVPlayer ne sait pas rendre l'ASS sideloadé → toujours VTT
        // (Jellyfin convertit). Android/ExoPlayer garde l'ASS natif.
        const fmt = Platform.OS === "ios" ? "vtt" : nativeSubFormat(s.Codec);
        return {
          jellyfinIndex: s.Index,
          language: (s.Language ?? "").toLowerCase(),
          label: s.DisplayTitle || s.Title || s.Language || `Sub ${s.Index}`,
          uri: ds?.enabled && ds.mediaBaseUrl && ds.jellyfinToken
            ? `${ds.mediaBaseUrl}/Videos/${itemId}/${mediaSourceId}/Subtitles/${s.Index}/Stream.${fmt}?api_key=${encodeURIComponent(ds.jellyfinToken)}`
            : client.getSubtitleUrl(itemId, mediaSourceId, s.Index, fmt),
        };
      });
  }, [enabled, itemId, mediaSourceId, streams, client]);
}
