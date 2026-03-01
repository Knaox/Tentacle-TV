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
  return item.title ?? item.name ?? "Sans titre";
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

export function formatMediaType(item: SeerrSearchResult): string {
  if (isAnime(item)) return "Anime";
  if (item.mediaType === "movie") return "Film";
  if (item.mediaType === "tv") return "Série";
  return item.mediaType;
}

export const STATUS_CONFIG: Record<RequestStatus, { label: string; color: string }> = {
  queued: { label: "En attente", color: "bg-yellow-500/20 text-yellow-400" },
  processing: { label: "Traitement", color: "bg-blue-500/20 text-blue-400" },
  sent_to_seer: { label: "Envoyé", color: "bg-indigo-500/20 text-indigo-400" },
  approved: { label: "Approuvé", color: "bg-green-500/20 text-green-400" },
  downloading: { label: "Téléchargement", color: "bg-cyan-500/20 text-cyan-400" },
  available: { label: "Disponible", color: "bg-emerald-500/20 text-emerald-400" },
  failed: { label: "Échec", color: "bg-red-500/20 text-red-400" },
  cancelled: { label: "Annulé", color: "bg-gray-500/20 text-gray-400" },
};
