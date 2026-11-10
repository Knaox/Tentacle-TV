/**
 * Les données factices du labo du lecteur : un épisode, ses pistes, ses paliers de qualité.
 * Rien ne vient d'un serveur — le banc (`apps/web/bench/lecteur/`) répond aux requêtes des
 * panneaux (saisons, épisodes) avec les mêmes identifiants.
 */

import { QUALITY_PRESETS, type MediaItem, type SourceQuality } from "@tentacle-tv/shared";

export const LAB_SERIES_ID = "lab-series";
export const LAB_SEASON_ID = "lab-season-1";
export const LAB_EPISODE_ID = "lab-episode-2";
export const LAB_USER_ID = "lab-user";

export const LAB_EPISODE = {
  Id: LAB_EPISODE_ID,
  Name: "Gran Dillama",
  Type: "Episode",
  SeriesId: LAB_SERIES_ID,
  SeriesName: "Caminandes",
  SeasonId: LAB_SEASON_ID,
  ParentIndexNumber: 1,
  IndexNumber: 2,
  RunTimeTicks: 190 * 10_000_000,
} as unknown as MediaItem;

export const LAB_MOVIE = {
  Id: "lab-movie",
  Name: "Sintel",
  Type: "Movie",
  RunTimeTicks: 888 * 10_000_000,
} as unknown as MediaItem;

export const LAB_AUDIO = [
  { index: 1, label: "Français - EAC3" },
  { index: 2, label: "English - TRUEHD" },
  { index: 3, label: "Español - AAC" },
];

export const LAB_SUBTITLES = [
  { index: 4, label: "Français - SUBRIP" },
  { index: 5, label: "English - SUBRIP" },
  { index: 6, label: "Français (forcés) - PGSSUB" },
];

export const LAB_SOURCE_QUALITY = {
  resolution: "4K",
  isHDR: true,
  isDolbyVision: true,
  isDolbyAtmos: true,
} as unknown as SourceQuality;

export const LAB_QUALITY_PRESETS = QUALITY_PRESETS.slice(0, 5);

/** Les images du banc (`window.__LECTEUR_LAB_IMAGES__`) ; sans banc, une encre unie. */
export interface LabImages {
  backdrop?: string;
  backdropNext?: string;
  thumb?: string;
  poster?: string;
}

export function labImages(): LabImages {
  return (window as unknown as { __LECTEUR_LAB_IMAGES__?: LabImages }).__LECTEUR_LAB_IMAGES__ ?? {};
}

/** Un paramètre de l'adresse du labo (`?vue=…&etat=…`). */
export function labParam(name: string): string | null {
  return new URLSearchParams(window.location.search).get(name);
}
