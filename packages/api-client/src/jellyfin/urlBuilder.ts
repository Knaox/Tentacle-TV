import { buildQuery } from "./types";

/** Callback that rewrites a same-origin proxy URL to the direct-streaming URL
 *  when direct streaming is active, otherwise returns the proxy URL unchanged. */
export type ResolveMediaUrl = (proxyUrl: string) => string;

export type ImageType = "Primary" | "Backdrop" | "Logo" | "Thumb";

export interface ImageUrlOptions {
  width?: number;
  height?: number;
  quality?: number;
  tag?: string;
  index?: number;
}

export function buildImageUrl(
  baseUrl: string,
  itemId: string,
  imageType: ImageType,
  options: ImageUrlOptions | undefined,
  resolveMediaUrl: ResolveMediaUrl,
): string {
  const p: Record<string, string> = {};
  if (options?.width) p.maxWidth = String(options.width);
  if (options?.height) p.maxHeight = String(options.height);
  if (options?.quality) p.quality = String(options.quality);
  if (options?.tag) p.tag = options.tag;
  const idx = options?.index ?? 0;
  const suffix = imageType === "Backdrop" && idx > 0 ? `/${idx}` : "";
  const url = `${baseUrl}/Items/${itemId}/Images/${imageType}${suffix}?${buildQuery(p)}`;
  return resolveMediaUrl(url);
}

export interface StreamUrlOptions {
  audioIndex?: number;
  mediaSourceId?: string;
  maxBitrate?: number;
  maxHeight?: number;
  directPlay?: boolean;
  startTimeTicks?: number;
  playSessionId?: string;
  /** @deprecated Kept for mobile/TV compat — remux always uses h264 fallback. */
  sourceVideoCodec?: string;
  /** Progressive remux (default true). Set false for Safari/iOS (no Range support). */
  useProgressiveRemux?: boolean;
  /** Bitmap subtitle burn-in index (PGS/DVDSUB). */
  subtitleStreamIndex?: number;
}

export interface StreamUrlContext {
  baseUrl: string;
  deviceId: string;
  accessToken: string | null;
  useCredentials: boolean;
  resolveMediaUrl: ResolveMediaUrl;
}

export function buildStreamUrl(
  ctx: StreamUrlContext,
  itemId: string,
  options?: StreamUrlOptions,
): string {
  const p: Record<string, string> = {};
  // When using httpOnly cookies (web), no api_key needed — cookie is sent automatically.
  // Mobile/desktop still need api_key in the URL for stream requests.
  if (!ctx.useCredentials) {
    p.api_key = ctx.accessToken ?? "";
  }
  if (options?.mediaSourceId) p.MediaSourceId = options.mediaSourceId;
  if (options?.audioIndex != null) p.AudioStreamIndex = String(options.audioIndex);
  if (options?.startTimeTicks) p.StartTimeTicks = String(options.startTimeTicks);
  // Server-side burn-in for bitmap subtitles (PGS/DVDSUB)
  if (options?.subtitleStreamIndex != null) p.SubtitleStreamIndex = String(options.subtitleStreamIndex);

  // Direct play — raw file, browser handles codec/track selection
  if (options?.directPlay !== false && !options?.maxBitrate) {
    p.Static = "true";
    return ctx.resolveMediaUrl(`${ctx.baseUrl}/Videos/${itemId}/stream?${buildQuery(p)}`);
  }

  // Shared transcode/remux params
  p.DeviceId = ctx.deviceId;
  if (options?.playSessionId) p.PlaySessionId = options.playSessionId;
  p.TranscodingMaxAudioChannels = "6";
  p.RequireAvc = "false";
  p.context = "Streaming";

  if (!options?.maxBitrate) {
    // Remux: video copy + audio transcode. h264 fallback codec for HW encoding.
    // VideoBitrate/MaxWidth are safety nets if Jellyfin can't copy (HDR tonemapping).
    p.VideoCodec = "h264";
    p.AllowVideoStreamCopy = "true";
    p.AllowAudioStreamCopy = "false";
    p.AudioCodec = "aac";
    p.CopyTimestamps = "true";
    p.VideoBitrate = "139616000";
    p.AudioBitrate = "384000";
    p.MaxWidth = "1920";

    if (options?.useProgressiveRemux !== false) {
      return ctx.resolveMediaUrl(`${ctx.baseUrl}/Videos/${itemId}/stream.mp4?${buildQuery(p)}`);
    }
    // HLS remux fallback (Safari/iOS) — TS segments
    return buildHlsUrl(ctx.baseUrl, itemId, p, ctx.resolveMediaUrl);
  }

  // Quality transcode via HLS — full re-encode with bitrate limit.
  p.AllowVideoStreamCopy = "false";
  p.AllowAudioStreamCopy = "false";
  p.EnableAudioVbrEncoding = "true";
  p.CopyTimestamps = "true";
  p.VideoCodec = "h264";
  p.AudioCodec = "aac";
  const audioBitrate = 384000;
  p.VideoBitrate = String(Math.max(options.maxBitrate - audioBitrate, 500000));
  p.AudioBitrate = String(audioBitrate);
  p.MaxWidth = "1920";
  if (options?.maxHeight) p.MaxHeight = String(options.maxHeight);
  return buildHlsUrl(ctx.baseUrl, itemId, p, ctx.resolveMediaUrl);
}

export function buildHlsUrl(
  baseUrl: string,
  itemId: string,
  p: Record<string, string>,
  resolveMediaUrl: ResolveMediaUrl,
): string {
  // Jellyfin 10.10+ rejects StartTimeTicks on individual .ts segment requests,
  // but propagates all master.m3u8 query params to segment URLs → error.
  // The client must seek to the desired position instead.
  delete p.StartTimeTicks;
  p.BreakOnNonKeyFrames = "true";
  p.RequireNonAnamorphic = "false";
  p.EnableSubtitlesInManifest = "true";
  p.SegmentContainer = "ts";
  p.MinSegments = "2";
  return resolveMediaUrl(`${baseUrl}/Videos/${itemId}/master.m3u8?${buildQuery(p)}`);
}

export function buildSubtitleUrl(
  baseUrl: string,
  itemId: string,
  mediaSourceId: string,
  streamIndex: number,
  format: string,
  accessToken: string | null,
  useCredentials: boolean,
): string {
  // Always proxy — <track> elements enforce CORS; cross-origin tracks are blocked
  // (and on browsers with crossOrigin="anonymous", they corrupt the <video> element).
  const base = `${baseUrl}/Videos/${itemId}/${mediaSourceId}/Subtitles/${streamIndex}/Stream.${format}`;
  return useCredentials ? base : `${base}?api_key=${accessToken}`;
}
