import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

let _backendBase = "/api/seerr";

export function setSeerrBackendUrl(url: string) {
  _backendBase = `${url.replace(/\/$/, "")}/api/seerr`;
}

async function seerrFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${_backendBase}${path}`, init);
  if (!res.ok) {
    const msg = await res.text().catch(() => `${res.status}`);
    throw new Error(msg);
  }
  return res.json();
}

// ---------- Types ----------

export interface SeerrSearchResult {
  id: number;
  mediaType: "movie" | "tv" | "person";
  title?: string;
  name?: string;
  overview?: string;
  posterPath?: string;
  backdropPath?: string;
  releaseDate?: string;
  firstAirDate?: string;
  voteAverage?: number;
  mediaInfo?: { status: number };
}

export interface SeerrPagedResponse {
  page: number;
  totalPages: number;
  totalResults: number;
  results: SeerrSearchResult[];
}

export interface SeerrMediaRequest {
  id: number;
  type: "movie" | "tv";
  status: number; // 1=PENDING,2=APPROVED,3=DECLINED,4=FAILED,5=COMPLETED
  createdAt: string;
  updatedAt: string;
  media: { id: number; tmdbId: number; mediaType: "movie" | "tv"; status: number };
  requestedBy: { displayName?: string; username?: string };
  seasons?: { seasonNumber: number; status: number }[];
}

export interface SeerrRequestsResponse {
  pageInfo: { pages: number; results: number; page: number; pageSize: number };
  results: SeerrMediaRequest[];
}

export type SeerrSearchResponse = SeerrPagedResponse;

// ---------- Hooks ----------

export function useSeerrSearch(query: string, page = 1) {
  return useQuery({
    queryKey: ["seerr-search", query, page],
    queryFn: () => seerrFetch<SeerrPagedResponse>(`/search?query=${encodeURIComponent(query)}&page=${page}`),
    enabled: query.length >= 2,
    staleTime: 60_000,
  });
}

export function useSeerrDiscover(type: "movies" | "tv" | "anime", page = 1) {
  return useQuery({
    queryKey: ["seerr-discover", type, page],
    queryFn: () => seerrFetch<SeerrPagedResponse>(`/discover/${type}?page=${page}`),
    staleTime: 5 * 60_000,
  });
}

export function useSeerrRequests(filter?: string, take = 20, skip = 0) {
  return useQuery({
    queryKey: ["seerr-requests", filter, take, skip],
    queryFn: () => {
      const p = new URLSearchParams({ take: String(take), skip: String(skip) });
      if (filter) p.set("filter", filter);
      return seerrFetch<SeerrRequestsResponse>(`/requests?${p}`);
    },
    staleTime: 30_000,
  });
}

export function useSeerrRequestCount() {
  return useQuery({
    queryKey: ["seerr-request-count"],
    queryFn: () => seerrFetch<Record<string, number>>("/requests/count"),
    staleTime: 30_000,
  });
}

export function useSeerrRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { mediaType: "movie" | "tv"; mediaId: number; seasons?: number[] }) =>
      seerrFetch("/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useSeerrDeleteRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (requestId: number) =>
      seerrFetch(`/request/${requestId}`, { method: "DELETE" }),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useSeerrRetryRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { requestId: number; mediaType: "movie" | "tv"; mediaId: number; seasons?: number[] }) => {
      // Delete first, then re-request
      await seerrFetch(`/request/${params.requestId}`, { method: "DELETE" });
      return seerrFetch("/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaType: params.mediaType, mediaId: params.mediaId, seasons: params.seasons }),
      });
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useSeerrMediaDetail(mediaType: "movie" | "tv" | undefined, tmdbId: number | undefined) {
  return useQuery({
    queryKey: ["seerr-media-detail", mediaType, tmdbId],
    queryFn: () => seerrFetch<{ title?: string; name?: string; posterPath?: string }>(
      `/${mediaType}/${tmdbId}`
    ),
    enabled: !!mediaType && !!tmdbId,
    staleTime: 24 * 60 * 60_000,
  });
}

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["seerr-search"] });
  qc.invalidateQueries({ queryKey: ["seerr-discover"] });
  qc.invalidateQueries({ queryKey: ["seerr-requests"] });
  qc.invalidateQueries({ queryKey: ["seerr-request-count"] });
}
