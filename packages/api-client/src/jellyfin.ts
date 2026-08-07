import { APP_NAME, APP_VERSION } from "@tentacle-tv/shared";
import type { PlaybackInfoResponse } from "@tentacle-tv/shared";
import type { StorageAdapter, UuidGenerator } from "./storage";
import { DirectStreamingState } from "./jellyfin/types";
import { fetchPlaybackInfo, type PlaybackInfoOptions } from "./jellyfin/playbackInfo";
import {
  buildImageUrl,
  buildStreamUrl,
  buildSubtitleUrl,
  type ImageType,
  type ImageUrlOptions,
  type StreamUrlOptions,
} from "./jellyfin/urlBuilder";
import { fetchWithRetry, type FetchWithRetryState } from "./jellyfin/fetchWithRetry";

// Re-exports for backward-compatible public API.
export { JellyfinError } from "./jellyfin/types";
export type { DirectStreamingState } from "./jellyfin/types";

export class JellyfinClient {
  private baseUrl: string;
  private accessToken: string | null = null;
  private deviceId: string;
  private storage: StorageAdapter;
  private deviceName: string;
  private clientName: string;
  private version: string;
  private authExpiredCallback?: () => void | Promise<void>;
  private directStreaming: DirectStreamingState | null = null;
  private directStreamingErrors = 0;
  private directStreamingFailCallback?: () => void;
  private static readonly DS_ERROR_THRESHOLD = 3;
  /**
   * Ce navigateur ne peut PAS joindre le serveur média en direct : verrou de
   * session, posé sur constat (cf. `signalerDirectStreamingBloque`). Il survit
   * aux resynchronisations de la config admin, sans quoi celle-ci rallumerait
   * aussitôt un chemin dont on vient de mesurer qu'il ne passe pas.
   */
  private directStreamingBloque = false;
  private _isLoggingIn = false;
  // Seuil à 5 (et non 3) pour absorber les 401 transitoires (Jellyfin qui rotate
  // ses tokens, glitches DNS, redémarrage serveur de quelques secondes) sans
  // déclencher un logout intempestif sur les clients qui n'ont pas de retry
  // côté UI (TV notamment).
  private fetchState: FetchWithRetryState = {
    consecutive401Count: 0,
    authRefreshInProgress: false,
  };
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

  setOnAuthExpired(cb: () => void | Promise<void>) { this.authExpiredCallback = cb; }
  setAccessToken(token: string | null) { this.accessToken = token; }
  getAccessToken() { return this.accessToken; }
  getToken() { return this.accessToken; }
  setLoggingIn(v: boolean) { this._isLoggingIn = v; }
  setBaseUrl(url: string) { this.baseUrl = url.replace(/\/$/, ""); }

  /** Reset auth state after a successful token refresh. */
  resetAuthState() {
    this.fetchState.consecutive401Count = 0;
    this.fetchState.authRefreshInProgress = false;
  }

  getBaseUrl() { return this.baseUrl; }

  setDirectStreaming(config: DirectStreamingState | null) {
    if (config && this.directStreamingBloque) return;
    this.directStreaming = config;
    if (config) this.directStreamingErrors = 0;
  }
  getDirectStreaming() { return this.directStreaming; }

  /**
   * Le direct est inatteignable depuis cette origine — typiquement un serveur
   * Jellyfin sans en-tête CORS. On coupe pour toute la session.
   *
   * Sans ce verrou, chaque lecture repayait la découverte : le `PlaybackInfo`
   * direct échouait puis repartait en proxy MAIS laissait `directStreaming`
   * actif, l'URL de stream se construisait donc encore sur le serveur média,
   * hls.js se cassait sur le manifeste, et le lecteur redemandait un
   * `PlaybackInfo` complet. Deux allers-retours et un rechargement visible, à
   * chaque démarrage.
   *
   * On ne déclenche PAS `directStreamingFailCallback` ici : il invalide la
   * config admin, dont la resynchronisation rallumerait le direct.
   *
   * Le prix d'une erreur réseau passagère prise pour un refus est faible : le
   * proxy sert tout, et un rechargement de page repart de zéro.
   */
  signalerDirectStreamingBloque(raison: string) {
    if (this.directStreamingBloque) return;
    this.directStreamingBloque = true;
    this.directStreaming = null;
    this.directStreamingErrors = 0;
    console.warn("[Tentacle:DirectStreaming] coupe pour la session —", raison);
  }

  /**
   * Voie native pour la télémétrie de lecture, posée par l'hôte s'il en a une.
   *
   * Vide partout sauf sur la coquille Electron, où le `fetch` du moteur web est
   * refusé par le CORS depuis l'origine applicative. Voir `playbackTransport`.
   */
  nativeSessionPost?: (
    baseUrl: string,
    path: string,
    token: string,
    authHeader: string,
    body: string,
  ) => Promise<number>;

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
  private resolveMediaUrl = (proxyUrl: string): string => {
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
  };

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

  fetch<T>(path: string, init?: RequestInit, opts?: { noAuthExpiry?: boolean }): Promise<T> {
    return fetchWithRetry<T>(
      {
        baseUrl: this.baseUrl,
        path,
        init,
        accessToken: this.accessToken,
        useCredentials: this.useCredentials,
        authHeader: this.getAuthHeader(),
        onAuthExpired: this.authExpiredCallback,
        isLoggingIn: this._isLoggingIn,
        noAuthExpiry: opts?.noAuthExpiry,
      },
      this.fetchState,
    );
  }

  getImageUrl(
    itemId: string,
    imageType: ImageType = "Primary",
    options?: ImageUrlOptions,
  ): string {
    return buildImageUrl(this.baseUrl, itemId, imageType, options, this.resolveMediaUrl);
  }

  getStreamUrl(itemId: string, options?: StreamUrlOptions): string {
    return buildStreamUrl(
      {
        baseUrl: this.baseUrl,
        deviceId: this.deviceId,
        accessToken: this.accessToken,
        useCredentials: this.useCredentials,
        resolveMediaUrl: this.resolveMediaUrl,
      },
      itemId,
      options,
    );
  }

  getSubtitleUrl(itemId: string, mediaSourceId: string, streamIndex: number, format = "vtt"): string {
    return buildSubtitleUrl(
      this.baseUrl,
      itemId,
      mediaSourceId,
      streamIndex,
      format,
      this.accessToken,
      this.useCredentials,
    );
  }

  /** POST /Items/{id}/PlaybackInfo — server-driven stream selection.
   *  When direct streaming is active, sends directly to Jellyfin so the
   *  transcode session uses the user's token (not the admin API key).
   *  Falls back to the same-origin proxy on CORS / network error. */
  getPlaybackInfo(itemId: string, options: PlaybackInfoOptions): Promise<PlaybackInfoResponse> {
    return fetchPlaybackInfo(
      {
        directStreaming: this.directStreaming,
        getAuthHeader: (t) => this.getAuthHeader(t),
        signalerDirectBloque: (raison) => this.signalerDirectStreamingBloque(raison),
        viaProxy: (path, init) => this.fetch<PlaybackInfoResponse>(path, init),
      },
      itemId,
      options,
    );
  }
}
