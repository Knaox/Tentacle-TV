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

    if (response.status === 204) return undefined as T;
    return response.json();
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
    subtitleIndex?: number;
    mediaSourceId?: string;
    maxBitrate?: number;
    /** false = force transcode/remux (e.g. audio track change) */
    directPlay?: boolean;
  }): string {
    const params = new URLSearchParams();
    params.set("api_key", this.accessToken ?? "");
    if (options?.mediaSourceId) params.set("MediaSourceId", options.mediaSourceId);
    if (options?.audioIndex != null) params.set("AudioStreamIndex", String(options.audioIndex));
    if (options?.subtitleIndex != null) params.set("SubtitleStreamIndex", String(options.subtitleIndex));

    // Direct play — raw file, browser handles codec/track selection
    if (options?.directPlay !== false && !options?.maxBitrate) {
      params.set("Static", "true");
      return `${this.baseUrl}/Videos/${itemId}/stream?${params}`;
    }

    // Transcode or remux via progressive MP4
    params.set("Static", "false");
    params.set("Container", "mp4");
    params.set("VideoCodec", "h264,hevc");
    params.set("AudioCodec", "aac,mp3,ac3");
    if (options?.maxBitrate) {
      params.set("MaxStreamingBitrate", String(options.maxBitrate));
    } else {
      // Remux: very high cap to preserve original quality
      params.set("MaxStreamingBitrate", "150000000");
    }
    return `${this.baseUrl}/Videos/${itemId}/stream.mp4?${params}`;
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
