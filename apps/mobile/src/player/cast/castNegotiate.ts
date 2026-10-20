import type { useJellyfinClient } from "@tentacle-tv/api-client";
import {
  buildCastDeviceProfile, castContentType, CAST_TEXT_SUBTITLES, TICKS_PER_SECOND,
  type MediaItem, type MediaSource, type PlaybackRights,
} from "@tentacle-tv/shared";
import { castRightsAfter, castRightsBefore } from "./castRights";
import { buildStreamUrl, extractActualStartTicks } from "@/hooks/usePlaybackInfoFetch";
import type { CastLoadRequest } from "../../../modules/tentacle-cast";
import { castLoadStart, pickCastUrl, withCastAuth } from "./castPlan";

type JfClient = ReturnType<typeof useJellyfinClient>;

export interface CastNegotiation {
  request: CastLoadRequest;
  /** Début du flux, en secondes du titre (transcodage : la position demandée). */
  offset: number;
  directPlay: boolean;
  playSessionId: string | undefined;
  mediaSourceId: string;
}

/** `notAllowed` : les droits de lecture du compte refusent ce que la TV demanderait. */
export type CastNegotiationFailure = "noSource" | "unreachable" | "notAllowed";

interface Args {
  client: JfClient;
  userId: string;
  itemId: string;
  item: MediaItem | undefined;
  mediaSourceId: string | undefined;
  audioIndex: number;
  subtitleIndex: number;
  /** La position du titre où la TV reprend. */
  startSeconds: number;
  /** Les droits de lecture du compte (`usePlaybackRights`) : plafond, conversions. */
  rights: PlaybackRights;
}

/**
 * Demande à Jellyfin un flux POUR LA TV (profil `buildCastDeviceProfile`,
 * shared) et le décrit au récepteur : URL joignable depuis la TV, clé dans
 * l'URL, type MIME, position, sous-titre texte en WebVTT séparé.
 */
export async function negotiateCast(args: Args): Promise<CastNegotiation | CastNegotiationFailure> {
  const { client, userId, itemId, item, audioIndex, subtitleIndex, startSeconds } = args;
  const startTicks = Math.floor(startSeconds * TICKS_PER_SECOND);
  const before = castRightsBefore(args.rights);
  if (before.refused) return "notAllowed";
  const result = await client.getPlaybackInfo(itemId, {
    userId, deviceProfile: buildCastDeviceProfile(before.maxBitrate), mediaSourceId: args.mediaSourceId,
    maxStreamingBitrate: before.maxBitrate,
    audioStreamIndex: audioIndex >= 0 ? audioIndex : undefined,
    subtitleStreamIndex: subtitleIndex >= 0 ? subtitleIndex : undefined,
    startTimeTicks: startTicks > 0 ? startTicks : undefined,
  });
  const ms: MediaSource | undefined = result.MediaSources?.[0];
  if (!ms) return "noSource";
  const directPlay = ms.SupportsDirectPlay && !ms.TranscodingUrl;
  if (castRightsAfter(args.rights, ms, directPlay)) return "notAllowed";
  const ds = client.getDirectStreaming() ?? null;
  const common = { itemId, ms, directPlay, baseUrl: client.getBaseUrl(), accessToken: client.getAccessToken(), subIdx: subtitleIndex };
  // Jellyfin en direct d'abord (son adresse réglée pour les applications, et
  // son CORS ouvert au récepteur), puis le serveur Tentacle.
  const url = pickCastUrl([
    ds ? buildStreamUrl({ ...common, ds }) : null,
    buildStreamUrl({ ...common, ds: null }),
  ]);
  if (!url) return "unreachable";
  const token = ds && url.startsWith(ds.mediaBaseUrl) ? ds.jellyfinToken : client.getAccessToken();
  const offset = directPlay ? 0 : extractActualStartTicks(ms) / TICKS_PER_SECOND;

  const subtitle = subtitleIndex >= 0
    ? ms.MediaStreams?.find((s) => s.Type === "Subtitle" && s.Index === subtitleIndex)
    : undefined;
  const textTrack = subtitle && CAST_TEXT_SUBTITLES.includes(subtitle.Codec?.toLowerCase() ?? "")
    ? pickCastUrl([client.getSubtitleUrl(itemId, ms.Id, subtitle.Index, "vtt")])
    : null;
  const image = pickCastUrl([client.getImageUrl(item?.SeriesId ?? itemId, "Primary", { width: 600 })]);
  const runtime = item?.RunTimeTicks ? item.RunTimeTicks / TICKS_PER_SECOND : 0;

  return {
    request: {
      url: withCastAuth(url, token),
      contentType: castContentType(directPlay, ms.Container),
      title: item?.Name ?? "",
      subtitle: item?.SeriesName ?? undefined,
      imageUrl: image ?? undefined,
      startSeconds: castLoadStart(directPlay, startSeconds),
      // Transcodé, le flux commence à `offset` : sa durée est le reste du titre.
      durationSeconds: runtime > 0 ? Math.max(0, runtime - offset) : 0,
      textTrackUrl: textTrack ? withCastAuth(textTrack, client.getAccessToken()) : undefined,
      textTrackLanguage: subtitle?.Language ?? undefined,
      textTrackName: subtitle?.DisplayTitle ?? subtitle?.Title ?? undefined,
    },
    offset,
    directPlay,
    playSessionId: result.PlaySessionId ?? undefined,
    mediaSourceId: ms.Id,
  };
}
