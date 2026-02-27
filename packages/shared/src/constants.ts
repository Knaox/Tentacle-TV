export const APP_NAME = "Tentacle TV";
export const APP_VERSION = "0.9.1";

export const PAIRING_RELAY_URL = "https://pair.tentacletv.app";

/** 1 Jellyfin tick = 100 nanoseconds */
export const TICKS_PER_SECOND = 10_000_000;
export const TICKS_PER_MINUTE = TICKS_PER_SECOND * 60;

/**
 * Convert Jellyfin RunTimeTicks to a human-readable duration string.
 * Handles edge cases (null, 0, absurdly large values).
 */
export function formatDuration(ticks: number | undefined | null): string | null {
  if (ticks == null || ticks <= 0) return null;

  const totalSeconds = Math.floor(ticks / TICKS_PER_SECOND);
  // Sanity check: if > 30 days, likely bad data
  if (totalSeconds > 30 * 86400) return null;

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0) return `${hours}h ${minutes.toString().padStart(2, "0")}min`;
  return `${minutes}min`;
}

/**
 * Convert Jellyfin RunTimeTicks to seconds.
 */
export function ticksToSeconds(ticks: number | undefined | null): number {
  if (ticks == null || ticks <= 0) return 0;
  return ticks / TICKS_PER_SECOND;
}

export const JELLYFIN_AUTH_HEADER = "X-Emby-Authorization";
export const JELLYFIN_TOKEN_HEADER = "X-Emby-Token";

export const DEFAULT_BUFFER_SECONDS = 30;
export const MAX_BITRATE_DIRECT_PLAY = 100_000_000; // 100 Mbps

export const IMAGE_QUALITY = {
  thumbnail: 90,
  backdrop: 80,
  poster: 90,
} as const;
