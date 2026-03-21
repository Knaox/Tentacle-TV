import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

let _backendBase = "/api/notifications";

export function setNotificationsBackendUrl(url: string) {
  _backendBase = `${url.replace(/\/$/, "")}/api/notifications`;
}

function getAuthHeader(): Record<string, string> {
  const token = typeof localStorage !== "undefined"
    ? localStorage.getItem("tentacle_token")
    : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function notifFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...getAuthHeader(),
    ...(init?.headers as Record<string, string>),
  };
  // Only set Content-Type when there's a body (Fastify rejects empty JSON bodies with 400)
  if (init?.body) headers["Content-Type"] = "application/json";
  // Use credentials: "include" (cookies) only on web (no Bearer token in localStorage).
  // Desktop/mobile send the token via Authorization header — cookies don't work cross-origin.
  const hasToken = !!localStorage.getItem("tentacle_token");
  const res = await fetch(`${_backendBase}${path}`, { ...init, headers, credentials: hasToken ? undefined : "include" });
  if (!res.ok) {
    const msg = await res.text().catch(() => `${res.status}`);
    throw new Error(msg);
  }
  return res.json();
}

// ---------- Types ----------

export interface AppNotification {
  id: string;
  jellyfinUserId: string;
  type: "ticket_reply" | "ticket_status" | "request_status" | "watchlist_share";
  title: string;
  body: string | null;
  refId: string | null;
  read: boolean;
  createdAt: string;
}

// ---------- Hooks ----------

export function useNotifications(limit = 20) {
  const hasToken = typeof localStorage !== "undefined" && !!(localStorage.getItem("tentacle_token") || localStorage.getItem("tentacle_user"));

  return useQuery({
    queryKey: ["notifications", limit],
    queryFn: () => notifFetch<AppNotification[]>(`/?limit=${limit}`),
    enabled: hasToken,
    staleTime: 15_000,
    refetchInterval: 30_000, // Poll every 30s
  });
}

export function useUnreadCount() {
  const hasToken = typeof localStorage !== "undefined" && !!(localStorage.getItem("tentacle_token") || localStorage.getItem("tentacle_user"));

  return useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: () => notifFetch<{ count: number }>("/unread-count"),
    enabled: hasToken,
    staleTime: 10_000,
    refetchInterval: 30_000,
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => notifFetch<{ success: boolean }>("/read-all", { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notifFetch<{ success: boolean }>(`/${id}/read`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

// ---------- Delete hooks (optimistic) ----------

type NotifSnapshot = {
  lists: Array<[readonly unknown[], AppNotification[] | undefined]>;
  unread: { count: number } | undefined;
};

function snapshotNotifs(qc: ReturnType<typeof useQueryClient>): NotifSnapshot {
  const lists: NotifSnapshot["lists"] = [];
  const cache = qc.getQueriesData<AppNotification[]>({ queryKey: ["notifications"] });
  for (const [key, data] of cache) {
    if (Array.isArray(data)) lists.push([key, data]);
  }
  const unread = qc.getQueryData<{ count: number }>(["notifications", "unread-count"]);
  return { lists, unread };
}

function rollback(qc: ReturnType<typeof useQueryClient>, snap: NotifSnapshot): void {
  for (const [key, data] of snap.lists) qc.setQueryData(key, data);
  if (snap.unread) qc.setQueryData(["notifications", "unread-count"], snap.unread);
}

export function useDeleteNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      notifFetch<{ deleted: number }>(`/${id}`, { method: "DELETE" }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["notifications"] });
      const snap = snapshotNotifs(qc);
      let wasUnread = false;
      for (const [key, data] of snap.lists) {
        if (!data) continue;
        const target = data.find((n) => n.id === id);
        if (target && !target.read) wasUnread = true;
        qc.setQueryData(key, data.filter((n) => n.id !== id));
      }
      if (wasUnread && snap.unread) {
        qc.setQueryData(["notifications", "unread-count"], { count: Math.max(0, snap.unread.count - 1) });
      }
      return snap;
    },
    onError: (_err, _id, ctx) => { if (ctx) rollback(qc, ctx); },
    onSettled: () => { qc.invalidateQueries({ queryKey: ["notifications"] }); },
  });
}

export function useDeleteNotifications() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) =>
      notifFetch<{ deleted: number }>("/batch", { method: "DELETE", body: JSON.stringify({ ids }) }),
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: ["notifications"] });
      const snap = snapshotNotifs(qc);
      const idSet = new Set(ids);
      let unreadRemoved = 0;
      for (const [key, data] of snap.lists) {
        if (!data) continue;
        for (const n of data) { if (idSet.has(n.id) && !n.read) unreadRemoved++; }
        qc.setQueryData(key, data.filter((n) => !idSet.has(n.id)));
      }
      if (unreadRemoved > 0 && snap.unread) {
        qc.setQueryData(["notifications", "unread-count"], { count: Math.max(0, snap.unread.count - unreadRemoved) });
      }
      return snap;
    },
    onError: (_err, _ids, ctx) => { if (ctx) rollback(qc, ctx); },
    onSettled: () => { qc.invalidateQueries({ queryKey: ["notifications"] }); },
  });
}

export function useDeleteAllNotifications() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      notifFetch<{ deleted: number }>("/all", { method: "DELETE" }),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["notifications"] });
      const snap = snapshotNotifs(qc);
      for (const [key] of snap.lists) qc.setQueryData(key, []);
      qc.setQueryData(["notifications", "unread-count"], { count: 0 });
      return snap;
    },
    onError: (_err, _vars, ctx) => { if (ctx) rollback(qc, ctx); },
    onSettled: () => { qc.invalidateQueries({ queryKey: ["notifications"] }); },
  });
}
