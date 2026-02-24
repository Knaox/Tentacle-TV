import {
  APP_NAME,
  APP_VERSION,
  JELLYFIN_AUTH_HEADER,
  JELLYFIN_TOKEN_HEADER,
} from "@tentacle/shared";

export class JellyfinClient {
  private baseUrl: string;
  private accessToken: string | null = null;
  private deviceId: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.deviceId = this.getOrCreateDeviceId();
  }

  setAccessToken(token: string | null) {
    this.accessToken = token;
  }

  getAccessToken() {
    return this.accessToken;
  }

  private getOrCreateDeviceId(): string {
    const stored = localStorage.getItem("tentacle_device_id");
    if (stored) return stored;
    const id = crypto.randomUUID();
    localStorage.setItem("tentacle_device_id", id);
    return id;
  }

  private getAuthHeader(): string {
    const parts = [
      `MediaBrowser Client="${APP_NAME}"`,
      `Device="Web"`,
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

  getStreamUrl(itemId: string): string {
    return `${this.baseUrl}/Videos/${itemId}/stream?Static=true&api_key=${this.accessToken}`;
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
