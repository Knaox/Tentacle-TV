/**
 * Les droits de mise de côté, tels que `GET /api/downloads/capabilities` les
 * rend — et tels que la photo de session hors ligne les conserve.
 *
 * Deux droits, pas un : le REMUX recopie l'image (palier `pmax`), l'ALLÉGÉ la
 * recompresse. Seul le second est une conversion de média au sens de Jellyfin.
 * Les confondre fermait le hors ligne d'un MKV sur iPhone à tout compte sans
 * mode Allégé, alors que rien n'y était dégradé.
 */

export interface DownloadCapabilities {
  downloads: boolean;
  /** Le palier `pmax` — l'image telle quelle, dans un MP4. */
  remuxDownloads: boolean;
  /** Les paliers qui recompressent : 1080p / 720p / 480p. */
  lightDownloads: boolean;
  /**
   * Le serveur peut-il CONVERTIR l'audio ? Le remux sort toujours de l'AAC :
   * sans ce droit, une source sans aucune piste AAC arriverait muette.
   */
  audioConversion: boolean;
  /**
   * Paliers que le serveur sert (`pmax` = qualité d'origine en MP4). Champ
   * additif : un serveur qui ne l'annonce pas connaît les trois paliers
   * historiques, et pas `pmax`.
   */
  lightPresets: readonly string[];
}

/** Les trois paliers de toujours, pour un serveur qui n'en annonce pas. */
export const DEFAULT_LIGHT_PRESETS: readonly string[] = ["p1080", "p720", "p480"];

export const NO_CAPABILITIES: DownloadCapabilities = {
  downloads: false,
  remuxDownloads: false,
  lightDownloads: false,
  audioConversion: false,
  lightPresets: [],
};

/**
 * Lecture prudente : tout ce qui n'est pas explicitement `true` vaut `false`.
 *
 * Sauf les deux champs NÉS APRÈS le serveur d'en face. Un serveur ancien ne
 * les annonce pas ; les lire à `false` retirerait le remux à des comptes qui
 * l'ont aujourd'hui. Absents, ils suivent donc `lightDownloads` — c'est-à-dire
 * exactement le comportement d'avant ce découplage.
 */
export function parseCapabilities(raw: unknown): DownloadCapabilities {
  if (raw && typeof raw === "object") {
    const value = raw as Partial<Record<keyof DownloadCapabilities, unknown>>;
    const lightDownloads = value.lightDownloads === true;
    const remuxDownloads =
      value.remuxDownloads === undefined ? lightDownloads : value.remuxDownloads === true;
    const audioConversion =
      value.audioConversion === undefined ? lightDownloads : value.audioConversion === true;
    const announced = Array.isArray(value.lightPresets)
      ? value.lightPresets.filter((p): p is string => typeof p === "string")
      : null;
    return {
      downloads: value.downloads === true,
      remuxDownloads,
      lightDownloads,
      audioConversion,
      // Un serveur ancien n'annonce rien : les trois paliers historiques, et
      // seulement s'il autorise l'Allégé. Un serveur récent dit lui-même ce
      // qu'il sert — `pmax` seul est un cas normal.
      lightPresets: announced ?? (lightDownloads ? DEFAULT_LIGHT_PRESETS : []),
    };
  }
  return NO_CAPABILITIES;
}
