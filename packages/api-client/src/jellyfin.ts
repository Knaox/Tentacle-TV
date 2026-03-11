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
  private clientName: string;
  private version: string;
  private authExpiredCallback?: () => void;
  private directStreaming: DirectStreamingState | null = null;
  private directStreamingErrors = 0;
  private directStreamingFailCallback?: () => void;
  private static readonly DS_ERROR_THRESHOLD = 3;
  private _consecutive401Count = 0;
  private _isLoggingIn = false;
  private static readonly AUTH_EXPIRE_THRESHOLD = 2;
  /** When true, send credentials: "include" (httpOnly cookies) instead of token headers. */
  useCredentials = false;
  constructor(
    baseUrl: string,
    storage: StorageAdapter,
    uuid: UuidGenerator,
    deviceName = "Web",
    clientName?: string,
    version?: string,
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.storage = storage;
    this.deviceName = deviceName;
    this.clientName = clientName ?? APP_NAME;
    this.version = version ?? APP_VERSION;
    this.deviceId = this.getOrCreateDeviceId(uuid);
  }

  setOnAuthExpired(cb: () => void) { this.authExpiredCallback = cb; }
  setAccessToken(token: string | null) { this.accessToken = token; }
  getAccessToken() { return this.accessToken; }
  getToken() { return this.accessToken; }
  setLoggingIn(v: boolean) { this._isLoggingIn = v; }
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
    // Images stay proxied to avoid CORS — only streams & subtitles go direct
    if (/\/Images\//i.test(path)) return proxyUrl;
    let url = `${mediaBaseUrl}${path}`;
    const encoded = encodeURIComponent(jellyfinToken);
    if (/([?&])(api_key|ApiKey)=/i.test(url)) {
      url = url.replace(/([?&])(api_key|ApiKey)=[^&]*/i, `$1api_key=${encoded}`);
    } else {
      url += (url.includes("?") ? "&" : "?") + `api_key=${encoded}`;
    }
    return url;
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

  getAuthHeader(token?: string): string {
    const t = token ?? this.accessToken;
    const parts = [
      `MediaBrowser Client="${this.clientName}"`,
      `Device="${this.deviceName}"`,
      `DeviceId="${this.deviceId}"`,
      `Version="${this.version}"`,
    ];
    if (t) parts.push(`Token="${t}"`);
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
      credentials: this.useCredentials ? "include" : undefined,
    });

    if (!response.ok) {
      if (response.status === 401 && this.accessToken && !this._isLoggingIn) {
        this._consecutive401Count++;
        if (this._consecutive401Count >= JellyfinClient.AUTH_EXPIRE_THRESHOLD) {
          this._consecutive401Count = 0;
          this.authExpiredCallback?.();
        }
      }
      throw new JellyfinError(response.status, response.statusText, path);
    }
    this._consecutive401Count = 0;
    if (response.status === 204) return undefined as T;
    const text = await response.text();
    return text ? JSON.parse(text) : (undefined as T);
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
    const p: Record<string, string> = {};
    // When using httpOnly cookies (web), no api_key needed — cookie is sent automatically.
    // Mobile/desktop still need api_key in the URL for stream requests.
    if (!this.useCredentials) {
      p.api_key = this.accessToken ?? "";
    }
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
      // HLS remux fallback (Safari/iOS) — TS segments
      return this.resolveHls(itemId, p);
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
    return this.resolveHls(itemId, p);
  }

  private resolveHls(itemId: string, p: Record<string, string>): string {
    // Jellyfin 10.10+ rejects StartTimeTicks on individual .ts segment requests,
    // but propagates all master.m3u8 query params to segment URLs → error.
    // The client must seek to the desired position instead.
    delete p.StartTimeTicks;
    p.BreakOnNonKeyFrames = "true";
    p.RequireNonAnamorphic = "false";
    p.EnableSubtitlesInManifest = "true";
    p.SegmentContainer = "ts";
    p.MinSegments = "2";
    return this.resolveMediaUrl(`${this.baseUrl}/Videos/${itemId}/master.m3u8?${buildQuery(p)}`);
  }

  getSubtitleUrl(itemId: string, mediaSourceId: string, streamIndex: number, format = "vtt"): string {
    // Always proxy — <track> elements enforce CORS; cross-origin tracks are blocked
    // (and on browsers with crossOrigin="anonymous", they corrupt the <video> element).
    const base = `${this.baseUrl}/Videos/${itemId}/${mediaSourceId}/Subtitles/${streamIndex}/Stream.${format}`;
    // When using httpOnly cookies (web), no api_key needed — cookie is sent automatically.
    return this.useCredentials ? base : `${base}?api_key=${this.accessToken}`;
  }

  /** POST /Items/{id}/PlaybackInfo — server-driven stream selection.
   *  When direct streaming is active, sends directly to Jellyfin so the
   *  transcode session uses the user's token (not the admin API key). */
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
      maxWidth?: number;
      maxHeight?: number;
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
    if (options.maxWidth) q.MaxWidth = String(options.maxWidth);
    if (options.maxHeight) q.MaxHeight = String(options.maxHeight);

    const path = `/Items/${itemId}/PlaybackInfo?${buildQuery(q)}`;
    const body = JSON.stringify({ DeviceProfile: options.deviceProfile });

    // Direct streaming: call Jellyfin directly so the transcode session
    // (and all HLS segment URLs) use the user's token, not the admin API key.
    // Wrapped in try/catch: Safari/iOS blocks CORS preflight → fall back to proxy.
    if (this.directStreaming) {
      try {
        const { mediaBaseUrl, jellyfinToken } = this.directStreaming;
        const res = await fetch(`${mediaBaseUrl}${path}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            [JELLYFIN_AUTH_HEADER]: this.getAuthHeader(jellyfinToken),
            [JELLYFIN_TOKEN_HEADER]: jellyfinToken,
          },
          body,
        });
        if (!res.ok) throw new JellyfinError(res.status, res.statusText, path);
        const text = res.status === 204 ? "" : await res.text();
        return text ? JSON.parse(text) : (undefined as unknown as PlaybackInfoResponse);
      } catch (e) {
        if (e instanceof JellyfinError) throw e;
        // CORS preflight blocked (Safari/iOS) — fall back to proxy
      }
    }

    return this.fetch<PlaybackInfoResponse>(path, { method: "POST", body });
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
