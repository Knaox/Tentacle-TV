/** Direct streaming session config: when set, media URLs are emitted against
 *  the direct Jellyfin media base URL (with the user's own token) instead of
 *  the Tentacle backend proxy. Cleared on repeated failures via reportDirectStreamingError. */
export interface DirectStreamingState {
  enabled: boolean;
  mediaBaseUrl: string;
  jellyfinToken: string;
}

export class JellyfinError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public path: string
  ) {
    super(`Media server API error ${status}: ${statusText} (${path})`);
    this.name = "JellyfinError";
  }
}

/** Build query string — Hermes-safe (no URLSearchParams.set). */
export function buildQuery(entries: Record<string, string>): string {
  return Object.entries(entries)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}
