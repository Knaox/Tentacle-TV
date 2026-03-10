import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

let _backendBase = "/api/shared-watchlists";

export function setSharedWatchlistsBackendUrl(url: string) {
  _backendBase = `${url.replace(/\/$/, "")}/api/shared-watchlists`;
}

function getAuthHeader(): Record<string, string> {
  const token = typeof localStorage !== "undefined"
    ? localStorage.getItem("tentacle_token")
    : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function swFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...getAuthHeader(),
    ...(init?.headers as Record<string, string>),
  };
  if (init?.body) headers["Content-Type"] = "application/json";
  const hasToken = !!localStorage.getItem("tentacle_token");
  const res = await fetch(`${_backendBase}${path}`, {
    ...init,
    headers,
    credentials: hasToken ? undefined : "include",
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => `${res.status}`);
    throw new Error(msg);
  }
  return res.json();
}

// ---------- Types ----------

export interface JellyfinUser {
  Id: string;
  Name: string;
}

export type ShareRole = "contributor" | "reader";

export interface SharedWatchlistSummary {
  id: string;
  name: string;
  creatorId: string;
  creatorUsername: string;
  memberCount: number;
  itemCount: number;
  myRole: "creator" | "contributor" | "reader";
}

export interface SharedWatchlistMember {
  id: string;
  watchlistId: string;
  userId: string;
  username: string;
  role: string;
  createdAt: string;
}

export interface SharedWatchlistItemData {
  id: string;
  jellyfinItemId: string;
  name: string;
  type: string;
  year?: number;
  imageTag?: string;
  addedById: string;
  addedByUsername: string;
  userData?: { played: boolean; isFavorite: boolean; likes: boolean };
  createdAt: string;
}

export interface BatchAddResult {
  added: string[];
  skipped: string[];
  forbidden: string[];
}

// ---------- Query hooks ----------

function hasAuth(): boolean {
  return typeof localStorage !== "undefined" &&
    !!(localStorage.getItem("tentacle_token") || localStorage.getItem("tentacle_user"));
}

export function useShareableUsers() {
  return useQuery({
    queryKey: ["sw", "users"],
    queryFn: () => swFetch<JellyfinUser[]>("/users"),
    enabled: hasAuth(),
    staleTime: 60_000,
  });
}

export function useMySharedWatchlists() {
  return useQuery({
    queryKey: ["sw", "lists"],
    queryFn: () => swFetch<SharedWatchlistSummary[]>("/"),
    enabled: hasAuth(),
    staleTime: 30_000,
  });
}

export function useSharedWatchlistMembers(watchlistId: string | null) {
  return useQuery({
    queryKey: ["sw", "members", watchlistId],
    queryFn: () => swFetch<SharedWatchlistMember[]>(`/${watchlistId}/members`),
    enabled: !!watchlistId,
    staleTime: 30_000,
  });
}

export function useSharedWatchlistItems(watchlistId: string | null) {
  return useQuery({
    queryKey: ["sw", "items", watchlistId],
    queryFn: () =>
      swFetch<{ items: SharedWatchlistItemData[] }>(`/${watchlistId}/items`).then(
        (r) => r.items
      ),
    enabled: !!watchlistId,
    staleTime: 30_000,
  });
}

// ---------- Mutation hooks ----------

export function useCreateSharedWatchlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string }) =>
      swFetch<SharedWatchlistSummary>("/", { method: "POST", body: JSON.stringify(data) }),
    onSettled: () => { qc.invalidateQueries({ queryKey: ["sw"] }); },
  });
}

export function useUpdateSharedWatchlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      swFetch(`/${id}`, { method: "PATCH", body: JSON.stringify({ name }) }),
    onSettled: () => { qc.invalidateQueries({ queryKey: ["sw"] }); },
  });
}

export function useDeleteSharedWatchlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      swFetch<{ success: boolean }>(`/${id}`, { method: "DELETE" }),
    onSettled: () => { qc.invalidateQueries({ queryKey: ["sw"] }); },
  });
}

export function useAddSharedWatchlistMember(watchlistId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { userId: string; username: string; role?: ShareRole }) =>
      swFetch<SharedWatchlistMember>(`/${watchlistId}/members`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSettled: () => { qc.invalidateQueries({ queryKey: ["sw"] }); },
  });
}

export function useUpdateMemberRole(watchlistId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: ShareRole }) =>
      swFetch(`/${watchlistId}/members/${memberId}`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      }),
    onSettled: () => { qc.invalidateQueries({ queryKey: ["sw"] }); },
  });
}

export function useRemoveMember(watchlistId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) =>
      swFetch<{ success: boolean }>(`/${watchlistId}/members/${memberId}`, {
        method: "DELETE",
      }),
    onSettled: () => { qc.invalidateQueries({ queryKey: ["sw"] }); },
  });
}

export function useAddSharedWatchlistItem(watchlistId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { jellyfinItemId: string }) =>
      swFetch(`/${watchlistId}/items`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSettled: () => { qc.invalidateQueries({ queryKey: ["sw", "items", watchlistId] }); },
  });
}

export function useRemoveSharedWatchlistItem(watchlistId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) =>
      swFetch<{ success: boolean }>(`/${watchlistId}/items/${itemId}`, {
        method: "DELETE",
      }),
    onSettled: () => { qc.invalidateQueries({ queryKey: ["sw", "items", watchlistId] }); },
  });
}

export function useBatchAddToSharedWatchlists() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { jellyfinItemId: string; watchlistIds: string[] }) =>
      swFetch<BatchAddResult>("/batch-add", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSettled: () => { qc.invalidateQueries({ queryKey: ["sw"] }); },
  });
}
