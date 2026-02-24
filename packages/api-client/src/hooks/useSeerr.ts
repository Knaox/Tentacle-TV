import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

let _backendBase = "/api/seerr";

/** Call once at app init to set the backend base URL */
export function setSeerrBackendUrl(url: string) {
  _backendBase = `${url.replace(/\/$/, "")}/api/seerr`;
}

async function seerrFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${_backendBase}${path}`, init);
  if (!res.ok) throw new Error(`Seerr error ${res.status}`);
  return res.json();
}

export interface SeerrSearchResult {
  id: number;
  mediaType: "movie" | "tv" | "person";
  title?: string;       // movie
  name?: string;        // tv / person
  overview?: string;
  posterPath?: string;
  backdropPath?: string;
  releaseDate?: string;
  firstAirDate?: string;
  voteAverage?: number;
  mediaInfo?: {
    status: number;     // 1=UNKNOWN, 2=PENDING, 3=PROCESSING, 4=PARTIAL, 5=AVAILABLE
  };
}

export interface SeerrSearchResponse {
  page: number;
  totalPages: number;
  totalResults: number;
  results: SeerrSearchResult[];
}

export function useSeerrSearch(query: string, page = 1) {
  return useQuery({
    queryKey: ["seerr-search", query, page],
    queryFn: () =>
      seerrFetch<SeerrSearchResponse>(`/search?query=${encodeURIComponent(query)}&page=${page}`),
    enabled: query.length >= 2,
    staleTime: 60 * 1000,
  });
}

export function useSeerrRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: { mediaType: "movie" | "tv"; mediaId: number; seasons?: number[] }) =>
      seerrFetch("/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seerr-search"] });
    },
  });
}
