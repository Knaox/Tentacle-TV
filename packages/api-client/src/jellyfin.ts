import {
  APP_NAME,
  APP_VERSION,
  JELLYFIN_AUTH_HEADER,
  JELLYFIN_TOKEN_HEADER,
} from "@tentacle/shared";
import type { StorageAdapter, UuidGenerator } from "./storage";

/** Build query string — compatible Hermes (pas de URLSearchParams.set). */
function buildQuery(entries: Record<string, string>): string {
  return Object.entries(entries)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}

export class JellyfinClient {
  private baseUrl: string;
  private accessToken: string | null = null;
  private deviceId: string;
  private storage: StorageAdapter;
  private deviceName: string;
  private authExpiredCallback?: () => void;
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

  /** Register a callback invoked when an authenticated request returns 401.
   *  Typically used to clear stored tokens and redirect to login. */
  setOnAuthExpired(cb: () => void) {
    this.authExpiredCallback = cb;
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

  setBaseUrl(url: string) {
    this.baseUrl = url.replace(/\/$/, "");
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
    return `${this.baseUrl}/Items/${itemId}/Images/${imageType}${suffix}?${buildQuery(p)}`;
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
    const p: Record<string, string> = {
      api_key: this.accessToken ?? "",
    };
    if (options?.mediaSourceId) p.MediaSourceId = options.mediaSourceId;
    if (options?.audioIndex != null) p.AudioStreamIndex = String(options.audioIndex);
    if (options?.startTimeTicks) p.StartTimeTicks = String(options.startTimeTicks);

    // Direct play — raw file, browser handles codec/track selection
    if (options?.directPlay !== false && !options?.maxBitrate) {
      p.Static = "true";
      return `${this.baseUrl}/Videos/${itemId}/stream?${buildQuery(p)}`;
    }

    // Shared transcode/remux params
    p.DeviceId = this.deviceId;
    if (options?.playSessionId) p.PlaySessionId = options.playSessionId;
    p.TranscodingMaxAudioChannels = "6";
    p.RequireAvc = "false";
    p.context = "Streaming";

    if (!options?.maxBitrate) {
      // Remux: video copied as-is, only audio transcoded.
      const videoCodec = options?.sourceVideoCodec || "h264";
      p.VideoCodec = videoCodec;
      p.AllowVideoStreamCopy = "true";
      p.AllowAudioStreamCopy = "false";
      p.AudioCodec = "aac";
      p.CopyTimestamps = "true";
      p.MaxStreamingBitrate = "150000000";

      if (options?.useProgressiveRemux !== false) {
        // Progressive: avoids Jellyfin's HLS playlist generator which overrides
        // AllowVideoStreamCopy for HEVC, forcing h264 transcode.
        return `${this.baseUrl}/Videos/${itemId}/stream.mp4?${buildQuery(p)}`;
      }

      // HLS fallback (Safari/iOS): progressive transcode doesn't support HTTP
      // Range requests that WebKit requires for media playback.
      p.BreakOnNonKeyFrames = "true";
      p.RequireNonAnamorphic = "false";
      p.EnableSubtitlesInManifest = "false";
      p.SegmentContainer = "mp4";
      p.MinSegments = "2";
      return `${this.baseUrl}/Videos/${itemId}/master.m3u8?${buildQuery(p)}`;
    }

    // Quality transcode via HLS — full re-encode with bitrate limit
    p.BreakOnNonKeyFrames = "true";
    p.RequireNonAnamorphic = "false";
    p.EnableSubtitlesInManifest = "false";
    p.VideoCodec = "h264";
    p.AudioCodec = "aac";
    p.SegmentContainer = "ts";
    const audioBitrate = 384000;
    const videoBitrate = Math.max(options.maxBitrate - audioBitrate, 500000);
    p.VideoBitRate = String(videoBitrate);
    p.AudioBitRate = String(audioBitrate);
    p.MaxStreamingBitrate = String(options.maxBitrate);

    // Resolution constraint — Jellyfin calculates proportional width automatically
    if (options?.maxHeight) {
      p.MaxHeight = String(options.maxHeight);
    }

    return `${this.baseUrl}/Videos/${itemId}/master.m3u8?${buildQuery(p)}`;
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
