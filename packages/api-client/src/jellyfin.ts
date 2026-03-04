import {
  APP_NAME,
  APP_VERSION,
  JELLYFIN_AUTH_HEADER,
  JELLYFIN_TOKEN_HEADER,
} from "@tentacle-tv/shared";
import type { DeviceProfile, PlaybackInfoResponse } from "@tentacle-tv/shared";
import type { StorageAdapter, UuidGenerator } from "./storage";

/** Build query string — compatible Hermes (pas de URLSearchParams.set). */
function buildQuery(entries: Record<string, string>): string {
  return Object.entries(entries)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}

export interface DirectStreamingState {
  enabled: boolean;
  mediaBaseUrl: string;
  jellyfinToken: string;
}

export class JellyfinClient {
  private baseUrl: string;
  private accessToken: string | null = null;
  private deviceId: string;
  private storage: StorageAdapter;
  private deviceName: string;
  private authExpiredCallback?: () => void;
  private directStreaming: DirectStreamingState | null = null;
  private directStreamingErrors = 0;
  private directStreamingFailCallback?: () => void;
  private static readonly DS_ERROR_THRESHOLD = 3;
  constructor(
    baseUrl: string,
    storage: StorageAdapter,
    uuid: UuidGenerator,
    deviceName = "Web"
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.storage = storage;
    this.deviceName = deviceName;
    this.deviceId = this.getOrCreateDeviceId(uuid);
  }

  setOnAuthExpired(cb: () => void) { this.authExpiredCallback = cb; }
  setAccessToken(token: string | null) { this.accessToken = token; }
  getAccessToken() { return this.accessToken; }
  getToken() { return this.accessToken; }
  setBaseUrl(url: string) { this.baseUrl = url.replace(/\/$/, ""); }

  getBaseUrl() { return this.baseUrl; }

  setDirectStreaming(config: DirectStreamingState | null) {
    this.directStreaming = config;
    if (config) this.directStreamingErrors = 0;
  }
  getDirectStreaming() { return this.directStreaming; }

  setOnDirectStreamingFail(cb: () => void) { this.directStreamingFailCallback = cb; }

  /** Report a direct streaming media failure. After DS_ERROR_THRESHOLD consecutive
   *  errors, auto-disables direct streaming and fires the fail callback. */
  reportDirectStreamingError(): void {
    if (!this.directStreaming) return;
    if (++this.directStreamingErrors >= JellyfinClient.DS_ERROR_THRESHOLD) {
      this.directStreaming = null;
      this.directStreamingErrors = 0;
      this.directStreamingFailCallback?.();
    }
  }

  /** Reset consecutive error counter (call on successful media load). */
  reportDirectStreamingSuccess(): void { this.directStreamingErrors = 0; }

  /** Resolve a media URL: use direct Jellyfin URL if active, otherwise proxy.
   *  Also replaces api_key/ApiKey with the user's own Jellyfin token. */
  private resolveMediaUrl(proxyUrl: string): string {
    if (!this.directStreaming) return proxyUrl;
    const { mediaBaseUrl, jellyfinToken } = this.directStreaming;
    const path = proxyUrl.replace(this.baseUrl, "");
    return `${mediaBaseUrl}${path}`.replace(
      /([?&])(api_key|ApiKey)=[^&]*/i,
      `$1api_key=${encodeURIComponent(jellyfinToken)}`
    );
  }

  getDeviceId() {
    return this.deviceId;
  }

  private getOrCreateDeviceId(uuid: UuidGenerator): string {
    const stored = this.storage.getItem("tentacle_device_id");
    if (stored) return stored;
    const id = uuid.randomUUID();
    this.storage.setItem("tentacle_device_id", id);
    return id;
  }

  getAuthHeader(): string {
    const parts = [
      `MediaBrowser Client="${APP_NAME}"`,
      `Device="${this.deviceName}"`,
      `DeviceId="${this.deviceId}"`,
      `Version="${APP_VERSION}"`,
    ];
    if (this.accessToken) {
      parts.push(`Token="${this.accessToken}"`);
    }
    return parts.join(", ");
  }

  async fetch<T>(path: string, init?: RequestInit): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      [JELLYFIN_AUTH_HEADER]: this.getAuthHeader(),
      ...(this.accessToken
        ? { [JELLYFIN_TOKEN_HEADER]: this.accessToken }
        : {}),
      ...(init?.headers as Record<string, string>),
    };

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers,
    });

    if (!response.ok) {
      // Token is stale or revoked — clear auth state so the UI redirects to login.
      // Only trigger when we *thought* we were authenticated (accessToken set).
      if (response.status === 401 && this.accessToken) {
        this.accessToken = null;
        this.authExpiredCallback?.();
      }
      throw new JellyfinError(response.status, response.statusText, path);
    }

    // 204 No Content or empty body — return undefined
    if (response.status === 204) return undefined as T;
    const text = await response.text();
    if (!text) return undefined as T;
    return JSON.parse(text);
  }

  getImageUrl(
    itemId: string,
    imageType: "Primary" | "Backdrop" | "Logo" | "Thumb" = "Primary",
    options?: { width?: number; height?: number; quality?: number; tag?: string; index?: number }
  ): string {
    const p: Record<string, string> = {};
    if (options?.width) p.maxWidth = String(options.width);
    if (options?.height) p.maxHeight = String(options.height);
    if (options?.quality) p.quality = String(options.quality);
    if (options?.tag) p.tag = options.tag;
    const idx = options?.index ?? 0;
    const suffix = imageType === "Backdrop" && idx > 0 ? `/${idx}` : "";
    const url = `${this.baseUrl}/Items/${itemId}/Images/${imageType}${suffix}?${buildQuery(p)}`;
    return this.resolveMediaUrl(url);
  }

  getStreamUrl(itemId: string, options?: {
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
  }): string {
    const p: Record<string, string> = {
      api_key: this.accessToken ?? "",
    };
    if (options?.mediaSourceId) p.MediaSourceId = options.mediaSourceId;
    if (options?.audioIndex != null) p.AudioStreamIndex = String(options.audioIndex);
    if (options?.startTimeTicks) p.StartTimeTicks = String(options.startTimeTicks);
    // Server-side burn-in for bitmap subtitles (PGS/DVDSUB)
    if (options?.subtitleStreamIndex != null) p.SubtitleStreamIndex = String(options.subtitleStreamIndex);

    // Direct play — raw file, browser handles codec/track selection
    if (options?.directPlay !== false && !options?.maxBitrate) {
      p.Static = "true";
      return this.resolveMediaUrl(`${this.baseUrl}/Videos/${itemId}/stream?${buildQuery(p)}`);
    }

    // Shared transcode/remux params
    p.DeviceId = this.deviceId;
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
        return this.resolveMediaUrl(`${this.baseUrl}/Videos/${itemId}/stream.mp4?${buildQuery(p)}`);
      }

      // HLS remux — TS segments avoid hls.js fMP4 audio timestamp offset bug (#7432).
      p.BreakOnNonKeyFrames = "true";
      p.RequireNonAnamorphic = "false";
      p.EnableSubtitlesInManifest = "false";
      p.SegmentContainer = "ts";
      p.MinSegments = "2";
      return this.resolveMediaUrl(`${this.baseUrl}/Videos/${itemId}/master.m3u8?${buildQuery(p)}`);
    }

    // Quality transcode via HLS — full re-encode with bitrate limit.
    p.AllowVideoStreamCopy = "false";
    p.AllowAudioStreamCopy = "false";
    p.BreakOnNonKeyFrames = "true";
    p.RequireNonAnamorphic = "false";
    p.EnableSubtitlesInManifest = "false";
    p.EnableAudioVbrEncoding = "true";
    p.CopyTimestamps = "true";
    p.VideoCodec = "h264";
    p.AudioCodec = "aac";
    p.SegmentContainer = "ts";
    p.MinSegments = "2";
    const audioBitrate = 384000;
    const videoBitrate = Math.max(options.maxBitrate - audioBitrate, 500000);
    p.VideoBitrate = String(videoBitrate);
    p.AudioBitrate = String(audioBitrate);
    // H264 cap: 1920px wide (4K H264 unsupported by most browsers).
    p.MaxWidth = "1920";

    if (options?.maxHeight) {
      p.MaxHeight = String(options.maxHeight);
    }

    return this.resolveMediaUrl(`${this.baseUrl}/Videos/${itemId}/master.m3u8?${buildQuery(p)}`);
  }

  getSubtitleUrl(itemId: string, mediaSourceId: string, streamIndex: number, format = "vtt"): string {
    return this.resolveMediaUrl(`${this.baseUrl}/Videos/${itemId}/${mediaSourceId}/Subtitles/${streamIndex}/Stream.${format}?api_key=${this.accessToken}`);
  }

  /** POST /Items/{id}/PlaybackInfo — server-driven stream selection.
   *  The server analyzes the file against the DeviceProfile and returns
   *  MediaSources with optimal TranscodingUrl (or direct play flags).
   *  Used by web; mobile/TV/desktop still use getStreamUrl(). */
  async getPlaybackInfo(
    itemId: string,
    options: {
      userId: string;
      deviceProfile: DeviceProfile;
      mediaSourceId?: string;
      audioStreamIndex?: number;
      subtitleStreamIndex?: number;
      startTimeTicks?: number;
      maxStreamingBitrate?: number;
    }
  ): Promise<PlaybackInfoResponse> {
    const q: Record<string, string> = {
      UserId: options.userId,
      StartTimeTicks: String(options.startTimeTicks ?? 0),
      IsPlayback: "true",
      AutoOpenLiveStream: "true",
      MaxStreamingBitrate: String(options.maxStreamingBitrate ?? 42_000_000),
    };
    if (options.mediaSourceId) q.MediaSourceId = options.mediaSourceId;
    if (options.audioStreamIndex != null) q.AudioStreamIndex = String(options.audioStreamIndex);
    if (options.subtitleStreamIndex != null) q.SubtitleStreamIndex = String(options.subtitleStreamIndex);

    return this.fetch<PlaybackInfoResponse>(
      `/Items/${itemId}/PlaybackInfo?${buildQuery(q)}`,
      { method: "POST", body: JSON.stringify({ DeviceProfile: options.deviceProfile }) }
    );
  }
}

export class JellyfinError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public path: string
  ) {
    super(`Jellyfin API error ${status}: ${statusText} (${path})`);
    this.name = "JellyfinError";
  }
}
