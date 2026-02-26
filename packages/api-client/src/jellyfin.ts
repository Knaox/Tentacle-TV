import {
  APP_NAME,
  APP_VERSION,
  JELLYFIN_AUTH_HEADER,
  JELLYFIN_TOKEN_HEADER,
} from "@tentacle/shared";
import type { StorageAdapter, UuidGenerator } from "./storage";

export class JellyfinClient {
  private baseUrl: string;
  private accessToken: string | null = null;
  private deviceId: string;
  private storage: StorageAdapter;
  private deviceName: string;
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

  setAccessToken(token: string | null) {
    this.accessToken = token;
  }

  getAccessToken() {
    return this.accessToken;
  }

  /** Alias for getAccessToken — used by playback reporting diagnostics */
  getToken() {
    return this.accessToken;
  }

  getBaseUrl() {
    return this.baseUrl;
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

  private getAuthHeader(): string {
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
    const params = new URLSearchParams();
    if (options?.width) params.set("maxWidth", String(options.width));
    if (options?.height) params.set("maxHeight", String(options.height));
    if (options?.quality) params.set("quality", String(options.quality));
    if (options?.tag) params.set("tag", options.tag);
    const idx = options?.index ?? 0;
    const suffix = imageType === "Backdrop" && idx > 0 ? `/${idx}` : "";
    return `${this.baseUrl}/Items/${itemId}/Images/${imageType}${suffix}?${params}`;
  }

  getStreamUrl(itemId: string, options?: {
    audioIndex?: number;
    mediaSourceId?: string;
    maxBitrate?: number;
    /** Max video height for quality switching (e.g. 720 for 720p) */
    maxHeight?: number;
    /** false = force transcode/remux (e.g. audio track change) */
    directPlay?: boolean;
    /** Seek position for transcoded streams (in Jellyfin ticks) */
    startTimeTicks?: number;
    /** Unique ID per transcode session — lets Jellyfin's segment handler
     *  find the correct transcode started by master.m3u8. */
    playSessionId?: string;
    /** Source video codec (e.g. "hevc", "h264") — used in remux mode
     *  so Jellyfin knows it can stream copy instead of re-encoding. */
    sourceVideoCodec?: string;
    /** Use progressive stream for remux (default true). Set false for Safari/iOS
     *  where progressive transcode doesn't support Range requests. Falls back to HLS. */
    useProgressiveRemux?: boolean;
  }): string {
    const params = new URLSearchParams();
    params.set("api_key", this.accessToken ?? "");
    if (options?.mediaSourceId) params.set("MediaSourceId", options.mediaSourceId);
    if (options?.audioIndex != null) params.set("AudioStreamIndex", String(options.audioIndex));
    if (options?.startTimeTicks) params.set("StartTimeTicks", String(options.startTimeTicks));

    // Direct play — raw file, browser handles codec/track selection
    if (options?.directPlay !== false && !options?.maxBitrate) {
      params.set("Static", "true");
      return `${this.baseUrl}/Videos/${itemId}/stream?${params}`;
    }

    // Shared transcode/remux params
    params.set("DeviceId", this.deviceId);
    if (options?.playSessionId) params.set("PlaySessionId", options.playSessionId);
    params.set("TranscodingMaxAudioChannels", "6");
    params.set("RequireAvc", "false");
    params.set("context", "Streaming");

    if (!options?.maxBitrate) {
      // Remux: video copied as-is, only audio transcoded.
      const videoCodec = options?.sourceVideoCodec || "h264";
      params.set("VideoCodec", videoCodec);
      params.set("AllowVideoStreamCopy", "true");
      params.set("AllowAudioStreamCopy", "false");
      params.set("AudioCodec", "aac");
      params.set("CopyTimestamps", "true");
      params.set("MaxStreamingBitrate", "150000000");

      if (options?.useProgressiveRemux !== false) {
        // Progressive: avoids Jellyfin's HLS playlist generator which overrides
        // AllowVideoStreamCopy for HEVC, forcing h264 transcode.
        return `${this.baseUrl}/Videos/${itemId}/stream.mp4?${params}`;
      }

      // HLS fallback (Safari/iOS): progressive transcode doesn't support HTTP
      // Range requests that WebKit requires for media playback.
      params.set("BreakOnNonKeyFrames", "true");
      params.set("RequireNonAnamorphic", "false");
      params.set("EnableSubtitlesInManifest", "false");
      params.set("SegmentContainer", "mp4");
      params.set("MinSegments", "2");
      return `${this.baseUrl}/Videos/${itemId}/master.m3u8?${params}`;
    }

    // Quality transcode via HLS — full re-encode with bitrate limit
    params.set("BreakOnNonKeyFrames", "true");
    params.set("RequireNonAnamorphic", "false");
    params.set("EnableSubtitlesInManifest", "false");
    params.set("VideoCodec", "h264");
    params.set("AudioCodec", "aac");
    params.set("SegmentContainer", "ts");
    const audioBitrate = 384000;
    const videoBitrate = Math.max(options.maxBitrate - audioBitrate, 500000);
    params.set("VideoBitRate", String(videoBitrate));
    params.set("AudioBitRate", String(audioBitrate));
    params.set("MaxStreamingBitrate", String(options.maxBitrate));

    // Resolution constraint — Jellyfin calculates proportional width automatically
    if (options?.maxHeight) {
      params.set("MaxHeight", String(options.maxHeight));
    }

    return `${this.baseUrl}/Videos/${itemId}/master.m3u8?${params}`;
  }

  getSubtitleUrl(itemId: string, mediaSourceId: string, streamIndex: number): string {
    return `${this.baseUrl}/Videos/${itemId}/${mediaSourceId}/Subtitles/${streamIndex}/Stream.vtt?api_key=${this.accessToken}`;
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
