/**
 * Les droits de mise de côté, tels que `GET /api/downloads/capabilities` les
 * rend — et tels que la photo de session hors ligne les conserve.
 */

export interface DownloadCapabilities {
  downloads: boolean;
  lightDownloads: boolean;
  /**
   * Paliers Allégés que le serveur sert (`pmax` = qualité d'origine en MP4).
   * Champ additif : un serveur qui ne l'annonce pas connaît les trois paliers
   * historiques, et pas `pmax`.
   */
  lightPresets: readonly string[];
}

/** Les trois paliers de toujours, pour un serveur qui n'en annonce pas. */
export const DEFAULT_LIGHT_PRESETS: readonly string[] = ["p1080", "p720", "p480"];

export const NO_CAPABILITIES: DownloadCapabilities = {
  downloads: false,
  lightDownloads: false,
  lightPresets: [],
};

/** Lecture prudente : tout ce qui n'est pas explicitement `true` vaut `false`. */
export function parseCapabilities(raw: unknown): DownloadCapabilities {
  if (raw && typeof raw === "object") {
    const value = raw as Partial<Record<keyof DownloadCapabilities, unknown>>;
    const lightDownloads = value.lightDownloads === true;
    const announced = Array.isArray(value.lightPresets)
      ? value.lightPresets.filter((p): p is string => typeof p === "string")
      : null;
    return {
      downloads: value.downloads === true,
      lightDownloads,
      lightPresets: !lightDownloads ? [] : (announced ?? DEFAULT_LIGHT_PRESETS),
    };
  }
  return NO_CAPABILITIES;
}
