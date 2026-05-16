import { Platform } from "react-native";
import { TextTrackType } from "react-native-video";
import type { MediaSource, MediaStream as JfStream, PlaybackInfoResponse } from "@tentacle-tv/shared";
import { buildIosDeviceProfile } from "../lib/iosDeviceProfile";
import { buildAndroidDeviceProfile } from "../lib/androidDeviceProfile";
import { toISO6391 } from "../lib/playerUtils";

/** Bitmap subtitle codecs that need server-side burn-in */
const BITMAP_CODECS = new Set(["pgssub", "dvdsub", "dvbsub", "pgs", "vobsub"]);

export function isBitmapSub(stream: JfStream): boolean {
  return BITMAP_CODECS.has(stream.Codec?.toLowerCase() ?? "");
}

export interface TextTrackEntry {
  title: string;
  language: string;
  type: TextTrackType;
  uri: string;
}

/** Build sideloaded VTT tracks for iOS AVPlayer (direct play only) */
export function buildTextTracks(
  ms: MediaSource,
  getSubtitleUrl: (itemId: string, msId: string, idx: number, ext: string) => string,
  itemId: string,
): TextTrackEntry[] {
  if (!ms.MediaStreams) return [];
  return ms.MediaStreams
    .filter((s) => s.Type === "Subtitle" && !isBitmapSub(s))
    .map((s) => ({
      title: s.DisplayTitle || s.Title || s.Language || `Sub ${s.Index}`,
      language: toISO6391(s.Language),
      type: TextTrackType.VTT,
      uri: getSubtitleUrl(itemId, ms.Id, s.Index, "vtt"),
    }));
}

export function detectBurnIn(ms: MediaSource, subIdx: number): number {
  if (subIdx < 0) return -1;
  const sub = ms.MediaStreams?.find((s) => s.Index === subIdx && s.Type === "Subtitle");
  return sub && isBitmapSub(sub) ? subIdx : -1;
}

export interface DirectStreamingCfg {
  mediaBaseUrl: string;
  jellyfinToken: string;
}

/** Construit l'URL HLS / direct depuis la réponse PlaybackInfo. */
export function buildStreamUrl(opts: {
  itemId: string;
  ms: MediaSource;
  directPlay: boolean;
  ds: DirectStreamingCfg | null;
  baseUrl: string;
  accessToken: string | null;
  subIdx: number;
}): string | null {
  const { itemId, ms, directPlay, ds, baseUrl, accessToken, subIdx } = opts;

  if (directPlay) {
    const root = ds ? ds.mediaBaseUrl : baseUrl;
    const token = ds ? ds.jellyfinToken : accessToken;
    return `${root}/Videos/${itemId}/stream?Static=true&MediaSourceId=${ms.Id}&api_key=${token}`;
  }

  if (!ms.TranscodingUrl) return null;

  const root = ds ? ds.mediaBaseUrl : baseUrl;
  let transcodingPath = ms.TranscodingUrl;

  if (ds) {
    transcodingPath = transcodingPath.replace(
      /([?&])(api_key|ApiKey)=[^&]*/i,
      `$1ApiKey=${encodeURIComponent(ds.jellyfinToken)}`,
    );
  } else if (Platform.OS === "ios") {
    // iOS AirPlay: Apple TV needs api_key in the URL (no cookie support)
    if (accessToken && !/api_key|ApiKey/i.test(transcodingPath)) {
      transcodingPath += (transcodingPath.includes("?") ? "&" : "?") + `api_key=${encodeURIComponent(accessToken)}`;
    }
  }

  let url = `${root}${transcodingPath}`;

  // Always force subtitles in HLS manifest for iOS AVPlayer
  url = url.replace(/EnableSubtitlesInManifest=false/i, "EnableSubtitlesInManifest=true");
  if (!/EnableSubtitlesInManifest/i.test(url)) {
    url += (url.includes("?") ? "&" : "?") + "EnableSubtitlesInManifest=true";
  }
  if (subIdx >= 0 && !/SubtitleStreamIndex/i.test(url)) {
    url += `&SubtitleStreamIndex=${subIdx}`;
  }
  return url;
}

/** Construit le device profile selon la plateforme et le bitrate cible. */
export function buildPlatformDeviceProfile(bitrate: number, isRetry: boolean) {
  const profile = Platform.OS === "android"
    ? buildAndroidDeviceProfile(bitrate > 0 ? bitrate : undefined)
    : buildIosDeviceProfile(bitrate > 0 ? bitrate : undefined);
  if (isRetry) profile.DirectPlayProfiles = [];
  return profile;
}

/** Extrait le StartTimeTicks effectif depuis l'URL renvoyée par Jellyfin. */
export function extractActualStartTicks(ms: MediaSource): number {
  if (!ms.TranscodingUrl) return 0;
  const match = ms.TranscodingUrl.match(/StartTimeTicks=(\d+)/i);
  return match ? Number(match[1]) : 0;
}

export type { PlaybackInfoResponse };
