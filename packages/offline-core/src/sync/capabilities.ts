/**
 * Les droits de mise de côté, tels que `GET /api/downloads/capabilities` les
 * rend — et tels que la photo de session hors ligne les conserve.
 */

export interface DownloadCapabilities {
  downloads: boolean;
  lightDownloads: boolean;
}

export const NO_CAPABILITIES: DownloadCapabilities = { downloads: false, lightDownloads: false };

/** Lecture prudente : tout ce qui n'est pas explicitement `true` vaut `false`. */
export function parseCapabilities(raw: unknown): DownloadCapabilities {
  if (raw && typeof raw === "object") {
    const value = raw as Partial<DownloadCapabilities>;
    return {
      downloads: value.downloads === true,
      lightDownloads: value.lightDownloads === true,
    };
  }
  return NO_CAPABILITIES;
}
