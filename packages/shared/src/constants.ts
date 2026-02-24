export const APP_NAME = "Tentacle";
export const APP_VERSION = "0.1.0";

export const JELLYFIN_AUTH_HEADER = "X-Emby-Authorization";
export const JELLYFIN_TOKEN_HEADER = "X-Emby-Token";

export const DEFAULT_BUFFER_SECONDS = 30;
export const MAX_BITRATE_DIRECT_PLAY = 100_000_000; // 100 Mbps

export const IMAGE_QUALITY = {
  thumbnail: 90,
  backdrop: 80,
  poster: 90,
} as const;
