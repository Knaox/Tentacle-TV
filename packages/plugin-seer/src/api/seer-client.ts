import { SEER_ENDPOINTS } from "./endpoints";
import type {
  SeerrPagedResponse,
  SeerrMovieDetail,
  SeerrTvDetail,
  LocalMediaRequest,
  RequestsPageResponse,
  DiscoverCategory,
  MediaType,
} from "./types";

function getToken(): string {
  return localStorage.getItem("tentacle_token") ?? "";
}

function headers(): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getToken()}`,
  };
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { headers: headers(), ...init });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Seer API ${res.status}: ${text}`);
  }
  return res.json();
}

/* ---- Search ---- */

export async function searchMedia(query: string, page = 1): Promise<SeerrPagedResponse> {
  return fetchJson(SEER_ENDPOINTS.search(query, page));
}

/* ---- Discover ---- */

export async function discoverMedia(
  category: DiscoverCategory,
  page = 1,
): Promise<SeerrPagedResponse> {
  const urlMap: Record<DiscoverCategory, string> = {
    movies: SEER_ENDPOINTS.discoverMovies(page),
    tv: SEER_ENDPOINTS.discoverTv(page),
    anime: SEER_ENDPOINTS.discoverAnime(page),
    trending: SEER_ENDPOINTS.discoverTrending(page),
  };
  return fetchJson(urlMap[category]);
}

/* ---- Media details ---- */

export async function getMovieDetail(id: number): Promise<SeerrMovieDetail> {
  return fetchJson(SEER_ENDPOINTS.movie(id));
}

export async function getTvDetail(id: number): Promise<SeerrTvDetail> {
  return fetchJson(SEER_ENDPOINTS.tv(id));
}

/* ---- Requests (local queue) ---- */

export async function createRequest(body: {
  mediaType: MediaType;
  tmdbId: number;
  title: string;
  posterPath?: string;
  seasons?: number[];
}): Promise<LocalMediaRequest> {
  return fetchJson(SEER_ENDPOINTS.request(), {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getMyRequests(
  page = 1,
  limit = 20,
): Promise<RequestsPageResponse> {
  return fetchJson(SEER_ENDPOINTS.requests(page, limit));
}

export async function deleteRequest(id: string): Promise<void> {
  await fetch(SEER_ENDPOINTS.requestById(id), {
    method: "DELETE",
    headers: headers(),
  });
}

export async function retryRequest(id: string): Promise<LocalMediaRequest> {
  return fetchJson(SEER_ENDPOINTS.retryRequest(id), { method: "POST" });
}

/* ---- Config check ---- */

export async function testSeerConnection(): Promise<{ ok: boolean; message?: string }> {
  try {
    const res = await fetch(SEER_ENDPOINTS.testConnection(), { headers: headers() });
    if (!res.ok) return { ok: false, message: `Status ${res.status}` };
    return { ok: true };
  } catch {
    return { ok: false, message: "Connection failed" };
  }
}

export async function isSeerConfigured(): Promise<boolean> {
  try {
    const res = await fetch(SEER_ENDPOINTS.config(), { headers: headers() });
    if (!res.ok) return false;
    const data = await res.json();
    return data.enabled === true && !!data.url;
  } catch {
    return false;
  }
}
