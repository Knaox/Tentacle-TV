import type { MediaStream } from "../types/media";

/**
 * La cadence du flux vidéo, celle sur laquelle un écran se cale pour ne plus
 * saccader (Android TV, téléphone Android). Une seule règle pour tous les
 * lecteurs : `RealFrameRate` d'abord — Jellyfin la tire de la durée d'image du
 * conteneur, c'est la seule EXACTE (23,976 et non 23,81) —, `AverageFrameRate`
 * en repli. Une valeur aberrante est refusée : mieux vaut ne rien basculer que
 * basculer de travers.
 */
export const CONTENT_FRAME_RATE_MIN = 5;
export const CONTENT_FRAME_RATE_MAX = 480;

export function isPlausibleFrameRate(fps: number | null | undefined): fps is number {
  return typeof fps === "number" && Number.isFinite(fps) && fps >= CONTENT_FRAME_RATE_MIN && fps <= CONTENT_FRAME_RATE_MAX;
}

export function contentFrameRate(streams: readonly MediaStream[] | null | undefined): number | undefined {
  const video = streams?.find((s) => s.Type === "Video");
  if (!video) return undefined;
  if (isPlausibleFrameRate(video.RealFrameRate)) return video.RealFrameRate;
  if (isPlausibleFrameRate(video.AverageFrameRate)) return video.AverageFrameRate;
  return undefined;
}
