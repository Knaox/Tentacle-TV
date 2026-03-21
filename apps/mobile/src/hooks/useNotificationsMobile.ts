import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTentacleConfig } from "@tentacle-tv/api-client";
import type { AppNotification } from "@tentacle-tv/api-client";

function useNotifFetch() {
  const { storage } = useTentacleConfig();
  const serverUrl = storage.getItem("tentacle_server_url") ?? "";
  const token = storage.getItem("tentacle_token") ?? "";

  return async <T>(path: string, init?: RequestInit): Promise<T> => {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      ...(init?.headers as Record<string, string>),
    };
    if (init?.body) headers["Content-Type"] = "application/json";
    const res = await fetch(`${serverUrl}/api/notifications${path}`, { ...init, headers });
    if (!res.ok) throw new Error(`${res.status}`);
    return res.json();
  };
}

export function useNotificationsMobile(limit = 20) {
  const fetcher = useNotifFetch();
  const { storage } = useTentacleConfig();
  const hasToken = !!storage.getItem("tentacle_token");

  return useQuery({
    queryKey: ["notifications", limit],
    queryFn: () => fetcher<AppNotification[]>(`/?limit=${limit}`),
    enabled: hasToken,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

export function useUnreadCountMobile() {
  const fetcher = useNotifFetch();
  const { storage } = useTentacleConfig();
  const hasToken = !!storage.getItem("tentacle_token");

  return useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: () => fetcher<{ count: number }>("/unread-count"),
    enabled: hasToken,
    staleTime: 10_000,
    refetchInterval: 30_000,
  });
}

export function useMarkAllReadMobile() {
  const qc = useQueryClient();
  const fetcher = useNotifFetch();

  return useMutation({
    mutationFn: () => fetcher<{ success: boolean }>("/read-all", { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["notifications"] }); },
  });
}

export function useMarkReadMobile() {
  const qc = useQueryClient();
  const fetcher = useNotifFetch();

  return useMutation({
    mutationFn: (id: string) => fetcher<{ success: boolean }>(`/${id}/read`, { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["notifications"] }); },
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

export function useDeleteNotificationMobile() {
  const qc = useQueryClient();
  const fetcher = useNotifFetch();
  return useMutation({
    mutationFn: (id: string) => fetcher<{ deleted: number }>(`/${id}`, { method: "DELETE" }),
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

export function useDeleteNotificationsMobile() {
  const qc = useQueryClient();
  const fetcher = useNotifFetch();
  return useMutation({
    mutationFn: (ids: string[]) => fetcher<{ deleted: number }>("/batch", { method: "DELETE", body: JSON.stringify({ ids }) }),
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

export function useDeleteAllNotificationsMobile() {
  const qc = useQueryClient();
  const fetcher = useNotifFetch();
  return useMutation({
    mutationFn: () => fetcher<{ deleted: number }>("/all", { method: "DELETE" }),
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
