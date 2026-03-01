import type { SeerrSearchResult, RequestStatus } from "../api/types";

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

export function posterUrl(path?: string | null, size = "w342"): string {
  if (!path) return "";
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

export function backdropUrl(path?: string | null, size = "w1280"): string {
  if (!path) return "";
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

export function mediaTitle(item: SeerrSearchResult): string {
  return item.title ?? item.name ?? "";
}

export function mediaYear(item: SeerrSearchResult): string {
  const date = item.releaseDate ?? item.firstAirDate;
  return date ? date.slice(0, 4) : "";
}

export function isAnime(item: SeerrSearchResult): boolean {
  const hasAnimationGenre = item.genreIds?.includes(16) ?? false;
  const isJapanese = item.originCountry?.includes("JP") ?? false;
  return hasAnimationGenre && isJapanese;
}

/** Returns the i18n key for the media type. Use with t(key). */
export function mediaTypeKey(item: SeerrSearchResult): string {
  if (isAnime(item)) return "seer:typeAnime";
  if (item.mediaType === "movie") return "seer:typeMovie";
  if (item.mediaType === "tv") return "seer:typeSeries";
  return item.mediaType;
}

export const STATUS_CONFIG: Record<RequestStatus, { key: string; color: string }> = {
  queued: { key: "seer:statusQueued", color: "bg-yellow-500/20 text-yellow-400" },
  processing: { key: "seer:statusProcessing", color: "bg-blue-500/20 text-blue-400" },
  sent_to_seer: { key: "seer:statusSentToSeer", color: "bg-indigo-500/20 text-indigo-400" },
  approved: { key: "seer:statusApproved", color: "bg-green-500/20 text-green-400" },
  downloading: { key: "seer:statusDownloading", color: "bg-cyan-500/20 text-cyan-400" },
  available: { key: "seer:statusAvailable", color: "bg-emerald-500/20 text-emerald-400" },
  failed: { key: "seer:statusFailed", color: "bg-red-500/20 text-red-400" },
  cancelled: { key: "seer:statusCancelled", color: "bg-gray-500/20 text-gray-400" },
};
