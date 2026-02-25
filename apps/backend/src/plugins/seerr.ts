import type { RequestPlugin, PagedResults, RequestResult } from "./types";

const SEERR_URL = (process.env.SEERR_URL || "http://localhost:5055").replace(/\/$/, "");
const SEERR_API_KEY = process.env.SEERR_API_KEY || "";

const headers: Record<string, string> = { "X-Api-Key": SEERR_API_KEY };

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${SEERR_URL}/api/v1${path}`, {
    ...init,
    headers: { ...headers, ...(init?.headers as Record<string, string>) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw Object.assign(new Error(`Service error ${res.status}: ${text}`), { statusCode: res.status });
  }
  if (res.status === 204) return { success: true } as T;
  return res.json().catch(() => ({ success: true }) as T);
}

export class SeerrPlugin implements RequestPlugin {
  name = "Jellyseerr/Overseerr";

  async isAvailable(): Promise<boolean> {
    if (!SEERR_URL || !SEERR_API_KEY) return false;
    try {
      const res = await fetch(`${SEERR_URL}/api/v1/status`, {
        headers,
        signal: AbortSignal.timeout(3000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async search(query: string, page = 1, language = "en"): Promise<PagedResults> {
    return fetchJson(`/search?query=${encodeURIComponent(query)}&page=${page}&language=${language}`);
  }

  async discover(type: "movies" | "tv" | "anime" | "trending", page = 1, language = "en"): Promise<PagedResults> {
    if (type === "anime") {
      return fetchJson(`/discover/tv?page=${page}&language=${language}&keywords=210024`);
    }
    return fetchJson(`/discover/${type}?page=${page}&language=${language}`);
  }

  async request(body: unknown): Promise<RequestResult> {
    return fetchJson("/request", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async deleteRequest(requestId: number): Promise<void> {
    await fetchJson(`/request/${requestId}`, { method: "DELETE" });
  }

  async listRequests(params: Record<string, string>): Promise<unknown> {
    const qs = new URLSearchParams(params).toString();
    return fetchJson(`/request?${qs}`);
  }

  async getRequestCount(): Promise<Record<string, number>> {
    return fetchJson("/request/count");
  }

  async getMovie(id: number): Promise<unknown> {
    return fetchJson(`/movie/${id}`);
  }

  async getTv(id: number): Promise<unknown> {
    return fetchJson(`/tv/${id}`);
  }
}
