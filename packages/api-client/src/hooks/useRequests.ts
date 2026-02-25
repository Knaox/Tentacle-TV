import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

let _backendBase = "/api/requests";

export function setRequestsBackendUrl(url: string) {
  _backendBase = `${url.replace(/\/$/, "")}/api/requests`;
}

function getAuthHeader(): Record<string, string> {
  const token = typeof localStorage !== "undefined"
    ? localStorage.getItem("tentacle_token")
    : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function reqFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${_backendBase}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
      ...(init?.headers as Record<string, string>),
    },
  });
  // 409 = duplicate request — treat as success (return existing)
  if (!res.ok && res.status !== 409) {
    const msg = await res.text().catch(() => `${res.status}`);
    throw new Error(msg);
  }
  return res.json();
}

// ---------- Types ----------

export interface MediaRequest {
  id: string;
  jellyfinUserId: string;
  username: string;
  mediaType: "movie" | "tv";
  tmdbId: number;
  title: string;
  posterPath: string | null;
  status: "pending" | "submitted" | "approved" | "available" | "failed" | "declined";
  seerrRequestId: number | null;
  retryCount: number;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RequestsPage {
  results: MediaRequest[];
  total: number;
  page: number;
  totalPages: number;
}

// ---------- Hooks ----------

export function useRequestMedia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      mediaType: "movie" | "tv";
      tmdbId: number;
      title: string;
      posterPath?: string;
    }) => reqFetch<MediaRequest>("/", {
      method: "POST",
      body: JSON.stringify(body),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["media-requests"] });
    },
  });
}

export function useMyRequests(status?: string, page = 1, limit = 20) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) params.set("status", status);
  const hasToken = typeof localStorage !== "undefined" && !!localStorage.getItem("tentacle_token");

  return useQuery({
    queryKey: ["media-requests", "mine", status, page],
    queryFn: () => reqFetch<RequestsPage>(`/?${params}`),
    enabled: hasToken,
    staleTime: 30_000,
  });
}

export function useAllRequests(status?: string, page = 1, limit = 20) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) params.set("status", status);
  const hasToken = typeof localStorage !== "undefined" && !!localStorage.getItem("tentacle_token");

  return useQuery({
    queryKey: ["media-requests", "all", status, page],
    queryFn: () => reqFetch<RequestsPage>(`/all?${params}`),
    enabled: hasToken,
    staleTime: 30_000,
  });
}

export function useCancelRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => reqFetch(`/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["media-requests"] });
    },
  });
}

export function useRetryRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => reqFetch<MediaRequest>(`/${id}/retry`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["media-requests"] });
    },
  });
}
